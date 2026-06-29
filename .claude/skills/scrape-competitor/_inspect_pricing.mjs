// Inspect-only: distribuição de preços do catálogo atual do FutNations por categoria.
import { fetchClient } from '../../lib/supabase-rest.mjs';
import { shReq, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';

const client = await fetchClient('FutNations');
console.log(`Cliente: ${client.name} (${client.shopify_domain})`);

let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,product_type,variants`;
const buckets = {};
let count = 0;
while (p) {
  const r = await shReq(client.shopify_domain, client.shopify_access_token, 'GET', p);
  for (const pr of (r.body.products || [])) {
    count++;
    const t = pr.title.toLowerCase();
    let cat = 'outros';
    if (/retr[oô]/.test(t)) cat = 'camisa_retro';
    else if (/manga (longa|comprida)|long.?sleeve/.test(t)) cat = 'camisa_manga_longa';
    else if (/conjunto|infantil|kit/.test(t)) cat = 'conjunto_infantil';
    else if (/jogador|player/.test(t)) cat = 'camisa_jogador';
    else if (/^camisa/.test(t)) cat = 'camisa_torcedor';
    const v = pr.variants?.[0];
    if (v?.price) {
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(parseFloat(v.price));
    }
  }
  p = nextPageUrl(r.link);
  if (p) await delay(400);
}
console.log('Total produtos:', count);
for (const [cat, prices] of Object.entries(buckets)) {
  prices.sort((a,b)=>a-b);
  const median = prices[Math.floor(prices.length/2)];
  const counts = {};
  prices.forEach(pr => counts[pr] = (counts[pr]||0)+1);
  const mode = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  console.log(`${cat}: n=${prices.length} min=R$${prices[0].toFixed(2)} max=R$${prices[prices.length-1].toFixed(2)} median=R$${median.toFixed(2)} mode=R$${mode[0]} (x${mode[1]})`);
}
