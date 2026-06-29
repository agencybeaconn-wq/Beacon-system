// Smoke test: fetch HTML of a NON kit-casal PDP and verify variant-picker still renders normally
import { getCreds, shopifyGraphQL } from '../../../../.claude/lib/shopify-api.mjs';
import https from 'https';

const TORCIDA_UUID = '3a9a7bf6-e392-427c-ae73-0d2823dbe53f';

function fetchHTML(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return resolve({ status: 999, body: '', headers: {} });
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    };
    https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          console.log(`  -> redirect to ${next}`);
          fetchHTML(next, depth + 1).then(resolve).catch(reject);
        } else {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    }).on('error', reject).end();
  });
}

(async () => {
  const c = await getCreds(TORCIDA_UUID);

  // Pega o primeiro produto ACTIVE da loja com Tamanho
  const q = `query { products(first: 5, query: "status:active") { edges { node { id title handle tags options { name } } } } }`;
  const r = await shopifyGraphQL(c.shop, c.token, q);
  const items = r.data?.products?.edges || [];
  if (items.length === 0) {
    console.log('ZERO produtos active. abort smoke test.');
    return;
  }

  // Acha primeiro produto que NÃO seja kit-casal e tenha tamanho
  let target = null;
  for (const e of items) {
    const p = e.node;
    if (p.tags.includes('kit-casal')) continue;
    if (p.options.some(o => o.name === 'Tamanho' || o.name === 'Size')) {
      target = p;
      break;
    }
  }
  if (!target) target = items[0].node;

  console.log(`Testing PDP: ${target.title} (handle=${target.handle})`);
  console.log(`  tags: [${target.tags.join(', ')}]`);
  console.log(`  has kit-casal tag: ${target.tags.includes('kit-casal')}`);

  const url = `https://${c.shop}/products/${target.handle}`;
  const html = await fetchHTML(url);
  console.log(`\n  GET ${url} -> ${html.status}`);

  // Markers que esperamos numa PDP normal (não-kit-casal):
  const checks = [
    { name: 'variant-selects element', re: /<variant-selects/ },
    { name: 'product-form (Add to Cart)', re: /<product-form/ },
    { name: 'Tamanho option label OR Size', re: /(Tamanho|Size)/ },
    { name: 'NÃO renderizou kit-casal-variant-picker', re: /data-kit-section/, expectAbsent: true },
    { name: 'NO Liquid error visible', re: /Liquid error/i, expectAbsent: true },
    { name: 'inline-customization #aparecer block', re: /id="aparecer"/ },
  ];
  let allOk = true;
  for (const ck of checks) {
    const found = ck.re.test(html.body);
    const pass = ck.expectAbsent ? !found : found;
    if (!pass) allOk = false;
    console.log(`  ${pass ? '✓' : '✗'}  ${ck.name} (${found ? 'found' : 'not found'})`);
  }
  if (!allOk) console.log('\n  HTML head sample:\n' + html.body.slice(0, 500));
  console.log(allOk ? '\n=== SMOKE TEST PASSOU — PDP normal intacta ===' : '\n=== SMOKE TEST FALHOU — regressão na PDP normal ===');
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
