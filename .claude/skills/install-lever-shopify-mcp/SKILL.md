---
name: install-lever-shopify-mcp
description: Conecta o MCP lever-shopify (multi-loja Shopify Admin) ao Claude Code do colaborador. Pergunta quem é o colab, lê a chave do `keys.json` local (gitignored), edita ~/.claude.json com Bearer auth, faz backup, valida e instrui restart. Idempotente.
argument-hint: "[user-name] [--diagnose]"
---

# Instalar lever-shopify MCP

Conecta o servidor MCP **lever-shopify** (multi-loja Shopify Admin, hospedado na Lever via Vercel) ao Claude Code da máquina atual.

## Quando usar

- Novo colab Lever entrou no squad e quer plugar o MCP
- Colab existente precisa rotacionar chave ou apontar pra novo deploy
- Diagnosticar por que `mcp__lever-shopify__*` não aparece nas tools

## Quando NÃO usar

- Se o user pediu pra instalar um MCP diferente — chama a skill correspondente
- Se o arquivo `keys.json` desta skill **não existe** na máquina, peça pro user dar `git pull` no repo `lever` (o arquivo vive em `lever/.claude/skills/install-lever-shopify-mcp/keys.json`, é commitado no repo privado). Não invente chave.

---

## Inputs

| Argumento | Obrigatório | Default | Exemplo |
|---|---|---|---|
| `[user-name]` | não | — pergunta interativo | `pedro`, `wesley`, `joao` |
| `--diagnose` | não | — | só roda diagnóstico, não modifica config |

Se o user não passar `user-name`, **pergunta com AskUserQuestion** listando os nomes em `keys.json#users` (label como opção, slug como valor). Não chuta. Se o nome passado não bater nenhum slug, lista os disponíveis e pergunta de novo.

---

## Constantes

- **MCP_NAME**: `lever-shopify`
- **KEYS_PATH**: `lever/.claude/skills/install-lever-shopify-mcp/keys.json` (relativo ao repo `lever`)
- **CONFIG_PATH**: 
  - Windows: `$env:USERPROFILE\.claude.json`
  - Mac/Linux: `$HOME/.claude.json`

---

## Passo 0 — Identificar o user e carregar a chave

1. Lê `KEYS_PATH` com Read tool. Se não existir, **PARA** e instrui: "Falta o arquivo `keys.json`. Roda `git pull` no repo `lever` — o arquivo é commitado no repo privado e vai aparecer em `lever/.claude/skills/install-lever-shopify-mcp/keys.json`."
2. Se `[user-name]` veio como argumento, valida que existe em `keys.json#users`. Se não bater (ex: typo), lista os slugs disponíveis e usa `AskUserQuestion` pra escolher.
3. Se nenhum argumento, usa `AskUserQuestion` (header: "Quem é você?", options = `label` de cada user em `keys.json#users`, valor selecionado mapeia ao slug).
4. Extrai do JSON: `API_KEY = users[slug].key`, `MCP_URL = url`.
5. **Nunca exibe a chave inteira no chat** — só os 8 primeiros chars + `...` pra confirmação. Ex: "Vou instalar como `pedro` (chave `b56db6c7...`)."

---

## Passo 1 — Localizar e ler o `~/.claude.json`

Use Bash (POSIX) ou PowerShell conforme OS. Detecta com `process.platform === 'win32'`.

```bash
# Mac/Linux
CONFIG="$HOME/.claude.json"
```

```powershell
# Windows
$config = "$env:USERPROFILE\.claude.json"
```

Se o arquivo **não existir**: cria com `{ "mcpServers": {} }` e segue.

Se existir mas for JSON inválido: **PARA imediatamente** e mostra o erro pro user. Não tenta consertar — é o config principal do Claude Code dele, não vale o risco.

---

## Passo 2 — Backup

Antes de qualquer escrita, copia o config pra `~/.claude.json.bak-<YYYYMMDD-HHMMSS>`.

```bash
cp "$CONFIG" "${CONFIG}.bak-$(date +%Y%m%d-%H%M%S)"
```

