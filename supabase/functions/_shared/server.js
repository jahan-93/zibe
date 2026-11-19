// 서버 함수 공통 코드 (Deno / Supabase Edge Functions)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { rankCandidates, sightingAsNotice, ownershipDaysLeft, isoDate, SIDO_LIST } from './core.js';
import { aiRerankRows, blendScore, fetchImage } from './ai.js';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
}

export function admin() {
  return createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export function todayKST() {
  return isoDate(new Date(Date.now() + 9 * 3600 * 1000));
}

export function addDays(iso, n) {
  return isoDate(new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000));
}

const SPECIES = ['dog', 'cat', 'etc'];
const clean = (v, max = 200) => (v == null ? null : String(v).trim().slice(0, max) || null);

export function validateReport(b) {
  const r = {
    species: b.species,
    lost_date: clean(b.lost_date, 10),
    sido: clean(b.sido, 20),
    sigungu: clean(b.sigungu, 20),
    sex: ['M', 'F', 'Q'].includes(b.sex) ? b.sex : 'Q',
    color: clean(b.color, 60),
    breed: clean(b.breed, 60),
    memo: clean(b.memo, 300),
  };
  if (!SPECIES.includes(r.species)) throw new Error('종(개/고양이)을 골라 주세요.');
  if (!r.lost_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.lost_date)) throw new Error('잃어버린 날짜를 입력해 주세요.');
  if (!SIDO_LIST.includes(r.sido)) throw new Error('시·도를 골라 주세요.');
  return r;
}

// data:image/jpeg;base64,.... → 사진 저장
export async function savePhoto(db, folder, id, dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('사진 형식은 JPG, PNG, WEBP만 돼요.');
  const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
  if (bytes.length > 6 * 1024 * 1024) throw new Error('사진이 너무 커요 (6MB 이하).');
  const path = `${folder}/${id}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`;
  const { error } = await db.storage.from('photos').upload(path, bytes, { contentType: m[1], upsert: true });
  if (error) throw error;
  return path;
}

