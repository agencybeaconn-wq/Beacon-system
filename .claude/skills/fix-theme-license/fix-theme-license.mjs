#!/usr/bin/env node
// fix-theme-license — diagnostica e corrige divergência de licença Lever.
//
// Problema: Shopify compiled cache do snippet lever-protection.liquid não invalida
// por API. Solução: update no Supabase pra casar com o HTML renderizado.
//
// Uso:
//   node fix-theme-license.mjs "<cliente>"             # DRY-RUN
//   node fix-theme-license.mjs "<cliente>" --apply     # Aplica fix
//   node fix-theme-license.mjs "<cliente>" --try-republish --apply

import https from 'https';
import { shReq, API_VERSION } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';
import { supaRest } from '../../lib/supabase-rest.mjs';

const LEVER_SITE_HOST = 'ykctllrqygchllhxnkjh.supabase.co';
const LEVER_SITE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrY3RsbHJxeWdjaGxsaHhua2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTU0NTIsImV4cCI6MjA4NTYzMTQ1Mn0.7xXWKBWVie2Hrwtuvavey73ys1NjNxSAcRE2JktJBw0';

function parseArgs() {
  const args = { _: [], apply: false, tryRepublish: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--try-republish') args.tryRepublish = true;
    else args._.push(a);
  }
  return args;
}

function leverSiteReq(method, path, body, serviceKey) {
  return new Promise((resolve) => {
    const key = serviceKey || LEVER_SITE_ANON;
    const payload = body ? JSON.stringify(body) : null;
    const rq = https.request({
      hostname: LEVER_SITE_HOST,
      path: '/rest/v1' + path,
      method,
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    }, (res) => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    if (payload) rq.write(payload);
    rq.end();
  });
}

function fetchStorefront(domain) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: domain,
      path: '/?fix-theme-license=' + Date.now(),
      headers: { 'User-Agent': 'Mozilla/5.0 fix-theme-license-skill' },
    }, (res) => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    }).on('error', reject);
  });
}

