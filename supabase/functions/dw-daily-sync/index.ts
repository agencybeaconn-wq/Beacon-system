// Lever DW — Daily Sync (Supabase Edge Function)
//
// Roda 1x/dia via pg_cron. Faz pull incremental dos últimos N dias:
//   • Shopify orders (updated_at_min) → dw_orders + dw_order_items + dw_customers
//   • Meta insights (last N days) → dw_meta_insights_daily (campaigns/ads também)
//
// Body opcional:
//   { days?: 3, only?: "meta" | "shopify", client_id?: uuid }
//
// Idempotente (UPSERT por (client_id, shopify_order_id) e por (entity_id, entity_type, date)).

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { instrument } from "../_shared/logger.ts";

const META_API = 'https://graph.facebook.com/v21.0'
const SHOPIFY_API_VERSION = '2025-01'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(instrument("dw-daily-sync", async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const t0 = Date.now()
  const body = await req.json().catch(() => ({}))
  const DAYS = body.days ?? 3
  const ONLY = body.only ?? 'both' // 'shopify' | 'meta' | 'both'
  const CLIENT_FILTER = body.client_id ?? null

  const supabase = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const result: any = { ok: true, days: DAYS, shopify: null, meta: null, errors: [] }

  try {
    if (ONLY === 'shopify' || ONLY === 'both') {
      result.shopify = await syncShopify(supabase, DAYS, CLIENT_FILTER, result.errors)
    }
    if (ONLY === 'meta' || ONLY === 'both') {
      result.meta = await syncMeta(supabase, DAYS, CLIENT_FILTER, result.errors)
    }
  } catch (e) {
    result.ok = false
    result.errors.push(String(e?.message || e))
  }

  result.duration_s = ((Date.now() - t0) / 1000).toFixed(1)
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}))

// ============================================================================
// SHOPIFY incremental — updated_at_min
// ============================================================================
async function syncShopify(supabase: any, days: number, clientFilter: string | null, errors: string[]) {
  let q = supabase.from('agency_clients')
    .select('id,name,shopify_domain,shopify_access_token')
    .eq('shopify_status', 'connected')
  if (clientFilter) q = q.eq('id', clientFilter)
  const { data: clients } = await q
  if (!clients?.length) return { total_clients: 0 }

  const sinceISO = new Date(Date.now() - days * 86400 * 1000).toISOString()
  let totalOrders = 0, totalItems = 0
  const byClient: Record<string, any> = {}

  // Concurrency 3
  const CONC = 3
  const queue = [...clients]
  const running = new Set<Promise<any>>()

  async function processOne(c: any) {
    try {
      let path = `/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=250&status=any&updated_at_min=${encodeURIComponent(sinceISO)}`
      let orders: any[] = []
      while (path) {
        const r: any = await shopifyREST(c.shopify_domain, c.shopify_access_token, path)
        if (r.status !== 200) {
          errors.push(`Shopify ${c.name}: ${r.status}`)
          return
        }
        orders.push(...(r.body.orders || []))
        path = nextLinkPath(r.link)
      }
      if (!orders.length) { byClient[c.name] = { orders: 0 }; return }

      // transform é async (sha256) — await em paralelo
      const transformed = await Promise.all(orders.map(o => transformShopifyOrder(o, c.id)))
      const orderRows: any[] = []
      const itemRows: any[] = []
      const customerRows: any[] = []
      for (let idx = 0; idx < transformed.length; idx++) {
        const t = transformed[idx]
        const shipId = parseInt(orders[idx].id)
        orderRows.push(t.orderRow)
        for (const it of t.itemRows) itemRows.push({ ...it, _ship_id: shipId })
        if (t.customerRow) customerRows.push(t.customerRow)
      }

      // Upsert orders, get back IDs
      const { data: inserted } = await supabase.from('dw_orders')
        .upsert(orderRows.map(nullify), { onConflict: 'client_id,shopify_order_id' })
        .select('id,shopify_order_id')
      const idMap = new Map((inserted || []).map((r: any) => [Number(r.shopify_order_id), r.id]))

      // Items
      const finalItems = itemRows
        .map((it: any) => ({ ...it, order_id: idMap.get(it._ship_id), _ship_id: undefined }))
        .filter((it: any) => it.order_id)
        .map((it: any) => { delete it._ship_id; return nullify(it) })

      if (finalItems.length) {
        await supabase.from('dw_order_items').upsert(finalItems, { onConflict: 'order_id,shopify_line_item_id' })
      }

      const dedupCust = Array.from(new Map(customerRows.map((c: any) => [c.shopify_customer_id, c])).values())
        .map(nullify)
      if (dedupCust.length) {
        await supabase.from('dw_customers').upsert(dedupCust, { onConflict: 'client_id,shopify_customer_id' })
      }

      totalOrders += orderRows.length
      totalItems += finalItems.length
      byClient[c.name] = { orders: orderRows.length, items: finalItems.length }

      // Update sync state
      await supabase.from('dw_sync_state').upsert({
        client_id: c.id,
        resource: 'orders',
        last_synced_order_created_at: orderRows[orderRows.length - 1]?.created_at,
        total_orders_synced: orderRows.length,
        last_run_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: 'client_id' })
    } catch (e: any) {
      errors.push(`Shopify ${c.name}: ${e.message}`)
    }
  }

  while (queue.length || running.size) {
    while (running.size < CONC && queue.length) {
      const c = queue.shift()!
      const p = processOne(c).finally(() => running.delete(p))
      running.add(p)
    }
    if (running.size) await Promise.race(running)
  }

  return { total_clients: clients.length, total_orders: totalOrders, total_items: totalItems, by_client: byClient }
}

