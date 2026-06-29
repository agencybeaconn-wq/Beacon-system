import { readFileSync } from 'node:fs';

const env = {};
for (const f of ['.env', '.env.local']) {
  try {
    const content = readFileSync(f, 'utf8').replace(/\r/g, ''); // strip CRLF
    for (const line of content.split('\n')) {
      const eq = line.indexOf('=');
      if (eq < 1 || !/^[A-Z_][A-Z0-9_]*$/.test(line.slice(0, eq))) continue;
      env[line.slice(0, eq)] = line.slice(eq + 1).replace(/^["']|["']$/g, '');
    }
  } catch {}
}

const URL = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
console.log('URL:', URL);
console.log('KEY?', KEY ? KEY.length + ' chars' : 'no');

async function query(filter) {
  const r = await fetch(`${URL}/rest/v1/agency_clients?select=id,name,shopify_domain,shopify_status&${filter}`, {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
  });
  return r.json();
}

console.log('\nSOURCE candidates (template*/testeloja):');
console.log(JSON.stringify(await query('or=(name.ilike.*template*,shopify_domain.eq.testeloja-9899.myshopify.com)'), null, 2));

console.log('\nTARGET candidates (respeita*):');
console.log(JSON.stringify(await query('or=(name.ilike.*respeita*,shopify_domain.eq.i5pr3b-q6.myshopify.com)'), null, 2));
