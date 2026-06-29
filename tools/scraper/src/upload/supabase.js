// ============================================================
// Upload catalogo_raw.json → Supabase (tabela chaves_automotivas)
//
//   node upload_supabase.js
//
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { SUPABASE_URL, SUPABASE_KEY } = require('../_env');

// ---------- CONFIGURAÇÃO ----------
const INPUT_FILE = 'catalogo_raw.json';
const BATCH_SIZE = 500; // inserir em lotes

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`[ERRO] Arquivo ${INPUT_FILE} não encontrado.`);
    process.exit(1);
  }

  const catalogo = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`[INFO] ${catalogo.length} marcas no arquivo.`);

  // Achatar a estrutura aninhada para linhas flat
  const rows = [];
  for (const marca of catalogo) {
    for (const modelo of marca.modelos) {
      for (const ano of modelo.anos) {
        for (const chave of ano.chaves) {
          rows.push({
            marca: marca.marca,
            modelo: modelo.modelo,
            ano: ano.ano,
            tipo: chave.tipo,
            descricao: chave.descricao,
            preco: chave.preco,
            key_id: chave.keyId,
            categoria: chave.categoria,
          });
        }
      }
    }
  }

  console.log(`[INFO] ${rows.length} chaves para inserir.`);

  if (rows.length === 0) {
    console.log('[AVISO] Nenhuma chave encontrada.');
    return;
  }

  // Limpar tabela antes de inserir (evita duplicatas em re-runs)
  const { error: delError } = await supabase.from('chaves_automotivas').delete().neq('id', 0);
  if (delError) {
    console.error('[ERRO] Falha ao limpar tabela:', delError.message);
    console.log('Verifique se a tabela foi criada no Supabase Dashboard.');
    process.exit(1);
  }
  console.log('[OK] Tabela limpa.');

  // Inserir em lotes
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('chaves_automotivas').insert(batch);

    if (error) {
      console.error(`[ERRO] Batch ${i}-${i + batch.length}:`, error.message);
      continue;
    }

    inserted += batch.length;
    console.log(`[INSERT] ${inserted}/${rows.length} (${Math.round(inserted / rows.length * 100)}%)`);
  }

  console.log(`\n[FIM] ${inserted} chaves inseridas no Supabase.`);
})();
