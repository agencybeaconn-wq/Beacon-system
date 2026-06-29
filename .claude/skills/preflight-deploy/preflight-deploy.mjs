#!/usr/bin/env node
// preflight-deploy — valida pré-requisitos antes de deploy-complete.
// Read-only — não executa deploy, só reporta pendências.
//
// Uso:
//   node preflight-deploy.mjs "<cliente>"           # Single
//   node preflight-deploy.mjs --batch=pending       # Todos pending
//   node preflight-deploy.mjs "<cliente>" --json    # Saída JSON

import { shReq, API_VERSION } from '../../lib/shopify-api.mjs';
import { supaRest } from '../../lib/supabase-rest.mjs';

const MIN_BRIEFING_FIELDS = ['contato_email', 'contato_telefone', 'marca_nome'];

function parseArgs() {
  const args = { _: [], batch: null, locale: null, json: false, sourceClient: null, cloneMode: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--json') args.json = true;
    else if (a.startsWith('--batch=')) args.batch = a.slice(8);
    else if (a.startsWith('--locale=')) args.locale = a.slice(9);
    else if (a.startsWith('--source-client=')) { args.sourceClient = a.slice(16); args.cloneMode = true; }
    else if (a === '--clone-mode') args.cloneMode = true;
    else args._.push(a);
  }
  return args;
}

function detectLocale(shop) {
  return /-en\.|en\.myshopify|desenvolvimento-en/i.test(shop || '') ? 'en' : 'br';
}

async function checkClient(client, opts = {}) {
  const pending = [];
  const result = {
    id: client.id,
    name: client.name,
    shop: client.shopify_domain,
    status: client.shopify_status,
    verdict: null,
    pending,
    checks: {},
  };

  // 1. Connected + tem token
  if (client.shopify_status !== 'connected') {
    pending.push({ code: 'NOT_CONNECTED', fix: 'Conectar loja via OAuth no admin do Lever System' });
    result.checks.connected = false;
    result.verdict = 'NOT_CONNECTED';
    return result;
  }
  result.checks.connected = true;

  if (!client.shopify_access_token) {
    pending.push({ code: 'NO_TOKEN', fix: 'Re-autorizar app Shopify (token ausente)' });
    result.checks.hasToken = false;
    result.verdict = 'NO_TOKEN';
    return result;
  }
  result.checks.hasToken = true;

  // 2. Token válido — ping /shop.json
  try {
    const r = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
      `/admin/api/${API_VERSION}/shop.json`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    result.checks.tokenValid = true;
    result.primary_domain = r.body.shop.domain;
    result.primary_locale = r.body.shop.primary_locale;
  } catch (e) {
    pending.push({ code: 'INVALID_TOKEN', fix: `Re-autorizar app (${e.message})` });
    result.checks.tokenValid = false;
    result.verdict = 'INVALID_TOKEN';
    return result;
  }

  // 2b. Scopes do token — verifica se tem write_publications (necessário pra publicar produtos no Online Store)
  // Ver memory feedback_active_vs_published: token sem esse scope deixa produtos ACTIVE mas unpublished
  try {
    const r = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
      `/admin/oauth/access_scopes.json`);
    if (r.status === 200) {
      const scopes = (r.body.access_scopes || []).map(s => s.handle);
      result.checks.scopes = scopes;
      const required = ['write_products', 'write_publications'];
      const missing = required.filter(s => !scopes.includes(s));
      if (missing.length > 0) {
        pending.push({
          code: 'MISSING_SCOPES',
          fix: `Token falta scope(s): ${missing.join(', ')}. Re-autorizar app — sem write_publications produtos ficam ACTIVE mas invisíveis na storefront.`,
          missing,
        });
        result.checks.scopesValid = false;
      } else {
        result.checks.scopesValid = true;
      }
    } else {
      // /access_scopes.json indisponível em alguns tipos de token; não bloqueia
      result.checks.scopesValid = null;
    }
  } catch (e) {
    result.checks.scopesValid = null;
  }

  // 3. Briefing — em clone-mode é opcional (clone mantém textos da origem)
  try {
    const briefs = await supaRest('GET',
      `/briefings?select=id,client_name,answers,status&client_name=ilike.*${encodeURIComponent(client.name)}*`,
      null, { serviceRole: true });
    if (!briefs.length) {
      if (!opts.cloneMode) {
        pending.push({ code: 'NO_BRIEFING', fix: 'Criar briefing na UI admin com nome casando com client.name' });
      }
      result.checks.hasBriefing = false;
    } else {
      const brief = briefs[0];
      result.briefing_id = brief.id;
      result.checks.hasBriefing = true;
      const answers = brief.answers || {};
      const missing = MIN_BRIEFING_FIELDS.filter(f => !answers[f]);
      if (missing.length) {
        if (!opts.cloneMode) {
          pending.push({ code: 'INCOMPLETE_BRIEFING', fix: `Preencher em briefing: ${missing.join(', ')}` });
        }
        result.checks.briefingComplete = false;
      } else {
        result.checks.briefingComplete = true;
      }
    }
  } catch (e) {
    pending.push({ code: 'BRIEFING_ERROR', fix: `Erro consultando briefings: ${e.message}` });
  }

  // 4. Pricing — em clone-mode é opcional (clone herda preços da origem)
  try {
    const pricing = await supaRest('GET',
      `/client_pricing?select=id&client_id=eq.${client.id}&limit=1`, null, { serviceRole: true });
    if (!pricing.length) {
      if (!opts.cloneMode) {
        pending.push({ code: 'NO_PRICING', fix: 'Importar client_pricing via skill update-prices' });
      }
      result.checks.hasPricing = false;
    } else {
      result.checks.hasPricing = true;
    }
  } catch (e) {
    pending.push({ code: 'PRICING_ERROR', fix: `Erro consultando client_pricing: ${e.message}` });
  }

  // 5. Locale + source
  const locale = (result.primary_locale || '').startsWith('en') ? 'en' : 'br';
  result.locale = locale;
  if (opts.sourceClient) {
    const srcRows = await supaRest('GET',
      `/agency_clients?select=id,name,shopify_domain,shopify_status&name=eq.${encodeURIComponent(opts.sourceClient)}&limit=1`,
      null, { serviceRole: true });
    if (!srcRows.length) {
      pending.push({ code: 'SOURCE_NOT_FOUND', fix: `Source "${opts.sourceClient}" não existe em agency_clients` });
    } else if (srcRows[0].shopify_status !== 'connected') {
      pending.push({ code: 'SOURCE_NOT_CONNECTED', fix: `Source "${opts.sourceClient}" está ${srcRows[0].shopify_status} — precisa estar connected` });
    } else {
      result.source_client = srcRows[0].name;
      result.source_client_id = srcRows[0].id;
      result.source_shop = srcRows[0].shopify_domain;
      result.source_template = srcRows[0].name;
    }
  } else {
    const sourceTemplateName = locale === 'en' ? 'Loja de Desenvolvimento - EN' : 'Loja de Desenvolvimento - BR';
    result.source_template = sourceTemplateName;
  }

  // Resumo do verdict
  if (pending.length === 0) {
    result.verdict = 'READY';
  } else if (pending.length === 1) {
    result.verdict = pending[0].code;
  } else {
    result.verdict = 'MULTIPLE_BLOCKS';
  }
  return result;
}

