import { readFileSync } from 'node:fs';

const env = {};
for (const f of ['.env', '.env.local']) {
  const content = readFileSync(f, 'utf8').replace(/\r/g, '');
  for (const line of content.split('\n')) {
    const eq = line.indexOf('=');
    if (eq < 1 || !/^[A-Z_][A-Z0-9_]*$/.test(line.slice(0, eq))) continue;
    env[line.slice(0, eq)] = line.slice(eq + 1).replace(/^["']|["']$/g, '');
  }
}

const URL = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// First peek at a sample row to know schema
const s = await fetch(`${URL}/rest/v1/agency_clients?select=*&limit=1`, {
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
});
const sample = await s.json();
console.log('Sample row keys:', Object.keys(sample[0] || {}).join(', '));

// Insert Respeita
const payload = {
  name: 'Respeita Esportes',
  shopify_domain: 'i5pr3b-q6.myshopify.com',
  shopify_access_token: env.RESPEITA_ADMIN_TOKEN,
  shopify_status: 'connected',
};

console.log('\nInserting Respeita Esportes...');
const r = await fetch(`${URL}/rest/v1/agency_clients`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify(payload),
});
const result = await r.json();
console.log('Status:', r.status);
console.log('Response:', JSON.stringify(result, null, 2));