```powershell
Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

Confirma o backup foi criado (Read tool ou `Test-Path`) antes de seguir.

---

## Passo 3 — Edit `mcpServers.lever-shopify`

Use Node inline pra editar com segurança (preserva resto do JSON intacto). **Não edita string manualmente** — vai quebrar formatação ou perder campos.

```bash
node -e "
const fs = require('fs');
const path = process.env.CONFIG_PATH;
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.mcpServers = cfg.mcpServers || {};
const existed = Boolean(cfg.mcpServers['lever-shopify']);
cfg.mcpServers['lever-shopify'] = {
  type: 'http',
  url: process.env.MCP_URL,
  headers: { Authorization: 'Bearer ' + process.env.API_KEY }
};
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
console.log(existed ? 'UPDATED existing entry' : 'ADDED new entry');
"
```

Passa via env: `CONFIG_PATH`, `MCP_URL`, `API_KEY`. **Nunca interpole API key direto no script** (vaza no shell history).

---

## Passo 4 — Smoke test HTTP

Ainda antes de pedir restart, valida a chave bateu na URL com um `GET` ao endpoint (health check):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$MCP_URL"
# espera 200
```

Se 200 → URL ativa. Se 404/5xx → URL provavelmente errada, alerta e pede confirmação.

Depois, valida a chave fazendo uma chamada autenticada de `tools/list`:

```bash
curl -sS -X POST "$MCP_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 500
```

- 200 + `result.tools` array → chave válida, MCP saudável
- 401 → chave errada/revogada — **NÃO seguir**, pede pro user confirmar com o João
- 5xx → server fora — instala mesmo assim (config local é válida), avisa pro user tentar mais tarde

---

## Passo 5 — Instruir restart

Output final pro user (em PT, claro e curto):

```
✓ lever-shopify MCP configurado como <user-slug> em ~/.claude.json
✓ Backup salvo em ~/.claude.json.bak-<timestamp>
✓ Smoke test passou (HTTP 200 + chave válida)

PRÓXIMO PASSO: Reinicia o Claude Code (fecha e abre).
Numa nova sessão, vai aparecer:
  mcp__lever-shopify__list_shops
  mcp__lever-shopify__get_shop_info
  mcp__lever-shopify__graphql_query
  mcp__lever-shopify__graphql_mutation
  mcp__lever-shopify__bulk_query

Pra confirmar que funcionou, peça: "lista as lojas configuradas no lever-shopify"
```

Sem emojis. Sem fluff.

---

## Modo `--diagnose`

Se `--diagnose` foi passado, **não modifica nada**. Só inspeciona e reporta:

1. Existe `~/.claude.json`?
2. Tem entry `mcpServers.lever-shopify`? Mostra URL configurada (sem chave).
3. `GET <url>` retorna 200?
4. Com a chave do entry, `tools/list` retorna 200 e lista N tools?
5. Quantas linhas no log local de tool calls do Claude Code mencionam `lever-shopify` nas últimas 24h?
   (Procurar em `~/.claude/projects/*/sessions/*.jsonl` — grep `lever-shopify`)

Output: tabela curta tipo
```
config file:        OK (~/.claude.json existe)
mcp entry:          OK (url=https://lever-shopify-mcp.vercel.app/api/mcp)
endpoint reachable: OK (200)
auth:               OK (5 tools listed)
recent usage 24h:   12 tool calls
```

Se algum check falhar, mostra causa provável e sugestão.

---

## Erros comuns e o que fazer

| Sintoma | Causa | Ação |
|---|---|---|
| `tools/list` retorna 401 | Chave revogada ou typo | Confirmar a chave com o João. Não tentar advinhar. |
| `GET` retorna 404 | URL errada | Confirma URL atual; pode ter mudado pra outro domínio Vercel |
| `~/.claude.json` JSON inválido | Edit manual quebrado | **PARA**. Pede pro user consertar manualmente ou restaurar backup mais recente |
| MCP não aparece após restart | Restart parcial (só fechou janela, não matou processo) | Pede pra matar Claude Code via Task Manager / `pkill -f "claude"` e reabrir |
| Entry adicionada mas tools não aparecem | Versão antiga Claude Code não suporta `type: http` | Pede pra atualizar Claude Code |

---

## Não fazer

- **Não rodar o servidor MCP localmente** — esse install é pro modo HTTP hospedado. Quem quer rodar stdio local lê o README em `lever/tools/shopify-mcp/`.
- **`keys.json` vive no repo privado** — qualquer rotação (saída de colab, suspeita de vazamento) faz via `vercel env rm/add LEVER_MCP_API_KEY_<USER>` + edita o arquivo + commit + colabs `git pull`. Chave antiga no histórico do git fica inútil porque o server rejeita.
- **Não compartilhar slug com chave de outro user** — cada colab usa o próprio slug pra auditoria do server reconhecer quem chamou.
- **Não modificar outros entries** em `mcpServers` — adiciona/atualiza só `lever-shopify`.
- **Não exibir a chave inteira em logs/output** — sempre máscara nos 8 primeiros chars.
