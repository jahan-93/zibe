// 집으로 — AI 사진 비교
//
// 규칙(core.js)으로 날짜·지역·종이 맞는 후보를 먼저 거른 뒤, 상위 몇 마리만
// '잃어버린 아이 사진'과 '후보 사진'을 함께 보여 주고 같은 아이일 가능성을 물어요.
//
// 제공자는 두 가지를 지원해요 (app_secrets 테이블, 브라우저에서는 못 읽음)
//   ai_provider        'openrouter' | 'gemini'  (없으면 키가 있는 쪽)
//   openrouter_api_key / openrouter_models  (쉼표로 여러 개 → 앞 모델이 막히면 다음 모델로)
//   gemini_api_key     / gemini_model
// AI가 실패해도 등록은 막지 않고 규칙 점수 그대로 둬요.
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const PHOTO_WEIGHT = 0.6; // 최종 점수 = 규칙 40% + 사진 60%
const DEFAULT_OPENROUTER_MODELS = ['nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free'];

const PROMPT = `너는 잃어버린 반려동물을 구조 공고·목격 제보 사진과 대조하는 도우미야.
사진 A는 보호자가 올린 잃어버린 아이, 사진 B는 후보야. 두 사진이 '같은 개체'일 가능성을 0~100 정수로 판단해.

판단 원칙:
- 품종·털색이 같아서 비슷해 보이는 것만으로는 높게 주지 마. (흰 말티즈끼리는 원래 다 비슷해)
- 개체 고유 특징을 근거로 해: 얼룩·무늬의 위치와 모양, 귀 모양과 접힘, 털 길이·미용 상태, 얼굴 비율, 눈·코 색, 꼬리, 목줄·옷.
- 미용·털 상태·조명·각도 차이는 시간이 지나 달라질 수 있으니 크게 깎지 마.
- 사진이 흐리거나 얼굴이 안 보여 판단이 어려우면 50 근처로 두고 note에 그렇게 적어.
- 종이 다르거나 B에 동물이 없으면 0~5.
- same, diff는 각각 최대 3개, 한국어 15자 안팎의 짧은 구절. (예: "왼쪽 귀 갈색 얼룩", "꼬리 모양이 다름")
- note는 보호자에게 보여 줄 한국어 한 문장. 단정하지 말고 "확인해 보세요" 투로.
반드시 JSON 객체 하나로만 답해: {"same_animal": 정수, "same": [..], "diff": [..], "note": ".."}`;

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    same_animal: { type: 'integer', description: '같은 개체일 가능성 0~100' },
    same: { type: 'array', items: { type: 'string' } },
    diff: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
  required: ['same_animal', 'same', 'diff', 'note'],
  additionalProperties: false,
};

export async function loadAiConfig(db) {
  const { data } = await db.from('app_secrets').select('name, value')
    .in('name', ['ai_provider', 'openrouter_api_key', 'openrouter_models', 'gemini_api_key', 'gemini_model']);
  const m = Object.fromEntries((data || []).map((r) => [r.name, r.value]));
  const provider = m.ai_provider || (m.openrouter_api_key ? 'openrouter' : 'gemini');
  if (provider === 'openrouter' && m.openrouter_api_key) {
    const models = (m.openrouter_models || '').split(',').map((s) => s.trim()).filter(Boolean);
    return { provider, key: m.openrouter_api_key, models: models.length ? models : DEFAULT_OPENROUTER_MODELS };
  }
  if (provider === 'gemini' && m.gemini_api_key) {
    return { provider, key: m.gemini_api_key, model: m.gemini_model || 'gemini-flash-latest' };
  }
  return null;
}

async function withTimeout(ms, fn) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fn(ctl.signal);
  } finally {
    clearTimeout(t);
  }
}

