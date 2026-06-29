// 42 escopos Lever System canônicos.
// ⚠️ FONTE DE VERDADE compartilhada com a skill client-onboarder
// (.claude/skills/client-onboarder/src/lib/scopes.ts) e a edge function
// shopify-auth-start. O app de cada cliente é CRIADO com exatamente estes
// escopos no Dev Dashboard — o authorize URL NÃO pode pedir nada fora desta
// lista (Shopify rejeita escopos não configurados no app).
// Mexeu aqui? Sincronize os três lugares.

export const LEVER_SHOPIFY_SCOPES = [
  'read_assigned_fulfillment_orders', 'write_assigned_fulfillment_orders',
  'read_checkout_branding_settings', 'write_checkout_branding_settings',
  'read_content', 'write_content',
  'read_customers', 'write_customers',
  'read_discounts', 'write_discounts',
  'read_files', 'write_files',
  'read_fulfillments', 'write_fulfillments',
  'read_inventory', 'write_inventory',
  'read_legal_policies', 'write_legal_policies',
  'read_locales', 'write_locales',
  'read_locations', 'write_locations',
  'read_markets', 'write_markets',
  'read_metaobjects', 'write_metaobjects',
  'read_online_store_navigation', 'write_online_store_navigation',
  'read_online_store_pages', 'write_online_store_pages',
  'read_orders', 'write_orders',
  'read_products', 'write_products',
  'read_publications', 'write_publications',
  'read_shipping', 'write_shipping',
  'read_themes', 'write_themes',
  'read_translations', 'write_translations',
] as const;

export const LEVER_SHOPIFY_SCOPES_CSV = LEVER_SHOPIFY_SCOPES.join(',');