// ============================================================================
// META incremental
// ============================================================================
async function syncMeta(supabase: any, days: number, clientFilter: string | null, errors: string[]) {
  const { data: conn } = await supabase.from('fb_connections')
    .select('access_token').eq('status', 'connected')
    .order('created_at', { ascending: false }).limit(1).single()
  if (!conn?.access_token) { errors.push('Meta: no token'); return null }
  const token = conn.access_token

  const { data: accounts } = await supabase.from('dw_meta_accounts')
    .select('account_id,name,client_id,ownership,status')
    .in('ownership', ['client', 'lever_internal'])
    .in('status', [1, 3])
  if (!accounts?.length) return { total_accounts: 0 }

  const toSync = clientFilter
    ? accounts.filter((a: any) => a.client_id === clientFilter)
    : accounts

  const until = new Date().toISOString().slice(0, 10)
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10)

  let totalInsights = 0
  const byAccount: Record<string, number> = {}

  const CONC = 4
  const queue = [...toSync]
  const running = new Set<Promise<any>>()

  async function processOne(acc: any) {
    try {
      const insightsPath = `${META_API}/act_${acc.account_id}/insights?level=ad&time_increment=1&time_range={"since":"${since}","until":"${until}"}&fields=ad_id,date_start,impressions,reach,clicks,unique_clicks,spend,cpm,cpc,ctr,frequency,actions,action_values&limit=500&access_token=${token}`
      let url: string | null = insightsPath
      let allRows: any[] = []
      while (url) {
        const r: any = await (await fetch(url)).json()
        if (r.error) { errors.push(`Meta ${acc.name}: ${r.error.message}`); return }
        for (const i of (r.data || [])) {
          const acts: any[] = i.actions || []
          const vals: any[] = i.action_values || []
          const findAct = (n: string) => { const a = acts.find(x => x.action_type === n); return a ? parseInt(a.value) : 0 }
          const findVal = (n: string) => { const a = vals.find(x => x.action_type === n); return a ? parseFloat(a.value) : 0 }
          const purchases = findAct('purchase') || findAct('offsite_conversion.fb_pixel_purchase')
          const purchasesValue = findVal('purchase') || findVal('offsite_conversion.fb_pixel_purchase')
          const spend = parseFloat(i.spend || 0)
          allRows.push({
            entity_id: i.ad_id,
            entity_type: 'ad',
            account_id: acc.account_id,
            client_id: acc.client_id,
            date: i.date_start,
            impressions: parseInt(i.impressions || 0),
            reach: parseInt(i.reach || 0),
            clicks: parseInt(i.clicks || 0),
            unique_clicks: parseInt(i.unique_clicks || 0),
            spend,
            cpm: parseFloat(i.cpm || 0),
            cpc: parseFloat(i.cpc || 0),
            ctr: parseFloat(i.ctr || 0),
            frequency: parseFloat(i.frequency || 0),
            purchases,
            purchases_value: purchasesValue,
            add_to_carts: findAct('add_to_cart') || findAct('offsite_conversion.fb_pixel_add_to_cart'),
            initiate_checkouts: findAct('initiate_checkout') || findAct('offsite_conversion.fb_pixel_initiate_checkout'),
            landing_page_views: findAct('landing_page_view'),
            video_views: findAct('video_view'),
            roas: spend > 0 ? (purchasesValue / spend) : null,
            cpa: purchases > 0 ? (spend / purchases) : null,
          })
        }
        url = r.paging?.next || null
      }
      if (allRows.length) {
        // Batches of 200
        for (let i = 0; i < allRows.length; i += 200) {
          await supabase.from('dw_meta_insights_daily').upsert(
            allRows.slice(i, i + 200).map(nullify),
            { onConflict: 'entity_id,entity_type,date' }
          )
        }
      }
      totalInsights += allRows.length
      byAccount[acc.name] = allRows.length
    } catch (e: any) {
      errors.push(`Meta ${acc.name}: ${e.message}`)
    }
  }

  while (queue.length || running.size) {
    while (running.size < CONC && queue.length) {
      const a = queue.shift()!
      const p = processOne(a).finally(() => running.delete(p))
      running.add(p)
    }
    if (running.size) await Promise.race(running)
  }

  return { total_accounts: toSync.length, total_insights: totalInsights, by_account: byAccount }
}

