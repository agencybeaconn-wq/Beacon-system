import { openSession, ensureLoggedIn } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';
import { selectors } from '../lib/selectors.ts';

function parseArgs(args: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) out[a.slice(2)] = args[i + 1] ?? '';
  }
  return out;
}

export async function run(args: string[]) {
  const a = parseArgs(args);
  const { flow, step, subject, preview, fromName } = a;
  if (!flow || !step) throw new Error('Uso: edit-email --flow "X" --step 2 [--subject "..."] [--preview "..."] [--fromName "..."]');

  const log = new RunLogger(`edit-email_${flow.replace(/\W+/g, '-')}_${step}`);
  const { context, page } = await openSession({ headless: false });

  try {
    await ensureLoggedIn(page, false);
    log.info(`STUB — abrir flow="${flow}" step=${step} e editar email`);
    log.info('Este flow requer seletores validados ao vivo. Rode `doctor` antes.');
    log.info(`Alvos: subject=${subject ?? '(skip)'} preview=${preview ?? '(skip)'} fromName=${fromName ?? '(skip)'}`);

    // TODO ao vivo:
    //  1. navegar pro flow pela nav/busca
    //  2. clicar no step N
    //  3. abrir edição do email
    //  4. preencher subject/preview/fromName se vieram nos args
    //  5. SAVE (não publicar — só salvar draft)
    //  6. screenshot antes e depois
    //
    // Selectors esperados em selectors.emailEditor.*

    await log.snap(page, 'current-state');
  } finally {
    await context.close();
  }
}
