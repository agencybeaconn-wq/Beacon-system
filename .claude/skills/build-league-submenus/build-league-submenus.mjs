#!/usr/bin/env node
// build-league-submenus — adiciona submenus de clubes/seleções a cada item de liga
// no menu principal, usando coleções existentes que tenham ≥1 produto.
//
// Uso:
//   node build-league-submenus.mjs <clientIdOrName>                  # dry-run
//   node build-league-submenus.mjs <clientIdOrName> --apply          # aplica
//   node build-league-submenus.mjs <clientIdOrName> --apply --menu=main-menu

import { shReq, shopifyGraphQL, paginate, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';

function parseArgs() {
  const args = { _: [], apply: false, menu: 'main-menu' };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--menu=')) args.menu = a.slice(7);
    else if (!a.startsWith('--')) args._.push(a);
  }
  if (!args._[0]) {
    console.error('Uso: build-league-submenus.mjs <clientIdOrName> [--apply] [--menu=main-menu]');
    process.exit(1);
  }
  return args;
}

// Mapa autoritativo: liga (handle do menu) → handles de clubes/seleções esperados.
// Aliases (PT/EN) listados juntos — primeira ocorrência encontrada na loja vence.
const LEAGUE_CLUBS = {
  'brasileirao': [
    'atletico-mineiro', 'botafogo', 'corinthians', 'cruzeiro', 'flamengo',
    'fluminense', 'fortaleza', 'gremio', 'internacional', 'palmeiras',
    'sao-paulo', 'vasco', 'bahia', 'santos', 'athletico-paranaense',
    'atletico-pr', 'ceara', 'juventude', 'mirassol', 'sport',
    'vitoria', 'bragantino', 'red-bull-bragantino', 'cuiaba', 'goias'
  ],
  'premier-league': [
    'arsenal', 'aston-villa', 'brighton', 'chelsea', 'everton',
    'fulham', 'leeds', 'leeds-united', 'liverpool', 'manchester-city',
    'manchester-united', 'newcastle', 'nottingham-forest', 'tottenham',
    'west-ham', 'wolverhampton', 'crystal-palace', 'brentford', 'bournemouth'
  ],
  'la-liga': [
    'atletico-de-madrid', 'atletico-madrid', 'barcelona', 'real-betis',
    'real-madrid', 'real-sociedad', 'sevilla', 'valencia', 'villarreal',
    'athletic-bilbao', 'athletic-club'
  ],
  'serie-a': [
    'inter-de-milao', 'inter-milan', 'juventus', 'lazio', 'milan',
    'ac-milan', 'napoli', 'roma', 'as-roma', 'atalanta',
    'fiorentina', 'torino', 'bologna'
  ],
  'bundesliga': [
    'bayer-leverkusen', 'bayern-de-munique', 'bayern-munich', 'borussia-dortmund',
    'borussia-monchengladbach', 'eintracht-frankfurt', 'rb-leipzig', 'schalke-04',
    'vfb-stuttgart', 'werder-bremen', 'wolfsburg', 'hoffenheim'
  ],
  'ligue-1': [
    'psg', 'paris-saint-germain', 'olympique-de-marseille', 'marseille',
    'olympique-lyonnais', 'lyon', 'monaco', 'lille', 'nice', 'rennes',
    'lens', 'strasbourg'
  ],
  'selecoes': [
    'alemanha', 'germany', 'argentina', 'belgica', 'belgium', 'brasil', 'brazil',
    'canada', 'colombia', 'costa-rica', 'croacia', 'croatia', 'dinamarca', 'denmark',
    'equador', 'ecuador', 'escocia', 'scotland', 'espanha', 'spain',
    'estados-unidos', 'usa', 'franca', 'france', 'holanda', 'netherlands',
    'inglaterra', 'england', 'italia', 'italy', 'jamaica', 'japao', 'japan',
    'marrocos', 'morocco', 'mexico', 'paraguai', 'paraguay', 'peru',
    'polonia', 'poland', 'portugal', 'senegal', 'suica', 'switzerland',
    'uruguai', 'uruguay', 'australia', 'arabia-saudita', 'tunisia',
    'gana', 'ghana', 'camaroes', 'cameroon', 'coreia-do-sul', 'south-korea'
  ],
};

// Detecta a liga a partir do url do item de menu.
function detectLeague(url) {
  if (!url) return null;
  const m = url.match(/\/collections\/([a-z0-9-]+)/i);
  if (!m) return null;
  const handle = m[1].toLowerCase();
  return LEAGUE_CLUBS[handle] ? handle : null;
}

// Sort alfabético com normalização de acentos.
function alphaSort(a, b) {
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return norm(a.title).localeCompare(norm(b.title));
}