// ============================================================================
// Helpers
// ============================================================================
function nullify(obj: any) {
  const out: any = {}
  for (const k of Object.keys(obj)) out[k] = obj[k] === undefined ? null : obj[k]
  return out
}

async function shopifyREST(shop: string, token: string, path: string) {
  const res = await fetch(`https://${shop}${path}`, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  })
  const link = res.headers.get('link') || ''
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body, link }
}

function nextLinkPath(link: string) {
  if (!link) return null
  const m = link.match(/<([^>]+)>;\s*rel="next"/)
  if (!m) return null
  const u = new URL(m[1])
  return u.pathname + u.search
}

// Enriquecedor inline (mesma lógica do dw-enrich.mjs, mas autocontido em Deno)
const TEAMS: { match: RegExp; team: string; country: string; isNational?: boolean }[] = [
  { match: /\bbrasil\b|sele[çc][ãa]o brasileira|cbf\b/i, team: 'Brasil', country: 'BR', isNational: true },
  { match: /\bargentina\b/i, team: 'Argentina', country: 'AR', isNational: true },
  { match: /\bportugal\b/i, team: 'Portugal', country: 'PT', isNational: true },
  { match: /\bflamengo\b|\bmengo\b/i, team: 'Flamengo', country: 'BR' },
  { match: /\bcorinthians\b|\btim[ãa]o\b/i, team: 'Corinthians', country: 'BR' },
  { match: /\bpalmeiras\b/i, team: 'Palmeiras', country: 'BR' },
  { match: /\bs[ãa]o paulo\b|\bspfc\b/i, team: 'São Paulo', country: 'BR' },
  { match: /\bsantos\b/i, team: 'Santos', country: 'BR' },
  { match: /\bvasco\b/i, team: 'Vasco', country: 'BR' },
  { match: /\bcruzeiro\b/i, team: 'Cruzeiro', country: 'BR' },
  { match: /\batletico mineiro\b|\bgalo\b/i, team: 'Atlético Mineiro', country: 'BR' },
  { match: /\bgremio\b|gr[êe]mio/i, team: 'Grêmio', country: 'BR' },
  { match: /\binternacional\b|colorado/i, team: 'Internacional', country: 'BR' },
  { match: /\bfluminense\b/i, team: 'Fluminense', country: 'BR' },
  { match: /\bbotafogo\b/i, team: 'Botafogo', country: 'BR' },
  { match: /\bbahia\b/i, team: 'Bahia', country: 'BR' },
  { match: /\breal madrid\b/i, team: 'Real Madrid', country: 'ES' },
  { match: /\bbarcelona\b|barça/i, team: 'Barcelona', country: 'ES' },
  { match: /\bmanchester united\b|man utd/i, team: 'Manchester United', country: 'EN' },
  { match: /\bmanchester city\b/i, team: 'Manchester City', country: 'EN' },
  { match: /\bliverpool\b/i, team: 'Liverpool', country: 'EN' },
  { match: /\bpsg\b/i, team: 'PSG', country: 'FR' },
  { match: /\bbayern\b/i, team: 'Bayern Munich', country: 'DE' },
  { match: /\bjuventus\b/i, team: 'Juventus', country: 'IT' },
]

