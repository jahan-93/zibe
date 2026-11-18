// 공공데이터포털 "농림축산식품부 농림축산검역본부_국가동물보호정보시스템 구조동물 조회 서비스" (v2)
// https://www.data.go.kr/data/15098931/openapi.do
// v1/v2 응답 필드 이름이 조금씩 달라서 둘 다 읽도록 함. 원본은 raw에 그대로 저장.

import { speciesFromText } from './core.js';

export const API_BASE = 'https://apis.data.go.kr/1543061/abandonmentPublicService_v2/abandonmentPublic_v2';

const pick = (o, ...keys) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '') return String(o[k]).trim();
  return null;
};

const ymd = (v) => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);
const https = (u) => (u ? u.replace(/^http:\/\//, 'https://') : null);

export function mapItem(it) {
  const kindRaw = pick(it, 'kindNm', 'kindCd') || '';              // v1: "[개] 믹스견"
  const upKind = pick(it, 'upKindCd', 'upKindNm') || kindRaw;
  return {
    desertion_no: pick(it, 'desertionNo'),
    notice_no: pick(it, 'noticeNo'),
    species: speciesFromText(upKind),
    kind_name: kindRaw.replace(/^\[[^\]]+\]\s*/, ''),
    color: pick(it, 'colorCd'),
    sex: pick(it, 'sexCd'),
    age: pick(it, 'age'),
    weight: pick(it, 'weight'),
    neuter: pick(it, 'neuterYn'),
    special_mark: pick(it, 'specialMark'),
    happen_dt: ymd(pick(it, 'happenDt')),
    happen_place: pick(it, 'happenPlace', 'happenAddr'),
    notice_sdt: ymd(pick(it, 'noticeSdt')),
    notice_edt: ymd(pick(it, 'noticeEdt')),
    process_state: pick(it, 'processState'),
    photo_url: https(pick(it, 'popfile1', 'popfile', 'filename')),
    photo_url2: https(pick(it, 'popfile2')),
    care_name: pick(it, 'careNm'),
    care_tel: pick(it, 'careTel'),
    care_addr: pick(it, 'careAddr'),
    org_name: pick(it, 'orgNm'),
    raw: it,
    updated_at: new Date().toISOString(),
  };
}

function yyyymmdd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// 최근 days일 치 전국 구조 공고를 페이지 단위로 모두 받기
export async function fetchRecentNotices(serviceKey, days = 30, log = console.log) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const rows = [];
  for (let page = 1; page <= 30; page++) {
    const url = new URL(API_BASE);
    // 포털에서 받은 '인코딩' 키를 그대로 붙이면 이중 인코딩되므로 디코딩 키 기준으로 처리
    url.searchParams.set('serviceKey', decodeURIComponent(serviceKey));
    url.searchParams.set('bgnde', yyyymmdd(start));
    url.searchParams.set('endde', yyyymmdd(end));
    url.searchParams.set('pageNo', String(page));
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('_type', 'json');
    const res = await fetch(url);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new Error(`API 응답이 JSON이 아님 (키 확인 필요): ${text.slice(0, 200)}`); }
    const header = body?.response?.header;
    if (header && header.resultCode && header.resultCode !== '00') throw new Error(`API 오류 ${header.resultCode}: ${header.resultMsg}`);
    const b = body?.response?.body;
    let items = b?.items?.item ?? [];
    if (!Array.isArray(items)) items = [items];
    rows.push(...items.map(mapItem).filter((r) => r.desertion_no));
    const total = Number(b?.totalCount ?? 0);
    log(`page ${page}: ${items.length}건 (전체 ${total})`);
    if (items.length === 0 || page * 1000 >= total) break;
  }
  return rows;
}
