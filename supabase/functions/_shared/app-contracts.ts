/**
 * Contratos do Módulo de Apps Mobile (white-label) — FONTE DE VERDADE.
 *
 * Schema Zod primeiro, types inferidos depois (nunca o contrário).
 * Consumidores: painel NODE (este repo), edge functions e o app Expo (node-shell-app).
 *
 * ESPELHO DENO (este arquivo) da fonte src/contracts/app-mobile.ts — corpo idêntico,
 * muda só a linha de import do zod. Alterou aqui, replicar lá (fronteira Node/Deno
 * impede import único; o corpo dos schemas deve permanecer byte a byte igual).
 */
import { z } from 'npm:zod@3.25.76';

// ---------------------------------------------------------------------------
// Config remoto do app (store_apps.config) — o app é casca burra: busca esse
// JSON no boot e se monta. Nada aqui exige rebuild; nome/ícone/splash NATIVA
// ficam no binário e NÃO pertencem a este contrato.
// ---------------------------------------------------------------------------

export const appTabSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** webview = abre rota da loja; native = tela nativa do app */
  kind: z.enum(['webview', 'native']),
  /** rota da loja (kind=webview) ex.: "/collections/novidades" */
  path: z.string().optional(),
  /** tela nativa (kind=native): rastreio | cashback | conta */
  screen: z.enum(['rastreio', 'cashback', 'conta']).optional(),
  icon: z.enum(['home', 'sparkles', 'cart', 'package', 'wallet', 'user']),
});

export const appBannerSchema = z.object({
  image_url: z.string().url(),
  /** deep link pra rota da loja ao tocar */
  link_path: z.string().optional(),
  alt: z.string().default(''),
});

export const appConfigSchema = z.object({
  /** versão do config — o app usa pra invalidar cache local */
  version: z.number().int().min(1),
  store_url: z.string().url(),
  theme: z.object({
    /** cor de acento única (regra de design do NODE: 1 acento por projeto) */
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logo_url: z.string().url().nullable().default(null),
  }),
  /** segunda splash (animada, em RN) — a nativa é neutra e fica no binário */
  splash: z.object({
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logo_url: z.string().url().nullable().default(null),
    duration_ms: z.number().int().min(0).max(4000).default(1200),
  }),
  tabs: z.array(appTabSchema).min(2).max(5),
  home_banners: z.array(appBannerSchema).max(10).default([]),
  features: z.object({
    cashback: z.boolean().default(false),
    rastreio: z.boolean().default(true),
  }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type AppTab = z.infer<typeof appTabSchema>;

// ---------------------------------------------------------------------------
// Registro de device (app -> edge register-device)
// ---------------------------------------------------------------------------

export const deviceRegistrationSchema = z.object({
  app_id: z.string().uuid(),
  expo_push_token: z.string().min(1),
  platform: z.enum(['android', 'ios']),
  app_version: z.string().min(1),
  os_version: z.string().default(''),
  device_model: z.string().default(''),
  locale: z.string().default('pt-BR'),
  /** id do customer Shopify quando o cliente loga na webview */
  shopify_customer_id: z.string().nullable().default(null),
});

export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>;

// ---------------------------------------------------------------------------
// Telemetria (app -> edge track-event) — alimenta dash, segmentos e jornadas
// ---------------------------------------------------------------------------

export const appEventSchema = z.object({
  app_id: z.string().uuid(),
  device_id: z.string().uuid(),
  type: z.enum([
    'install',
    'open',
    'push_open',
    'add_to_cart',
    'checkout_start',
    'login',
  ]),
  /** dados livres do evento (ex.: { push_campaign_id }) */
  payload: z.record(z.unknown()).default({}),
  occurred_at: z.string().datetime(),
});

export type AppEvent = z.infer<typeof appEventSchema>;

// ---------------------------------------------------------------------------
// Push (painel -> push_campaigns; dispatcher -> Expo Push API)
// ---------------------------------------------------------------------------

export const pushPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(240),
  image_url: z.string().url().nullable().default(null),
  /** rota da loja ou tela nativa aberta ao tocar (ex.: "/collections/promo") */
  deep_link: z.string().nullable().default(null),
});

export type PushPayload = z.infer<typeof pushPayloadSchema>;

// ---------------------------------------------------------------------------
// Segmentos (segments.definition) — filtro salvo que o dispatcher resolve.
// Campos null = "não filtra por isso". Todos os preenchidos valem em AND.
// ---------------------------------------------------------------------------

export const segmentDefinitionSchema = z.object({
  /** só devices dessa plataforma */
  platform: z.enum(['android', 'ios']).nullable().default(null),
  /** 'sim' = já comprou pelo app; 'nao' = nunca comprou */
  comprou: z.enum(['sim', 'nao']).nullable().default(null),
  /** não abre o app há N dias (win-back) */
  inativo_dias: z.number().int().min(1).max(365).nullable().default(null),
  /** instalou há no máximo N dias */
  instalou_ha_dias: z.number().int().min(1).max(365).nullable().default(null),
  /** total gasto no app maior ou igual a (BRL) */
  gasto_minimo: z.number().min(0).nullable().default(null),
});

export type SegmentDefinition = z.infer<typeof segmentDefinitionSchema>;

// ---------------------------------------------------------------------------
// Jornadas — motor único de automação (boas-vindas, carrinho abandonado,
// conforto de entrega e jornadas custom são TODAS instâncias disso)
// ---------------------------------------------------------------------------

export const journeyTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('install') }),
  z.object({
    kind: z.literal('cart_abandoned'),
    /** minutos sem pedido após o último evento de checkout */
    after_minutes: z.number().int().min(15).default(60),
  }),
  z.object({
    kind: z.literal('order_status_changed'),
    /** status normalizado do rastreio que dispara (ver tracked_orders.status) */
    status: z.enum([
      'confirmado',
      'postado',
      'transito_internacional',
      'alfandega',
      'transito_nacional',
      'saiu_para_entrega',
      'entregue',
    ]),
  }),
  z.object({
    /** rastreio mudo: pedido sem evento novo há N dias (o "conforto") */
    kind: z.literal('order_silent'),
    days_without_event: z.number().int().min(1).max(60),
  }),
  z.object({
    kind: z.literal('inactivity'),
    days_without_open: z.number().int().min(1).max(365),
  }),
]);

