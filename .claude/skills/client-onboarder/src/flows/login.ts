import { openSession, ensureLoggedIn, saveStorageState } from '../lib/session.js';

export async function runLogin() {
  const { context, page, close } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, true);
    await saveStorageState(context);
    console.log('\n✓ Login OK no Dev Dashboard.');
    console.log('  Sessão salva em storage-state.json (JSON portável cross-OS). Dura ~14d.');
    console.log('  Pra renovar o runner: suba esse arquivo no bucket (PROFILE_SEED_URL).');
  } finally {
    await close();
  }
}
