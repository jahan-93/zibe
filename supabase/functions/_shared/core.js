// 집으로 — 후보 거르기 + 순위 매기기 (서버 함수와 화면 데모가 같이 쓰는 코드)
//
// 지금은 공고에 적힌 정보(종·색·품종·성별·지역·날짜·특징)로 점수를 매깁니다.
// AI 사진 비교를 붙일 때는 rankCandidates()로 거른 후보를 AI에 넘기고,
// AI가 준 점수/닮은 점/다른 점으로 덮어쓰면 됩니다(method: 'ai').

export const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도',
  '경상북도', '경상남도', '제주특별자치도',
];

// 같은 생활권이라 넘어가기 쉬운 이웃 시도
const NEIGHBORS = {
  '서울특별시': ['경기도', '인천광역시'],
  '경기도': ['서울특별시', '인천광역시', '강원특별자치도', '충청북도', '충청남도'],
  '인천광역시': ['서울특별시', '경기도'],
  '대전광역시': ['세종특별자치시', '충청남도', '충청북도'],
  '세종특별자치시': ['대전광역시', '충청남도', '충청북도'],
  '부산광역시': ['경상남도', '울산광역시'],
  '울산광역시': ['부산광역시', '경상남도', '경상북도'],
  '대구광역시': ['경상북도'],
  '광주광역시': ['전라남도'],
};

// 공고마다 '흰색', '흰', '백색', '화이트'처럼 적는 법이 달라서 묶어 둠
const COLOR_GROUPS = {
  흰색: ['흰', '하얀', '백색', '화이트', '아이보리'],
  검정: ['검', '흑', '블랙', '까만'],
  갈색: ['갈', '브라운', '초코', '밤색', '레드'],
  크림: ['크림', '베이지', '살구', '연갈'],
  회색: ['회', '그레이', '은색', '실버', '블루'],
  노랑: ['노랑', '황', '누렁', '치즈', '오렌지', '주황', '황색'],
  삼색: ['삼색', '카오스'],
  고등어: ['고등어', '태비', '줄무늬'],
  점박이: ['점박이', '얼룩', '바둑'],
};

const BREED_WORDS = [
  '믹스', '말티즈', '푸들', '포메', '시츄', '진도', '진돗', '시바', '비숑', '치와와', '요크', '닥스',
  '웰시', '코기', '리트리버', '골든', '래브라도', '보더', '슈나우저', '스피츠', '페키니즈', '불독',
  '비글', '허스키', '풍산', '삽살', '코리안숏헤어', '코숏', '페르시안', '러시안', '스코티시', '브리티시',
  '먼치킨', '샴', '랙돌', '노르웨이', '아비시니안', '벵갈', '터키시',
];

const STOP = new Set(['있음', '없음', '보호', '중', '및', '사람', '좋아함', '추정', '이상', '정도', '착용', '왼쪽', '오른쪽', '한쪽', '상태', '많음', '잘', '따름', '있는', '없는']);

export function speciesFromText(s = '') {
  if (/개|417000/.test(s)) return 'dog';
  if (/고양이|422400/.test(s)) return 'cat';
  return 'etc';
}

export function colorGroups(text = '') {
  const t = String(text);
  const out = new Set();
  for (const [g, words] of Object.entries(COLOR_GROUPS)) {
    if (t.includes(g) || words.some((w) => t.includes(w))) out.add(g);
  }
  return out;
}

function breeds(text = '') {
  const t = String(text).replace(/\s/g, '');
  return new Set(BREED_WORDS.filter((b) => t.includes(b)).map((b) => (b === '진돗' ? '진도' : b === '코숏' ? '코리안숏헤어' : b)));
}

function words(text = '') {
  return new Set(
    String(text)
      .replace(/(\S+)\s*(없음|없고|없는|없이|미착용)/gu, ' ')   // '목줄 없음' → 목줄로 세지 않기
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/(이|가|을|를|은|는|에|의|와|과|로|으로|도)$/u, ''))
      .filter((w) => w.length >= 2 && !STOP.has(w)),
  );
}

export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const s = String(v).replace(/-/g, '');
  if (!/^\d{8}$/.test(s)) return null;
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

export function dayDiff(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

export function isoDate(d) {
  return toDate(d).toISOString().slice(0, 10);
}

// 동물보호법: 공고일부터 10일이 지나도 보호자를 못 찾으면 지자체가 소유권을 가질 수 있음
export function ownershipDaysLeft(noticeSdt, today) {
  if (!noticeSdt) return null;
  return 10 - dayDiff(noticeSdt, today);
}

function regionOf(n) {
  return [n.org_name, n.care_addr, n.happen_place].filter(Boolean).join(' ');
}

function sidoMatch(text, sido) {
  if (!sido) return false;
  const short = sido.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/u, '');
  return text.includes(sido) || text.startsWith(short) || text.includes(' ' + short);
}

