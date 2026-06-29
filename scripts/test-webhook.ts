/**
 * Script de teste — envia um evento real ao painel Paperclip usando
 * as credenciais do .env na raiz do projeto.
 *
 * Uso: npx tsx scripts/test-webhook.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env fica na raiz (um nível acima de /scripts)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

interface PaperclipEventPayload {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  source: string;
}

async function main(): Promise<void> {
  const url = process.env.PAPERCLIP_WEBHOOK_URL;
  const secret = process.env.PAPERCLIP_WEBHOOK_SECRET;

  if (!url || !secret) {
    console.error('Faltam PAPERCLIP_WEBHOOK_URL e/ou PAPERCLIP_WEBHOOK_SECRET no .env');
    process.exit(1);
  }

  const payload: PaperclipEventPayload = {
    title: 'Novo Cliente VIP cadastrado',
    description: 'Cliente "Acme Corp" entrou no Lever via NewClientModal (teste manual).',
    priority: 'high',
    source: 'lever.agency_clients.insert',
  };

  console.log('→ POST', url);
  console.log('  payload:', payload);

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        ...payload,
        dispatched_at: new Date().toISOString(),
      }),
    });

    const elapsed = Date.now() - started;
    const text = await res.text();
    console.log(`← ${res.status} ${res.statusText} (${elapsed}ms)`);
    if (text) console.log('  body:', text.slice(0, 1000));

    if (!res.ok) {
      process.exit(1);
    }
    console.log('OK — evento aceito pelo Paperclip.');
  } catch (err) {
    console.error('Falha de rede ao chamar Paperclip:', err);
    process.exit(1);
  }
}

main();
