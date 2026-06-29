#!/usr/bin/env node
// generate-checklists — gera 1 arquivo MD por loja com plano de cirurgia.
// Lê o JSON mais recente do pagespeed + audita estrutura do tema (templates/index.json)
// + lista imagens grandes do shop. Não altera nada — só lê e gera relatório.

import { shReq, API_VERSION } from '../../lib/shopify-api.mjs';
import { supaRest } from '../../lib/supabase-rest.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'out', 'pagespeed');
const CHECKLISTS_DIR = path.join(OUT_DIR, 'checklists');

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmtKB(b) { return Math.round((b || 0) / 1024) + 'KB'; }
function fmtMB(b) { if (!b) return '0MB'; return (b / 1024 / 1024).toFixed(1) + 'MB'; }

async function getStoreStructure(shop, token) {
  const [tRes, filesRes] = await Promise.all([
    shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json`),
    shReq(shop, token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
      query: `{ files(first: 100, query: "media_type:IMAGE", sortKey: CREATED_AT, reverse: true) { edges { node { ... on MediaImage { id alt image { url width height } originalSource { fileSize } } } } } }`,
    }),
  ]);
  const main = tRes.body?.themes?.find(t => t.role === 'main');
  if (!main) return null;
  const drafts = (tRes.body?.themes || []).filter(t => t.role !== 'main' && t.role !== 'demo').length;

  const indexRes = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes/${main.id}/assets.json?asset[key]=templates/index.json`);
  let indexJson = {};
  try { indexJson = JSON.parse(indexRes.body?.asset?.value || '{}'); } catch {}

  const order = indexJson.order || [];
  const sections = indexJson.sections || {};
  const enabledList = order.map(id => ({ id, ...sections[id] })).filter(s => s.type && !s.disabled);
  const counts = {};
  let totalBlocks = 0;
  const monsterSections = [];
  for (const sec of enabledList) {
    counts[sec.type] = (counts[sec.type] || 0) + 1;
    const enabledBlocks = sec.blocks ? Object.entries(sec.blocks).filter(([_, b]) => !b.disabled) : [];
    totalBlocks += enabledBlocks.length;
    if (enabledBlocks.length >= 15) {
      const sample = enabledBlocks.slice(0, 5).map(([_, b]) => {
        const s = b.settings || {};
        return s.collection || s.title || s.heading || s.collection_list || s.image || JSON.stringify(s).slice(0, 60);
      });
      monsterSections.push({ id: sec.id, type: sec.type, count: enabledBlocks.length, sample });
    }
  }

  const filesEdges = filesRes.body?.data?.files?.edges || [];
  const heavyImages = filesEdges
    .map(e => e.node)
    .filter(n => n.image && (n.originalSource?.fileSize || 0) > 500_000)
    .map(n => ({
      url: n.image.url,
      name: (n.image.url || '').split('/').pop().split('?')[0],
      kb: Math.round((n.originalSource?.fileSize || 0) / 1024),
      width: n.image.width,
      height: n.image.height,
      isPng: /\.png$/i.test(n.image.url),
    }))
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 25);

  return {
    themeName: main.name,
    themeId: main.id,
    drafts,
    sectionsAtivas: enabledList.length,
    totalBlocks,
    counts,
    monsterSections,
    heavyImages,
  };
}

