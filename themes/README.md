# Themes — Lever System

Esta pasta contém as cópias locais dos temas Lever usados nas lojas de **desenvolvimento**. Elas são a **source of truth** pra edições de tema — todas as mudanças começam aqui e depois são propagadas pros clientes via a skill [`/lever-theme`](../.claude/skills/lever-theme/SKILL.md).

## Estrutura

```
themes/
├── README.md                  ← este arquivo
├── lever-br/                  ← tema da Template BR (testeloja-9899)
│   ├── assets/                 (202 arquivos: CSS, JS, imagens, fontes)
│   ├── sections/               (63 arquivos Liquid)
│   ├── snippets/               (55 arquivos Liquid)
│   ├── locales/                (51 arquivos i18n pt-BR)
│   ├── templates/              (25 arquivos JSON + Liquid)
│   ├── config/                 (settings_schema + settings_data)
│   └── layout/                 (theme.liquid + password.liquid)
└── lever-en/                  ← tema da Template EN (loja-de-estruturacao-...-en)
    └── (mesma estrutura, mas locales em en-US)
```

## Source of Truth

| Sigla | Loja | Domínio | Tema principal | ID |
|---|---|---|---|---|
| `br` | Template BR | `testeloja-9899.myshopify.com` | Tema Lever Atualizado 18/03 | `160282804466` |
| `en` | Template EN | `loja-de-estruturacao-e-desenvolvimento-en.myshopify.com` | Tema Lever Inglês Atualizado 23/03 | `129577091130` |

## Workflow

```
┌─────────────────────────────────────────────────────┐
│  1. Pull dos temas DEV (sincronizar com Shopify)    │
│     /lever-theme pull br                            │
│     /lever-theme pull en                            │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  2. Editar localmente (Claude lê direto via Read)   │
│     themes/lever-br/sections/header.liquid           │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  3. Preview local (hot-reload)                       │
│     /lever-theme dev br                              │
│     → abre localhost:9292 conectado ao shop DEV      │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  4. Push pra loja DEV (NUNCA pra cliente direto)    │
│     /lever-theme push-dev br                         │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  5. Testar no storefront da loja DEV                 │
│     https://testeloja-9899.myshopify.com             │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  6. Propagar pros clientes (diff + confirm)          │
│     /lever-theme diff <cliente>        ← checar primeiro  │
│     /lever-theme propagate <cliente>   ← aplicar          │
└─────────────────────────────────────────────────────┘
```

## Allowlist de propagate

**Arquivos copiados do dev pros clientes:**
- `sections/*.liquid` — componentes reutilizáveis
- `snippets/*.liquid` — helpers Liquid
- `assets/*.{js,css,liquid}` — CSS/JS globais
- `layout/*.liquid` — theme.liquid, password.liquid
- `config/settings_schema.json` — definição dos campos editáveis

**Arquivos NUNCA copiados (blocklist):**
- `templates/*.json` — customizações per-team (collection.flamengo.json, collection.corinthians.json, etc)
- `config/settings_data.json` — valores específicos do cliente (cores, licença, milestones, frete)
- `locales/*.json` — i18n do cliente (podem ter traduções específicas)

## BR vs EN

Os dois temas compartilham **mesma estrutura Liquid** mas divergem em `locales/`. Regras:

- Edições em `sections/`, `snippets/`, `assets/`, `layout/` → **propagam** entre BR e EN
- Edições em `locales/` → **nunca** propagam entre idiomas (óbvio)
- Edições em `config/settings_schema.json` → propagam (schema é universal)

Antes de `propagate` em massa, rode `/lever-theme diff-br-en` pra garantir que BR e EN estão sincronizados.

## Primeira vez: instalação

```bash
# 1. Instalar Shopify CLI como devDependency
npm install --save-dev @shopify/cli @shopify/theme

# 2. Login (uma vez por máquina)
npx shopify auth login

# 3. Primeiro pull (via skill)
cd themes/lever-br
npx shopify theme pull --store=testeloja-9899.myshopify.com --theme=160282804466 --path=.

cd ../lever-en
npx shopify theme pull --store=loja-de-estruturacao-e-desenvolvimento-en.myshopify.com --path=.
```

## Arquivos-chave do tema Lever

Documentação rápida do que cada arquivo principal faz:

| Arquivo | Propósito |
|---|---|
| `sections/collection-list-tabs.liquid` | Case statement handle → logo do time (home) |
| `sections/collection-player-tabs.liquid` | Mapeamento handle → foto do jogador |
| `sections/custom-patch-rules.liquid` | Configurador de patches no produto |
| `sections/custom-player-rules.liquid` | Configurador de nome/número (personalizar) |
| `sections/featured-collection-tabs.liquid` | Tabs home (Masculino/Feminino/Infantil) |
| `sections/header.liquid` + `header-group.json` | Header + settings (suporte/email/telefone) |
| `sections/footer.liquid` + `footer-group.json` | Footer + settings |
| `config/settings_schema.json` | Schema dos campos editáveis |
| `config/settings_data.json` | Valores atuais (cores, licença, milestones) |
| `templates/cart.json` | Progress bar + milestones + frete grátis |
| `templates/collection.flamengo.json` | Customização específica Flamengo |
| `layout/theme.liquid` | Layout base de todas as páginas |

## Git

As pastas `themes/lever-br/` e `themes/lever-en/` **são versionadas no git** (não ignoradas). Isso dá:
- Histórico de mudanças no tema
- Diff de PRs
- Rollback fácil

Ignorados (gitignore):
- `themes/*/.shopify-cli.yml` — contém domínio da loja, não compartilhar
- `themes/*/.shopify/` — cache do CLI
- `themes/*/config/settings_data.json.backup` — backup automático do CLI

## Troubleshooting

**`npx shopify theme pull` falha no Windows com acento no path**
Causa: Shopify CLI tem issues com UTF-8 em paths como "João Vithor". Mitigação:
1. Sempre passe `--path` com quotes
2. Se quebrar, use fallback via Asset API (skill `/shopify` tem helpers de `get_asset`/`put_asset`)

**`theme dev` não conecta**
Rode `npx shopify auth logout && npx shopify auth login` e tente de novo.

**Arquivos com encoding errado**
O CLI às vezes muda EOL (LF ↔ CRLF). Configure `.gitattributes` na raiz:
```
themes/**/*.liquid text eol=lf
themes/**/*.json text eol=lf
```
