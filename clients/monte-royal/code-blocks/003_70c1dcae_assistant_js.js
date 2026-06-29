  // VALIDATE
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  let pricing;
  if (args.asis) {
    pricing = { products: {}, extras: {}, info: {} };
    console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
    console.log(`✓ Pricing: --asis (preserva preços do CSV)`);
  } else {
    pricing = await fetchPricing(client.id);
    assertPricingConfigured(pricing, ['torcedor']);
    console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
    console.log(`✓ Pricing: ${Object.keys(pricing.products).length} produtos + ${Object.keys(pricing.extras).length} extras`);
  }