function buildChecklist(client, perf, struct, psiResult) {
  const md = [];
  md.push(`# Checklist: ${client.name}`);
  md.push('');
  md.push(`**Domain:** ${psiResult?.baseUrl || client.shop}`);
  md.push(`**Tema atual:** ${struct?.themeName || '?'}`);
  md.push(`**Score atual:** Performance **${perf}** · LCP ${psiResult?.results?.[0]?.metrics?.lcp_ms}ms · TBT ${psiResult?.results?.[0]?.metrics?.tbt_ms}ms · CLS ${psiResult?.results?.[0]?.metrics?.cls}`);
  md.push('');

  // Status emoji
  let status = '🟢';
  if (perf < 50) status = '🔴 CRÍTICO';
  else if (perf < 70) status = '🟠 ATENÇÃO';
  else if (perf < 85) status = '🟡 MELHORÁVEL';
  md.push(`**Status:** ${status}`);
  md.push('');

  // 1. Imagens grandes
  if (struct?.heavyImages?.length) {
    md.push('## 🖼️ Imagens grandes pra comprimir');
    md.push('');
    md.push('Top imagens >500KB no shop. **Recomendação:** baixar → comprimir pra WebP qualidade 85 → upload com novo nome → atualizar URL na section que usa.');
    md.push('');
    md.push('| KB | Dim | Formato | Arquivo |');
    md.push('|---:|:---:|:---:|---|');
    for (const img of struct.heavyImages.slice(0, 15)) {
      const fmt = img.isPng ? '🔴 PNG' : (/\.jpe?g$/i.test(img.name) ? 'JPG' : 'OTHER');
      md.push(`| ${img.kb} | ${img.width}x${img.height} | ${fmt} | \`${img.name}\` |`);
    }
    md.push('');
    const totalKB = struct.heavyImages.reduce((a, b) => a + b.kb, 0);
    const pngs = struct.heavyImages.filter(i => i.isPng);
    md.push(`**Total:** ${struct.heavyImages.length} imagens grandes (${(totalKB/1024).toFixed(1)} MB)`);
    if (pngs.length) md.push(`**Atenção:** ${pngs.length} são PNG — converter pra WebP pode reduzir 60-80%`);
    md.push('');
  }

  // 2. Sections monstro
  if (struct?.monsterSections?.length) {
    md.push('## 🧱 Sections monstro (15+ blocks)');
    md.push('');
    md.push('Cada block carrega imagem + texto above-fold. Recomendação: reduzir pra 10-12 ativos, desabilitar o resto (ou virar página separada).');
    md.push('');
    for (const s of struct.monsterSections) {
      md.push(`### ${s.type} — ${s.count} blocks`);
      md.push(`Section ID: \`${s.id}\``);
      md.push('');
      md.push('Primeiros 5 blocks (amostra):');
      for (const x of s.sample) md.push(`- \`${typeof x === 'string' ? x : JSON.stringify(x)}\``);
      md.push('');
      md.push(`**Ação sugerida:** desabilitar blocks 11+ (deixar ${s.count - 10} \`disabled: true\`) ou converter em página \`/all-${s.type}\` separada.`);
      md.push('');
    }
  }

  // 3. Sections counts
  if (struct?.counts) {
    md.push('## 📊 Estrutura da home');
    md.push('');
    md.push(`Total de sections ativas: **${struct.sectionsAtivas}** | Total de blocks: **${struct.totalBlocks}**`);
    md.push('');
    md.push('| Section type | Quantidade |');
    md.push('|---|---:|');
    Object.entries(struct.counts).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => {
      const flag = v > 3 ? ' 🟡' : '';
      md.push(`| ${k} | ${v}${flag} |`);
    });
    md.push('');
    if (struct.drafts > 5) md.push(`⚠️ **${struct.drafts} drafts de tema** — não afeta perf, mas vale higienizar.`);
    md.push('');
  }

  // 4. Third-party scripts pesados
  if (psiResult?.results?.[0]?.heavyRequests?.length) {
    const scripts = psiResult.results[0].heavyRequests.filter(h => h.type === 'Script' || h.type === 'Other');
    if (scripts.length) {
      md.push('## 🧩 Scripts pesados detectados (PageSpeed)');
      md.push('');
      md.push('| KB | ms | URL |');
      md.push('|---:|---:|---|');
      for (const s of scripts.slice(0, 8)) md.push(`| ${s.kb} | ${s.ms} | \`${s.url.slice(0, 100)}\` |`);
      md.push('');
    }
  }

  // 5. Ranking de ações por ROI
  md.push('## 🎯 Ações em ordem de ROI');
  md.push('');
  let n = 1;
  if (struct?.heavyImages?.filter(i => i.isPng).length) {
    md.push(`${n++}. **Converter PNGs hero pra WebP** — ${struct.heavyImages.filter(i => i.isPng).length} PNGs grandes detectados. Maior impacto no LCP.`);
  }
  if (struct?.monsterSections?.length) {
    md.push(`${n++}. **Reduzir blocks das sections monstro** — ${struct.monsterSections.map(m => m.type + '(' + m.count + ')').join(', ')}.`);
  }
  if (struct?.heavyImages?.length > 5) {
    md.push(`${n++}. **Comprimir restante das imagens grandes** — ${struct.heavyImages.length - struct.heavyImages.filter(i => i.isPng).length} JPEGs >500KB pra recomprimir.`);
  }
  md.push(`${n++}. **Re-rodar PageSpeed depois** pra medir ganho: \`node .claude/skills/pagespeed/pagespeed.mjs "${client.name}"\``);
  md.push('');

  return md.join('\n');
}

