// 42 escopos Lever System canônicos — validados em Mantos do PH, Mega Mantos, Coringão, etc.
// NÃO mexer sem alinhar com lever-shopify-mcp + edge functions Lever.

export const LEVER_SCOPES = [
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

export const LEVER_SCOPES_CSV = LEVER_SCOPES.join(',');