async function main() {
  const args = parseArgs();
  let targets = [];

  if (args.batch) {
    const rows = await supaRest('GET',
      `/agency_clients?select=id,name,shopify_domain,shopify_access_token,shopify_status&shopify_status=eq.${args.batch}&order=name`,
      null, { serviceRole: true });
    targets = rows;
  } else if (args._[0]) {
    const name = args._[0];
    const rows = await supaRest('GET',
      `/agency_clients?select=id,name,shopify_domain,shopify_access_token,shopify_status&name=ilike.*${encodeURIComponent(name)}*&limit=5`,
      null, { serviceRole: true });
    if (rows.length === 0) {
      console.error(`❌ Nenhum cliente casa com "${name}"`);
      process.exit(1);
    }
    if (rows.length > 1) {
      console.error(`⚠ Múltiplos matches pra "${name}":`);
      rows.forEach(r => console.error(`  - ${r.name} (${r.shopify_domain || 'sem loja'})`));
      console.error('Seja mais específico.');
      process.exit(1);
    }
    targets = rows;
  } else {
    console.error('Uso: node preflight-deploy.mjs "<cliente>" | --batch=pending|disconnected|connected');
    process.exit(1);
  }

  const results = [];
  const checkOpts = { cloneMode: args.cloneMode, sourceClient: args.sourceClient };
  for (const c of targets) {
    results.push(await checkClient(c, checkOpts));
  }

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Report human-readable
  console.log(`\n=== preflight-deploy — ${results.length} cliente(s) ===\n`);
  for (const r of results) {
    const icon = r.verdict === 'READY' ? '✓' : '✗';
    console.log(`${icon} ${r.name} [${r.verdict}]`);
    console.log(`  shop: ${r.shop || '(sem domínio)'} | status: ${r.status}`);
    if (r.primary_domain) console.log(`  primary: ${r.primary_domain} | locale: ${r.locale}`);
    if (r.briefing_id) console.log(`  briefing: ${r.briefing_id}`);
    if (r.source_template) console.log(`  source: ${r.source_template}`);
    if (r.pending.length) {
      console.log(`  Pendências:`);
      for (const p of r.pending) console.log(`    • [${p.code}] ${p.fix}`);
    }
    console.log();
  }

  const ready = results.filter(r => r.verdict === 'READY').length;
  console.log(`--- Resumo: ${ready}/${results.length} prontos pra deploy-complete ---`);
  if (ready > 0) {
    console.log(`\nPra deploy:`);
    results.filter(r => r.verdict === 'READY').forEach(r => {
      console.log(`  node .claude/skills/deploy-complete/deploy-complete.mjs "${r.name}"`);
    });
  }
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
