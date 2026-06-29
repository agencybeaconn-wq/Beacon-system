#!/usr/bin/env node
// heloisa-reply/revoke.mjs <numero> <messageId>
//
// Revoga (apaga pra todos) uma mensagem que a Heloisa mandou.
// Útil quando o tom saiu artificial e precisa reenviar.

import https from 'https';

const EVO_URL = process.env.EVOLUTION_API_URL || 'https://evo.jotabot.site';
const EVO_KEY = process.env.EVOLUTION_API_KEY || 'JotaBotEVO2025_API_Key_Definitiva';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'userdcfdce54';

const [numero, msgId] = process.argv.slice(2);
if (!numero || !msgId) {
  console.error('Uso: node revoke.mjs <numero> <messageId>');
  process.exit(1);
}

const digits = numero.replace(/\D/g, '');
const jid = `${digits}@s.whatsapp.net`;
const payload = Buffer.from(JSON.stringify({ id: msgId, remoteJid: jid, fromMe: true }), 'utf8');

const url = new URL(`${EVO_URL}/chat/deleteMessageForEveryone/${INSTANCE}`);
const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    apikey: EVO_KEY,
  },
}, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log(res.statusCode, b.slice(0, 200)));
});
req.on('error', e => { console.error('ERRO:', e.message); process.exit(1); });
req.write(payload);
req.end();
