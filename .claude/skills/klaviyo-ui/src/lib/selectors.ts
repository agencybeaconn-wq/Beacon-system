/**
 * Seletores Klaviyo centralizados.
 *
 * Klaviyo muda DOM com frequência. Sempre prefira data-testid > role > text > css.
 * Quando algo quebrar, rodar `npm run flow -- doctor` (ou login --debug) e inspecionar.
 *
 * NOTA: muitos destes seletores estão como TODO porque Klaviyo precisa ser inspecionado
 * ao vivo na conta real. Preencher conforme construímos cada flow.
 */

export const selectors = {
  // navegação global
  nav: {
    flows: 'a[href="/flows"], a[href*="/flow/list"]', // TODO confirmar
    campaigns: 'a[href="/campaigns"]',
    signupForms: 'a[href*="/signup-forms"]',
    metrics: 'a[href*="/metrics"]',
  },

  // lista de flows
  flowsList: {
    searchInput: 'input[placeholder*="Search" i]', // TODO confirmar
    flowRow: (name: string) => `[role="row"]:has-text("${name}")`,
    flowLink: (name: string) => `a:has-text("${name}")`,
  },

  // editor de flow
  flowEditor: {
    canvas: '[data-testid="flow-canvas"]', // TODO confirmar
    step: (index: number) => `[data-testid="flow-step-${index}"]`, // TODO confirmar
    emailStep: '[data-testid*="email-step"]', // TODO
    publishButton: 'button:has-text("Publish")', // TODO confirmar copy
    statusBadge: '[data-testid="flow-status"]',
  },

  // editor de email
  emailEditor: {
    subjectInput: 'input[name="subject"]', // TODO
    previewInput: 'input[name="preview_text"]', // TODO
    fromNameInput: 'input[name="from_name"]',
    smartSendingToggle: '[data-testid="smart-sending-toggle"]',
    saveButton: 'button:has-text("Save")',
  },

  // A/B test
  abTest: {
    winnerControls: '[data-testid="ab-winner-controls"]', // TODO
    keepVariantA: 'button:has-text("Keep A")',
    keepVariantB: 'button:has-text("Keep B")',
    discardButton: 'button:has-text("Discard test")',
  },

  // conversion metric
  conversion: {
    metricDropdown: '[data-testid="conversion-metric-select"]', // TODO
    metricOption: (name: string) => `[role="option"]:has-text("${name}")`,
  },

  // signup form
  form: {
    displaySettingsTab: 'button[role="tab"]:has-text("Behaviors")', // TODO confirmar
    delayInput: 'input[name="delay_seconds"]',
    frequencySelect: 'select[name="display_frequency"]',
  },
} as const;