function detectCategory(title: string, isNational: boolean) {
  const t = title.toLowerCase()
  if (/\b(patch|meia|mei[ãa]o|short|cal[çc]a|bon[ée]|cachecol)\b/.test(t)) return 'Acessório'
  if (/\bpolo\b|treino/.test(t)) return 'Treino'
  if (/infantil|\bkids?\b|crian[çc]a/.test(t)) return 'Infantil'
  if (/g[2-9]\b|[2-9]gg\b|plus size/.test(t)) return 'Plus size'
  if (isNational) return 'Seleção'
  if (/retr[ôo]/.test(t)) return 'Retrô'
  if (/camisa|camiseta|jersey/.test(t)) return 'Atual'
  return null
}

function detectSeason(title: string) {
  const full = title.match(/\b(19|20)(\d{2})\s*[\/\-]\s*(\d{2})\b/)
  if (full) return { season: `${full[2]}/${full[3]}`, season_year: parseInt(full[1] + full[2]) }
  const short = title.match(/\b(\d{2})\s*[\/\-]\s*(\d{2})\b/)
  if (short) {
    const yy = parseInt(short[1])
    const year = (yy <= 30 ? 2000 : 1900) + yy
    return { season: `${short[1]}/${short[2]}`, season_year: year }
  }
  const single = title.match(/\b(19[89]\d|20[0-3]\d)\b/)
  if (single) return { season: single[1], season_year: parseInt(single[1]) }
  return { season: null, season_year: null }
}

function detectSize(variantTitle: string | null) {
  if (!variantTitle) return null
  const first = variantTitle.split('/')[0].trim()
  if (/^(p|m|g|gg|ggg|g[1-9]|[1-9]gg|xs|s|l|xl|xxl)$/i.test(first)) return first.toUpperCase()
  if (/^\d{1,2}\s*anos$/i.test(first)) return first
  return first.length <= 6 ? first : null
}

