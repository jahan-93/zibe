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
  };
  try {
    const rest = loadSaved().filter((s) => s.id !== r.id);
    window.localStorage.setItem(KEY, JSON.stringify([item, ...rest].slice(0, 10)));
  } catch {
    /* 사생활 보호 모드 등에서는 저장하지 않아요 */
  }
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

export function handOffSighting(r: SightingResult) {
  lastSighting = r;
}
export function peekSighting() {
  return lastSighting;
}
