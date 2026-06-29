// ============================================================
// Upload cke_produtos.json → Supabase (tabela cke_produtos)
//
//   node upload_cke.js
//
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { SUPABASE_URL, SUPABASE_KEY } = require('../_env');
const INPUT_FILE = 'cke_produtos.json';
const BATCH_SIZE = 200;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const produtos = data.produtos || [];
  console.log(`[INFO] ${produtos.length} produtos para inserir.`);

  const rows = produtos.map(p => ({
    product_id: p.id || 0,
    marca: p.marca || '',
    modelo: p.modelo || '',
    ano: p.ano || 0,
    titulo: p.titulo || '',
    titulo_curto: p.titulo_curto || '',
    subtitulo: p.subtitulo || '',
    sku: p.sku || '',
    tipo: p.tipo || '',
    marca_produto: p.marca_produto || '',
    preco: p.preco || null,
    preco_canada: p.preco_canada || null,
    preco_pop: p.preco_pop || null,
    botoes: p.botoes || null,
    features: p.features || [],
    part_numbers: p.part_numbers || [],
    fotos: p.fotos || [],
    thumbnails: p.thumbnails || [],
    foto_360: p.foto_360 || '',
    requer_corte: p.requer_corte || false,
    requer_programacao: p.requer_programacao || false,
    transponder_id: p.transponder_id || null,
    blade_id: p.blade_id || null,
    battery_id: p.battery_id || null,
    keyway_type: p.keyway_type || '',
    descricao: (p.descricao || '').substring(0, 10000),
    avisos: p.avisos || [],
    servico_corte: p.servico_corte || null,
    consumer_sellable: p.consumer_sellable || false,
    dispatch_exclusive: p.dispatch_exclusive || false,
    veiculo_descricao: (p.veiculo_descricao || '').substring(0, 5000),
    max_chaves: p.max_chaves || null,
    max_remotes: p.max_remotes || null,
    max_prox: p.max_prox || null,
    pin_required: p.pin_required || null,
  }));

  // Limpar tabela
  const { error: delError } = await supabase.from('cke_produtos').delete().neq('id', 0);
  if (delError) {
    console.error('[ERRO]', delError.message);
    process.exit(1);
  }
  console.log('[OK] Tabela limpa.');

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('cke_produtos').insert(batch);
    if (error) {
      console.error(`[ERRO] Batch ${i}: ${error.message}`);
      continue;
    }
    inserted += batch.length;
    console.log(`[INSERT] ${inserted}/${rows.length} (${Math.round(inserted / rows.length * 100)}%)`);
  }

  console.log(`\n[FIM] ${inserted} produtos inseridos no Supabase.`);
})();
