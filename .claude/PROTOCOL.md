# Protocolo de Execução — Lever System

Este é o **protocolo único** seguido por toda skill que modifica estado (Shopify, Supabase, filesystem). Cada SKILL.md deve referenciar este arquivo em vez de duplicar o fluxo.

## As 6 etapas

### 1. VALIDATE — Asserções pré-flight

Antes de qualquer operação write, confirmar que as entidades existem e o ambiente tá saudável. Use `.claude/lib/validate.mjs`:

```js
import { assertClientExists, assertShopifyConnected, assertCollectionExists } from '../../lib/validate.mjs';

const client = await assertClientExists(clientIdOrSlug);
await assertShopifyConnected(client);
// Se alvo é coleção específica:
await assertCollectionExists(shop, token, collectionHandle);
```

Se qualquer assert falhar → **PARA imediatamente** e reporta ao user qual entidade faltou. Não tente "corrigir" chutando.

### 2. DRY-RUN — Calcular sem aplicar

Rode toda a lógica em modo read-only. Gere o **diff/plano completo** (não apenas amostra):

```js
const plan = await buildPlan({ mode: 'dry' });
// plan = { changes: [...], summary: { totalAffected, byCategory, ... } }
```

A função de aplicar **deve ter default `mode: 'dry'`** — precisa do user passar explicitamente `{ mode: 'apply' }` pra escrever.

### 3. PREVIEW — Mostrar ao user

Mostre o resumo em markdown:

```
## Preview: <operação>

- **Entidades afetadas:** 1.165 produtos, 13.752 variantes
- **Por categoria:**
  - camisa_torcedor: 611
  - camisa_retro: 178
  - ...
- **Amostra (5 mudanças):**
  - Camisa X: R$X → R$Y
  - ...
```

Preview é **obrigatório**. Sem preview, não executa.

### 4. CONFIRM — Aguardar aprovação

Espere resposta explícita do user (`"sim"`, `"pode"`, `"aplica"`). Silêncio ≠ confirmação.

Se o user disse `"aplica direto"` no pedido original, você ainda deve mostrar o preview e esperar um segundo "confirma?" — curto-circuitar isso é a origem de boa parte das alucinações.

**Exceção**: operações triviais e totalmente parametrizadas (ex: `/create-discount PAGUE2LEVE3 cliente-x`) podem pular preview, desde que o input seja 1:1 sem ambiguidade.

### 5. EXECUTE — Rodar com rate limit

