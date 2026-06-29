#!/usr/bin/env node
// create-standard-pages — cria páginas legais padrão a partir de templates markdown.
//
// Uso:
//   node create-standard-pages.mjs <clientIdOrName>               # DRY-RUN
//   node create-standard-pages.mjs <clientIdOrName> --apply       # cria
//   node create-standard-pages.mjs <clientIdOrName> --lang=en     # força idioma

import { shopifyGraphQL } from '../../lib/shopify-api.mjs';
import { fetchBriefing } from '../../lib/supabase-rest.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Mapeamento: handle → título → template file
const PAGES_BR = [
  { handle: 'aviso-legal',             title: 'Aviso Legal',             file: 'br-aviso-legal.md' },
  { handle: 'compra-segura',           title: 'Compra Segura',           file: 'br-compra-segura.md' },
  { handle: 'envios-e-prazos',         title: 'Envios e Prazos',         file: 'br-envios-e-prazos.md' },
  { handle: 'opcoes-de-pagamento',     title: 'Opções de Pagamento',     file: 'br-opcoes-de-pagamento.md' },
  { handle: 'perguntas-frequentes',    title: 'Perguntas Frequentes',    file: 'br-perguntas-frequentes.md' },
  { handle: 'politica-de-privacidade', title: 'Política de Privacidade', file: 'br-politica-de-privacidade.md' },
];

const PAGES_EN = [
  { handle: 'about-us',        title: 'About Us',                    file: 'en-about-us.md' },
  { handle: 'faq',             title: 'Frequently Asked Questions',  file: 'en-faq.md' },
  { handle: 'legal-notice',    title: 'Terms of Service & Legal Notice', file: 'en-legal-notice.md' },
  { handle: 'privacy-policy',  title: 'Privacy Policy',              file: 'en-privacy-policy.md' },
  { handle: 'shipping',        title: 'Shipping & Delivery',         file: 'en-shipping.md' },
  { handle: 'payment',         title: 'Payment Options',             file: 'en-payment.md' },
  { handle: 'secure-checkout', title: 'Secure Checkout',             file: 'en-secure-checkout.md' },
];

function parseArgs() {
  const args = {
    _: [], apply: false, update: false, lang: null,
    email: null, phone: null, cnpj: null, address: null, fullName: null, shopUrl: null, shippingMin: null, businessHours: null, dpoEmail: null,
  };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--update') args.update = true;
    else if (a.startsWith('--lang=')) args.lang = a.slice(7);
    else if (a.startsWith('--locale=')) args.lang = a.slice(9); // alias pra --lang
    else if (a.startsWith('--email=')) args.email = a.slice(8);
    else if (a.startsWith('--phone=')) args.phone = a.slice(8);
    else if (a.startsWith('--cnpj=')) args.cnpj = a.slice(7);
    else if (a.startsWith('--address=')) args.address = a.slice(10);
    else if (a.startsWith('--full-name=')) args.fullName = a.slice(12);
    else if (a.startsWith('--shop-url=')) args.shopUrl = a.slice(11);
    else if (a.startsWith('--shipping-min=')) args.shippingMin = a.slice(15);
    else if (a.startsWith('--business-hours=')) args.businessHours = a.slice(17);
    else if (a.startsWith('--dpo-email=')) args.dpoEmail = a.slice(12);
    else args._.push(a);
  }
  return args;
}

function detectLang(client) {
  const name = (client.name || '').toLowerCase();
  const dom = (client.shopify_domain || '').toLowerCase();
  if (/\b(br|brasil|brazilian|brasileir)\b/i.test(name)) return 'br';
  if (dom.endsWith('.com.br') || dom.endsWith('.br')) return 'br';
  if (/\b(en|english|international|global)\b/i.test(name)) return 'en';
  if (dom.includes('-en.') || dom.endsWith('.en')) return 'en';
  return 'br'; // default pt-BR
}

function applyPlaceholders(content, data) {
  // Loop simples — troca toda chave {{X}} pelo valor correspondente.
  // Usa split/join ao invés de regex pra evitar problemas com chars especiais no valor.
  let out = content;
  for (const [key, value] of Object.entries(data)) {
    out = out.split(`{{${key}}}`).join(value ?? '');
  }
  return out;
}

