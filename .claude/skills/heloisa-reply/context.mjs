#!/usr/bin/env node
// heloisa-reply/context.mjs <numero-ou-jid>
//
// Lookup completo pra responder uma conversa da Heloisa:
//   1. Normaliza número → JID WhatsApp
//   2. Puxa últimas N mensagens da conversa via Evolution
//   3. Casa cliente no Supabase (crm_leads.phone OR fuzzy em agency_clients)
//   4. Lista demandas pending + tasks recentes
//   5. Imprime bloco de contexto pro Claude rascunhar resposta
//
// Uso: node context.mjs "+55 31 98214-3790"
//      node context.mjs 5531982143790
//      node context.mjs 553182143790 --history=10

import https from 'https';
import { supaRest } from '../../lib/supabase-rest.mjs';

const EVO_URL = process.env.EVOLUTION_API_URL || 'https://evo.jotabot.site';
const EVO_KEY = process.env.EVOLUTION_API_KEY || 'JotaBotEVO2025_API_Key_Definitiva';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'userdcfdce54';

const args = process.argv.slice(2);
const rawNumber = args.find(a => !a.startsWith('--'));
const historyN = Number((args.find(a => a.startsWith('--history='))?.split('=')[1]) || 30);

if (!rawNumber) {
  console.error('Uso: node context.mjs <numero> [--history=N]');
  process.exit(1);
}

// Normaliza: tira tudo que não é dígito, garante DDI 55
function normalize(raw) {
  let digits = String(raw).replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = '55' + digits;
  // Algumas conversas vêm sem o 9 inicial do celular (553182143790 vs 5531982143790).
  // Retorna ambas variantes pra tentar match em ambas.
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  const variants = new Set([digits]);
  if (rest.length === 8) variants.add(`55${ddd}9${rest}`);
  if (rest.length === 9 && rest.startsWith('9')) variants.add(`55${ddd}${rest.slice(1)}`);
  return [...variants];
}

function evoReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${EVO_URL}${path}`);
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        apikey: EVO_KEY,
        ...(payload && { 'Content-Length': payload.length }),
      },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch { resolve(b); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractText(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    (m.message?.imageMessage ? `[imagem] ${m.message.imageMessage.caption || ''}` : '') ||
    (m.message?.videoMessage ? `[vídeo] ${m.message.videoMessage.caption || ''}` : '') ||
    (m.message?.audioMessage ? '[áudio]' : '') ||
    (m.message?.documentMessage ? `[doc] ${m.message.documentMessage.fileName || ''}` : '') ||
    ''
  );
}

async function fetchHistory(jid, limit) {
  const res = await evoReq('POST', `/chat/findMessages/${INSTANCE}`, {
    where: { key: { remoteJid: jid } },
    limit,
  });
  const records = res?.messages?.records || res?.records || (Array.isArray(res) ? res : []);
  return records.map(m => ({
    from: m.key?.fromMe ? 'heloisa' : 'cliente',
    ts: m.messageTimestamp,
    text: extractText(m),
  })).filter(m => m.text).sort((a, b) => a.ts - b.ts);
}

// Fallback: busca metadata da conversa (lastMessage, profileName, updatedAt).
// Útil quando findMessages volta vazio mas o chat existe na instância.
async function fetchChatMeta(jid) {
  const res = await evoReq('POST', `/chat/findChats/${INSTANCE}`, {
    where: { remoteJid: jid },
    limit: 1,
  });
  const chat = Array.isArray(res) ? res[0] : res?.records?.[0];
  if (!chat) return null;
  return {
    pushName: chat.pushName || null,
    profilePicUrl: chat.profilePicUrl || null,
    updatedAt: chat.updatedAt || null,
    lastMessage: chat.lastMessage ? {
      from: chat.lastMessage.key?.fromMe ? 'heloisa' : 'cliente',
      text: extractText(chat.lastMessage),
    } : null,
  };
}

async function findClient(variants) {
  // 1. crm_leads.phone ilike qualquer variante
  for (const v of variants) {
    const phoneFrag = v.slice(-9); // últimos 9 dígitos = celular sem DDI
    const leads = await supaRest(
      'GET',
      `/crm_leads?select=id,name,store_name,phone,email,lead_status,observations,workspace_id&phone=ilike.*${phoneFrag}*&limit=3`,
      null,
      { serviceRole: true }
    );
    if (leads?.length) return { kind: 'lead', match: leads[0], all: leads };
  }
  return null;
}

async function findAgencyClientByNameHint(hint) {
  if (!hint) return null;
  const rows = await supaRest(
    'GET',
    `/agency_clients?select=id,name,shopify_shop_name,is_archived,client_type,onboarding_type&name=ilike.*${encodeURIComponent(hint)}*&limit=5`,
    null,
    { serviceRole: true }
  );
  return rows?.[0] || null;
}

async function fetchDemands(clientId) {
  const open = await supaRest(
    'GET',
    `/demand_requests?select=id,title,description,area,client_priority,status,created_at&client_id=eq.${clientId}&status=in.(pending,approved,in_progress)&order=created_at.desc&limit=10`,
    null,
    { serviceRole: true }
  );
  const tasks = await supaRest(
    'GET',
    `/client_tasks?select=title,status,priority,updated_at&client_id=eq.${clientId}&status=in.(pending,in_progress)&order=updated_at.desc&limit=10`,
    null,
    { serviceRole: true }
  );
  return { demands: open || [], tasks: tasks || [] };
}

(async () => {
  const variants = normalize(rawNumber);

  // Tenta history em todas as variantes (com e sem 9) e fica com a que retornou algo
  let history = [];
  let jid = `${variants[0]}@s.whatsapp.net`;
  for (const v of variants) {
    const tryJid = `${v}@s.whatsapp.net`;
    const h = await fetchHistory(tryJid, historyN).catch(() => []);
    if (Array.isArray(h) && h.length) { history = h; jid = tryJid; break; }
  }

  // Metadata do chat — pushName (nome que o cliente colocou no perfil), última atividade.
  // Útil quando history vem vazio: confirma se a conversa existe na instância.
  const chatMeta = await fetchChatMeta(jid).catch(() => null);

  const leadMatch = await findClient(variants);

  let client = null;
  let demands = { demands: [], tasks: [] };

  if (leadMatch?.match) {
    // Tenta casar com agency_clients via store_name ou name do lead
    const hint = leadMatch.match.store_name || leadMatch.match.name;
    client = await findAgencyClientByNameHint(hint);
    if (client) demands = await fetchDemands(client.id);
  }

  // Lead novo = sem cliente ativo casado + histórico magro com a Heloisa
  // (< 2 mensagens trocadas — só o "oi" inicial ou nada).
  const heloisaMsgs = history.filter(m => m.from === 'heloisa').length;
  const isNewLead = !client && heloisaMsgs < 2;
  const mode = isNewLead ? 'sdr' : (client ? 'atendimento' : 'desconhecido');

  // Detecta histórico provavelmente incompleto: chat existe na instância
  // (chatMeta retornou) mas history veio curto/vazio. Sinal de mensagens
  // pré-conexão da Evolution — operador deve mandar print.
  const historyLikelyIncomplete = !!chatMeta && history.length <= 1;

  const out = {
    target: { raw: rawNumber, variants, jid, instance: INSTANCE },
    mode,                       // 'sdr' | 'atendimento' | 'desconhecido'
    isNewLead,                  // true → playbook SDR (lead frio sem cliente casado)
    historyLikelyIncomplete,    // true → pedir print ao operador antes de rascunhar
    chatMeta,                   // { pushName, lastMessage, updatedAt }
    lead: leadMatch,
    client,
    demands,
    history,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(out, null, 2));
})().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