(async () => {
  // Pegar JSON mais recente
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort().reverse();
  if (!files.length) { console.error('Nenhum JSON do pagespeed encontrado em', OUT_DIR); process.exit(1); }
  const latest = path.join(OUT_DIR, files[0]);
  console.log('Lendo:', files[0]);
  const psiData = JSON.parse(fs.readFileSync(latest, 'utf8'));
  const ok = psiData.filter(s => s?.results?.length);
  console.log(`Lojas com PSI ok: ${ok.length}`);

  if (!fs.existsSync(CHECKLISTS_DIR)) fs.mkdirSync(CHECKLISTS_DIR, { recursive: true });

  // Pegar credenciais de todas as lojas
  const ids = ok.map(s => s.client.id).join(',');
  const url = `/agency_clients?select=id,name,shopify_domain,shopify_access_token&id=in.(${ids})`;
  const rows = await supaRest('GET', url, null, { serviceRole: true });
  const credMap = Object.fromEntries(rows.map(r => [r.id, r]));

  // Filtrar lojas que precisam de checklist (perf < 90)
  const targets = ok.filter(s => {
    const home = s.results.find(r => r.page_type === 'home');
    return home && home.performance < 90;
  });
  console.log(`Gerando checklist pra ${targets.length} lojas (perf < 90)...\n`);

  const summary = [];
  for (const s of targets) {
    const cred = credMap[s.client.id];
    if (!cred?.shopify_access_token) {
      console.log(`✗ ${s.client.name} — sem token`);
      continue;
    }
    const home = s.results.find(r => r.page_type === 'home') || s.results[0];
    process.stdout.write(`→ ${s.client.name.padEnd(32)} `);
    let struct = null;
    try { struct = await getStoreStructure(cred.shopify_domain, cred.shopify_access_token); }
    catch (e) { console.log(`✗ ${e.message.slice(0, 60)}`); continue; }

    const md = buildChecklist(s.client, home.performance, struct, s);
    const slug = slugify(s.client.name);
    const file = path.join(CHECKLISTS_DIR, `${slug}.md`);
    fs.writeFileSync(file, md);
    console.log(`✓ perf=${home.performance} blocks=${struct?.totalBlocks || 0} imgs=${struct?.heavyImages?.length || 0} drafts=${struct?.drafts || 0}`);

    summary.push({
      loja: s.client.name,
      perf: home.performance,
      sections: struct?.sectionsAtivas || 0,
      blocks: struct?.totalBlocks || 0,
      monstros: struct?.monsterSections?.length || 0,
      imgs_grandes: struct?.heavyImages?.length || 0,
      pngs: struct?.heavyImages?.filter(i => i.isPng).length || 0,
      drafts: struct?.drafts || 0,
    });
  }

  // Index file
  const idx = ['# Checklists PageSpeed — index', ''];
  idx.push(`Gerado em ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  idx.push('');
  idx.push('| Loja | Perf | Sections | Blocks | Monstros | Imgs >500KB | PNGs | Drafts |');
  idx.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of summary.sort((a, b) => a.perf - b.perf)) {
    idx.push(`| [${s.loja}](${slugify(s.loja)}.md) | ${s.perf} | ${s.sections} | ${s.blocks} | ${s.monstros} | ${s.imgs_grandes} | ${s.pngs} | ${s.drafts} |`);
  }
  fs.writeFileSync(path.join(CHECKLISTS_DIR, 'INDEX.md'), idx.join('\n'));

  console.log(`\n📁 Checklists salvos em out/pagespeed/checklists/`);
  console.log(`   index: out/pagespeed/checklists/INDEX.md`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
