// ============================================================
// Upload mk3_deep.json → Supabase (tabela mk3_produtos)
//
//   node upload_mk3_deep.js
//
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { SUPABASE_URL, SUPABASE_KEY } = require('../_env');
const INPUT_FILE = 'mk3_deep.json';
const BATCH_SIZE = 100;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  // Filtrar produtos com erro
  const produtos = data.filter(p => !p.erro);
  console.log(`[INFO] ${produtos.length} produtos válidos (${data.length - produtos.length} com erro removidos).`);

  const rows = produtos.map(p => {
    // Filtrar imagens — só manter as do próprio produto (mesmo productId no alt ou primeiras imagens)
    const productImgs = (p.imagens || []).filter(img => {
      if (!img.src || img.src.includes(p.url)) return false; // URL da página, não imagem
      // Manter só imagens que contêm parte do nome do produto no alt, ou as primeiras 6
      return true;
    }).slice(0, 10); // máx 10 imagens por produto

    return {
      product_id: p.productId,
      nome: p.nome || '',
      url: p.url || '',
      sku: p.sku || '',
      preco: p.preco || '',
      preco_antigo: p.precoAntigo || '',
      fabricante: p.fabricante || '',
      estoque: p.estoque || '',
      peso: p.weight || '',
      specs: p.specs || {},
      imagens: productImgs,
      fitments: p.modelos || [],
      price_breaks: p.priceBreaks || [],
      descricao: (p.fullDescription || '').substring(0, 10000),
    };
  });

  // Limpar tabela
  const { error: delError } = await supabase.from('mk3_produtos').delete().neq('id', 0);
  if (delError) {
    console.error('[ERRO] Falha ao limpar tabela:', delError.message);
    process.exit(1);
  }
  console.log('[OK] Tabela limpa.');

  // Inserir em lotes
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('mk3_produtos').insert(batch);
    if (error) {
      console.error(`[ERRO] Batch ${i}-${i + batch.length}:`, error.message);
      // Tentar inserir um por um pra identificar o problemático
      for (const row of batch) {
        const { error: singleErr } = await supabase.from('mk3_produtos').insert(row);
        if (singleErr) {
          console.error(`  [SKIP] ${row.nome.substring(0, 50)}: ${singleErr.message}`);
        } else {
          inserted++;
        }
      }
      continue;
    }
    inserted += batch.length;
    console.log(`[INSERT] ${inserted}/${rows.length} (${Math.round(inserted / rows.length * 100)}%)`);
  }

  console.log(`\n[FIM] ${inserted} produtos inseridos no Supabase.`);
})();