/**
 * Converte markdown simples em HTML. Não cobre todos os casos — só os usados
 * nos templates (headers, parágrafos, listas, bold, links).
 */
function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;
  let inParagraph = false;
  const flushParagraph = () => {
    if (inParagraph) { out.push('</p>'); inParagraph = false; }
  };
  const flushList = () => {
    if (inList) { out.push('</ul>'); inList = false; }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#\s+/.test(line)) {
      flushParagraph(); flushList();
      out.push(`<h1>${inlineMd(line.replace(/^#\s+/, ''))}</h1>`);
    } else if (/^##\s+/.test(line)) {
      flushParagraph(); flushList();
      out.push(`<h2>${inlineMd(line.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^###\s+/.test(line)) {
      flushParagraph(); flushList();
      out.push(`<h3>${inlineMd(line.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`  <li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (!inList) { out.push('<ol>'); inList = true; }
      out.push(`  <li>${inlineMd(line.replace(/^\d+\.\s+/, ''))}</li>`);
    } else if (line === '') {
      flushParagraph(); flushList();
    } else {
      flushList();
      if (!inParagraph) { out.push('<p>'); inParagraph = true; }
      out.push(inlineMd(line));
    }
  }
  flushParagraph(); flushList();
  return out.join('\n');
}

function inlineMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

const PAGE_CREATE_MUT = `mutation pageCreate($page: PageCreateInput!) {
  pageCreate(page: $page) {
    page { id title handle isPublished }
    userErrors { field message code }
  }
}`;

const PAGE_UPDATE_MUT = `mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
  pageUpdate(id: $id, page: $page) {
    page { id title handle isPublished }
    userErrors { field message code }
  }
}`;

const PAGE_QUERY_BY_HANDLE = `query($query: String!) {
  pages(first: 1, query: $query) {
    edges { node { id title handle } }
  }
}`;

async function pageExists(shop, token, handle) {
  const r = await shopifyGraphQL(shop, token, PAGE_QUERY_BY_HANDLE, { query: `handle:${handle}` });
  return r.data?.pages?.edges?.[0]?.node || null;
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node create-standard-pages.mjs <clientIdOrName> [--apply] [--lang=br|en]');
    process.exit(1);
  }

  console.log(`\n=== create-standard-pages ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const lang = args.lang || detectLang(client);
  const pages = lang === 'en' ? PAGES_EN : PAGES_BR;
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
  console.log(`✓ Idioma: ${lang.toUpperCase()} (${pages.length} páginas padrão)`);

  // Fetch briefing pra placeholders (se existir — é opcional)
  let briefing = null;
  try { briefing = await fetchBriefing(client.id); } catch { /* ignore */ }

  // Deriva shop URL do domínio (público se disponível, senão o myshopify)
  const shopUrlDefault = args.shopUrl
    || (client.shopify_domain?.endsWith('myshopify.com')
          ? `https://${client.shopify_domain.replace('.myshopify.com', '.com.br')}`
          : `https://${client.shopify_domain}`);

  // Data hoje formatada conforme o idioma
  const today = new Date();
  const lastUpdated = lang === 'en'
    ? today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : today.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });

  const supportEmail = args.email || briefing?.email || 'contato@loja.com.br';
  const data = {
    client_name: client.name,
    company_full_name: args.fullName || client.shopify_shop_name || client.name,
    company_cnpj: args.cnpj || 'em formalização',
    company_address: args.address || 'Endereço em formalização',
    support_email: supportEmail,
    dpo_email: args.dpoEmail || supportEmail,
    support_phone: args.phone || briefing?.telefone || briefing?.whatsapp || '+55 (11) 99999-9999',
    shipping_min_value: args.shippingMin || (briefing?.frete_gratis_valor ? String(briefing.frete_gratis_valor) : '129,00'),
    business_hours: args.businessHours || briefing?.horario_atendimento || 'Seg a Sex: 09h às 18h',
    shop_url: shopUrlDefault,
    last_updated: lastUpdated,
  };
  console.log(`✓ Placeholders:`);
  console.log(`    client_name:        ${data.client_name}`);
  console.log(`    company_full_name:  ${data.company_full_name}`);
  console.log(`    company_cnpj:       ${data.company_cnpj}`);
  console.log(`    company_address:    ${data.company_address}`);
  console.log(`    support_email:      ${data.support_email}`);
  console.log(`    dpo_email:          ${data.dpo_email}`);
  console.log(`    support_phone:      ${data.support_phone}`);
  console.log(`    shipping_min_value: R$ ${data.shipping_min_value}`);
  console.log(`    business_hours:     ${data.business_hours}`);
  console.log(`    shop_url:           ${data.shop_url}`);
  console.log(`    last_updated:       ${data.last_updated}`);

  // Compute missing / existing
  console.log(`\nVerificando quais páginas já existem...`);
  const toCreate = [];
  const toUpdate = [];
  for (const p of pages) {
    const existing = await pageExists(client.shopify_domain, client.shopify_access_token, p.handle);
    if (existing) {
      if (args.update) {
        console.log(`  ↻ /${p.handle} existe (id=${existing.id.split('/').pop()}) → ATUALIZAR`);
        toUpdate.push({ ...p, existingId: existing.id });
      } else {
        console.log(`  ⊘ /${p.handle} já existe (id=${existing.id.split('/').pop()}) — skip (use --update pra sobrescrever)`);
      }
    } else {
      console.log(`  ○ /${p.handle} FALTANDO → criar`);
      toCreate.push(p);
    }
  }

  console.log(`\n=== PREVIEW ===`);
  console.log(`Páginas a criar: ${toCreate.length}/${pages.length}`);
  if (args.update) console.log(`Páginas a atualizar: ${toUpdate.length}/${pages.length}`);

  if (toCreate.length === 0 && toUpdate.length === 0) {
    console.log('\n✓ Nada a fazer (todas já existem e --update não foi passado).');
    return;
  }

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra ${args.update ? 'atualizar/criar' : 'criar'}.`);
    return;
  }

  // EXECUTE
  let ok = 0, fail = 0;
  const errors = [];

  const buildBody = (p) => {
    const tplPath = path.join(TEMPLATES_DIR, p.file);
    if (!fs.existsSync(tplPath)) throw new Error(`template não encontrado: ${p.file}`);
    const md = fs.readFileSync(tplPath, 'utf8');
    return markdownToHtml(applyPlaceholders(md, data));
  };

  if (toCreate.length > 0) {
    console.log(`\n=== CRIANDO ${toCreate.length} PÁGINAS ===`);
    for (const p of toCreate) {
      try {
        const htmlBody = buildBody(p);
        const r = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, PAGE_CREATE_MUT, {
          page: { title: p.title, handle: p.handle, body: htmlBody, isPublished: true },
        });
        const uerr = r.data?.pageCreate?.userErrors || [];
        if (uerr.length) {
          fail++;
          errors.push({ handle: p.handle, errs: uerr });
          console.log(`  ✗ ${p.handle}: ${JSON.stringify(uerr).slice(0, 200)}`);
        } else {
          ok++;
          console.log(`  ✓ ${p.handle} criada (${r.data.pageCreate.page.id.split('/').pop()})`);
        }
      } catch (e) {
        fail++;
        errors.push({ handle: p.handle, error: e.message });
        console.log(`  ✗ ${p.handle}: ${e.message}`);
      }
    }
  }

  if (toUpdate.length > 0) {
    console.log(`\n=== ATUALIZANDO ${toUpdate.length} PÁGINAS ===`);
    for (const p of toUpdate) {
      try {
        const htmlBody = buildBody(p);
        const r = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, PAGE_UPDATE_MUT, {
          id: p.existingId,
          page: { title: p.title, body: htmlBody, isPublished: true },
        });
        const uerr = r.data?.pageUpdate?.userErrors || [];
        if (uerr.length) {
          fail++;
          errors.push({ handle: p.handle, errs: uerr });
          console.log(`  ✗ ${p.handle}: ${JSON.stringify(uerr).slice(0, 200)}`);
        } else {
          ok++;
          console.log(`  ✓ ${p.handle} atualizada`);
        }
      } catch (e) {
        fail++;
        errors.push({ handle: p.handle, error: e.message });
        console.log(`  ✗ ${p.handle}: ${e.message}`);
      }
    }
  }

  console.log(`\nResultado: ok=${ok} fail=${fail}`);

  await appendExecutionLog({
    skill: 'create-standard-pages',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    lang,
    to_create: toCreate.length,
    ok, fail,
    dry_run: false,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
