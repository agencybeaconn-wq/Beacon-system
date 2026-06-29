// ============================================================
// Upload servicos_raw.json → Supabase (tabela servicos_timpson)
//
//   1. Crie a tabela no Supabase SQL Editor:
//
//   CREATE TABLE servicos_timpson (
//     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
//     url TEXT NOT NULL,
//     categoria TEXT NOT NULL,
//     titulo TEXT,
//     meta_descricao TEXT,
//     blocos JSONB,
//     imagens JSONB,
//     faqs JSONB,
//     links JSONB,
//     precos JSONB,
//     scraped_at TIMESTAMPTZ
//   );
//
//   2. Depois rode:  node upload_servicos.js
//
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { SUPABASE_URL, SUPABASE_KEY } = require('../_env');
const INPUT_FILE = 'servicos_raw.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`[ERRO] Arquivo ${INPUT_FILE} não encontrado.`);
    process.exit(1);
  }

  const dados = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  // Filtrar páginas 404
  const paginas = dados.filter(p => !p.erro && !p.titulo?.includes('Uh-oh'));
  const removidas = dados.length - paginas.length;
  console.log(`[INFO] ${paginas.length} páginas válidas (${removidas} removidas por 404).`);

  const rows = paginas.map(p => ({
    url: p.url,
    categoria: p.categoria,
    titulo: p.titulo || '',
    meta_descricao: p.metaDesc || '',
    blocos: p.blocos || [],
    imagens: p.imagens || [],
    faqs: p.faqs || [],
    links: p.links || [],
    precos: p.precos || [],
    scraped_at: p.scrapedAt || new Date().toISOString(),
  }));

  // Limpar tabela
  const { error: delError } = await supabase.from('servicos_timpson').delete().neq('id', 0);
  if (delError) {
    console.error('[ERRO] Falha ao limpar tabela:', delError.message);
    console.log('\nCrie a tabela primeiro. Cole este SQL no Supabase SQL Editor:\n');
    console.log(`CREATE TABLE servicos_timpson (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url TEXT NOT NULL,
  categoria TEXT NOT NULL,
  titulo TEXT,
  meta_descricao TEXT,
  blocos JSONB,
  imagens JSONB,
  faqs JSONB,
  links JSONB,
  precos JSONB,
  scraped_at TIMESTAMPTZ
);`);
    process.exit(1);
  }
  console.log('[OK] Tabela limpa.');

  // Inserir
  const { error } = await supabase.from('servicos_timpson').insert(rows);
  if (error) {
    console.error('[ERRO] Insert:', error.message);
    process.exit(1);
  }

  console.log(`[FIM] ${rows.length} páginas inseridas no Supabase.`);
})();