// { path } = 우리 Storage 사진, { url } = 공고 사진 주소 → { mime, b64 }
export async function loadImage(db, src) {
  if (!src) return null;
  let bytes;
  let mime = 'image/jpeg';
  if (src.path) {
    const { data, error } = await db.storage.from('photos').download(src.path);
    if (error || !data) return null;
    bytes = new Uint8Array(await data.arrayBuffer());
    mime = data.type || mime;
  } else if (src.url) {
    const res = await withTimeout(8000, (signal) => fetch(src.url, { signal })).catch(() => null);
    if (!res || !res.ok) return null;
    mime = (res.headers.get('content-type') || mime).split(';')[0].trim();
    if (!mime.startsWith('image/')) return null;
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  if (!bytes || !bytes.length || bytes.length > 7 * 1024 * 1024) return null;
  return { mime, b64: encodeBase64(bytes) };
}

const short = (arr, n = 3, len = 40) =>
  (Array.isArray(arr) ? arr : []).map((s) => String(s).trim().slice(0, len)).filter(Boolean).slice(0, n);

// 모델이 ```json 으로 감싸거나 앞뒤에 말을 붙여도 JSON만 꺼내기
function parseJson(text) {
  const t = String(text || '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error(`AI 응답을 읽을 수 없어요: ${t.slice(0, 120)}`);
  }
}

function speciesWord(species) {
  return species === 'cat' ? '고양이' : species === 'dog' ? '강아지' : '반려동물';
}

async function callOpenRouter(cfg, lost, cand, species) {
  const img = (x) => ({ type: 'image_url', image_url: { url: `data:${x.mime};base64,${x.b64}` } });
  const body = {
    models: cfg.models, // 앞 모델이 막히면(429 등) OpenRouter가 다음 모델로 넘겨요
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${PROMPT}\n\n찾는 동물: ${speciesWord(species)}` },
          { type: 'text', text: '사진 A (잃어버린 아이):' },
          img(lost),
          { type: 'text', text: '사진 B (후보):' },
          img(cand),
        ],
      },
    ],
    temperature: 0.2,
    response_format: { type: 'json_schema', json_schema: { name: 'pet_compare', strict: true, schema: JSON_SCHEMA } },
  };
  const res = await withTimeout(45000, (signal) =>
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zibe.vercel.app',
        'X-Title': 'zibeuro',
      },
      body: JSON.stringify(body),
      signal,
    }),
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`openrouter ${res.status}: ${j?.error?.message ?? ''} ${j?.error?.metadata?.raw ?? ''}`.slice(0, 300));
  return { out: parseJson(j.choices?.[0]?.message?.content), model: j.model || cfg.models[0] };
}

async function callGemini(cfg, lost, cand, species) {
  const img = (x) => ({ inlineData: { mimeType: x.mime, data: x.b64 } });
  const schema = {
    type: 'OBJECT',
    properties: {
      same_animal: { type: 'INTEGER' },
      same: { type: 'ARRAY', items: { type: 'STRING' } },
      diff: { type: 'ARRAY', items: { type: 'STRING' } },
      note: { type: 'STRING' },
    },
    required: ['same_animal', 'same', 'diff', 'note'],
  };
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: `${PROMPT}\n\n찾는 동물: ${speciesWord(species)}` },
        { text: '사진 A (잃어버린 아이):' }, img(lost),
        { text: '사진 B (후보):' }, img(cand),
      ],
    }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
  };
  const res = await withTimeout(30000, (signal) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify(body),
      signal,
    }),
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`gemini ${res.status}: ${j?.error?.message ?? ''}`.slice(0, 300));
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? '' : p.text || '')).join('');
  return { out: parseJson(text), model: j.modelVersion || cfg.model };
}

export async function comparePhotos(cfg, lost, cand, { species } = {}) {
  const { out, model } = cfg.provider === 'openrouter'
    ? await callOpenRouter(cfg, lost, cand, species)
    : await callGemini(cfg, lost, cand, species);
  const score = Math.max(0, Math.min(100, Math.round(Number(out.same_animal) || 0)));
  return { score, same: short(out.same), diff: short(out.diff), note: String(out.note || '').slice(0, 160), model };
}

// matchReport가 만든 행들 중 사진이 있는 상위 maxCalls개를 AI로 다시 점수 매김 (행을 직접 고쳐요)
export async function aiRerankRows(db, report, rows, { maxCalls = 3 } = {}) {
  const stats = { tried: 0, ok: 0, error: null };
  if (!report.photo_path) return { ...stats, error: 'no report photo' };
  const targets = rows.filter((r) => r._photo).slice(0, maxCalls);
  if (!targets.length) return stats;
  const cfg = await loadAiConfig(db);
  if (!cfg) return { ...stats, error: 'no api key' };
  const lost = await loadImage(db, { path: report.photo_path });
  if (!lost) return { ...stats, error: 'report photo unreadable' };

  await Promise.all(
    targets.map(async (row) => {
      stats.tried++;
      try {
        const cand = await loadImage(db, row._photo);
        if (!cand) return;
        const r = await comparePhotos(cfg, lost, cand, { species: report.species });
        row.photo_score = r.score;
        row.photo_note = r.note;
        row.ai_model = r.model;
        row.method = 'ai';
        row.score = Math.max(0, Math.min(99, Math.round((1 - PHOTO_WEIGHT) * row.rule_score + PHOTO_WEIGHT * r.score)));
        row.same_points = [...r.same.map((s) => `사진: ${s}`), ...row.same_points];
        row.diff_points = [...r.diff.map((s) => `사진: ${s}`), ...row.diff_points];
        stats.ok++;
      } catch (e) {
        stats.error = String(e?.message ?? e);
        console.error('AI 사진 비교 실패', stats.error);
      }
    }),
  );
  return stats;
}
