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
}

export interface ReportView {
  report: Report;
  today: string;
  matches: Match[];
  /** POST 응답에만 있어요 */
  token?: string;
  stats?: { poolSize: number; total: number; added: number };
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
  /** data:image/jpeg;base64,... */
  photo?: string;
}

export interface NewSighting {
  species: Species;
  seen_date: string;
  sido: string;
  sigungu?: string;
  place?: string;
  color?: string;
  memo?: string;
  photo: string;
}

export interface SightingResult {
  ok: true;
  id: string;
  /** 비교한 실종 등록 수 */
  compared: number;
  /** 닮은 아이로 알린 수 */
  matched: number;
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

export function createSighting(input: NewSighting) {
  return call<SightingResult>(`${FN}?type=sighting`, { method: 'POST', body: JSON.stringify(input) });
}
