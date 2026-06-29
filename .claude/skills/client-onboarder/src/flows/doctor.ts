import { openSession, isLoggedInDevDashboard, LEVER_SYSTEM_URL } from '../lib/session.js';
import { db } from '../lib/db.js';

export async function runDoctor() {
  console.log('=== client-onboarder doctor ===\n');

  // 1. ENV check
  const envOk = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`[env] SUPABASE_SERVICE_ROLE_KEY: ${envOk ? '✓' : '✗ MISSING'}`);
  console.log(`[env] LEVER_SYSTEM_URL: ${LEVER_SYSTEM_URL}`);

  // 2. DB check
  try {
    const { count } = await db.from('agency_clients').select('*', { count: 'exact', head: true });
    console.log(`[db]  agency_clients accessible: ✓ (${count} rows)`);
  } catch (e: any) {
    console.log(`[db]  ✗ ${e.message}`);
  }

  // 3. Browser sessions
  const { page, close } = await openSession(); // headless via env HEADLESS
  try {
    const devOk = await isLoggedInDevDashboard(page);
    console.log(`[browser] Dev Dashboard logado: ${devOk ? '✓' : '✗ Run npm run login'}`);
  } finally {
    await close();
  }

  console.log('\n=== doctor done ===');
}
