/**
 * Seletores centralizados do Shopify Dev Dashboard + Custom App install.
 *
 * IMPORTANTE: o Shopify muda o DOM com frequência. Quando uma flow quebrar,
 * inspeciona o DOM no Dev Dashboard ao vivo, ajusta aqui, commita.
 *
 * Convenção: roles + aria-label > nomes legíveis > CSS class (último recurso).
 * Use Page.getByRole/getByText/getByLabel sempre que possível antes de cair em locator CSS.
 */

export const DEV_DASHBOARD_SELECTORS = {
  // Top-level navigation
  appsNavLink: { role: 'link' as const, name: /^Apps$/i },

  // Apps list view
  createAppButton: { role: 'button' as const, name: /^Create app$/i },
  startFromDashboardOption: { role: 'button' as const, name: /Start from Dev Dashboard/i },

  // Create app dialog
  appNameInput: { label: /^App name$/i },
  createSubmitButton: { role: 'button' as const, name: /^Create$/i },

  // App detail view
  versionsTab: { role: 'tab' as const, name: /^Versions$/i },
  newVersionButton: { role: 'button' as const, name: /New version|Create version/i },
  appUrlInput: { label: /App URL|Application URL/i },

  // Scope selection — Dev Dashboard renders scopes as a checkbox list with searchable filter
  scopeSearchInput: { placeholder: /Search scopes|Filter scopes/i },
  scopeCheckbox: (handle: string) => ({ label: new RegExp(`^${handle}$`) }),

  // Release / publish version
  releaseButton: { role: 'button' as const, name: /^Release$/i },

  // Install on store
  installOnStoreButton: { role: 'button' as const, name: /Install on store|Install/i },
  storeUrlInput: { label: /Store URL|Shop domain/i },

  // OAuth grant screen (loja target) — appears as separate page on shop
  oauthInstallButton: { role: 'button' as const, name: /^Install app|^Install$/i },

  // Reveal access token after install
  apiCredentialsTab: { role: 'tab' as const, name: /API credentials|Tokens/i },
  revealTokenButton: { role: 'button' as const, name: /Reveal token once|Reveal/i },
  tokenValueDisplay: { selector: 'code, [data-token], input[readonly][value^="shpat_"]' },
} as const;