function extractFromHtml(html) {
  const licMatch = html.match(/const licenseKey = "([^"]*)"/);
  const shopMatch = html.match(/const currentShop = '([^']*)'/);
  return {
    licenseKey: licMatch ? licMatch[1] : null,
    currentShop: shopMatch ? shopMatch[1] : null,
  };
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node fix-theme-license.mjs "<cliente>" [--apply] [--try-republish]');
    process.exit(1);
  }

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`\n=== fix-theme-license ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Cliente: ${client.name} (${client.shopify_domain})`);

  const report = {
    client: client.name,
    permanent_domain: client.shopify_domain,
    html: {},
    theme: {},
    supabase: {},
    verdict: null,
    action: null,
  };

  // 1. Pega o permanent_domain via /shop.json (pode diferir se config custom)
  const shopInfo = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
    `/admin/api/${API_VERSION}/shop.json`);
  report.primary_domain = shopInfo.body.shop.domain;
  report.myshopify_domain = shopInfo.body.shop.myshopify_domain;
  console.log(`\nDomínios:`);
  console.log(`  myshopify:  ${report.myshopify_domain}`);
  console.log(`  primary:    ${report.primary_domain}`);

  // 2. Busca tema main + settings_data.json
  const themes = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
    `/admin/api/${API_VERSION}/themes.json`);
  const mainTheme = themes.body.themes.find(t => t.role === 'main');
  report.theme.id = mainTheme.id;
  report.theme.name = mainTheme.name;
  const settings = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
    `/admin/api/${API_VERSION}/themes/${mainTheme.id}/assets.json?asset[key]=config/settings_data.json`);
  const settingsJson = JSON.parse(settings.body.asset.value);
  report.theme.licenseKey = settingsJson.current?.lever_license_key || null;
  console.log(`\nTema publicado: "${mainTheme.name}" (id=${mainTheme.id})`);
  console.log(`  settings_data.json: lever_license_key = ${JSON.stringify(report.theme.licenseKey)}`);

  // 3. Fetch storefront HTML
  const html = await fetchStorefront(report.primary_domain);
  const extracted = extractFromHtml(html.body);
  report.html.licenseKey = extracted.licenseKey;
  report.html.currentShop = extracted.currentShop;
  console.log(`\nStorefront HTML (${report.primary_domain}):`);
  console.log(`  licenseKey  = ${JSON.stringify(report.html.licenseKey)}`);
  console.log(`  currentShop = ${JSON.stringify(report.html.currentShop)}`);

  // 4. Fetch Supabase license registry
  const supaQuery = await leverSiteReq('GET',
    `/licenses?shop_url=eq.${encodeURIComponent(report.myshopify_domain)}&select=id,license_key,shop_url,status,client_name`);
  const supaRows = Array.isArray(supaQuery.body) ? supaQuery.body : [];
  report.supabase.rows = supaRows;
  console.log(`\nSupabase externo (licenses):`);
  if (supaRows.length === 0) {
    console.log(`  (nenhum registro pra shop_url=${report.myshopify_domain})`);
    report.supabase.licenseKey = null;
    report.supabase.id = null;
  } else {
    for (const r of supaRows) {
      console.log(`  id=${r.id} key=${JSON.stringify(r.license_key)} status=${r.status} client=${JSON.stringify(r.client_name)}`);
    }
    report.supabase.licenseKey = supaRows[0].license_key;
    report.supabase.id = supaRows[0].id;
    report.supabase.status = supaRows[0].status;
  }

  // 5. Diagnóstico
  const htmlKey = report.html.licenseKey;
  const themeKey = report.theme.licenseKey;
  const supaKey = report.supabase.licenseKey;
  console.log(`\n=== DIAGNÓSTICO ===`);
  console.log(`  HTML      → ${JSON.stringify(htmlKey)}`);
  console.log(`  Theme     → ${JSON.stringify(themeKey)}`);
  console.log(`  Supabase  → ${JSON.stringify(supaKey)}`);

  const htmlCasaSupa = htmlKey === supaKey;
  const htmlCasaTheme = htmlKey === themeKey;
  const themeCasaSupa = themeKey === supaKey;

  if (htmlCasaSupa && htmlCasaTheme) {
    report.verdict = 'OK';
    report.action = 'none';
    console.log(`\n✓ Todas as fontes casam. Loja operando normalmente.`);
    return;
  }

  if (htmlCasaSupa && !themeCasaSupa) {
    report.verdict = 'THEME_DRIFT_SAFE';
    report.action = 'none (HTML casa com Supabase — storefront funciona)';
    console.log(`\n⚠ theme settings diverge do HTML cached (compiled cache do Shopify), MAS HTML casa com Supabase → storefront OK.`);
    console.log(`   Quando alguém salvar o tema via Customize UI, a divergência some.`);
    return;
  }

  if (!htmlCasaSupa) {
    report.verdict = 'SUPABASE_MISMATCH';
    report.action = `UPDATE licenses SET license_key = '${htmlKey}' WHERE shop_url = '${report.myshopify_domain}'`;
    console.log(`\n✗ Supabase diverge do HTML → overlay de licença inválida aparece na storefront.`);
    console.log(`\n=== FIX PROPOSTO ===`);
    console.log(`Atualizar o registro no Supabase pra casar com o HTML que Shopify está servindo (workaround pro compiled cache):`);
    console.log(`  SQL: ${report.action};`);

    // Tentar themePublish primeiro se --try-republish
    if (args.tryRepublish && args.apply) {
      console.log(`\n▶ Tentando themePublish antes (--try-republish)...`);
      const pub = await shReq(client.shopify_domain, client.shopify_access_token, 'POST',
        `/admin/api/${API_VERSION}/graphql.json`,
        { query: 'mutation($id: ID!) { themePublish(id: $id) { userErrors { message } } }',
          variables: { id: `gid://shopify/OnlineStoreTheme/${mainTheme.id}` } });
      const errs = pub.body?.data?.themePublish?.userErrors || [];
      if (errs.length) {
        console.log(`  themePublish falhou: ${JSON.stringify(errs)}`);
      } else {
        console.log(`  themePublish OK. Aguardando 8s pra cache invalidar...`);
        await new Promise(r => setTimeout(r, 8000));
        const html2 = await fetchStorefront(report.primary_domain);
        const ex2 = extractFromHtml(html2.body);
        console.log(`  Novo HTML licenseKey = ${JSON.stringify(ex2.licenseKey)}`);
        if (ex2.licenseKey === supaKey) {
          console.log(`  ✓ themePublish resolveu! Cache invalidou.`);
          report.action = 'themePublish rebuildou o cache — sem alteração no Supabase necessária';
          report.verdict = 'FIXED_BY_REPUBLISH';
          return;
        } else {
          console.log(`  ✗ themePublish não resolveu — seguindo pro fallback Supabase.`);
        }
      }
    }

    if (!args.apply) {
      console.log(`\n[DRY-RUN] Rode com --apply pra aplicar. Ou execute o SQL acima no Supabase UI.`);
      return;
    }

    // Tentar UPDATE via service role
    const serviceKey = process.env.LEVER_SITE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.log(`\n⚠ LEVER_SITE_SERVICE_ROLE_KEY não está no env. Sem service role, não consigo UPDATE (anon é bloqueado por RLS).`);
      console.log(`\n📋 Execute manualmente no Supabase SQL editor:`);
      console.log(`    ${report.action};`);
      console.log(`\nOu configure a env var:`);
      console.log(`  echo "LEVER_SITE_SERVICE_ROLE_KEY=<key>" >> .env.local`);
      console.log(`  Pegar em: https://supabase.com/dashboard/project/ykctllrqygchllhxnkjh/settings/api`);
      process.exit(2);
    }

    // UPDATE via service role
    if (!report.supabase.id) {
      // Não existe registro — cria um novo
      console.log(`\n▶ Criando registro novo (não existia)...`);
      const create = await leverSiteReq('POST', '/licenses', {
        license_key: htmlKey,
        shop_url: report.myshopify_domain,
        status: 'active',
        client_name: client.name,
      }, serviceKey);
      console.log(`  POST status=${create.status}:`, JSON.stringify(create.body).slice(0, 200));
    } else {
      console.log(`\n▶ UPDATE registro ${report.supabase.id}...`);
      const upd = await leverSiteReq('PATCH',
        `/licenses?id=eq.${report.supabase.id}`,
        { license_key: htmlKey },
        serviceKey);
      console.log(`  PATCH status=${upd.status}:`, JSON.stringify(upd.body).slice(0, 200));
    }

    // Verificação final
    console.log(`\n▶ Verificando via query EXATA do snippet...`);
    const verify = await leverSiteReq('GET',
      `/licenses?shop_url=eq.${encodeURIComponent(report.myshopify_domain)}&license_key=eq.${encodeURIComponent(htmlKey)}&select=id,status`);
    if (Array.isArray(verify.body) && verify.body.length > 0 && verify.body[0].status === 'active') {
      console.log(`  ✓ Registro casa com o HTML. Storefront deve destravar imediatamente.`);
      report.verdict = 'FIXED_VIA_SUPABASE';
    } else {
      console.log(`  ✗ UPDATE não persistiu. Verifique manualmente.`);
      report.verdict = 'FIX_FAILED';
    }
  }
}

main().catch(e => { console.error('\n❌ Erro:', e.message, e.stack); process.exit(1); });
