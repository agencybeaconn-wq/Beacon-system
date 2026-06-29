#!/usr/bin/env node
/**
 * Upload Images: Google Drive → WEBP → Shopify Files
 *
 * Usage:
 *   node scripts/upload-images.mjs "Nome do Cliente" [pasta-drive-id]
 *
 * Requirements:
 *   - npm install sharp
 *   - Google Drive connected in the system
 *   - Shopify connected for the client
 *
 * Flow:
 *   1. Find client in system (agency_clients)
 *   2. List images from Google Drive folder
 *   3. Download each image
 *   4. Convert to WEBP using Sharp
 *   5. Upload to Shopify Files via stagedUploadsCreate
 */

import https from 'https';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const envPath = resolve(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
} catch(e) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const clientName = process.argv[2];
const driveFolderId = process.argv[3];

if (!clientName) {
  console.error('Usage: node scripts/upload-images.mjs "Nome do Cliente" [drive-folder-id]');
  process.exit(1);
}

// ─── HTTP Helpers ───

function supabaseRest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const url = new URL(SUPABASE_URL);
    const req = https.request({
      hostname: url.hostname,
      path: `/rest/v1/${path}`,
      method,
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve(b); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function supabaseFunction(fnName, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(SUPABASE_URL);
    const req = https.request({
      hostname: url.hostname,
      path: `/functions/v1/${fnName}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve(b); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function shopifyGraphQL(shop, token, query, variables) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: shop,
      path: '/admin/api/2026-01/graphql.json',
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve(b); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpPost(url, formData, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.write(formData);
    req.end();
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Main ───

async function main() {
  console.log(`\n=== Upload Images: ${clientName} ===\n`);

  // 1. Find client
  const clients = await supabaseRest('GET', `agency_clients?select=id,name,shopify_domain,shopify_access_token,shopify_status,workspace_id&name=ilike.*${encodeURIComponent(clientName)}*&shopify_status=eq.connected`);

  if (!Array.isArray(clients) || clients.length === 0) {
    console.error('Client not found or Shopify not connected:', clientName);
    process.exit(1);
  }

  const client = clients[0];
  console.log('Client:', client.name);
  console.log('Shop:', client.shopify_domain);

  // 2. List images from Google Drive
  console.log('\nListando imagens do Drive...');
  const driveResult = await supabaseFunction('google-drive', {
    action: 'listClientFiles',
    workspaceId: client.workspace_id,
    folderId: driveFolderId || undefined,
    query: undefined,
    pageSize: 100,
  });

  if (!driveResult.success) {
    console.error('Erro ao listar Drive:', driveResult.error);
    console.log('Dica: Passe o ID da pasta do Drive como 2º argumento');
    process.exit(1);
  }

  const files = (driveResult.data?.files || []).filter(f =>
    /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name) ||
    ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.mimeType)
  );

  console.log('Imagens encontradas:', files.length);
  files.forEach(f => console.log('  ' + f.name + ' (' + f.mimeType + ')'));

  if (files.length === 0) {
    console.log('Nenhuma imagem encontrada.');
    process.exit(0);
  }

  // 3. Download, convert, upload each image
  let uploaded = 0;
  let errors = 0;

  for (const file of files) {
    try {
      console.log(`\n[${uploaded + errors + 1}/${files.length}] ${file.name}`);

      // Download from Drive
      console.log('  Downloading...');
      const dlResult = await supabaseFunction('google-drive', {
        action: 'downloadFile',
        workspaceId: client.workspace_id,
        fileId: file.id,
      });

      if (!dlResult.success) {
        console.log('  ❌ Download failed:', dlResult.error);
        errors++;
        continue;
      }

      const imageBuffer = Buffer.from(dlResult.data.content, 'base64');

      // Convert to WEBP
      console.log('  Converting to WEBP...');
      const webpBuffer = await sharp(imageBuffer).webp({ quality: 85 }).toBuffer();
      const webpName = file.name.replace(/\.(png|jpg|jpeg|gif)$/i, '.webp');

      console.log('  Original:', (imageBuffer.length / 1024).toFixed(1) + 'KB → WEBP:', (webpBuffer.length / 1024).toFixed(1) + 'KB');

      // Upload to Shopify Files via stagedUploadsCreate
      console.log('  Uploading to Shopify...');

      // Step 1: Create staged upload
      const stageResult = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters { name value }
            }
            userErrors { field message }
          }
        }
      `, {
        input: [{
          resource: 'FILE',
          filename: webpName,
          mimeType: 'image/webp',
          fileSize: webpBuffer.length.toString(),
          httpMethod: 'POST',
        }]
      });

      const target = stageResult.data?.stagedUploadsCreate?.stagedTargets?.[0];
      if (!target) {
        console.log('  ❌ Staged upload failed:', JSON.stringify(stageResult.data?.stagedUploadsCreate?.userErrors));
        errors++;
        continue;
      }

      // Step 2: Upload to staged URL using multipart form
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      let formBody = '';
      for (const param of target.parameters) {
        formBody += `--${boundary}\r\nContent-Disposition: form-data; name="${param.name}"\r\n\r\n${param.value}\r\n`;
      }
      formBody += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${webpName}"\r\nContent-Type: image/webp\r\n\r\n`;
      const formEnd = `\r\n--${boundary}--\r\n`;

      const bodyBuffer = Buffer.concat([
        Buffer.from(formBody),
        webpBuffer,
        Buffer.from(formEnd)
      ]);

      const uploadRes = await new Promise((resolve, reject) => {
        const parsedUrl = new URL(target.url);
        const req = https.request({
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': bodyBuffer.length,
          }
        }, (res) => {
          let b = ''; res.on('data', c => b += c);
          res.on('end', () => resolve({ status: res.statusCode }));
        });
        req.on('error', reject);
        req.write(bodyBuffer);
        req.end();
      });

      if (uploadRes.status >= 200 && uploadRes.status < 300) {
        // Step 3: Create file in Shopify
        const keyParam = target.parameters.find(p => p.name === 'key');
        const createResult = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, `
          mutation fileCreate($files: [FileCreateInput!]!) {
            fileCreate(files: $files) {
              files { id alt }
              userErrors { field message }
            }
          }
        `, {
          files: [{
            alt: webpName.replace('.webp', ''),
            contentType: 'IMAGE',
            originalSource: target.resourceUrl || `${target.url}/${keyParam?.value}`,
          }]
        });

        const fileErrors = createResult.data?.fileCreate?.userErrors || [];
        if (fileErrors.length === 0) {
          console.log('  ✅ Uploaded: ' + webpName);
          uploaded++;
        } else {
          console.log('  ❌ File create failed:', JSON.stringify(fileErrors));
          errors++;
        }
      } else {
        console.log('  ❌ Upload failed:', uploadRes.status);
        errors++;
      }

      await delay(500);
    } catch (err) {
      console.log('  ❌ Error:', err.message);
      errors++;
    }
  }

  console.log(`\n=== COMPLETO ===`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${files.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
