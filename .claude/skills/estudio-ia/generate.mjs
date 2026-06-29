#!/usr/bin/env node
// Estúdio IA — gera imagem via edge function gemini-image-gen e sobe pro Storage.
//
// Uso:
//   node .claude/skills/estudio-ia/generate.mjs --prompt "..." --slug "nome" [opts]
//   node .claude/skills/estudio-ia/generate.mjs --batch prompts.json [opts]
//
// Lê credenciais de .env.local (gitignored).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// ── 1. Carrega .env.local + .env ────────────────────────────────────
function loadEnvFile(filename) {
  const p = path.resolve(PROJECT_ROOT, filename);
  if (!fs.existsSync(p)) return {};
  const env = {};
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
  return env;
}

const envMain = loadEnvFile('.env');
const envLocal = loadEnvFile('.env.local');
const env = { ...envMain, ...envLocal };

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_JWT = env.SUPABASE_SERVICE_ROLE_JWT || env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltam credenciais. Verifique .env.local com:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...');
  console.error('   SUPABASE_SERVICE_ROLE_JWT=eyJhbGc... (legacy, pra storage)');
  process.exit(1);
}

// ── 2. Parse args ────────────────────────────────────────────────────
function parseArgs() {
  const args = {
    prompt: null,
    slug: 'image',
    batch: null,
    bucket: 'academy-covers',
    folder: 'generated',
    aspect: '1:1',
    model: 'gemini-3-pro-image-preview',
  };
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--prompt') args.prompt = raw[++i];
    else if (a === '--slug') args.slug = raw[++i];
    else if (a === '--batch') args.batch = raw[++i];
    else if (a === '--bucket') args.bucket = raw[++i];
    else if (a === '--folder') args.folder = raw[++i];
    else if (a === '--aspect') args.aspect = raw[++i];
    else if (a === '--model') args.model = raw[++i];
  }
  return args;
}

// ── 3. Chama edge function ───────────────────────────────────────────
async function generateImage(prompt, { model, aspect }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-image-gen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ prompt, model, aspectRatio: aspect }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`gemini-image-gen falhou (${res.status}): ${data.error || 'sem detalhes'}`);
  }
  return { base64: data.imageBase64, mimeType: data.mimeType };
}

// ── 4. Upload pro Storage ────────────────────────────────────────────
async function uploadImage(bucket, folder, slug, base64, mimeType) {
  const ext = (mimeType.split('/')[1] || 'png').replace('jpeg', 'jpeg');
  const filename = `${folder}/${slug}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(base64, 'base64');

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'Authorization': `Bearer ${STORAGE_JWT}`,
        'apikey': ANON_KEY,
        'x-upsert': 'true',
        'cache-control': '3600',
      },
      body: buffer,
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload falhou (${res.status}): ${t}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
}

// ── 5. Processa um item ──────────────────────────────────────────────
async function processItem({ slug, prompt, aspect }, opts) {
  const aspectFinal = aspect || opts.aspect;
  process.stdout.write(`[${slug}] Gerando (${opts.model}, ${aspectFinal})... `);
  try {
    const { base64, mimeType } = await generateImage(prompt, {
      model: opts.model,
      aspect: aspectFinal,
    });
    process.stdout.write('✓ Gerada. Subindo... ');
    const url = await uploadImage(opts.bucket, opts.folder, slug, base64, mimeType);
    console.log('✓');
    console.log(`  → ${url}`);
    return { slug, url };
  } catch (e) {
    console.log('❌');
    console.error(`  ${e.message}`);
    return { slug, error: e.message };
  }
}

// ── 6. Main ──────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  let items = [];
  if (args.batch) {
    const batchPath = path.resolve(args.batch);
    if (!fs.existsSync(batchPath)) {
      console.error(`❌ Arquivo batch não encontrado: ${batchPath}`);
      process.exit(1);
    }
    items = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
    if (!Array.isArray(items)) {
      console.error('❌ Batch deve ser array de { slug, prompt, aspect? }');
      process.exit(1);
    }
  } else if (args.prompt) {
    items = [{ slug: args.slug, prompt: args.prompt, aspect: args.aspect }];
  } else {
    console.error('❌ Passe --prompt "<texto>" OU --batch <arquivo.json>');
    console.error('   Mais info: cat .claude/skills/estudio-ia/SKILL.md');
    process.exit(1);
  }

  console.log(`🎨 Gerando ${items.length} imagem(ns) via ${args.model}...\n`);
  const results = [];
  for (const item of items) {
    const r = await processItem(item, args);
    results.push(r);
    console.log('');
  }

  const okCount = results.filter(r => r.url).length;
  const errCount = results.filter(r => r.error).length;
  console.log('════════════════════════════════════');
  console.log(`✅ ${okCount} geradas | ❌ ${errCount} falharam\n`);

  if (okCount > 0) {
    console.log('URLs (colar em código/metadata):');
    results.forEach(r => {
      if (r.url) console.log(`  ${r.slug}: '${r.url}',`);
    });
  }

  const outPath = path.resolve(__dirname, '.tmp_result.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Resultado salvo em .claude/skills/estudio-ia/.tmp_result.json`);

  if (errCount > 0) process.exit(1);
}

main().catch(e => {
  console.error('❌ Erro fatal:', e.message);
  process.exit(1);
});
