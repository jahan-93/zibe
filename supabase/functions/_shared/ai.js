// 집으로 — AI 사진 비교 (Gemini)
//
// 규칙(core.js)으로 날짜·지역·종이 맞는 후보를 먼저 거른 뒤, 상위 몇 마리만
// '잃어버린 아이 사진'과 '후보 사진'을 함께 보여 주고 같은 아이일 가능성을 물어요.
// 키·모델은 app_secrets 테이블(gemini_api_key, gemini_model)에 있어요. 브라우저에서는 못 읽어요.
// AI가 실패해도 등록은 막지 않고 규칙 점수 그대로 둬요.
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const PHOTO_WEIGHT = 0.6; // 최종 점수 = 규칙 40% + 사진 60%

const PROMPT = `너는 잃어버린 반려동물을 구조 공고·목격 제보 사진과 대조하는 도우미야.
사진 A는 보호자가 올린 잃어버린 아이, 사진 B는 후보야. 두 사진이 '같은 개체'일 가능성을 0~100 정수로 판단해.

판단 원칙:
- 품종·털색이 같아서 비슷해 보이는 것만으로는 높게 주지 마. (흰 말티즈끼리는 원래 다 비슷해)
- 개체 고유 특징을 근거로 해: 얼룩·무늬의 위치와 모양, 귀 모양과 접힘, 털 길이·미용 상태, 얼굴 비율, 눈·코 색, 꼬리, 목줄·옷.
- 미용·털 상태·조명·각도 차이는 시간이 지나 달라질 수 있으니 크게 깎지 마.
- 사진이 흐리거나 얼굴이 안 보여 판단이 어려우면 50 근처로 두고 note에 그렇게 적어.
- 종이 다르거나 B에 동물이 없으면 0~5.
- same, diff는 각각 최대 3개, 한국어 15자 안팎의 짧은 구절. (예: "왼쪽 귀 갈색 얼룩", "꼬리 모양이 다름")
- note는 보호자에게 보여 줄 한 문장. 단정하지 말고 "확인해 보세요" 투로.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    same_animal: { type: 'INTEGER', description: '같은 개체일 가능성 0~100' },
    same: { type: 'ARRAY', items: { type: 'STRING' } },
    diff: { type: 'ARRAY', items: { type: 'STRING' } },
    note: { type: 'STRING' },
  },
  required: ['same_animal', 'same', 'diff', 'note'],
};

export async function loadAiConfig(db) {
  const { data } = await db.from('app_secrets').select('name, value').in('name', ['gemini_api_key', 'gemini_model']);
  const m = Object.fromEntries((data || []).map((r) => [r.name, r.value]));
  if (!m.gemini_api_key) return null;
  return { key: m.gemini_api_key, model: m.gemini_model || 'gemini-flash-latest' };
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

// { path } = 우리 Storage 사진, { url } = 공고 사진 주소
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
  return { inlineData: { mimeType: mime, data: encodeBase64(bytes) } };
}

const short = (arr, n = 3, len = 40) =>
  (Array.isArray(arr) ? arr : []).map((s) => String(s).trim().slice(0, len)).filter(Boolean).slice(0, n);

export async function comparePhotos(cfg, lostImg, candImg, { species } = {}) {
  const kind = species === 'cat' ? '고양이' : species === 'dog' ? '강아지' : '반려동물';
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${PROMPT}\n\n찾는 동물: ${kind}` },
          { text: '사진 A (잃어버린 아이):' },
          lostImg,
          { text: '사진 B (후보):' },
          candImg,
        ],
      },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
  };
  const res = await withTimeout(30000, (signal) =>
    fetch(`${API}/${cfg.model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify(body),
      signal,
    }),
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`gemini ${res.status}: ${j?.error?.message ?? ''}`.slice(0, 300));
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? '' : p.text || '')).join('');
  const out = JSON.parse(text);
  const score = Math.max(0, Math.min(100, Math.round(Number(out.same_animal) || 0)));
  return { score, same: short(out.same), diff: short(out.diff), note: String(out.note || '').slice(0, 160), model: j.modelVersion || cfg.model };
}

// matchReport가 만든 행들 중 사진이 있는 상위 maxCalls개를 AI로 다시 점수 매김 (행을 직접 고쳐요)
export async function aiRerankRows(db, report, rows, { maxCalls = 5 } = {}) {
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
