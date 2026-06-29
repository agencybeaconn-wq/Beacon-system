// Checkpoint helper — permite skills long-running salvarem estado e retomarem.
//
// Uso:
//   import { writeCheckpoint, readCheckpoint, clearCheckpoint, installSigintHandler } from '../../lib/checkpoint.mjs';
//
//   // No boot:
//   const ck = readCheckpoint('update-prices');
//   if (ck && args.resume) {
//     // pula ids já processados
//   }
//   installSigintHandler('update-prices', () => ({ processedIds, lastBatch }));
//
//   // Durante processamento:
//   writeCheckpoint('update-prices', { processedIds: [...], total: 1300 });
//
//   // No sucesso final:
//   clearCheckpoint('update-prices');
//
// Checkpoint fica em .claude/logs/.checkpoint-<skill>.json (gitignored).
// Cada skill usa seu próprio arquivo — sem colisão.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.resolve(__dirname, '..', 'logs');

const CHECKPOINT_VERSION = 1;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function checkpointPath(skillName) {
  return path.join(LOG_DIR, `.checkpoint-${skillName}.json`);
}

/**
 * Escreve um checkpoint pro skill dado.
 * @param {string} skillName - ex: "update-prices"
 * @param {object} data - qualquer objeto serializável
 */
export function writeCheckpoint(skillName, data) {
  ensureLogDir();
  const payload = {
    version: CHECKPOINT_VERSION,
    skill: skillName,
    ts: new Date().toISOString(),
    data,
  };
  fs.writeFileSync(checkpointPath(skillName), JSON.stringify(payload, null, 2), 'utf8');
}

/**
 * Lê o checkpoint do skill. Retorna null se não existe ou se versão incompatível.
 * @param {string} skillName
 * @returns {object|null} - o field `data` do checkpoint, ou null
 */
export function readCheckpoint(skillName) {
  const p = checkpointPath(skillName);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.version !== CHECKPOINT_VERSION) {
      console.warn(`⚠ Checkpoint de ${skillName} tem versão ${parsed.version} (esperado ${CHECKPOINT_VERSION}). Ignorando.`);
      return null;
    }
    return { ts: parsed.ts, data: parsed.data };
  } catch (e) {
    console.warn(`⚠ Falha lendo checkpoint ${skillName}: ${e.message}`);
    return null;
  }
}

/**
 * Remove o checkpoint do skill (chamar em sucesso final).
 * @param {string} skillName
 */
export function clearCheckpoint(skillName) {
  const p = checkpointPath(skillName);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

/**
 * Retorna true se há checkpoint existente pro skill.
 * @param {string} skillName
 */
export function hasCheckpoint(skillName) {
  return fs.existsSync(checkpointPath(skillName));
}

/**
 * Instala handler de SIGINT (Ctrl+C) que salva o estado antes de sair com código 130.
 * Deve ser chamado uma vez no boot do skill.
 *
 * @param {string} skillName
 * @param {() => object} getState - callback que retorna o estado atual pra persistir
 */
export function installSigintHandler(skillName, getState) {
  let saving = false;
  const handler = () => {
    if (saving) return;
    saving = true;
    try {
      const state = getState ? getState() : null;
      if (state) {
        writeCheckpoint(skillName, state);
        console.error(`\n⏸  SIGINT recebido — checkpoint salvo em .claude/logs/.checkpoint-${skillName}.json`);
        console.error(`    Rode novamente com --resume pra continuar.`);
      } else {
        console.error(`\n⏸  SIGINT recebido — nada a salvar.`);
      }
    } catch (e) {
      console.error(`\n⚠  Erro salvando checkpoint: ${e.message}`);
    }
    process.exit(130);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

/**
 * Retorna só o `data` de um checkpoint (conveniência). Null se não existe.
 * @param {string} skillName
 */
export function checkpointData(skillName) {
  const ck = readCheckpoint(skillName);
  return ck?.data ?? null;
}
