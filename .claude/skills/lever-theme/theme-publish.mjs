#!/usr/bin/env node
// theme-publish — promove o draft theme de um cliente pra main (publica).
//
// ⚠️ OPERAÇÃO DESTRUTIVA: o tema main atual fica unpublished, o draft vira main.
// Sempre confirma antes de aplicar.
//
// Uso:
//   node theme-publish.mjs <clientIdOrName>             # dry-run (só mostra o que ia fazer)
//   node theme-publish.mjs <clientIdOrName> --apply     # aplica de verdade

import { fetchClient } from '../../lib/supabase-rest.mjs';
import { shReq, API_VERSION } from '../../lib/shopify-api.mjs';
import { appendExecutionLog } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

async function main() {
  const arg = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!arg) {
    console.error('Uso: node theme-publish.mjs <clientIdOrName> [--apply]');
    process.exit(1);
  }

  const client = await fetchClient(arg);
  if (!client) { console.error('Cliente não encontrado'); process.exit(1); }

  const metaFile = path.join(REPO_ROOT, `themes/client-${client.id.slice(0, 8)}/.theme-draft.json`);
  if (!fs.existsSync(metaFile)) {
    console.error(`\n❌ Nenhum draft criado pra "${client.name}".`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const { draftThemeId, mainThemeId, draftName } = meta;
  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  console.log(`\n=== theme-publish ${apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Cliente:    ${client.name}`);
  console.log(`Shop:       ${shop}`);
  console.log(`\nOperação:`);
  console.log(`  - Theme atual main:    id=${mainThemeId}`);
  console.log(`  - Draft a promover:    id=${draftThemeId} ("${draftName}")`);

  if (!apply) {
    console.log(`\n[DRY-RUN] Ao rodar com --apply:`);
    console.log(`  1. Draft (${draftThemeId}) vira main — vai pra produção`);
    console.log(`  2. Main atual (${mainThemeId}) vira unpublished`);
    console.log(`  3. Arquivo .theme-draft.json é movido pra .theme-published.json`);
    console.log(`\n⚠️  Isso afeta a loja AO VIVO do cliente. Confirme antes.`);
    return;
  }

  // CONFIRMAÇÃO FINAL: exige que o user passe --yes também
  if (!process.argv.includes('--yes')) {
    console.log(`\n⚠️  Pra confirmar de verdade, rode novamente com --apply --yes`);
    console.log(`    (mecanismo anti-pressionou-por-engano)`);
    process.exit(0);
  }

  console.log(`\nPublicando draft como main...`);
  const r = await shReq(shop, token, 'PUT',
    `/admin/api/${API_VERSION}/themes/${draftThemeId}.json`,
    { theme: { id: draftThemeId, role: 'main' } });

  if (r.status !== 200) {
    console.error(`❌ Falha: ${r.status}`, JSON.stringify(r.body).slice(0, 300));
    console.error(`   Estado preservado: .theme-draft.json mantido intacto.`);
    process.exit(1);
  }

  console.log(`✓ Draft publicado como main.`);
  console.log(`   O tema anterior (${mainThemeId}) agora está unpublished.`);

  // Move .theme-draft.json → .theme-published.json — com rollback atômico
  const publishedFile = path.join(path.dirname(metaFile), '.theme-published.json');
  const published = { ...meta, publishedAt: new Date().toISOString(), previousMainId: mainThemeId };
  const draftBackup = fs.readFileSync(metaFile, 'utf8'); // backup pro rollback
  let publishedWritten = false;
  try {
    fs.writeFileSync(publishedFile, JSON.stringify(published, null, 2));
    publishedWritten = true;
    fs.unlinkSync(metaFile);
    console.log(`\n📋 Histórico salvo em .theme-published.json`);
  } catch (fsErr) {
    console.error(`\n⚠ Erro finalizando arquivos locais: ${fsErr.message}`);
    console.error(`   ATENÇÃO: a publicação na Shopify FOI bem-sucedida.`);
    console.error(`   Rollback local em progresso...`);
    try {
      if (publishedWritten && fs.existsSync(publishedFile)) fs.unlinkSync(publishedFile);
      if (!fs.existsSync(metaFile)) fs.writeFileSync(metaFile, draftBackup);
      console.error(`   Rollback local OK. Rode /lever-theme publish novamente pra salvar histórico.`);
    } catch (rollbackErr) {
      console.error(`   Rollback falhou: ${rollbackErr.message}. Estado inconsistente — ajuste manual.`);
    }
    // Não exit(1) porque a op principal (publicação) deu certo
  }

  await appendExecutionLog({
    skill: 'lever-theme',
    op: 'publish',
    client_id: client.id,
    published_theme_id: draftThemeId,
    previous_main_id: mainThemeId,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
