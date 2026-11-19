// Supabase Edge Function `report` 하나로 모든 화면이 움직여요.
//   POST /report                 실종 등록 + 바로 비교
//   GET  /report?id=&token=      내 등록 다시 보기 (보고 나면 '새로 올라옴' 표시가 꺼져요)
//   POST /report?type=sighting   길에서 본 아이 제보
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export type Species = 'dog' | 'cat' | 'etc';
export type Sex = 'M' | 'F' | 'Q';

export interface Match {
  kind: 'notice' | 'sighting';
  id: string;
  score: number;
  same: string[];
  diff: string[];
  method: string;
  is_new: boolean;
  is_sample?: boolean;
  photo: string | null;
  title: string | null;
  color: string | null;
  sex?: string | null;
  age?: string | null;
  weight?: string | null;
  special: string | null;
  place: string | null;
  date: string | null;
  care_name?: string | null;
  care_tel?: string | null;
  care_addr?: string | null;
  notice_no?: string | null;
  notice_sdt?: string | null;
  notice_edt?: string | null;
  days_left?: number | null;
  state?: string | null;
  /** 규칙(털색·품종·성별·장소·날짜·특징) 점수 */
  rule_score?: number | null;
  /** AI 사진 대조 점수 (method === 'ai'일 때만) */
  photo_score?: number | null;
  /** AI가 보호자에게 남긴 한 문장 */
  photo_note?: string | null;
  ai_model?: string | null;
}

export interface Report {
  id: string;
  species: Species;
  lost_date: string;
  sido: string;
  sigungu: string | null;
  sex: Sex | null;
  color: string | null;
  breed: string | null;
  memo: string | null;
  status: 'searching' | 'found' | 'closed';
  last_checked_at: string | null;
  photo: string | null;
  /** 체험용 등록 (실제 보호소 아이의 두 번째 사진으로 등록) */
  is_demo?: boolean;
  /** 체험 정답: 이 공고 속 아이가 등록 사진의 주인공 */
  demo_notice_id?: string | null;
}

/** 체험용 예시: 지금 보호소에 있는 실제 아이 */
export interface DemoCase {
  id: string;
  species: Species;
  kind_name: string | null;
  color: string | null;
  sex: Sex;
  sido: string;
  sigungu: string | null;
  /** 구조 하루 전 */
  lost_date: string;
  rescued_date: string;
  place: string | null;
  /** 보호자 사진 역할 (공고의 두 번째 사진) */
  photo_owner: string;
  /** 공고 사진 (정답) */
  photo_found: string;
}

export interface ReportView {
  report: Report;
  today: string;
  matches: Match[];
  /** POST 응답에만 있어요 */
  token?: string;
  stats?: { poolSize: number; total: number; added: number; ai?: { tried: number; ok: number; cached?: number; error: string | null } };
}

export interface NewReport {
  species: Species;
  lost_date: string;
  sido: string;
  sigungu?: string;
  sex: Sex;
  color?: string;
  breed?: string;
  memo?: string;
  /** data:image/jpeg;base64,... (체험이면 비워요) */
  photo?: string;
  /** 체험: 고른 예시 공고 번호. 사진은 서버가 그 공고에서 가져와요 */
  demo_notice_id?: string;
}

export interface NewSighting {
  species: Species;
  seen_date: string;
  sido: string;
  sigungu?: string;
  place?: string;
  color?: string;
  memo?: string;
  photo?: string;
  demo_notice_id?: string;
  /** 체험: 이 기기에서 만든 체험 등록과 비교 */
  for_report?: string;
}

export interface SightingResult {
  ok: true;
  id: string;
  /** 비교한 실종 등록 수 */
  compared: number;
  /** 닮은 아이로 알린 수 */
  matched: number;
  demo?: boolean;
  for_report?: string | null;
}

const FN = `${SUPABASE_URL}/functions/v1/report`;

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('서버 주소가 설정되지 않았어요. .env 파일을 확인해 주세요.');
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    throw new Error('인터넷 연결을 확인하고 다시 해 주세요.');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* 본문 없음 */
  }
  const err = (body as { error?: unknown } | null)?.error;
  if (!res.ok || err) {
    throw new Error(typeof err === 'string' && err ? err : `잠시 문제가 생겼어요 (${res.status}). 조금 뒤 다시 해 주세요.`);
  }
  return body as T;
}

export function createReport(input: NewReport) {
  return call<ReportView & { token: string }>(FN, { method: 'POST', body: JSON.stringify(input) });
}

export function getReport(id: string, token: string) {
  const q = new URLSearchParams({ id, token });
  return call<ReportView>(`${FN}?${q}`, { method: 'GET' });
}

/** include: ① 체험에서 고른 아이 — 예시 목록이 바뀌어도 맨 앞에 넣어 줘요 */
export function getDemoCases(include?: string | null) {
  const q = new URLSearchParams({ type: 'demo' });
  if (include) q.set('include', include);
  return call<{ cases: DemoCase[] }>(`${FN}?${q}`, { method: 'GET' });
}

export function createSighting(input: NewSighting) {
  return call<SightingResult>(`${FN}?type=sighting`, { method: 'POST', body: JSON.stringify(input) });
}
