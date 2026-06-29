#!/usr/bin/env node
// Snapshot dos assets sabotados do tema 162148253938 (Campo de Treinamento)
// Roda da raiz do repo.

import { shReq, API_VERSION } from '../.claude/lib/shopify-api.mjs';
import { supaRest } from '../.claude/lib/supabase-rest.mjs';
import fs from 'fs';
import path from 'path';

const rows = await supaRest('GET',
  '/agency_clients?select=shopify_domain,shopify_access_token&name=eq.Loja%20de%20Desenvolvimento%20-%20BR&limit=1',
  null, { serviceRole: true });
const c = rows[0];
const themeId = 162148253938;
const outRoot = 'themes/_campo-treino-remote-snapshot';
const targets = [
  'snippets/cart-drawer.liquid',
  'snippets/cart-progress-bar.liquid',
  'snippets/lever-protection.liquid',
  'snippets/patch-script.liquid',
  'snippets/scarcity-badge.liquid',
  'snippets/pix-badge.liquid',
  'sections/main-cart-items.liquid',
  'config/settings_data.json',
];
for (const k of targets) {
  const r = await shReq(c.shopify_domain, c.shopify_access_token, 'GET',
    `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(k)}`);
  if (r.status === 200 && r.body?.asset?.value != null) {
    const outPath = path.join(outRoot, k);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, r.body.asset.value, 'utf8');
    console.log('OK', k, '(' + r.body.asset.value.length + ' bytes)');
  } else {
    console.log('MISSING', k, r.status);
  }
}
