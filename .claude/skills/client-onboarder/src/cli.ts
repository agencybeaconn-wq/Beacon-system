import 'dotenv/config';
import { runLogin } from './flows/login.js';
import { runDoctor } from './flows/doctor.js';
import { runOnboard, type OnboardArgs } from './flows/onboard.js';
import { runWorker } from './flows/worker.js';
import { runStatus } from './flows/status.js';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const flags = parseArgs(rest);

  switch (cmd) {
    case 'login':
      await runLogin();
      break;

    case 'doctor':
      await runDoctor();
      break;

    case 'status':
      await runStatus();
      break;

    case 'worker':
      await runWorker();
      break;

    case 'enqueue': {
      if (!flags.client || typeof flags.client !== 'string') throw new Error('--client obrigatório');
      if (!flags.shop || typeof flags.shop !== 'string') throw new Error('--shop obrigatório');
      const { db } = await import('./lib/db.js');
      const { data, error } = await db.from('onboarding_jobs').insert({
        client_name: flags.client,
        shop_domain: flags.shop,
        payload: {
          client_type: flags['client-type'] || undefined,
          fee: flags.fee ? Number(flags.fee) : undefined,
          commission: flags.commission ? Number(flags.commission) : undefined,
          collab_code: (flags['collab-code'] as string) || undefined, // código de colaborador do cliente
          force: !!flags.force,
        },
      }).select().single();
      if (error) throw error;
      console.log(`✓ Job enfileirado: ${data.id}`);
      console.log(`  Worker vai pegar no próximo poll (30s).`);
      break;
    }

    case 'onboard': {
      if (!flags.client || typeof flags.client !== 'string') throw new Error('--client obrigatório');
      if (!flags.shop || typeof flags.shop !== 'string') throw new Error('--shop obrigatório (ex: loja.myshopify.com)');
      const args: OnboardArgs = {
        client: flags.client,
        shop: flags.shop,
        clientType: (flags['client-type'] as 'fixo' | 'avulso') || undefined,
        fee: flags.fee ? Number(flags.fee) : undefined,
        commission: flags.commission ? Number(flags.commission) : undefined,
        dryRun: !!flags['dry-run'],
        onlyApp: !!flags['only-app'],
        skipApp: !!flags['skip-app'],
        clientId: (flags['client-id'] as string) || undefined,
        clientSecret: (flags['client-secret'] as string) || undefined,
        appId: (flags['app-id'] as string) || undefined,
        force: !!flags.force,
      };
      await runOnboard(args);
      break;
    }

    default:
      console.log(`Usage:
  npm run login
  npm run doctor
  npm run flow -- onboard --client "<nome>" --shop "<loja>.myshopify.com" [opts]

Opções de onboard:
  --client-type fixo|avulso     se cliente novo
  --fee 3000                    fee_fixed default
  --commission 3                commission_rate (%)
  --dry-run                     simula tudo, não salva
  --only-app                    só Dev Dashboard, para após capturar creds
  --skip-app                    pula Dev Dashboard, requer --client-id + --client-secret + --app-id
  --force                       sobrescreve se já tem token
`);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((e) => {
  console.error('\n[FATAL]', e);
  process.exit(1);
});
