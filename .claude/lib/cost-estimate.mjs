// Cost-estimate helper — usado por todas skills bulk pra imprimir escopo + tempo
// + circuit-breaker antes de --apply. Memory: feedback_custo_beneficio + Regra Zero.
//
// Uso típico:
//   import { printEstimate, abortIfTooLarge } from '../../lib/cost-estimate.mjs';
//   printEstimate({ count: missing.length, opName: 'create products', bulkOp: false });
//   abortIfTooLarge({ count: missing.length, expected: 50, force: args.forceLarge });
//   if (!args.apply) { console.log('(dry-run — adicione --apply pra executar)'); return; }

/**
 * Imprime estimativa de escopo + tempo + API calls antes de qualquer bulk op.
 * Padroniza formato pra todas skills — fim do "1429 produtos" sem contexto.
 *
 * @param {object} opts
 * @param {number} opts.count - Quantos items vão ser tocados
 * @param {string} opts.opName - Nome curto da operação (ex: "update body_html", "delete duplicates")
 * @param {number} [opts.rateLimitMs=600] - Delay entre calls REST (Shopify default ~2/s = 500-600ms)
 * @param {boolean} [opts.bulkOp=false] - Se true, conta como 1-2 GraphQL bulk operations (~60-120s) em vez de N calls
 * @param {number} [opts.apiCalls] - Override explícito do número de API calls (se não for 1:1 com count)
 * @param {string} [opts.unit='produtos'] - Unidade do count (produtos, variantes, coleções, etc)
 */
export function printEstimate({ count, opName, rateLimitMs = 600, bulkOp = false, apiCalls, unit = 'produtos' }) {
  if (count === 0) {
    console.log(`✓ Nada a fazer (0 ${unit}).`);
    return;
  }

  const calls = bulkOp ? 2 : (apiCalls ?? count);
  const seconds = bulkOp ? 90 : (calls * (rateLimitMs / 1000));
  const time = formatTime(seconds);
  const callDesc = bulkOp ? '1-2 GraphQL bulk operations' : `${calls} calls @ ${(1000 / rateLimitMs).toFixed(1)}/s`;

  console.log(`\n📊 Custo da operação:`);
  console.log(`   • Escopo:    ${count} ${unit} (${opName})`);
  console.log(`   • Tempo:     ~${time}`);
  console.log(`   • API:       ${callDesc}`);
}

/**
 * Circuit-breaker: aborta se count >> expected (default 30% delta).
 * Uso: skill anuncia "esperava ~50" e se preview achar 500 → para sem apply.
 * Bypass com flag `--force-large` (passa force: true).
 *
 * @param {object} opts
 * @param {number} opts.count - Quantos items o preview encontrou
 * @param {number} opts.expected - Quantos esperava (estimativa do operador)
 * @param {number} [opts.threshold=0.3] - Diff relativo aceito (0.3 = 30%)
 * @param {boolean} [opts.force=false] - Se true, ignora circuit-breaker
 * @param {string} [opts.flag='--force-large'] - Nome da flag pra mostrar na mensagem
 * @returns {boolean} true se abortou (caller deve return/exit), false se ok pra continuar
 */
export function abortIfTooLarge({ count, expected, threshold = 0.3, force = false, flag = '--force-large' }) {
  if (force) return false;
  if (!expected || expected <= 0) return false;
  const delta = Math.abs(count - expected) / expected;
  if (delta <= threshold) return false;

  const sign = count > expected ? 'maior' : 'menor';
  console.error(`\n⚠️  ESCOPO INESPERADO`);
  console.error(`   Esperava ~${expected}, encontrou ${count} (${(delta * 100).toFixed(0)}% ${sign} que esperado).`);
  console.error(`   Para confirmar e prosseguir mesmo assim, rode com ${flag}.`);
  console.error(`   Para revisar, rode em dry-run (sem --apply) e cheque o preview antes.`);
  return true;
}

/**
 * Formata segundos em string legível: "1m 23s", "45s", "12min", "1h 5min".
 */
export function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 && m < 10 ? `${m}m ${s}s` : `${m}min`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Helper pra parsear --force-large e --expected=N nas skills sem repetir código.
 * Mesma rationale de cost-estimate — não cada skill reimplementar parseInt do flag.
 */
export function parseCostFlags(argv) {
  const out = { forceLarge: false, expected: null };
  for (const a of argv) {
    if (a === '--force-large') out.forceLarge = true;
    else if (a.startsWith('--expected=')) out.expected = parseInt(a.slice(11), 10) || null;
  }
  return out;
}
