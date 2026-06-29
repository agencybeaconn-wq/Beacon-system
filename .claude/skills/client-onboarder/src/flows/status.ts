// Status da fila + runners — pro Pedro orquestrar via Claude Code (sem precisar de UI).
import { db } from '../lib/db.js';

export async function runStatus() {
  console.log('=== client-onboarder status ===\n');

  const { data: jobs, error } = await db
    .from('onboarding_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.log(`[jobs] erro: ${error.message}`);
  } else if (!jobs?.length) {
    console.log('[jobs] fila vazia');
  } else {
    // Resumo por estágio (cai pra status se a migration de stages ainda não rodou)
    const counts: Record<string, number> = {};
    for (const j of jobs as any[]) {
      const key = j.stage || j.status || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    console.log('[jobs] resumo:', JSON.stringify(counts));
    console.log('\n[jobs] últimos 15:');
    for (const j of (jobs as any[]).slice(0, 15)) {
      const st = j.stage || j.status;
      const errStr = j.error_message ? `  ⚠ ${String(j.error_message).slice(0, 60)}` : '';
      console.log(`  • ${j.client_name} (${j.shop_domain}) — ${st}${errStr}`);
    }
  }

  // Saúde dos runners (tabela só existe após a migration da Fase 1)
  const { data: runners, error: rErr } = await db.from('onboarding_runners').select('*');
  if (!rErr && runners?.length) {
    console.log('\n[runners]');
    for (const r of runners as any[]) {
      console.log(`  • ${r.runner_id} — último beat ${r.last_heartbeat_at} — session_ok=${r.session_ok}${r.note ? ` (${r.note})` : ''}`);
    }
  }

  console.log('\n=== status done ===');
}
