  // VALIDATE
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const pricing = await fetchPricing(client.id);
  assertPricingConfigured(pricing, ['torcedor']);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
  console.log(`✓ Pricing: ${Object.keys(pricing.products).length} produtos + ${Object.keys(pricing.extras).length} extras`);
