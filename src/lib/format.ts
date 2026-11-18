import type { Species } from '../api';

export function speciesLabel(s: Species | string | null | undefined) {
  return s === 'dog' ? '강아지' : s === 'cat' ? '고양이' : '반려동물';
}

export function sexLabel(s: string | null | undefined) {
  return s === 'M' ? '수컷' : s === 'F' ? '암컷' : null;
}

/** '2026-11-16' → '11월 16일' */
export function monthDay(iso: string | null | undefined) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[2])}월 ${Number(m[3])}일`;
}

/** ISO 시각 → '11월 18일 오전 7:05' (한국 시간) */
export function dateTimeKST(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/** 오늘 날짜 (한국 시간) 'YYYY-MM-DD' */
export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function joinDot(parts: (string | null | undefined | false)[]) {
  return parts.filter(Boolean).join(' · ');
}