// 서버가 받은 사진(체험용 공고 사진 등)을 그대로 저장
export async function savePhotoBytes(db, folder, id, bytes, mime) {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${id}.${ext}`;
  const { error } = await db.storage.from('photos').upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  return path;
}

// ── 체험(데모) 모드 ──────────────────────────────────────────────
// 심사·체험하는 사람은 '잃어버린 내 아이 사진'이 없으니, 지금 보호소에 있는 실제 아이의
// 두 번째 사진(photo_url2)을 보호자 사진처럼 써요. 그러면 첫 번째 사진의 실제 공고가 '정답'이 돼요.
// 체험 등록·제보는 is_demo=true로 실제 사용자 데이터와 섞이지 않아요.

// 공고의 관할(org_name, 예: '서울특별시 구로구')에서 시·도와 시·군·구 꺼내기
export function regionOfNotice(n) {
  const org = String(n.org_name || '').trim();
  const sido = SIDO_LIST.find((s) => org === s || org.startsWith(s + ' '));
  if (!sido) return null;
  const sigungu = org.slice(sido.length).trim().split(/\s+/)[0] || null;
  return { sido, sigungu };
}

const DEMO_ID = /^[0-9A-Za-z-]{5,40}$/;
const DEMO_COLS = 'desertion_no, species, kind_name, color, sex, happen_dt, happen_place, org_name, photo_url, photo_url2, process_state, is_sample';

function demoCase(n) {
  const region = regionOfNotice(n);
  if (!region) return null;
  return {
    id: n.desertion_no,
    species: n.species,
    kind_name: n.kind_name,
    color: n.color,
    sex: ['M', 'F'].includes(n.sex) ? n.sex : 'Q',
    sido: region.sido,
    sigungu: region.sigungu,
    lost_date: addDays(n.happen_dt, -1), // 구조되기 하루 전에 잃어버렸다고 가정
    rescued_date: n.happen_dt,
    place: n.happen_place,
    photo_owner: n.photo_url2, // 보호자 사진 역할
    photo_found: n.photo_url, // 공고(정답) 사진
  };
}

// 지금 보호 중이고 사진이 두 장 있는 최근 공고 중에서 서로 다른 지역으로 강아지 4 + 고양이 2
// include: ① 체험에서 고른 아이 번호 — 목록이 하루 지나 바뀌어도 ② 체험에서 같은 아이를 고를 수 있게 맨 앞에 넣어요
export async function listDemoCases(db, { include = null } = {}) {
  const first = [];
  if (include) {
    const n = await getDemoNotice(db, include).catch(() => null);
    const c = n && demoCase(n);
    if (c) first.push(c);
  }
  const today = todayKST();
  const { data, error } = await db.from('notices').select(DEMO_COLS)
    .in('species', ['dog', 'cat'])
    .like('process_state', '보호%')
    .eq('is_sample', false)
    .not('photo_url', 'is', null)
    .not('photo_url2', 'is', null)
    .gte('happen_dt', addDays(today, -10))
    .lte('happen_dt', addDays(today, -1))
    .order('happen_dt', { ascending: false })
    .order('desertion_no', { ascending: true })
    .limit(600);
  if (error) throw error;
  const metro = /^(서울특별시|경기도|인천광역시)/;
  const pool = (data || [])
    .filter((n) => n.photo_url2 !== n.photo_url)
    .map(demoCase)
    .filter(Boolean)
    .sort((a, b) => Number(metro.test(b.sido)) - Number(metro.test(a.sido))); // 수도권 먼저 (안정 정렬)
  const picked = [...first];
  const usedRegion = new Set(first.map((c) => `${c.sido} ${c.sigungu ?? ''}`));
  const usedId = new Set(first.map((c) => c.id));
  for (const [species, want] of [['dog', 4], ['cat', 2]]) {
    let n = 0;
    for (const c of pool) {
      if (n >= want) break;
      const region = `${c.sido} ${c.sigungu ?? ''}`;
      if (c.species !== species || usedRegion.has(region) || usedId.has(c.id)) continue;
      usedRegion.add(region);
      picked.push(c);
      n++;
    }
  }
  return picked;
}

// 체험에 쓸 공고 하나 확인 (화면이 보낸 번호는 믿지 않고 DB에서 다시 읽어요)
// mustBeProtected: 실종 등록 체험은 '보호중' 공고만 (종료된 공고는 후보에서 빠져서 정답을 찾을 수 없어요)
export async function getDemoNotice(db, id, { mustBeProtected = false } = {}) {
  if (!DEMO_ID.test(String(id || ''))) throw new Error('체험 예시가 올바르지 않아요.');
  const { data: n } = await db.from('notices').select(DEMO_COLS).eq('desertion_no', id).maybeSingle();
  const gone = mustBeProtected && !String(n?.process_state || '').startsWith('보호');
  if (!n || gone || n.is_sample || !['dog', 'cat'].includes(n.species) || !n.photo_url || !n.photo_url2) {
    throw new Error('이 체험 예시는 그사이 보호가 끝났거나 더 이상 쓸 수 없어요. 다른 예시를 골라 주세요.');
  }
  return n;
}

export async function signed(db, path) {
  if (!path) return null;
  const { data } = await db.storage.from('photos').createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

const pairKey = (noticeId, sightingId) => (noticeId ? `n:${noticeId}` : `s:${sightingId}`);

// 한 실종 등록을 공고 + 목격 제보와 비교해서 matches에 저장
//  1단계 규칙(core.js): 종·날짜·지역으로 거르고 털색·품종·성별·특징으로 점수
//  2단계 AI(ai.js): 사진이 있는 상위 후보만 Gemini로 사진 대조 → 최종 점수 = 규칙 40% + 사진 60%
// sinceIso를 주면 그 뒤에 새로 들어온/바뀐 공고만 비교 (매일 다시 찾기)
const NOTICE_COLS = 'desertion_no, species, kind_name, color, sex, special_mark, happen_dt, happen_place, org_name, care_addr, process_state, photo_url';
const PAGE = 1000; // PostgREST가 한 번에 돌려주는 최대 행 수
const MAX_NOTICES = 12000;

// 비교할 공고 모두 받기 (한 번에 1000건까지만 와서 나눠 받아요)
async function loadNotices(db, report, sinceIso) {
  const out = [];
  for (let from = 0; from < MAX_NOTICES; from += PAGE) {
    let q = db.from('notices').select(NOTICE_COLS)
      .eq('species', report.species)
      .gte('happen_dt', addDays(report.lost_date, -1))
      .order('happen_dt', { ascending: false })
      .order('desertion_no', { ascending: true }) // 같은 날짜끼리도 순서가 매번 같게
      .range(from, from + PAGE - 1);
    if (sinceIso) q = q.gte('updated_at', sinceIso);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function matchReport(db, report, { sinceIso = null, keep = 10, minScore = 0, ai = true, aiMax = 5 } = {}) {
  const today = todayKST();
  const notices = await loadNotices(db, report, sinceIso);

  // 실제 등록은 실제 제보끼리만. 체험 등록은 '같은 아이'를 고른 체험 제보끼리만 (다른 사람이 쓴 글이 섞이지 않게)
  let sq = db.from('sightings').select('*').eq('species', report.species).eq('is_demo', !!report.is_demo)
    .gte('seen_date', addDays(report.lost_date, -1)).limit(1000);
  if (report.is_demo) sq = sq.eq('demo_notice_id', report.demo_notice_id ?? '-');
  if (sinceIso) sq = sq.gte('created_at', sinceIso);
  const { data: sightings } = await sq;

  const pool = [
    ...notices,
    ...(sightings || []).map((s) => ({
      ...sightingAsNotice(s),
      _sighting: s.id,
      _photoPath: s.photo_path,
      _photoKey: s.demo_notice_id ? `n1:${s.demo_notice_id}` : `p:${s.photo_path}`,
    })),
  ];
  const ranked = rankCandidates(report, pool, today, keep);

  // 이미 비교한 짝은 다시 하지 않음 (AI 호출 아끼기, 새 소식만 is_new)
  const { data: old } = await db.from('matches').select('notice_id, sighting_id').eq('report_id', report.id);
  const seen = new Set((old || []).map((m) => pairKey(m.notice_id, m.sighting_id)));

  const rows = ranked.top
    .map((r) => ({
      report_id: report.id,
      notice_id: r.notice._sighting ? null : r.notice.desertion_no,
      sighting_id: r.notice._sighting ?? null,
      score: r.score,
      rule_score: r.score,
      same_points: r.same,
      diff_points: r.diff,
      method: 'rule',
      is_new: true,
      _photo: r.notice._sighting
        ? (r.notice._photoPath ? { path: r.notice._photoPath } : null)
        : (r.notice.photo_url ? { url: r.notice.photo_url } : null),
      _photoKey: r.notice._sighting ? r.notice._photoKey : (r.notice.photo_url ? `u:${r.notice.photo_url}` : null),
    }))
    .filter((row) => !seen.has(pairKey(row.notice_id, row.sighting_id)));

  // 체험 등록은 보호자 사진이 '공고의 두 번째 사진'으로 정해져 있어서 같은 짝의 AI 결과를 다시 써요
  const cachePrefix = report.demo_notice_id ? `n2:${report.demo_notice_id}` : null;
  const aiStats = ai && rows.length
    ? await aiRerankRows(db, report, rows, { maxCalls: aiMax, cachePrefix })
    : { tried: 0, ok: 0, cached: 0, error: null };

  // 사진 비교를 못 한 후보도 같은 잣대(사진 점수 중간값)로 맞춰서, AI가 확인한 후보가 확인 안 한 후보 밑으로 밀리지 않게
  for (const row of rows) if (row.method !== 'ai') row.score = blendScore(row.rule_score);
  // 기준 점수: AI가 본 후보는 종합 점수로(다른 아이로 판단되면 빠져요), 못 본 후보는 정보 점수로
  const keepRows = rows.filter((r) => (r.method === 'ai' ? r.score : r.rule_score) >= minScore);
  for (const { _photo, _photoKey, ...row } of keepRows) {
    await db.from('matches').upsert(row, { onConflict: row.notice_id ? 'report_id,notice_id' : 'report_id,sighting_id', ignoreDuplicates: true });
  }
  await db.from('lost_reports').update({ last_checked_at: new Date().toISOString() }).eq('id', report.id);
  return { poolSize: ranked.poolSize, total: ranked.total, added: keepRows.length, ai: aiStats };
}

// 화면에 보낼 형태로 묶기
export async function reportView(db, report, { markSeen = false } = {}) {
  const today = todayKST();
  const { data: ms, error } = await db.from('matches')
    .select('*, notice:notices(*), sighting:sightings(*)')
    .eq('report_id', report.id)
    .order('score', { ascending: false })
    .limit(20);
  if (error) throw error;

  const items = [];
  for (const m of ms) {
    const ai = { rule_score: m.rule_score, photo_score: m.photo_score, photo_note: m.photo_note, ai_model: m.ai_model };
    if (m.notice) {
      const n = m.notice;
      items.push({
        kind: 'notice', id: n.desertion_no, score: m.score, same: m.same_points, diff: m.diff_points,
        method: m.method, is_new: m.is_new, is_sample: n.is_sample, ...ai,
        photo: n.photo_url, title: n.kind_name, color: n.color, sex: n.sex, age: n.age, weight: n.weight,
        special: n.special_mark, place: n.happen_place, date: n.happen_dt,
        care_name: n.care_name, care_tel: n.care_tel, care_addr: n.care_addr,
        notice_no: n.notice_no, notice_sdt: n.notice_sdt, notice_edt: n.notice_edt,
        days_left: ownershipDaysLeft(n.notice_sdt, today), state: n.process_state,
      });
    } else if (m.sighting) {
      const s = m.sighting;
      items.push({
        kind: 'sighting', id: s.id, score: m.score, same: m.same_points, diff: m.diff_points,
        method: m.method, is_new: m.is_new, ...ai, photo: await signed(db, s.photo_path),
        title: '목격 제보', color: s.color, special: s.memo,
        place: [s.sido, s.sigungu, s.place].filter(Boolean).join(' '), date: s.seen_date,
      });
    }
  }
  if (markSeen) await db.from('matches').update({ is_new: false }).eq('report_id', report.id).eq('is_new', true);

  return {
    report: {
      id: report.id, species: report.species, lost_date: report.lost_date, sido: report.sido, sigungu: report.sigungu,
      sex: report.sex, color: report.color, breed: report.breed, memo: report.memo, status: report.status,
      last_checked_at: report.last_checked_at, photo: await signed(db, report.photo_path),
      is_demo: !!report.is_demo, demo_notice_id: report.demo_notice_id ?? null,
    },
    today,
    matches: items,
  };
}
