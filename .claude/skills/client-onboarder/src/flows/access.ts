// FASE 3 — collaborator request + monitor do aceite (estágios access_requested/pending/granted).
import type { Page } from 'playwright';
import { DEV_DASHBOARD } from '../lib/session.js';
import { COLLAB_REQUEST_SELECTORS as CO } from '../lib/selectors.js';
import { info, warn, snap } from '../lib/log.js';

/**
 * Envia a solicitação de acesso de colaborador pra loja (com todas as permissões).
 * Retorna 'sent' | 'already' | 'error'. O cliente precisa aceitar do lado dele.
 */
export async function sendCollabRequest(
  page: Page,
  shop: string,
  collabCode?: string,
): Promise<'sent' | 'already' | 'needs_code' | 'error'> {
  const handle = shop.replace('.myshopify.com', '');
  info(`[access] Solicitando acesso de colaborador à loja ${shop}`);

  await page.goto(`${DEV_DASHBOARD}/stores/collaborations/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.fill(CO.inputStoreUrl, handle);
  await page.waitForTimeout(400);
  // Pede acesso total (inclui "Desenvolvimento de apps", necessário pra criar o app custom)
  await page.locator(CO.buttonSelectAll).first().click().catch(() => warn('  "Selecionar tudo" não encontrado'));
  await page.waitForTimeout(400);

  // Código de colaborador (a loja gera em Segurança → Usuários). Muitas lojas EXIGEM.
  if (collabCode) {
    await page.fill(CO.inputCollabCode, collabCode).catch(() => warn('  campo do código não encontrado'));
    await page.waitForTimeout(400);
  }
  await snap(page, 'collab_request_filled');

  // Se o botão segue desabilitado, a loja exige o código de colaborador e não o temos
  const btn = page.locator(CO.buttonSubmit).first();
  if (!(await btn.isEnabled().catch(() => false))) {
    warn('  Botão desabilitado — a loja exige "Código de solicitação de colaborador" (peça ao cliente)');
    return 'needs_code';
  }

  await btn.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await snap(page, 'collab_request_result');

  const body = (await page.locator('body').textContent().catch(() => '')) || '';
  if (/já (tem|possui) acesso|already has access/i.test(body)) {
    info('  Já temos acesso (ou request já existente)');
    return 'already';
  }
  if (page.url().includes('/collaborations/new') && /erro|inválid|n(ã|a)o foi poss|not found|invalid|c(ó|o)digo/i.test(body)) {
    warn('  Possível erro no envio — conferir screenshot collab_request_result');
    return 'error';
  }
  info('  Solicitação enviada — aguardando o cliente aceitar');
  return 'sent';
}

/**
 * Checa se já temos acesso à loja (cliente aceitou). Procura o handle na aba Colaborações.
 * Heurística — calibrar no 1º teste real com uma loja que passe do pending→granted.
 */
export async function isAccessGranted(page: Page, shop: string): Promise<boolean> {
  const handle = shop.replace('.myshopify.com', '');
  // Determinístico: tenta entrar no admin da loja. Se carrega o admin, temos acesso (aceito);
  // se cai numa tela de "solicitar acesso"/negação, ainda não. (Lista de Colaborações mostra só
  // nome+ID, não dá pra casar pelo domínio com confiança.)
  await page.goto(`https://admin.shopify.com/store/${handle}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const url = page.url();
  const body = (await page.locator('body').textContent().catch(() => '')) || '';
  const denied = /solicitar acesso|request access|n(ã|a)o tem acesso|do(n.t| not) have access|not found|p(á|a)gina n(ã|a)o/i.test(body);
  return url.includes(`/store/${handle}`) && !denied;
}
