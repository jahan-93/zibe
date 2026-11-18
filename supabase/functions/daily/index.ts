// 매일 아침 실행 (pg_cron이 호출): 새 공고 받기 → 찾는 중인 등록마다 새 공고와 다시 비교(규칙 → AI 사진 대조)
// 호출할 때 헤더 x-cron-secret 에 app_secrets.cron_secret 값을 넣어야 함 (DB 안에서만 보이는 값)
import { admin, json, CORS, matchReport } from '../_shared/server.js';
import { fetchRecentNotices } from '../_shared/notices_api.js';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = admin();
  const { data: sec } = await db.from('app_secrets').select('value').eq('name', 'cron_secret').maybeSingle();
  if (!sec?.value || req.headers.get('x-cron-secret') !== sec.value) return json({ error: 'unauthorized' }, 401);

  const startedAt = new Date().toISOString();
  const log: string[] = [];
  try {
    const u = new URL(req.url);
    const days = Math.min(60, Number(u.searchParams.get('days') || 30));
    const key = Deno.env.get('DATA_GO_KR_KEY');
    let synced = 0;
    if (key && u.searchParams.get('skip_sync') !== '1') {
      const rows = await fetchRecentNotices(key, days, (m: string) => log.push(m));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from('notices').upsert(rows.slice(i, i + 500), { onConflict: 'desertion_no' });
        if (error) throw error;
      }
      synced = rows.length;
    } else {
      log.push('DATA_GO_KR_KEY 없음 또는 skip_sync=1 → 공고 받기 건너뜀');
    }

    const { data: reports } = await db.from('lost_reports').select('*').eq('status', 'searching').limit(1000);
    let added = 0;
    let aiCalls = 0;
    for (const r of reports || []) {
      const since = r.last_checked_at ?? r.created_at;
      const st = await matchReport(db, r, { sinceIso: since < startedAt ? since : startedAt, keep: 5, minScore: 45, aiMax: 3 });
      added += st.added;
      aiCalls += st.ai?.tried ?? 0;
    }
    return json({ ok: true, synced, reports: (reports || []).length, new_matches: added, ai_calls: aiCalls, log });
  } catch (e) {
    console.error(e);
    return json({ error: e.message ?? String(e), log }, 500);
  }
});
