#!/usr/bin/env node
// heloisa-reply/send.mjs <numero> <arquivo-texto-utf8>
//
// Dispara mensagem via Evolution com encoding UTF-8 garantido.
// SEMPRE via arquivo (--data-binary @arquivo) — passar texto inline corrompe acentos no shell Windows.
//
// Uso: node send.mjs 5531982143790 /c/tmp/msg.txt

import fs from 'fs';
import https from 'https';

const EVO_URL = process.env.EVOLUTION_API_URL || 'https://evo.jotabot.site';
const EVO_KEY = process.env.EVOLUTION_API_KEY || 'JotaBotEVO2025_API_Key_Definitiva';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'userdcfdce54';

const [numero, txtFile] = process.argv.slice(2);
if (!numero || !txtFile) {
  console.error('Uso: node send.mjs <numero> <arquivo-utf8>');
  process.exit(1);
}

const text = fs.readFileSync(txtFile, 'utf8').trim();
const digits = numero.replace(/\D/g, '');
const payload = Buffer.from(JSON.stringify({ number: digits, text }), 'utf8');

const url = new URL(`${EVO_URL}/message/sendText/${INSTANCE}`);
const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    apikey: EVO_KEY,
  },
}, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(b);
      console.log(JSON.stringify({
        id: j.key?.id,
        status: j.status,
        sent: j.message?.conversation,
      }, null, 2));
    } catch {
      console.log(b);
    }
  });
});
req.on('error', e => { console.error('ERRO:', e.message); process.exit(1); });
req.write(payload);
req.end();
