// ============================================================
// Upload mk3_car_remotes.json → Supabase (tabela mk3_car_remotes)
//
//   node upload_mk3.js
//
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { SUPABASE_URL, SUPABASE_KEY } = require('../_env');
const INPUT_FILE = 'mk3_car_remotes.json';
const BATCH_SIZE = 500;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const produtos = data.produtos || [];
  console.log(`[INFO] ${produtos.length} produtos no arquivo.`);

  // Remover duplicatas por productId
  const seen = new Set();
  const unique = produtos.filter(p => {
    if (!p.productId || seen.has(p.productId)) return false;
    seen.add(p.productId);
    return true;
  });
  console.log(`[INFO] ${unique.length} produtos únicos (${produtos.length - unique.length} duplicatas removidas).`);

  const rows = unique.map(p => ({
    product_id: p.productId,
    nome: p.nome,
    url: p.url,
    preco: p.preco,
    preco_antigo: p.precoAntigo || '',
    imagem: p.imagem,
    imagem_alt: p.imagemAlt || '',
    descricao: p.descricao || '',
    rating: p.rating || '',
    estoque: p.estoque || '',
    best_seller: p.bestSeller || false,
  }));

  // Limpar tabela
  const { error: delError } = await supabase.from('mk3_car_remotes').delete().neq('id', 0);
  if (delError) {
    console.error('[ERRO] Falha ao limpar tabela:', delError.message);
    process.exit(1);
  }
  console.log('[OK] Tabela limpa.');

  // Inserir em lotes
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('mk3_car_remotes').insert(batch);
    if (error) {
      console.error(`[ERRO] Batch ${i}-${i + batch.length}:`, error.message);
      continue;
    }
    inserted += batch.length;
    console.log(`[INSERT] ${inserted}/${rows.length} (${Math.round(inserted / rows.length * 100)}%)`);
  }

  console.log(`\n[FIM] ${inserted} produtos inseridos no Supabase.`);
})();
