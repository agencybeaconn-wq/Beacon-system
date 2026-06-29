// load-balancer — decide pra QUAL PESSOA atribuir dado o role sugerido e carga atual.
//
// Estratégia:
// 1. Pega todos membros com o role sugerido
// 2. Conta client_tasks ativas (status != 'done') de cada um
// 3. Escolhe o menos carregado
// 4. Se todos os juniors estão no limite (maxActiveTasksJunior) e o role sugerido é junior, cai pro senior

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadTeamConfig() {
  const p = path.join(__dirname, 'team-config.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * @param {string} suggestedRole - junior | senior | lead | claude
 * @param {Map<string, number>} loadMap - { userId: activeTasks }
 * @param {object} teamConfig - loaded team-config.json
 * @returns {{ userId, name, role } | null}
 */
export function pickAssignee(suggestedRole, loadMap, teamConfig) {
  const { members, balancing } = teamConfig;

  // 'claude' role = auto-execution, não precisa de humano
  if (suggestedRole === 'claude') {
    return { userId: null, name: 'Claude (auto)', role: 'claude' };
  }

  // Helper: acha membros com role + lista ordenada por carga
  const pickByRole = (role) => {
    const candidates = members.filter(m => m.role === role);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const loadA = a.userId ? (loadMap.get(a.userId) || 0) : 0;
      const loadB = b.userId ? (loadMap.get(b.userId) || 0) : 0;
      return loadA - loadB;
    });
    return candidates;
  };

  // 1. Tenta o role sugerido
  const primary = pickByRole(suggestedRole);
  if (!primary) {
    // Sem membro nesse role — fallback pro próximo acima
    if (suggestedRole === 'junior') return pickAssignee('senior', loadMap, teamConfig);
    if (suggestedRole === 'senior') return pickAssignee('lead', loadMap, teamConfig);
    return null;
  }

  const best = primary[0];
  const bestLoad = best.userId ? (loadMap.get(best.userId) || 0) : 0;

  // 2. Se junior tá no limite, overflow pro senior
  if (suggestedRole === 'junior' && bestLoad >= (balancing.maxActiveTasksJunior || 5)) {
    const senior = pickByRole('senior');
    if (senior && senior.length > 0) {
      const seniorBest = senior[0];
      const seniorLoad = seniorBest.userId ? (loadMap.get(seniorBest.userId) || 0) : 0;
      if (seniorLoad < (balancing.maxActiveTasksSenior || 8)) {
        return { userId: seniorBest.userId, name: seniorBest.name, role: 'senior', overflowFrom: 'junior' };
      }
    }
  }

  return { userId: best.userId, name: best.name, role: best.role };
}

/**
 * Query Supabase pra contar tasks ativas por assignee.
 * @param {object} env - { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY }
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchActiveLoad(env) {
  const https = await import('https');
  const loadMap = new Map();

  return new Promise((resolve, reject) => {
    const url = `/rest/v1/client_tasks?select=assignee_id,status&status=neq.done&assignee_id=not.is.null`;
    const host = env.VITE_SUPABASE_URL.replace(/https?:\/\//, '').replace(/\/$/, '');
    const req = https.request({
      hostname: host, path: url, method: 'GET',
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.VITE_SUPABASE_ANON_KEY }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const arr = JSON.parse(b);
          if (Array.isArray(arr)) {
            for (const t of arr) {
              if (!t.assignee_id) continue;
              loadMap.set(t.assignee_id, (loadMap.get(t.assignee_id) || 0) + 1);
            }
          }
          resolve(loadMap);
        } catch { resolve(loadMap); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
