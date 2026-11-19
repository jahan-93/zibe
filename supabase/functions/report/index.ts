// 집으로 API (화면이 부르는 함수 하나)
// POST /report                 : 실종 등록 + 바로 비교(규칙 → AI 사진 대조) → 결과
// GET  /report?id=...&token=.. : 내 등록 다시 보기 (매일 새로 찾은 후보 포함)
// POST /report?type=sighting   : 길에서 본 동물 제보 → 찾고 있는 보호자들과 바로 비교
// GET  /report?type=demo       : 체험용 예시(지금 보호소에 있는 실제 아이) 목록
//   등록·제보 body에 demo_notice_id를 넣으면 체험 모드: 사진은 서버가 그 공고에서 가져오고 is_demo로 따로 관리
import {
  admin, json, CORS, validateReport, savePhoto, savePhotoBytes, matchReport, reportView, addDays,
  listDemoCases, getDemoNotice,
} from '../_shared/server.js';
import { SIDO_LIST } from '../_shared/core.js';
import { fetchImage } from '../_shared/ai.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// 체험 공고의 사진 한 장을 받아 우리 Storage에 저장
async function saveDemoPhoto(db, folder, id, url) {
  const img = await fetchImage(db, { url });
  // photos 버킷은 JPG·PNG·WEBP, 6MB까지만 받아요
  if (!img || !['image/jpeg', 'image/png', 'image/webp'].includes(img.mime) || img.bytes.length > 6 * 1024 * 1024) {
    throw new Error('체험 사진을 불러오지 못했어요. 다른 예시를 골라 주세요.');
  }
  return savePhotoBytes(db, folder, id, img.bytes, img.mime);
}

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
  const demo = b.demo_notice_id ? await getDemoNotice(db, b.demo_notice_id) : null;
  if (demo) s.species = demo.species;
  if (!['dog', 'cat', 'etc'].includes(s.species)) throw new Error('종(개/고양이)을 골라 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.seen_date)) throw new Error('본 날짜를 입력해 주세요.');
  if (!SIDO_LIST.includes(s.sido)) throw new Error('시·도를 골라 주세요.');
  if (!demo && !b.photo) throw new Error('사진을 올려 주세요.');

  const id = crypto.randomUUID();
  // 체험 제보는 공고의 첫 번째 사진(보호소가 찍은 사진)을 '길에서 찍은 사진'처럼 써요
  const photo_path = demo ? await saveDemoPhoto(db, 'sightings', id, demo.photo_url) : await savePhoto(db, 'sightings', id, b.photo);
  const { data: row, error } = await db.from('sightings')
    .insert({ id, ...s, photo_path, is_demo: !!demo, demo_notice_id: demo?.desertion_no ?? null })
    .select('*').single();
  if (error) throw error;

  // 이 제보와 맞을 수 있는 실종 등록(같은 종, 제보일 기준 60일 안에 잃어버림)과 비교
  // 실제 제보 ↔ 실제 등록. 체험 제보 ↔ '같은 아이'로 만든 체험 등록만
  //   (이 기기의 체험 등록이 있으면 그 하나, 없으면 같은 아이의 최근 체험 등록 5건 — 남의 체험에 다른 아이가 섞이지 않게)
  const since = new Date(Date.parse(row.created_at) - 1000).toISOString();
  let rq = db.from('lost_reports').select('*')
    .eq('status', 'searching').eq('species', s.species).eq('is_demo', !!demo)
    .lte('lost_date', addDays(s.seen_date, 1)).gte('lost_date', addDays(s.seen_date, -60));
  const forReport = demo && UUID.test(String(b.for_report || '')) ? String(b.for_report) : null;
  if (demo) {
    rq = rq.eq('demo_notice_id', demo.desertion_no);
    rq = forReport ? rq.eq('id', forReport) : rq.order('created_at', { ascending: false }).limit(5);
  } else {
    rq = rq.limit(500);
  }
  const { data: reports } = await rq;

  let matched = 0;
  // 등록마다 이 제보 한 장만 사진 대조 (aiMax: 1)
  for (const rep of reports || []) matched += (await matchReport(db, rep, { sinceIso: since, keep: 3, minScore: 40, aiMax: 1 })).added;
  return { ok: true, id, compared: (reports || []).length, matched, demo: !!demo, for_report: forReport };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = admin();
  const u = new URL(req.url);
  try {
    if (req.method === 'GET') {
      if (u.searchParams.get('type') === 'demo') {
        return json({ cases: await listDemoCases(db, { include: u.searchParams.get('include') }) });
      }
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

      const demo = body.demo_notice_id ? await getDemoNotice(db, body.demo_notice_id, { mustBeProtected: true }) : null;
      const r = validateReport(demo ? { ...body, species: demo.species } : body);
      const id = crypto.randomUUID();
      const token = crypto.randomUUID().replace(/-/g, '');
      // 체험 등록은 공고의 두 번째 사진을 '보호자가 가진 사진'처럼 써요
      const photo_path = demo ? await saveDemoPhoto(db, 'reports', id, demo.photo_url2) : await savePhoto(db, 'reports', id, body.photo);
      const { data: report, error } = await db.from('lost_reports')
        .insert({ id, access_token: token, ...r, photo_path, is_demo: !!demo, demo_notice_id: demo?.desertion_no ?? null })
        .select('*').single();
      if (error) throw error;
      // 무료 AI 등급은 하루 호출 수가 적어서 등록 한 번에 사진 대조는 상위 3마리까지
      const stats = await matchReport(db, report, { keep: 10, aiMax: 3 });
      const view = await reportView(db, report);
      return json({ ...view, token, stats });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: e.message ?? String(e) }, 400);
  }
});