Aplique a mudança respeitando as regras de paralelismo (ver [CLAUDE.md](../CLAUDE.md#regras-de-paralelismo)):

- Mesma loja: delay mínimo 500ms entre writes, concorrência máxima 3
- Lojas diferentes: paralelo OK
- Use `.claude/lib/shopify-api.mjs` pros helpers (`shReq`, `shopifyGraphQL`, `delay`)

**Retry automático 429 (built-in na lib):** `shReq` e `shopifyGraphQL` têm **retry automático em 429** com backoff exponencial (1s → 2s → 4s → 8s → 16s, até 5 tentativas). Você não precisa lidar com 429 manualmente — a lib cuida.

- Se quiser desabilitar: `shReq(shop, token, method, path, body, { noRetry: true })`
- Se quiser ver os retries no stdout: `SHOPIFY_VERBOSE=1 node script.mjs`
- Pra GraphQL: detecta também o erro `THROTTLED` (não só HTTP 429)

**Regra ainda válida**: mesmo com retry, **não rode 2 scripts escrevendo no mesmo shop simultaneamente**. O retry minimiza impacto mas não resolve congestão real.

### 6. LOG — Append em execution.jsonl

Cada execução completa (sucesso ou falha parcial) gera 1 linha em `.claude/logs/execution.jsonl`:

```json
{"ts":"2026-04-10T22:15:00Z","skill":"update-prices","client_id":"15d0144e-...","affected":1165,"ok":1165,"fail":0,"dry_run":false,"user_confirmed":true}
```

O log é append-only, gitignored, por máquina. Serve pra auditoria local ("o que rodei ontem no cliente X?").

## Regras de ouro

1. **Dry-run é default.** Função de escrita sem `{ mode: 'apply' }` explícito = dry-run.
2. **Preview é obrigatório.** Mesmo em operações pequenas.
3. **Validate antes de tudo.** Asserts baratos economizam debugging de 1h.
4. **Nunca pule CONFIRM** — mesmo se o user já disse "pode aplicar" no pedido inicial.
5. **Log de execução** sempre, mesmo em falhas parciais.
6. **Respeite rate limits** — 429 retentado é melhor que 429 engolido.

## Quando um passo pode ser pulado

| Etapa | Pode pular? | Quando |
|---|---|---|
| VALIDATE | ❌ nunca | — |
| DRY-RUN | ⚠️ em operações 1:1 triviais | `/create-discount PRESET cliente` (sem ambiguidade) |
| PREVIEW | ⚠️ em operações 1:1 triviais | idem |
| CONFIRM | ❌ nunca | — |
| EXECUTE | — | — |
| LOG | ❌ nunca | — |

Quando em dúvida: **não pule**. Fricção extra é melhor que alucinação em produção.

---

## Background-safe skills (Fase 7a)

Skills **long-running** (> 30s) devem ser **background-safe**: capazes de rodar em background, aceitar Ctrl+C, e retomar de onde pararam. Isso permite operações grandes (deletar 279 duplicatas, atualizar 13k variantes) sem bloquear interação humana.

### Contrato

Toda skill long-running implementa:

1. **Checkpoint** — salva progresso em `.claude/logs/.checkpoint-<skill>.json` durante o execute
2. **SIGINT handler** — Ctrl+C salva state e exita com código 130 (não perde trabalho)
3. **`--resume`** — lê checkpoint no boot e pula itens já processados
4. **`--status`** — mostra progresso do checkpoint sem rodar
5. **Clear on success** — remove checkpoint quando termina sem falhas

### Como usar o helper

```js
import { writeCheckpoint, readCheckpoint, clearCheckpoint,
         installSigintHandler, hasCheckpoint } from '../../lib/checkpoint.mjs';

const SKILL_NAME = 'minha-skill';

// No boot:
if (args.status) {
  const ck = readCheckpoint(SKILL_NAME);
  // imprime ck e sai
  return;
}

// Resume?
let processed = new Set();
if (args.resume && hasCheckpoint(SKILL_NAME)) {
  const ck = readCheckpoint(SKILL_NAME);
  if (ck?.data?.clientId === client.id) {
    processed = new Set(ck.data.processedIds);
  }
}

// Instala handler
installSigintHandler(SKILL_NAME, () => ({
  clientId: client.id,
  clientName: client.name,
  processedIds: [...processed],
  total: items.length,
}));

// Durante loop:
for (const item of items) {
  if (processed.has(item.id)) continue; // skip já processado
  await doWork(item);
  processed.add(item.id);
  if (processed.size % 20 === 0) {
    writeCheckpoint(SKILL_NAME, {
      clientId: client.id,
      clientName: client.name,
      processedIds: [...processed],
      total: items.length,
    });
  }
}

// Final:
if (fail === 0) clearCheckpoint(SKILL_NAME);
```

### Skills background-safe hoje (Fase 7a+)

| Skill | --resume | --status | SIGINT | Checkpoint |
|---|---|---|---|---|
| `update-prices` | ✓ | ✓ | ✓ | a cada 20 produtos |
| `bulk-fix-prices` | ✓ | ✓ | ✓ | a cada 20 produtos |
| `dedupe-products` | ✓ | ✓ | ✓ | a cada 10 produtos |
| `clean-titles` | — | — | — | bulk op = 1-shot (atomic) |
| `fix-empty-collections` | — | — | — | sequencial, rápido |
| `fix-broken-menus` | — | — | — | 1 update por menu |

Skills que usam bulk operations (stagedUpload + runBulk) são naturalmente atômicas — ou tudo funciona ou nada — e não precisam de checkpoint granular.

### Rodar em background via Claude Code

Com o Bash tool:
```
run_in_background: true
```
A notification chega quando o processo termina. Output fica no arquivo temporário.

### Invariantes

- **`--resume` é opt-in** — rodar sem ele ignora checkpoint (seguro pra forçar re-execução)
- **Checkpoint tem `version`** — se estrutura mudar entre versões, skill loga warning e ignora (não usa checkpoint stale)
- **SIGINT só salva** — não tenta finalizar a operação (evita partial state pior)
- **Filesystem local** — checkpoint fica em `.claude/logs/.checkpoint-<skill>.json`, gitignored, por máquina

## Reliability patterns (Fase 7a)

### assertEnv — validação explícita de env vars

Skills que dependem de env vars críticas devem chamar `assertEnv()` no boot:

```js
import { assertEnv } from '../../lib/validate.mjs';

const env = await assertEnv(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
// Lança Error com lista de keys faltando → exit com mensagem clara
```

### Collision detection em clean-titles

Skills que mudam identificadores (títulos, handles) devem **detectar colisões antes de aplicar**:

- Agrupa mudanças pelo novo valor normalizado
- Se N > 1 produtos mapeiam pro mesmo → primeiro vence, resto skip
- Se colisão com entidade não alterada → todo grupo skipa
- Preview mostra grupos colidindo com destaque

### Rollback de file operations destrutivas

Skills que tocam filesystem (renomeando/deletando) devem ter rollback em partial failure:

```js
const backup = fs.readFileSync(metaFile, 'utf8');
let publishedWritten = false;
try {
  fs.writeFileSync(publishedFile, data);
  publishedWritten = true;
  fs.unlinkSync(metaFile);
} catch (e) {
  // Rollback
  if (publishedWritten && fs.existsSync(publishedFile)) fs.unlinkSync(publishedFile);
  if (!fs.existsSync(metaFile)) fs.writeFileSync(metaFile, backup);
  throw e;
}
```

### Track-and-log em operações sequenciais grandes

Skills que rodam N calls sequenciais (ex: push N files pro tema) devem trackear quais succeederam pra emitir rollback hint em falha parcial:

```js
const pushed = [];
for (const f of files) {
  try {
    await push(f);
    pushed.push(f.key);
  } catch (e) {
    // Loga quais subiram, quais faltam
    fs.writeFileSync('.rollback-log.json', JSON.stringify({ pushed, failed: f.key }));
    throw e;
  }
}
```
