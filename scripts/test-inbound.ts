/**
 * Script de teste — invoca a Edge Function `paperclip-inbound` no Supabase
 * simulando o Paperclip. Roda `list_actions` e, opcionalmente, uma ação real.
 *
 * Uso:
 *   npx tsx scripts/test-inbound.ts                     # só list_actions
 *   npx tsx scripts/test-inbound.ts create              # cria task dummy
 *   npx tsx scripts/test-inbound.ts snapshot <uuid>     # snapshot de cliente
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PAPERCLIP_SECRET = process.env.PAPERCLIP_WEBHOOK_SECRET;

if (!SUPABASE_URL || !SUPABASE_ANON || !PAPERCLIP_SECRET) {
  console.error(
    'Variáveis necessárias no .env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, PAPERCLIP_WEBHOOK_SECRET',
  );
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/paperclip-inbound`;

interface Envelope {
  action: string;
  params: Record<string, unknown>;
  idempotency_key: string;
  actor?: string;
}

async function call(envelope: Envelope): Promise<void> {
  console.log(`\n→ POST ${FUNCTION_URL}`);
  console.log('  envelope:', JSON.stringify(envelope, null, 2));

  const started = Date.now();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Bearer usado pela Edge Function para autenticar o Paperclip
      Authorization: `Bearer ${PAPERCLIP_SECRET}`,
      // Supabase exige a apikey anon para rotear até a função (mesmo com --no-verify-jwt)
      apikey: SUPABASE_ANON as string,
    },
    body: JSON.stringify(envelope),
  });

  const elapsed = Date.now() - started;
  const text = await res.text();
  console.log(`← ${res.status} ${res.statusText} (${elapsed}ms)`);
  try {
    console.log('  body:', JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log('  body (raw):', text.slice(0, 500));
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'manifest';

  if (mode === 'manifest') {
    await call({
      action: 'list_actions',
      params: {},
      idempotency_key: `manifest_${Date.now()}`,
      actor: 'paperclip:test-script',
    });
    return;
  }

  if (mode === 'snapshot') {
    const clientId = process.argv[3];
    if (!clientId) {
      console.error('Uso: npx tsx scripts/test-inbound.ts snapshot <client_uuid>');
      process.exit(1);
    }
    await call({
      action: 'get_client_snapshot',
      params: { client_id: clientId },
      idempotency_key: `snapshot_${randomUUID()}`,
      actor: 'paperclip:test-script',
    });
    return;
  }

  if (mode === 'create') {
    const clientId = process.argv[3];
    if (!clientId) {
      console.error('Uso: npx tsx scripts/test-inbound.ts create <client_uuid>');
      process.exit(1);
    }
    await call({
      action: 'create_client_task',
      params: {
        client_id: clientId,
        title: 'Task de teste do Paperclip',
        description: 'Gerado por scripts/test-inbound.ts para validar o canal inbound.',
        priority: 'medium',
        area: 'strategy',
      },
      idempotency_key: `create_${randomUUID()}`,
      actor: 'paperclip:test-script',
    });
    return;
  }

  console.error(`Modo desconhecido: ${mode}. Use: manifest | snapshot | create`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Falha inesperada:', err);
  process.exit(1);
});
