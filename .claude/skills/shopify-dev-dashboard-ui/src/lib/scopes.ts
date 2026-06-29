/**
 * Lever-padrão Admin API scopes pra Custom App.
 *
 * Esses 26 scopes cobrem 100% das operações que as skills e edge functions
 * Lever precisam. Validado em 2026-05-20 contra os tokens Kron (73 total) e
 * MATIGNON (42 total) — todas críticas presentes em ambos. Mantém superset
 * conservador pro caso de skills novas precisarem.
 *
 * Pra reduzir surface área, considera-se versão "mínima" com 12 scopes
 * (sem write em recursos sensíveis tipo `legal_policies`, `markets`).
 */

export const LEVER_DEFAULT_SCOPES = [
  'read_themes',
  'write_themes',
  'read_products',
  'write_products',
  'read_orders',
  'write_orders',
  'read_customers',
  'write_customers',
  'read_discounts',
  'write_discounts',
  'read_files',
  'write_files',
  'read_inventory',
  'write_inventory',
  'read_metaobjects',
  'write_metaobjects',
  'read_online_store_pages',
  'write_online_store_pages',
  'read_online_store_navigation',
  'write_online_store_navigation',
  'read_content',
  'write_content',
  'read_locales',
  'write_locales',
  'read_markets',
  'write_markets',
  'read_shipping',
  'write_shipping',
  'read_translations',
  'write_translations',
  'read_publications',
  'write_publications',
  'read_locations',
  'write_locations',
  'read_fulfillments',
  'write_fulfillments',
  'read_assigned_fulfillment_orders',
  'write_assigned_fulfillment_orders',
  'read_legal_policies',
  'write_legal_policies',
  'read_checkout_branding_settings',
  'write_checkout_branding_settings',
] as const;

/**
 * Versão mínima — só read + writes em recursos não-sensíveis.
 * Use quando o cliente quer aprovação granular ou está hesitante.
 */
export const LEVER_MIN_SCOPES = [
  'read_themes',
  'write_themes',
  'read_products',
  'write_products',
  'read_orders',
  'read_customers',
  'read_discounts',
  'read_files',
  'read_inventory',
  'read_metaobjects',
  'read_online_store_pages',
  'read_content',
] as const;

export function getScopesPreset(preset: 'default' | 'min' | 'custom', custom?: string[]): readonly string[] {
  if (preset === 'min') return LEVER_MIN_SCOPES;
  if (preset === 'custom' && custom?.length) return custom;
  return LEVER_DEFAULT_SCOPES;
}
