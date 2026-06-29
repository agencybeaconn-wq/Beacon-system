import https from 'https';
import sharp from 'sharp';

const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4aG16cHd2eHZsd25namJqa3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzQ5NDksImV4cCI6MjA4NDUxMDk0OX0.9Wz6imtaCdwU4d0yRodSehWwHHWKRZ3WCRatL0WXyos';
const WORKSPACE = '3cb9ac39-d833-449e-a4ae-77197a5eba3b';
const SETOR_ID = 'e53fcdb5-0855-49ed-adc5-babe5a11e67c';
const FOLDER_ID = '1ZnVb1KWEgBTRPQQA22qHzeNZsSYvTppZ'; // Rotativos

function sb(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'pxhmzpwvxvlwngjbjkrg.supabase.co',
      path: `/rest/v1/${path}`, method: 'GET',
      headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}` }
    }, (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(JSON.parse(b))); });
    req.end();
  });
}

function driveCall(body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'pxhmzpwvxvlwngjbjkrg.supabase.co',
      path: '/functions/v1/google-drive',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON}`, 'apikey': ANON }
    }, (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(JSON.parse(b))); });
    req.write(payload); req.end();
  });
}

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        downloadUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

function shopifyGQL(shop, token, query, variables) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: shop, path: '/admin/api/2026-01/graphql.json', method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    }, (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(JSON.parse(b))); });
    req.write(payload); req.end();
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== Upload Banners Setor Esportes ===\n');

  // Get Shopify creds
  const creds = await sb(`agency_clients?select=shopify_domain,shopify_access_token&id=eq.${SETOR_ID}`);
  const { shopify_domain: shop, shopify_access_token: token } = creds[0];

  // Get Google token from google_connections
  const gConn = await sb(`google_connections?select=access_token&workspace_id=eq.${WORKSPACE}&status=eq.connected&limit=1`);
  if (!gConn[0]?.access_token) { console.log('Google Drive not connected'); return; }
  const driveToken = gConn[0].access_token;

  // List files in Rotativos folder
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&fields=files(id,name,mimeType,size)&pageSize=50`;
  const listRes = await new Promise((resolve) => {
    const req = https.request(listUrl, { headers: { 'Authorization': `Bearer ${driveToken}` } },
      (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(JSON.parse(b))); });
    req.end();
  });

  const files = (listRes.files || []).filter(f => /image/i.test(f.mimeType));
  console.log('Imagens:', files.length);
  files.forEach(f => console.log('  ' + f.name + ' (' + (parseInt(f.size || 0) / 1024).toFixed(0) + 'KB)'));

  let uploaded = 0;
  for (const file of files) {
    console.log(`\n[${uploaded + 1}/${files.length}] ${file.name}`);

    // Download from Drive directly
    console.log('  Downloading...');
    const dlUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    const imageBuffer = await new Promise((resolve, reject) => {
      const req = https.request(dlUrl, { headers: { 'Authorization': `Bearer ${driveToken}` } },
        (res) => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
      req.on('error', reject);
      req.end();
    });
    console.log('  Downloaded:', (imageBuffer.length / 1024).toFixed(0) + 'KB');

    // Convert to WEBP
    console.log('  Converting to WEBP...');
    const webpBuffer = await sharp(imageBuffer).webp({ quality: 85 }).toBuffer();
    const webpName = file.name.replace(/\.(png|jpg|jpeg|gif)$/i, '.webp');
    console.log('  WEBP:', (webpBuffer.length / 1024).toFixed(0) + 'KB');

    // Upload to Shopify
    console.log('  Uploading to Shopify...');
    const stageResult = await shopifyGQL(shop, token, `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { message }
        }
      }
    `, {
      input: [{ resource: 'FILE', filename: webpName, mimeType: 'image/webp', fileSize: webpBuffer.length.toString(), httpMethod: 'POST' }]
    });

    const target = stageResult.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) { console.log('  ❌ Stage failed'); continue; }

    // Multipart upload
    const boundary = '----Boundary' + Math.random().toString(36).substring(2);
    let formParts = '';
    for (const p of target.parameters) {
      formParts += `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`;
    }
    formParts += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${webpName}"\r\nContent-Type: image/webp\r\n\r\n`;
    const bodyBuffer = Buffer.concat([Buffer.from(formParts), webpBuffer, Buffer.from(`\r\n--${boundary}--\r\n`)]);

    const uploadRes = await new Promise((resolve) => {
      const parsedUrl = new URL(target.url);
      const req = https.request({
        hostname: parsedUrl.hostname, path: parsedUrl.pathname, method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': bodyBuffer.length }
      }, (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(res.statusCode)); });
      req.write(bodyBuffer); req.end();
    });

    if (uploadRes >= 200 && uploadRes < 300) {
      // Register file
      const keyParam = target.parameters.find(p => p.name === 'key');
      await shopifyGQL(shop, token, `
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) { files { id } userErrors { message } }
        }
      `, { files: [{ alt: webpName.replace('.webp', ''), contentType: 'IMAGE', originalSource: target.resourceUrl || `${target.url}/${keyParam?.value}` }] });
      console.log('  ✅ ' + webpName);
      uploaded++;
    } else {
      console.log('  ❌ Upload failed:', uploadRes);
    }
    await delay(500);
  }

  console.log(`\n=== COMPLETO ===`);
  console.log(`Uploaded: ${uploaded}/${files.length}`);
}

main();
