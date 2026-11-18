export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

/** 공고가 아직 예시 데이터일 때 true. 실제 공공 API 공고가 들어오면 .env에서 false로. */
export const SAMPLE_MODE = import.meta.env.VITE_SAMPLE_MODE !== 'false';
