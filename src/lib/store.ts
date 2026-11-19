import type { ReportView, SightingResult, Species } from '../api';

// ── 이 기기에 남겨 두는 내 등록 목록 (편의용, 없어도 링크로 다시 볼 수 있어요) ──
export interface SavedReport {
  id: string;
  token: string;
  species: Species;
  lost_date: string;
  place: string;
  label: string;
  saved_at: string;
  is_demo?: boolean;
  demo_notice_id?: string | null;
}

const KEY = 'zibeuro:reports';

export function loadSaved(): SavedReport[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedReport[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberReport(view: ReportView, token: string) {
  const r = view.report;
  const item: SavedReport = {
    id: r.id,
    token,
    species: r.species,
    lost_date: r.lost_date,
    place: [r.sido, r.sigungu].filter(Boolean).join(' '),
    label: [r.breed, r.color].filter(Boolean).join(' · '),
    saved_at: new Date().toISOString(),
    is_demo: !!r.is_demo,
    demo_notice_id: r.demo_notice_id ?? null,
  };
  try {
    const rest = loadSaved().filter((s) => s.id !== r.id);
    window.localStorage.setItem(KEY, JSON.stringify([item, ...rest].slice(0, 10)));
  } catch {
    /* 사생활 보호 모드 등에서는 저장하지 않아요 */
  }
}

/** 이 기기에서 가장 최근에 만든 체험 등록 (목격 제보 체험이 이 등록과 비교해요) */
export function latestDemoReport(): SavedReport | null {
  return loadSaved().find((s) => s.is_demo) ?? null;
}

export function forgetReport(id: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(loadSaved().filter((s) => s.id !== id)));
  } catch {
    /* noop */
  }
}

// ── 방금 만든 결과를 다음 화면에 넘겨주는 메모리 (새로고침하면 서버에서 다시 받아요) ──
let freshReport: ReportView | null = null;
let lastSighting: SightingResult | null = null;

export function handOffReport(view: ReportView) {
  freshReport = view;
}
export function peekFreshReport(id: string): ReportView | null {
  return freshReport?.report.id === id ? freshReport : null;
}
export function clearFreshReport(id: string) {
  if (freshReport?.report.id === id) freshReport = null;
}

// 새로고침해도 '제보 고마워요' 화면이 체험/실제를 구분할 수 있게 이 탭에만 잠깐 남겨요
const SIGHTING_KEY = 'zibeuro:lastSighting';
export function handOffSighting(r: SightingResult) {
  lastSighting = r;
  try {
    window.sessionStorage.setItem(SIGHTING_KEY, JSON.stringify(r));
  } catch {
    /* noop */
  }
}
export function peekSighting(): SightingResult | null {
  if (lastSighting) return lastSighting;
  try {
    const raw = window.sessionStorage.getItem(SIGHTING_KEY);
    return raw ? (JSON.parse(raw) as SightingResult) : null;
  } catch {
    return null;
  }
}

/** 체험 제보를 이어 붙일 이 기기의 체험 등록: 같은 아이로 만든 것 */
export function demoReportFor(noticeId: string): SavedReport | null {
  return loadSaved().find((s) => s.is_demo && s.demo_notice_id === noticeId) ?? null;
}