async function fetchMenuTree(shop, token, handle) {
  const q = `query($q: String!) {
    menus(first: 20, query: $q) {
      edges { node {
        id title handle
        items { id title url type
          items { id title url type
            items { id title url type } } }
      } }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, q, { q: `handle:${handle}` });
  const menus = r.data?.menus?.edges?.map(e => e.node) || [];
  return menus.find(m => m.handle === handle) || null;
}

async function fetchCollectionsWithCount(shop, token) {
  const fields = 'id,title,handle,published_at';
  const custom = await paginate(shop, token,
    `/admin/api/${API_VERSION}/custom_collections.json?limit=250&fields=${fields}`,
    'custom_collections', 350);
  const smart = await paginate(shop, token,
    `/admin/api/${API_VERSION}/smart_collections.json?limit=250&fields=${fields}`,
    'smart_collections', 350);
  const all = [
    ...custom.map(c => ({ ...c, _type: 'custom' })),
    ...smart.map(c => ({ ...c, _type: 'smart' })),
  ];

  // Conta produtos por coleção. /collections/{id}.json retorna products_count.
  const out = [];
  for (const c of all) {
    const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/collections/${c.id}.json`);
    const pc = r.body?.collection?.products_count;
    out.push({
      id: c.id,
      title: c.title,
      handle: c.handle,
      type: c._type,
      published: !!c.published_at,
      products_count: pc ?? 0,
    });
    await delay(180);
  }
  return out;
}

function buildSubmenuItems(leagueHandle, collectionsByHandle) {
  const candidates = LEAGUE_CLUBS[leagueHandle] || [];
  const seenTitle = new Set();
  const subs = [];
  for (const h of candidates) {
    const c = collectionsByHandle[h];
    if (!c) continue;
    if (c.products_count <= 0) continue;
    if (!c.published) continue;
    const tk = c.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (seenTitle.has(tk)) continue; // dedupe alias PT/EN
    seenTitle.add(tk);
    subs.push({
      title: c.title,
      type: 'HTTP',
      url: `/collections/${c.handle}`,
    });
  }
  subs.sort(alphaSort);
  return subs;
}

(async () => {
  const args = parseArgs();
  const client = await assertClientExists(args._[0]);
  await assertShopifyConnected(client);
  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  console.log(`Loja: ${client.name} (${shop})`);
  console.log(`Menu: ${args.menu}\n`);

  const menu = await fetchMenuTree(shop, token, args.menu);
  if (!menu) {
    console.error(`✗ Menu "${args.menu}" não encontrado.`);
    process.exit(1);
  }

  console.log('Lendo coleções e contagem de produtos...');
  const cols = await fetchCollectionsWithCount(shop, token);
  const byHandle = Object.fromEntries(cols.map(c => [c.handle, c]));
  console.log(`  ${cols.length} coleções (${cols.filter(c => c.products_count > 0).length} com produtos)\n`);

  // Reconstrói items do menu, adicionando submenus apenas em items de liga.
  const newItems = [];
  let touched = 0;
  for (const it of menu.items) {
    const leagueHandle = detectLeague(it.url);
    if (!leagueHandle) {
      // Item não-liga: preserva como está (incluindo subs existentes)
      newItems.push(stripIds(it));
      continue;
    }
    const subs = buildSubmenuItems(leagueHandle, byHandle);
    newItems.push({
      title: it.title,
      type: it.type,
      url: it.url,
      ...(subs.length ? { items: subs } : {}),
    });
    if (subs.length) touched++;
  }

  // Preview
  console.log('='.repeat(68));
  console.log(`PREVIEW — ${args.apply ? 'VAI APLICAR' : 'DRY-RUN'}`);
  console.log('='.repeat(68));
  for (const it of newItems) {
    const subs = it.items || [];
    console.log(`▸ ${it.title}${subs.length ? ` (+${subs.length} subs)` : ''}`);
    for (const s of subs) {
      console.log(`    ├─ ${s.title.padEnd(28)} ${s.url}`);
    }
  }
  console.log(`\nLigas com submenus: ${touched}`);
  console.log(`Total de subitems: ${newItems.reduce((n, i) => n + (i.items?.length || 0), 0)}`);

  if (!args.apply) {
    console.log('\n— DRY-RUN. Rode com --apply para escrever.');
    return;
  }

  // Apply
  console.log('\nAtualizando menu...');
  const r = await shopifyGraphQL(shop, token, `
    mutation updateMenu($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
        menu { id title }
        userErrors { field message }
      }
    }`,
    { id: menu.id, title: menu.title, handle: menu.handle, items: newItems }
  );

  const errors = r.data?.menuUpdate?.userErrors || r.errors;
  if (errors?.length) {
    console.error('✗ Erros:', JSON.stringify(errors, null, 2));
    process.exit(1);
  }
  console.log(`✓ Menu "${args.menu}" atualizado: ${touched} ligas com submenus.`);
})();

// Remove `id` (e itens aninhados) — o menuUpdate aceita só {title, type, url, items}.
function stripIds(item) {
  const out = { title: item.title, type: item.type, url: item.url };
  if (item.items?.length) out.items = item.items.map(stripIds);
  return out;
}