export const journeyStepSchema = z.object({
  /** espera relativa ao gatilho (passo 1) ou ao passo anterior */
  delay_minutes: z.number().int().min(0),
  push: pushPayloadSchema,
});

export const journeyDefinitionSchema = z.object({
  trigger: journeyTriggerSchema,
  steps: z.array(journeyStepSchema).min(1).max(10),
  /** o que tira o device do fluxo antes de terminar */
  exit_on: z.enum(['purchase', 'delivery', 'none']).default('none'),
});

export type JourneyDefinition = z.infer<typeof journeyDefinitionSchema>;
export type JourneyTrigger = z.infer<typeof journeyTriggerSchema>;

// ---------------------------------------------------------------------------
// Cashback (cashback_rules.config)
// ---------------------------------------------------------------------------

export const cashbackRuleSchema = z.object({
  /** % do pedido pago no app que vira saldo (0.5–20) */
  percent: z.number().min(0.5).max(20),
  /** dias até o crédito expirar */
  validity_days: z.number().int().min(7).max(365).default(90),
  /** valor mínimo de pedido pra acumular (BRL) */
  min_order_value: z.number().min(0).default(0),
  /** teto de crédito por pedido (BRL); null = sem teto */
  max_credit_per_order: z.number().min(1).nullable().default(null),
});

export type CashbackRule = z.infer<typeof cashbackRuleSchema>;

// ---------------------------------------------------------------------------
// Guarda-chuva anti-spam (store_apps.push_limits)
// ---------------------------------------------------------------------------

export const pushLimitsSchema = z.object({
  /** máximo de pushes de marketing por device por dia (rastreio não conta) */
  max_marketing_per_day: z.number().int().min(1).max(10).default(3),
});

export type PushLimits = z.infer<typeof pushLimitsSchema>;
