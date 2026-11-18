// 서버 함수 공통 코드 (Deno / Supabase Edge Functions)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { rankCandidates, sightingAsNotice, ownershipDaysLeft, isoDate, SIDO_LIST } from './core.js';
import { aiRerankRows } from './ai.js';

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
export async function matchReport(db, report, { sinceIso = null, keep = 10, minScore = 0, ai = true, aiMax = 5 } = {}) {
  const today = todayKST();
  let q = db.from('notices').select('*')
    .eq('species', report.species)
    .gte('happen_dt', addDays(report.lost_date, -1))
    .order('happen_dt', { ascending: false })
    .limit(5000);
  if (sinceIso) q = q.gte('updated_at', sinceIso);
  const { data: notices, error } = await q;
  if (error) throw error;

  let sq = db.from('sightings').select('*').eq('species', report.species).gte('seen_date', addDays(report.lost_date, -1)).limit(1000);
  if (sinceIso) sq = sq.gte('created_at', sinceIso);
  const { data: sightings } = await sq;

  const pool = [
    ...notices,
    ...(sightings || []).map((s) => ({ ...sightingAsNotice(s), _sighting: s.id, _photoPath: s.photo_path })),
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
    }))
    .filter((row) => !seen.has(pairKey(row.notice_id, row.sighting_id)));

  const aiStats = ai && rows.length ? await aiRerankRows(db, report, rows, { maxCalls: aiMax }) : { tried: 0, ok: 0, error: null };

  const keepRows = rows.filter((r) => r.score >= minScore);
  for (const { _photo, ...row } of keepRows) {
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
    },
    today,
    matches: items,
  };
}
