// Lê SCRAPER_SUPABASE_URL e SCRAPER_SUPABASE_SERVICE_KEY do .env na raiz de tools/scraper/.
// Uso: const { SUPABASE_URL, SUPABASE_KEY } = require('../_env');

const fs = require('fs');
const path = require('path');

function readEnv(key) {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env at ${envPath}. Copy .env.example and fill values.`);
  }
  const text = fs.readFileSync(envPath, 'utf-8');
  const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
}

const SUPABASE_URL = readEnv('SCRAPER_SUPABASE_URL');
const SUPABASE_KEY = readEnv('SCRAPER_SUPABASE_SERVICE_KEY');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Set SCRAPER_SUPABASE_URL and SCRAPER_SUPABASE_SERVICE_KEY in tools/scraper/.env');
}

module.exports = { SUPABASE_URL, SUPABASE_KEY };
