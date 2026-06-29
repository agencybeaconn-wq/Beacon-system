// Helpers pra chamar Supabase REST API (PostgREST).
// Lê credenciais do .env da raiz do projeto.
//
// Uso:
//   import { supaRest, fetchClient, fetchPricing, fetchBriefing } from '../../lib/supabase-rest.mjs';

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _env = null;
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
  return env;
}

function loadEnv() {
  if (_env) return _env;
  // Resolve project root (em ordem):
  //   1. LEVER_PROJECT_ROOT env var (explícito, wins)
  //   2. process.cwd() se tem .env (user rodando da raiz de outro projeto que usa essas libs via symlink)
  //   3. path relativo ao arquivo (comportamento original — Lever-System)
  const candidates = [
    process.env.LEVER_PROJECT_ROOT,
    process.cwd(),
    path.resolve(__dirname, '../..'),
  ].filter(Boolean);
  let main = {}, local = {};
  for (const root of candidates) {
    const m = loadEnvFile(path.join(root, '.env'));
    if (m.VITE_SUPABASE_URL) {
      main = m;
      local = loadEnvFile(path.join(root, '.env.local'));
      break;
    }
  }
  _env = { ...main, ...local };
  if (!_env.VITE_SUPABASE_URL) {
    throw new Error('.env não encontrado ou sem VITE_SUPABASE_URL (procurado em LEVER_PROJECT_ROOT, cwd, e raiz do Lever-System)');
  }
  return _env;
}

/**
 * Chama Supabase REST (PostgREST).
 * @param {"GET"|"POST"|"PATCH"|"DELETE"} method
 * @param {string} restPath - ex: "/agency_clients?select=id,name&id=eq.UUID"
 * @param {object} [body]
 * @param {object} [opts] - { preferReturn: "representation" | "minimal", onConflict: "col1,col2", serviceRole: true }
 * @returns {Promise<any>}
 */
export function supaRest(method, restPath, body, opts = {}) {
  const env = loadEnv();
  const url = new URL(env.VITE_SUPABASE_URL);
  // serviceRole opt-in (explícito): tenta JWT legacy → secret novo → anon
  // SUPABASE_SERVICE_ROLE_JWT: formato eyJhb... (legacy, necessário pra storage API)
  // SUPABASE_SERVICE_ROLE_KEY: pode ser o novo sb_secret_... ou o legacy JWT
  const TOKEN = opts.serviceRole
    ? (env.SUPABASE_SERVICE_ROLE_JWT || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)
    : env.VITE_SUPABASE_ANON_KEY;

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': TOKEN,
      'Authorization': `Bearer ${TOKEN}`,
    };
    if (opts.preferReturn || opts.onConflict) {
      const parts = [];
      if (opts.onConflict) parts.push('resolution=merge-duplicates');
      parts.push(`return=${opts.preferReturn || 'representation'}`);
      headers['Prefer'] = parts.join(',');
    }
    let fullPath = '/rest/v1' + restPath;
    if (opts.onConflict) {
      fullPath += (fullPath.includes('?') ? '&' : '?') + `on_conflict=${opts.onConflict}`;
    }
    const req = https.request({
      hostname: url.hostname,
      path: fullPath,
      method,
      headers,
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Supabase ${res.statusCode}: ${b.slice(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(b)); }
        catch { resolve(b); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Busca cliente por ID (UUID) ou slug/nome (fuzzy ilike).
 * @param {string} idOrName
 * @returns {Promise<object|null>}
 */
export async function fetchClient(idOrName) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName);
  const filter = isUuid
    ? `id=eq.${idOrName}`
    : `name=ilike.*${encodeURIComponent(idOrName)}*`;
  const rows = await supaRest(
    'GET',
    `/agency_clients?select=id,name,shopify_domain,shopify_access_token,shopify_status&${filter}&limit=5`,
    null,
    { serviceRole: true }
  );
  if (!rows?.length) return null;
  if (rows.length === 1) return rows[0];
  // múltiplos matches — retorna o primeiro connected, ou o primeiro
  return rows.find(r => r.shopify_status === 'connected') || rows[0];
}

/**
 * Busca todas as linhas de client_pricing de um cliente, agrupadas por section.
 * @param {string} clientId
 * @returns {Promise<{products: object, extras: object, info: object}>}
 */
export async function fetchPricing(clientId) {
  const rows = await supaRest(
    'GET',
    `/client_pricing?select=section,key,label,value,sort_order&client_id=eq.${clientId}&order=section,sort_order`,
    null,
    { serviceRole: true }
  );
  const out = { products: {}, extras: {}, info: {} };
  for (const r of (rows || [])) {
    if (out[r.section]) out[r.section][r.key] = { label: r.label, value: r.value };
  }
  return out;
}

/**
 * Salva linhas em client_pricing via upsert (on_conflict client_id,section,key).
 * @param {string} clientId
 * @param {Array<{section: string, key: string, label: string, value: string, sort_order?: number}>} entries
 * @returns {Promise<any>}
 */
export async function upsertPricing(clientId, entries) {
  const rows = entries.map(e => ({
    client_id: clientId,
    section: e.section,
    key: e.key,
    label: e.label,
    value: e.value,
    sort_order: e.sort_order ?? 0,
  }));
  return supaRest('POST', '/client_pricing', rows, {
    onConflict: 'client_id,section,key',
    preferReturn: 'representation',
  });
}

/**
 * Busca briefing do cliente.
 * @param {string} clientId
 * @returns {Promise<object|null>}
 */
export async function fetchBriefing(clientId) {
  // A tabela briefings referencia o cliente via client_group_id.
  // Retorna o registro mais recente e expande as respostas do JSONB `answers`
  // pra facilitar o consumo (campos flat no nível do objeto).
  const rows = await supaRest(
    'GET',
    `/briefings?select=*&client_group_id=eq.${clientId}&order=created_at.desc&limit=1`,
    null,
    { serviceRole: true }
  );
  const row = rows?.[0];
  if (!row) return null;
  // Se tiver `answers` JSONB, mescla no nível superior (sem sobrescrever campos existentes)
  if (row.answers && typeof row.answers === 'object') {
    return { ...row.answers, ...row };
  }
  return row;
}
