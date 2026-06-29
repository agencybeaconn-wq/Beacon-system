// inject-snippet — injeta o snippet do Microsoft Clarity no theme.liquid do tema MAIN
// (ou tema específico via --theme-id) do cliente Shopify.
//
// O snippet é injetado dentro do <head>, marcado com comentários LEVER-CLARITY-START/END
// pra ser idempotente (rodando de novo, atualiza o existente).
//
// Uso: node inject-snippet.mjs <cliente> [--project-id=XYZ] [--theme-id=ID]
//      Se --project-id omitido, lê de agency_clients.clarity_project_id.
//      Se --theme-id omitido, usa o tema main.

import 'dotenv/config';
import { fetchClient, supaRest } from '../../lib/supabase-rest.mjs';
import { getCreds, shReq, API_VERSION } from '../../lib/shopify-api.mjs';

const args = process.argv.slice(2);
const clientArg = args.find(a => !a.startsWith('--'));
const opts = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=') || true];
}));

if (!clientArg) {
  console.error('Uso: node inject-snippet.mjs <cliente> [--project-id=XYZ] [--theme-id=ID]');
  process.exit(1);
}

const SNIPPET_START = '<!-- LEVER-CLARITY-START (managed by Lever System, do not edit by hand) -->';
const SNIPPET_END = '<!-- LEVER-CLARITY-END -->';

function buildSnippet(projectId) {
  return `${SNIPPET_START}
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${projectId}");
</script>
${SNIPPET_END}`;
}

async function main() {
  const client = await fetchClient(clientArg);
  if (!client) { console.error(`Cliente não encontrado: ${clientArg}`); process.exit(1); }

  // Pega project_id (do argumento ou do banco)
  let projectId = opts['project-id'];
  if (!projectId) {
    const rows = await supaRest('GET', `/agency_clients?id=eq.${client.id}&select=clarity_project_id`, null, { serviceRole: true });
    projectId = rows?.[0]?.clarity_project_id;
  }
  if (!projectId) { console.error(`Cliente ${client.name} sem clarity_project_id. Conecte o Clarity primeiro ou passe --project-id=`); process.exit(1); }

  const creds = await getCreds(client.id);
  console.log(`\n=== inject-clarity-snippet — ${creds.name} ===`);
  console.log(`Project ID: ${projectId}`);

  // Pega tema main (ou o que foi passado)
  let themeId = opts['theme-id'];
  if (!themeId) {
    const themes = await shReq(creds.shop, creds.token, 'GET', `/admin/api/${API_VERSION}/themes.json`);
    const main = (themes.body.themes || []).find(t => t.role === 'main');
    if (!main) { console.error('Nenhum tema main encontrado'); process.exit(1); }
    themeId = main.id;
    console.log(`Tema: ${main.name} (${themeId}, MAIN)`);
  } else {
    console.log(`Tema: ${themeId} (custom)`);
  }

  // Lê layout/theme.liquid
  const r = await shReq(creds.shop, creds.token, 'GET', `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?asset[key]=layout/theme.liquid`);
  if (r.status >= 400) { console.error(`Falha lendo theme.liquid: ${r.status}`); process.exit(1); }
  const original = r.body.asset.value;

  const snippet = buildSnippet(projectId);

  let updated;
  if (original.includes(SNIPPET_START)) {
    // Substitui bloco existente
    const re = new RegExp(`${SNIPPET_START}[\\s\\S]*?${SNIPPET_END}`);
    updated = original.replace(re, snippet);
    console.log('✎ Snippet existente atualizado');
  } else {
    // Insere antes de </head>
    if (!/<\/head>/i.test(original)) { console.error('theme.liquid sem </head>?'); process.exit(1); }
    updated = original.replace(/<\/head>/i, `  ${snippet}\n  </head>`);
    console.log('+ Snippet inserido antes de </head>');
  }

  if (updated === original) {
    console.log('Sem mudanças (snippet já idêntico).');
  } else {
    const put = await shReq(creds.shop, creds.token, 'PUT', `/admin/api/${API_VERSION}/themes/${themeId}/assets.json`, {
      asset: { key: 'layout/theme.liquid', value: updated },
    });
    if (put.status >= 400) { console.error(`Falha salvando: ${put.status} ${JSON.stringify(put.body).slice(0, 300)}`); process.exit(1); }
    console.log('✓ theme.liquid salvo');
  }

  // Marca no banco
  await supaRest('PATCH', `/agency_clients?id=eq.${client.id}`, {
    clarity_snippet_installed: true,
  }, { serviceRole: true });
  console.log('✓ clarity_snippet_installed=true em agency_clients');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
