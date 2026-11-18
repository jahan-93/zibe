// 집으로 API (화면이 부르는 함수 하나)
// POST /report                 : 실종 등록 + 바로 비교(규칙 → AI 사진 대조) → 결과
// GET  /report?id=...&token=.. : 내 등록 다시 보기 (매일 새로 찾은 후보 포함)
// POST /report?type=sighting   : 길에서 본 동물 제보 → 찾고 있는 보호자들과 바로 비교
import { admin, json, CORS, validateReport, savePhoto, matchReport, reportView, addDays } from '../_shared/server.js';
import { SIDO_LIST } from '../_shared/core.js';

async function createSighting(db, b) {
  const s = {
    species: b.species,
    seen_date: String(b.seen_date || '').slice(0, 10),
    sido: b.sido,
    sigungu: b.sigungu ? String(b.sigungu).slice(0, 20) : null,
    place: b.place ? String(b.place).slice(0, 100) : null,
    color: b.color ? String(b.color).slice(0, 60) : null,
    memo: b.memo ? String(b.memo).slice(0, 300) : null,
  };
  if (!['dog', 'cat', 'etc'].includes(s.species)) throw new Error('종(개/고양이)을 골라 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.seen_date)) throw new Error('본 날짜를 입력해 주세요.');
  if (!SIDO_LIST.includes(s.sido)) throw new Error('시·도를 골라 주세요.');
  if (!b.photo) throw new Error('사진을 올려 주세요.');
  const id = crypto.randomUUID();
  const photo_path = await savePhoto(db, 'sightings', id, b.photo);
  const { data: row, error } = await db.from('sightings').insert({ id, ...s, photo_path }).select('*').single();
  if (error) throw error;

  // 이 제보와 맞을 수 있는 실종 등록(같은 종, 제보일 기준 60일 안에 잃어버림)과 비교
  const since = new Date(Date.parse(row.created_at) - 1000).toISOString();
  const { data: reports } = await db.from('lost_reports').select('*')
    .eq('status', 'searching').eq('species', s.species)
    .lte('lost_date', addDays(s.seen_date, 1)).gte('lost_date', addDays(s.seen_date, -60)).limit(500);
  let matched = 0;
  // 등록마다 이 제보 한 장만 사진 대조 (aiMax: 1). 규칙 점수가 높은 등록부터 순서대로.
  for (const rep of reports || []) matched += (await matchReport(db, rep, { sinceIso: since, keep: 3, minScore: 40, aiMax: 1 })).added;
  return { ok: true, id, compared: (reports || []).length, matched };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = admin();
  const u = new URL(req.url);
  try {
    if (req.method === 'GET') {
      const id = u.searchParams.get('id');
      const token = u.searchParams.get('token');
      if (!id || !token) return json({ error: '링크가 올바르지 않아요.' }, 400);
      const { data: report } = await db.from('lost_reports').select('*').eq('id', id).maybeSingle();
      if (!report || report.access_token !== token) return json({ error: '등록을 찾을 수 없어요.' }, 404);
      return json(await reportView(db, report, { markSeen: true }));
    }

    if (req.method === 'POST') {
      const body = await req.json();
      if (u.searchParams.get('type') === 'sighting') return json(await createSighting(db, body));

      const r = validateReport(body);
      const id = crypto.randomUUID();
      const token = crypto.randomUUID().replace(/-/g, '');
      const photo_path = await savePhoto(db, 'reports', id, body.photo);
      const { data: report, error } = await db.from('lost_reports')
        .insert({ id, access_token: token, ...r, photo_path })
        .select('*').single();
      if (error) throw error;
      const stats = await matchReport(db, report, { keep: 10, aiMax: 5 });
      const view = await reportView(db, report);
      return json({ ...view, token, stats });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: e.message ?? String(e) }, 400);
  }
});
