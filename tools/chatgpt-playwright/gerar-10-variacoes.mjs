// gerar-10-variacoes.mjs — Roda 10 variações × (9:16 + 1:1) = 20 imagens.
//
// Cada variação tem uma estratégia diferente (definida em VARIACOES abaixo).
// Roda serial (uma de cada vez). Se uma falha, pula pra próxima.
//
// Como usar:
//   node gerar-10-variacoes.mjs \
//     --base-prompt "Adapte esta arte ..." \
//     --ref ./inputs/referencia.jpg \
//     --ref ./inputs/logo-puskas.png \
//     --ref ./inputs/brasil-neymar-01.jpg ... \
//     --out-dir ./output/brasil-puskas-2026XXXX/
//
// O --base-prompt é o prompt template SEM a instrução de variação.
// O script adiciona automaticamente "VARIAÇÃO #N: [estratégia]" ao final.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- args ----------
const args = process.argv.slice(2);
const argMap = {};
const refs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--ref') { refs.push(args[++i]); continue; }
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const val = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : 'true';
    argMap[key] = val;
  }
}

let BASE_PROMPT = argMap['base-prompt'];
if (argMap['base-prompt-file']) {
  BASE_PROMPT = (await fs.readFile(argMap['base-prompt-file'], 'utf-8')).trim();
}
const OUT_DIR = argMap['out-dir'] || `./output/variacoes-${Date.now()}/`;
const START_AT = parseInt(argMap['start-at'] || '1', 10); // pra retomar do meio se quiser
const TIMEOUT = parseInt(argMap.timeout || '300000', 10);

if (!BASE_PROMPT) {
  console.error('❌ --base-prompt é obrigatório');
  process.exit(1);
}
await fs.mkdir(OUT_DIR, { recursive: true });

// ---------- ESTRATÉGIAS DAS 10 VARIAÇÕES ----------
const VARIACOES = [
  // V1 — base padrão
  'Versão BASE: gere exatamente como a arte de referência, sem variações extras.',

  // V2 — ângulo/peça diferente
  'Variação SUTIL: mostre a camisa em ângulo levemente diferente do original (mais 3/4 ou mais frontal), e priorize uma vista alternativa do produto se houver mais de uma camisa nas referências.',

  // V3 — destacar promoção diferente
  'Variação SUTIL: rotacione qual promoção fica em maior destaque visual. Se a referência destaca "COMPRE 2 LEVE 3", agora dê mais destaque para outra oferta (frete grátis, parcelamento, ou desconto na primeira compra).',

  // V4 — background diferente
  'Variação SUTIL: mude levemente a textura/padronagem do background, mantendo a mesma paleta de cores. Use elementos decorativos diferentes (estrelas em outra disposição, textura de tecido em vez de gramado, ou padronagem geométrica sutil).',

  // V5 — tipografia
  'Variação SUTIL: ajuste o peso da tipografia do título principal — se a referência é grossa, faça mais fina; se é fina, faça mais grossa. Mantenha a fonte (família) idêntica.',

  // V6 — disposição
  'Variação SUTIL: troque a disposição dos elementos — se a camisa está à esquerda, coloque à direita; se a taça está no canto inferior direito, mova para o esquerdo. Espelhamento horizontal sutil dos elementos.',

  // V7 — foto diferente
  'Variação SUTIL: use uma foto DIFERENTE da camisa entre as anexadas. Se a referência usa a foto frontal, use uma foto de costas ou em modelo posando se disponível.',

  // V8 — hierarquia
  'Variação SUTIL: aumente um pouco o destaque do logo da loja (segunda imagem em anexo) — torne-o mais visível na composição, sem dominar a arte.',

  // V9 — elementos decorativos
  'Variação SUTIL: adicione elementos decorativos sutis que reforcem o time/seleção — número icônico do clube (ano de fundação, número de títulos), bandeira do país se for seleção, ou textura referente ao escudo. Não exagere, mantenha clean.',

  // V10 — urgência/escassez
  'Variação SUTIL: adicione um pequeno elemento de urgência/escassez ao layout — selo "EDIÇÃO LIMITADA", "ÚLTIMAS UNIDADES", ou contador "OFERTA POR TEMPO LIMITADO". Coloque de forma discreta, sem competir com o título principal.',
];

