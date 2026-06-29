// Checks for kit-casal products on Loja da Torcida via GraphQL
import { getCreds, shopifyGraphQL } from '../../../../.claude/lib/shopify-api.mjs';

const TORCIDA_UUID = '3a9a7bf6-e392-427c-ae73-0d2823dbe53f';

(async () => {
  const c = await getCreds(TORCIDA_UUID);
  // Search by title containing "kit casal" OR tag kit-casal
  const q = `query {
    products(first: 50, query: "title:kit casal OR tag:kit-casal") {
      edges { node {
        id title handle status tags
        options { name optionValues { name } }
        variantsCount { count }
      }}
    }
  }`;
  const r = await shopifyGraphQL(c.shop, c.token, q);
  if (r.errors) {
    console.log('GraphQL errors:', JSON.stringify(r.errors, null, 2));
    return;
  }
  const items = r.data?.products?.edges || [];
  console.log(`Found ${items.length} kit-casal-related products in Loja da Torcida:`);
  for (const e of items) {
    const p = e.node;
    console.log(`\n  ${p.title}`);
    console.log(`    id=${p.id}`);
    console.log(`    handle=${p.handle}`);
    console.log(`    status=${p.status}`);
    console.log(`    tags=[${p.tags.join(', ')}]`);
    console.log(`    options=${JSON.stringify(p.options.map(o => ({ name: o.name, values: o.optionValues.map(v => v.name) })))}`);
    console.log(`    variants=${p.variantsCount?.count}`);
  }
  if (items.length === 0) console.log('  (none — Pedro precisa criar antes da PDP funcionar de verdade — flag pro Boss)');
})().catch(e => { console.error(e); process.exit(1); });