function ticketBand(total: any) {
  const t = parseFloat(total)
  if (isNaN(t)) return null
  if (t < 100) return '<100'
  if (t < 300) return '100-300'
  if (t < 500) return '300-500'
  if (t < 1000) return '500-1000'
  return '1000+'
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Cache de hashes — promessa pra ser awaited
async function hashEmail(email: any) {
  if (!email) return null
  const n = String(email).toLowerCase().trim()
  if (!n.includes('@')) return null
  return await sha256(n)
}

function enrichLineItem(li: any) {
  const title = li.title || li.name || ''
  let team = null, country = null, isNational = false
  for (const t of TEAMS) {
    if (t.match.test(title)) { team = t.team; country = t.country; isNational = !!t.isNational; break }
  }
  const category = detectCategory(title, isNational)
  const { season, season_year } = detectSeason(title)
  const size = detectSize(li.variant_title)
  const is_plus_size = size ? /^g[2-9]|[2-9]gg|xgg/i.test(size) : false

  const props: any = { is_personalized: false, has_patches: false, patches_count: 0, patch_titles: [], pairing_id: null, is_attached: false, attached_to: null, personalization_name: null, personalization_number: null }
  for (const p of (li.properties || [])) {
    const n = (p.name || '').toLowerCase().trim()
    const v = (p.value || '').toString().trim()
    if (!v) continue
    if (n === 'nome' || n === 'name') { props.personalization_name = v; props.is_personalized = true }
    else if (n === 'número' || n === 'numero' || n === 'number') { props.personalization_number = v; props.is_personalized = true }
    else if (n === 'patches' || n === 'patch') { props.has_patches = true; props.patches_count += v.split(/[,;]|\s+e\s+/).filter(Boolean).length; props.patch_titles.push(v) }
    else if (n === '_pairing_id') props.pairing_id = v
    else if (n === '_attached_to') { props.attached_to = v; props.is_attached = true }
  }

  return { team, team_country: country, category: is_plus_size ? 'Plus size' : category, season, season_year, size, is_plus_size, ...props }
}

// Async wrapper porque transformShopifyOrder usa hashEmail (async)
async function transformShopifyOrderAsync(order: any, clientId: string) {
  return await transformShopifyOrder(order, clientId)
}

async function transformShopifyOrder(order: any, clientId: string) {
  const customer = order.customer || {}
  const ship = order.shipping_address || {}
  const email = customer.email || order.email || null
  const email_hash = await hashEmail(email)

  const orderRow: any = {
    client_id: clientId,
    shopify_order_id: parseInt(order.id),
    order_number: order.name || null,
    created_at: order.created_at,
    cancelled_at: order.cancelled_at,
    processed_at: order.processed_at,
    currency: order.currency,
    total_price: parseFloat(order.total_price || 0),
    subtotal_price: order.subtotal_price ? parseFloat(order.subtotal_price) : null,
    total_discounts: order.total_discounts ? parseFloat(order.total_discounts) : null,
    total_tax: order.total_tax ? parseFloat(order.total_tax) : null,
    total_shipping: order.total_shipping_price_set?.shop_money?.amount ? parseFloat(order.total_shipping_price_set.shop_money.amount) : null,
    ticket_band: ticketBand(order.total_price),
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    source_name: order.source_name,
    referring_site: order.referring_site,
    landing_site: order.landing_site,
    channel: null,
    utm_source: null, utm_medium: null, utm_campaign: null,
    shopify_customer_id: customer.id ? parseInt(customer.id) : null,
    email_hash,
    ship_country: ship.country || null,
    ship_country_code: ship.country_code || null,
    ship_province: ship.province || null,
    ship_province_code: ship.province_code || null,
    ship_city: ship.city || null,
    ship_zip: ship.zip || null,
    items_count: (order.line_items || []).length,
    units_count: (order.line_items || []).reduce((s: number, li: any) => s + (li.quantity || 0), 0),
    email_marketing_consent: customer.email_marketing_consent?.state === 'subscribed',
    sms_marketing_consent: customer.sms_marketing_consent?.state === 'subscribed',
    raw_payload: order,
    enriched_at: new Date().toISOString(),
  }

  const itemRows = (order.line_items || []).map((li: any) => {
    const e = enrichLineItem(li)
    const price = parseFloat(li.price || 0)
    const qty = li.quantity || 0
    const disc = parseFloat(li.total_discount || 0)
    return {
      client_id: clientId,
      shopify_line_item_id: parseInt(li.id),
      shopify_product_id: li.product_id ? parseInt(li.product_id) : null,
      shopify_variant_id: li.variant_id ? parseInt(li.variant_id) : null,
      title: li.title || li.name || '',
      variant_title: li.variant_title,
      sku: li.sku || null,
      vendor: li.vendor || null,
      quantity: qty,
      price,
      total_discount: disc,
      line_total: price * qty - disc,
      ...e,
      model: null,
      properties_json: li.properties || null,
    }
  })

  const customerRow = customer.id ? {
    client_id: clientId,
    shopify_customer_id: parseInt(customer.id),
    email,
    email_hash,
    phone: customer.phone || null,
    phone_hash: null,
    first_name: customer.first_name || null,
    last_name: customer.last_name || null,
    country_code: customer.default_address?.country_code || ship.country_code || null,
    province_code: customer.default_address?.province_code || ship.province_code || null,
    city: customer.default_address?.city || ship.city || null,
    email_marketing_consent: customer.email_marketing_consent?.state === 'subscribed',
    sms_marketing_consent: customer.sms_marketing_consent?.state === 'subscribed',
    shopify_created_at: customer.created_at || null,
    raw_payload: customer,
  } : null

  return { orderRow, itemRows, customerRow }
}
