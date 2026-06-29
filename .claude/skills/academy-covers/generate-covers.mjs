#!/usr/bin/env node
// Gera capas do Academy via edge function gemini-image-gen (Nano Banana Pro),
// sobe pro bucket academy-covers e imprime as URLs públicas pra colar no PLACEHOLDER_CATALOG.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=<key> node .claude/skills/academy-covers/generate-covers.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lê .env pra pegar SUPABASE_URL
const envPath = path.resolve(__dirname, '../../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
// Edge function usa o novo secret format (sb_secret_...)
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Storage API ainda exige JWT legacy
const STORAGE_JWT = process.env.SUPABASE_SERVICE_ROLE_JWT || SERVICE_KEY;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não setado.');
  console.error('Rode: SUPABASE_SERVICE_ROLE_KEY=<chave> node .claude/skills/academy-covers/generate-covers.mjs');
  process.exit(1);
}

const COVERS = [
  {
    slug: 'claude-code-pratica',
    prompt: 'Vertical 3:4 course cover art. Glowing holographic terminal window floating in dark space, red prompt cursor blinking, Claude AI orange spiral mark hovering above emitting crimson energy waves. Deep black background #0A0A0A with radial crimson red #E11D2E glow. Brutalist sports-brand minimalism, premium Apple-meets-OffWhite aesthetic, cinematic depth, ultra-sharp focus. No text, no logos, no watermarks.',
  },
  {
    slug: 'antigravity-pratica',
    prompt: 'Vertical 3:4 course cover art. Glowing red astronaut figure suspended mid-air defying gravity, floating code fragments and geometric polygons orbiting around, crimson energy beam from below. Deep black background #0A0A0A, dramatic red #E11D2E gradient. Brutalist sports-brand aesthetic, cinematic, ultra-premium tech. No text, no logos, no watermarks.',
  },
  {
    slug: 'geracao-imagens-ia',
    prompt: 'Vertical 3:4 course cover art. A red paint brush mid-stroke dissolving into crystalline pixels and polygons, morphing from physical paint to digital artifact. Deep black background #0A0A0A with red #E11D2E radial glow, floating chromatic particles. Brutalist premium minimalism, cinematic, ultra-sharp. No text, no logos, no watermarks.',
  },
  {
    slug: 'shopify-cli-com-ia',
    prompt: 'Vertical 3:4 course cover art. Futuristic terminal window with glowing green Shopify shopping bag icon, red command cursor, neural network data lines flowing behind. Deep black background #0A0A0A with crimson red #E11D2E accent glow. Brutalist sports-brand premium tech aesthetic, cinematic, ultra-sharp. No text, no logos, no watermarks.',
  },
  {
    slug: 'claude-skills-shopify',
    prompt: 'Vertical 3:4 course cover art. Multiple 3D isometric terminal windows stacked in a diagonal cascade, each glowing red at its prompt, connected by thin energy threads. Deep black background #0A0A0A with layered crimson red #E11D2E highlights. Brutalist sports-brand aesthetic, cinematic depth of field, premium. No text, no logos, no watermarks.',
  },
];

async function generateImage(prompt) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-image-gen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({
      prompt,
      model: 'gemini-3-pro-image-preview',
      aspectRatio: '3:4',
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`gemini-image-gen falhou: ${data.error || res.status}`);
  }
  return { base64: data.imageBase64, mimeType: data.mimeType };
}

async function uploadCover(slug, base64, mimeType) {
  const ext = mimeType.split('/')[1] || 'png';
  const filename = `catalog/${slug}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(base64, 'base64');

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/academy-covers/${filename}`,
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

  return `${SUPABASE_URL}/storage/v1/object/public/academy-covers/${filename}`;
}

async function main() {
  console.log('🎨 Gerando', COVERS.length, 'capas via Nano Banana Pro...\n');
  const results = [];

  for (const cover of COVERS) {
    process.stdout.write(`[${cover.slug}] Gerando... `);
    try {
      const { base64, mimeType } = await generateImage(cover.prompt);
      process.stdout.write('✓ Gerada. Subindo... ');
      const url = await uploadCover(cover.slug, base64, mimeType);
      console.log('✓');
      console.log(`  → ${url}\n`);
      results.push({ slug: cover.slug, url });
    } catch (e) {
      console.log('❌');
      console.error(`  ${e.message}\n`);
      results.push({ slug: cover.slug, error: e.message });
    }
  }

  console.log('\n════════════════════════════════════');
  console.log('📋 URLs GERADAS (cole no PLACEHOLDER_CATALOG):\n');
  results.forEach(r => {
    if (r.url) console.log(`  ${r.slug}: '${r.url}',`);
  });

  fs.writeFileSync(
    path.resolve(__dirname, '.tmp_covers_result.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\n✅ Resultado salvo em .claude/skills/academy-covers/.tmp_covers_result.json');
}

main().catch(e => {
  console.error('❌ Erro fatal:', e.message);
  process.exit(1);
});
