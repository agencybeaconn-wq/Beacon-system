import { db, setJobStage, appendJobLogs, heartbeat } from '../lib/db.js';
import { runOnboard } from './onboard.js';
import { sendCollabRequest, isAccessGranted } from './access.js';
import { openSession, ensureLoggedIn } from '../lib/session.js';
import { info, warn, err, drainLogs } from '../lib/log.js';
import { hostname } from 'node:os';

const WORKER_ID = `${hostname()}-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS) || 30000;
const HEARTBEAT_MS = Number(process.env.WORKER_HEARTBEAT_MS) || 30000;
const ACCESS_RECHECK_MS = Number(process.env.ACCESS_RECHECK_MS) || 10 * 60 * 1000; // 10min entre checagens de aceite

let shuttingDown = false;

export async function runWorker() {
  info('=== client-onboarder worker started ===');
  info(`  worker_id: ${WORKER_ID} | poll: ${POLL_INTERVAL_MS}ms | recheck aceite: ${ACCESS_RECHECK_MS}ms`);

  process.on('SIGINT', () => { info('SIGINT — graceful shutdown'); shuttingDown = true; });
  process.on('SIGTERM', () => { info('SIGTERM — graceful shutdown'); shuttingDown = true; });

  await heartbeat(WORKER_ID, hostname(), true);
  const hb = setInterval(() => { heartbeat(WORKER_ID, hostname(), true).catch(() => {}); }, HEARTBEAT_MS);

  while (!shuttingDown) {
    try { await processOneTick(); } catch (e: any) { err(`tick failed: ${e.message}`); }
    await sleep(POLL_INTERVAL_MS);
  }
  clearInterval(hb);
  info('worker stopped.');
}

// 1 runner (VM) → claim simples basta. Pega o próximo job elegível (pending + sem recheck pendente).
async function claimNext(): Promise<any | null> {
  const { data, error } = await db
    .from('onboarding_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) { warn(`claimNext: ${error.message}`); return null; }
  // Filtra next_check_at no código (evita o parsing do .or() do PostgREST com timestamp ISO)
  const now = Date.now();
  return (data || []).find((j: any) => !j.next_check_at || new Date(j.next_check_at).getTime() <= now) || null;
}

async function reschedule(jobId: string, ms: number) {
  await db.from('onboarding_jobs')
    .update({ next_check_at: new Date(Date.now() + ms).toISOString() })
    .eq('id', jobId);
}

async function withBrowser<T>(fn: (page: any) => Promise<T>): Promise<T> {
  const { page, close } = await openSession(); // headless via env HEADLESS
  try {
    await ensureLoggedIn(page, false);
    return await fn(page);
  } finally {
    await close();
  }
}

async function processOneTick() {
  const job = await claimNext();
  if (!job) return;
  const shop = job.shop_domain;
  drainLogs();
  info(`\n[job ${job.id}] ${job.client_name} → ${shop} (stage=${job.stage})`);

  try {
    switch (job.stage) {
      // ── Estágio 1: enviar a collaborator request no Partners ──────────────
      case 'access_requested': {
        const collabCode = job.payload?.collab_code as string | undefined;
        const r = await withBrowser((p) => sendCollabRequest(p, shop, collabCode));
        if (r === 'already') {
          info('  Já temos acesso — pulando pra onboarding');
          await setJobStage(job.id, 'access_granted');
          await db.from('onboarding_jobs').update({ status: 'pending', next_check_at: null }).eq('id', job.id);
        } else if (r === 'needs_code') {
          // Não adianta retry — depende do cliente fornecer o código. Falha com instrução clara.
          await setJobStage(job.id, 'failed');
          await db.from('onboarding_jobs').update({
            status: 'failed',
            error_message: 'Loja exige Código de colaborador. Peça ao cliente (admin: Configurações → Usuários e permissões → Segurança) e re-enfileire com payload.collab_code',
          }).eq('id', job.id);
        } else if (r === 'error') {
          throw new Error('Falha ao enviar a solicitação de acesso (ver logs/screenshot)');
        } else {
          await setJobStage(job.id, 'access_pending');
          await db.from('onboarding_jobs').update({ status: 'pending' }).eq('id', job.id);
          await reschedule(job.id, ACCESS_RECHECK_MS);
        }
        await appendJobLogs(job.id, drainLogs());
        break;
      }

      // ── Estágio 2: monitorar até o cliente aceitar ────────────────────────
      case 'access_pending': {
        const granted = await withBrowser((p) => isAccessGranted(p, shop));
        if (granted) {
          info('  Cliente aceitou — acesso concedido');
          await setJobStage(job.id, 'access_granted'); // próximo tick roda o onboard
          await db.from('onboarding_jobs').update({ status: 'pending', next_check_at: null }).eq('id', job.id);
        } else {
          info('  Ainda aguardando o cliente aceitar');
          await reschedule(job.id, ACCESS_RECHECK_MS);
        }
        await appendJobLogs(job.id, drainLogs());
        break;
      }

      // ── Estágio 3: onboard (app + distribuição + token) ───────────────────
      case 'access_granted':
      case 'onboarding': {
        await setJobStage(job.id, 'onboarding');
        await db.from('onboarding_jobs')
          .update({ status: 'running', started_at: new Date().toISOString() })
          .eq('id', job.id);
        await runOnboard({
          client: job.client_name,
          shop,
          clientType: job.payload?.client_type,
          fee: job.payload?.fee,
          commission: job.payload?.commission,
          force: job.payload?.force ?? false,
        });
        await appendJobLogs(job.id, drainLogs());
        await setJobStage(job.id, 'connected');
        await db.from('onboarding_jobs')
          .update({ status: 'succeeded', finished_at: new Date().toISOString(), result: { ok: true } })
          .eq('id', job.id);
        info(`[job ${job.id}] ✓ connected`);
        break;
      }

      default:
        warn(`[job ${job.id}] stage desconhecido: ${job.stage} — marcando failed`);
        await db.from('onboarding_jobs')
          .update({ status: 'failed', error_message: `stage desconhecido: ${job.stage}` })
          .eq('id', job.id);
    }
  } catch (e: any) {
    const msg = e.message || String(e);
    err(`[job ${job.id}] ✗ ${msg}`);
    await appendJobLogs(job.id, drainLogs());
    if (/sess(ã|a)o|expirad|login/i.test(msg)) {
      await heartbeat(WORKER_ID, hostname(), false, 'sessão Shopify expirada — rodar `npm run login`');
    }
    const willRetry = (job.attempts ?? 0) < (job.max_attempts ?? 3);
    await db.from('onboarding_jobs')
      .update({
        status: willRetry ? 'pending' : 'failed',
        attempts: (job.attempts ?? 0) + 1,
        finished_at: new Date().toISOString(),
        error_message: msg.slice(0, 2000),
      })
      .eq('id', job.id);
    if (willRetry) await reschedule(job.id, ACCESS_RECHECK_MS);
    else await setJobStage(job.id, 'failed');
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