const PROMPT_1x1 = 'Agora gere a mesma arte que você acabou de gerar, mas na proporção 1:1 (formato quadrado, feed do Instagram). Mantenha TODOS os elementos visuais, textuais, cores, tipografia e composição idênticos — apenas ajuste o enquadramento para caber no formato quadrado.';

// ---------- run ----------
const startedAt = Date.now();
const results = [];

console.log(`\n🎨 Iniciando ${VARIACOES.length - (START_AT - 1)} variações × 2 formatos = ${(VARIACOES.length - (START_AT - 1)) * 2} imagens`);
console.log(`📂 Output: ${OUT_DIR}`);
console.log(`📎 Refs: ${refs.length} arquivos\n`);

for (let i = START_AT - 1; i < VARIACOES.length; i++) {
  const variacaoNum = i + 1;
  const variacaoStr = String(variacaoNum).padStart(2, '0');
  const estrategia = VARIACOES[i];

  const prompt9x16 = `${BASE_PROMPT}\n\n${estrategia}`;
  const out9x16 = path.join(OUT_DIR, `v${variacaoStr}-9x16.png`);
  const out1x1 = path.join(OUT_DIR, `v${variacaoStr}-1x1.png`);

  console.log(`\n══════ V${variacaoStr} (${i + 1}/${VARIACOES.length}) ══════`);
  console.log(`Estratégia: ${estrategia.slice(0, 80)}…`);

  const cliArgs = [
    'generate-pair.mjs',
    '--prompt-9x16', prompt9x16,
    '--prompt-1x1', PROMPT_1x1,
    '--out-9x16', out9x16,
    '--out-1x1', out1x1,
    '--timeout', String(TIMEOUT),
    '--debug',
  ];
  for (const ref of refs) {
    cliArgs.push('--ref', ref);
  }

  const start = Date.now();
  const exitCode = await new Promise(resolve => {
    const child = spawn('node', cliArgs, { cwd: __dirname, stdio: 'inherit' });
    child.on('exit', resolve);
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(0);

  if (exitCode === 0) {
    results.push({ v: variacaoNum, status: 'ok', tempo: elapsed });
    console.log(`✅ V${variacaoStr} completa em ${elapsed}s`);
  } else if (exitCode === 3) {
    // 9:16 deu certo mas 1:1 falhou
    results.push({ v: variacaoNum, status: 'parcial (só 9:16)', tempo: elapsed });
    console.log(`⚠️  V${variacaoStr}: 9:16 ok, mas 1:1 falhou`);
  } else {
    results.push({ v: variacaoNum, status: `falhou (exit ${exitCode})`, tempo: elapsed });
    console.log(`❌ V${variacaoStr} falhou (exit code ${exitCode})`);
  }

  // pausa pra não estressar ChatGPT
  if (i < VARIACOES.length - 1) {
    console.log('⏸️  Pausa 8s antes da próxima…');
    await new Promise(r => setTimeout(r, 8000));
  }
}

// ---------- resumo ----------
const totalElapsed = ((Date.now() - startedAt) / 60000).toFixed(1);
const ok = results.filter(r => r.status === 'ok').length;
const parcial = results.filter(r => r.status.includes('parcial')).length;
const fail = results.filter(r => r.status.includes('falhou')).length;

console.log(`\n${'═'.repeat(50)}`);
console.log(`🏁 FIM — ${totalElapsed} min total`);
console.log(`${'═'.repeat(50)}`);
console.log(`✅ ${ok} completas (9:16 + 1:1)`);
console.log(`⚠️  ${parcial} parciais (só 9:16)`);
console.log(`❌ ${fail} falhas`);
console.log(`\nDetalhes:`);
for (const r of results) {
  console.log(`  V${String(r.v).padStart(2, '0')}: ${r.status} (${r.tempo}s)`);
}
console.log(`\n📂 Imagens em: ${OUT_DIR}`);

// salva resumo em arquivo
await fs.writeFile(
  path.join(OUT_DIR, '_resumo.json'),
  JSON.stringify({ ok, parcial, fail, totalMin: totalElapsed, results }, null, 2)
);