// 1단계: 말이 안 되는 후보 빼기 (코드)
export function isCandidate(report, n, today) {
  if (n.species !== report.species) return false;
  if (n.process_state && n.process_state.includes('종료')) return false;
  const d = dayDiff(report.lost_date, n.happen_dt);
  if (d < -1) return false;                  // 잃어버리기 전에 이미 구조된 동물
  if (dayDiff(n.happen_dt, today) < 0) return false;
  const region = regionOf(n);
  const near = [report.sido, ...(NEIGHBORS[report.sido] || [])];
  return near.some((s) => sidoMatch(region, s));
}

// 2단계: 점수 + 닮은 점 / 다른 점 (사람이 읽을 이유)
export function scoreCandidate(report, n) {
  let score = 20;
  const same = [];
  const diff = [];

  // 색
  // 색은 '색' 칸끼리만 비교 (특징 글의 '흰 양말' 같은 말에 끌려가지 않게)
  const rc = colorGroups(report.color);
  const nc = colorGroups(n.color);
  if (rc.size && nc.size) {
    const both = [...rc].filter((c) => nc.has(c));
    if (both.length) { score += 25; same.push(`털색 ${both.join('·')}`); }
    else { score -= 15; diff.push(`털색이 다름 (공고: ${n.color || '?'})`); }
  }

  // 품종
  const rb = breeds(report.breed);
  const nb = breeds(n.kind_name);
  if (rb.size && nb.size) {
    const both = [...rb].filter((b) => nb.has(b));
    if (both.length) { score += 15; same.push(`품종 ${both.join('·')}`); }
    else if (!nb.has('믹스') && !rb.has('믹스')) { score -= 10; diff.push(`품종 표기가 다름 (공고: ${n.kind_name})`); }
  }

  // 성별
  if (report.sex && report.sex !== 'Q' && n.sex && n.sex !== 'Q') {
    if (report.sex === n.sex) { score += 8; same.push(report.sex === 'M' ? '수컷' : '암컷'); }
    else { score -= 20; diff.push('성별이 다름'); }
  }

  // 지역
  const region = regionOf(n);
  if (report.sigungu && region.includes(report.sigungu)) { score += 18; same.push(`${report.sigungu}에서 구조`); }
  else if (sidoMatch(region, report.sido)) { score += 8; same.push(`같은 ${report.sido.replace(/(특별시|광역시|특별자치도|특별자치시)$/u, '')} 안에서 구조`); }
  else { diff.push('옆 시도에서 구조'); }

  // 날짜
  const d = dayDiff(report.lost_date, n.happen_dt);
  if (d <= 3) { score += 12; same.push(d <= 0 ? '잃어버린 날 구조' : `잃어버리고 ${d}일 뒤 구조`); }
  else if (d <= 10) { score += 6; same.push(`잃어버리고 ${d}일 뒤 구조`); }

  // 특징 (목줄, 옷, 무늬 등 겹치는 낱말)
  const rw = words(report.memo);
  const nw = words(n.special_mark);
  const common = [...rw].filter((w) => nw.has(w));
  if (common.length) { score += Math.min(15, common.length * 6); same.push(`특징 '${common.slice(0, 3).join(', ')}'`); }

  return { score: Math.max(0, Math.min(99, score)), same, diff };
}

// 거르기 + 점수 + 정렬. AI를 붙이면 이 결과 상위 N개를 AI에 보내 다시 정렬
export function rankCandidates(report, notices, today, limit = 5) {
  const pool = notices.filter((n) => isCandidate(report, n, today));
  const ranked = pool
    .map((n) => ({ notice: n, ...scoreCandidate(report, n) }))
    .sort((a, b) => b.score - a.score || dayDiff(b.notice.happen_dt, a.notice.happen_dt));
  return { poolSize: pool.length, total: notices.length, top: ranked.slice(0, limit), all: ranked };
}

// 목격 제보도 같은 방식으로 (공고 형식으로 바꿔서 점수 계산)
export function sightingAsNotice(s) {
  return {
    desertion_no: 'S-' + s.id,
    species: s.species,
    kind_name: '',
    color: s.color || '',
    sex: 'Q',
    special_mark: s.memo || '',
    happen_dt: s.seen_date,
    happen_place: [s.sido, s.sigungu, s.place].filter(Boolean).join(' '),
    org_name: [s.sido, s.sigungu].filter(Boolean).join(' '),
    process_state: '목격',
  };
}
