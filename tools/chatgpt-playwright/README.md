# ChatGPT via Playwright — Geração de Criativos

Automação do ChatGPT web (modelo 4o image / gpt-image-1 in-chat) pra gerar variações de criativos em escala.

## Por que assim e não API?

A API `gpt-image-1` é mais barata e estável que automatizar o chat. **Use Playwright quando você precisa especificamente do comportamento in-chat** (refinamento iterativo na mesma conversa, contexto longo com múltiplas refs, plano Pro que já está pago).

Se descobrir que API resolve, migra — economiza dor de cabeça com sessão expirada e mudanças de DOM.

---

## Setup (uma vez)

```powershell
cd "c:\Projetos VS Lever\LeverSystem\tools\chatgpt-playwright"
npm install
```

`postinstall` baixa o Chromium do Playwright automaticamente (~150 MB).

---

## Passo 1 — Login manual

```powershell
npm run login
```

1. Abre janela do Chromium em `chatgpt.com`
2. Você loga normalmente (Google, email, o que usar)
3. Quando aparecer o campo de chat, volta no terminal e aperta **ENTER**
4. Sessão fica salva em `./.session/` — não precisa logar de novo (~30 dias)

> ⚠️ Não deletar a pasta `.session/`. Está no `.gitignore`.

---

## Passo 2 — Primeiro teste

Coloca uma imagem de referência em `./inputs/` (cria a pasta), depois:

```powershell
npm run generate -- --prompt "transforme essa camisa em modelo posando estilo editorial preto e branco" --ref "./inputs/minha-camisa.png" --out "./output/teste-01.png" --debug
```

Browser abre, manda o prompt, espera gerar, baixa a imagem. Demora 30-90s por imagem.

### Flags

| Flag | Default | Descrição |
|---|---|---|
| `--prompt` | (obrigatório) | Texto do prompt |
| `--ref` | — | Caminho de imagem de referência. **Pode repetir** pra várias refs |
| `--out` | `./output/gen-{ts}.png` | Caminho de saída |
| `--headed` | `true` | Mostra browser. Use `--headed false` pra headless |
| `--timeout` | `180000` (3min) | Timeout pra esperar a geração |
| `--debug` | `false` | Loga steps |

---

## Passo 3 — Batch de variações

Cria `jobs.json` (copia `jobs.example.json` e adapta):

```json
[
  { "prompt": "...", "refs": ["./inputs/cam1.png"], "out": "./output/v1.png" },
  { "prompt": "...", "refs": ["./inputs/cam1.png"], "out": "./output/v2.png" }
]
```

Roda:

```powershell
npm run batch -- --jobs ./jobs.json
```

Jobs rodam **serial** (1 por vez, 10s de pausa entre). Tentar paralelizar quebra — ChatGPT rate-limita e confunde contexto.

---

## Workflow recomendado pra treinar prompt

1. Começa com **1 job único** no `generate.mjs` direto
2. Itera o prompt até a saída ficar boa em 1 imagem
3. Salva esse prompt como template (com placeholders se precisar)
4. Gera `jobs.json` programaticamente a partir do template + lista de refs
5. Roda batch

Quando o template estiver maduro, vira **skill** em `.claude/skills/gerar-criativos/` invocando esse script.

---

## Troubleshooting

### "Sessão não existe"
Rodar `npm run login` primeiro.

### "Timeout — nenhuma imagem detectada"
Possíveis causas:
- Prompt foi rejeitado por política (verifica screenshot `-error.png` salvo no `output/`)
- ChatGPT abriu modal de upgrade / verificação
- Seletor do DOM mudou (raro mas acontece — abre `--debug` e ajusta `generate.mjs`)

### Cloudflare challenge
Roda em `--headed true` (default) e resolve manualmente uma vez. Sessão persiste depois.

### Imagem volta em baixa qualidade
ChatGPT às vezes serve preview em vez do full. Tenta clicar na imagem antes de baixar — ajuste no script (TODO).

### Rate limit
Espaça os jobs. `batch.mjs` já põe 10s entre. Se ainda assim limitar, aumenta pra 30s na linha do `setTimeout`.

---

## Estrutura

```
tools/chatgpt-playwright/
├── package.json
├── login.mjs           # Login manual (1x)
├── generate.mjs        # 1 geração
├── batch.mjs           # Várias gerações
├── jobs.example.json   # Template de batch
├── .session/           # Cookies (gitignored)
├── inputs/             # Refs (gitignored)
└── output/             # Imagens geradas (gitignored)
```

---

## Próximos passos (quando estiver maduro)

- [ ] Skill `gerar-criativos` em `.claude/skills/` invocando este tool
- [ ] Sub-prompts: variações pré-definidas (editorial, urbano, esporte, lifestyle, close-up)
- [ ] Multi-ref: enviar 2-3 imagens (estampa + modelo + cenário) num só prompt
- [ ] Auto-retry com prompt reformulado quando rejeita
- [ ] Integração com `import-missing` / `scrape-competitor` pra usar imagens dos próprios produtos como ref
