---
name: create-standard-pages
description: Cria as páginas legais padrão (Aviso Legal, Compra Segura, Envios e Prazos, Opções de Pagamento, FAQ, Política de Privacidade em BR / About Us, FAQ, Legal Notice em EN) numa loja Shopify a partir de templates com placeholders do briefing do cliente.
argument-hint: [nome do cliente] [--apply] [--lang=br|en]
---

# create-standard-pages — Páginas legais padrão

Cria páginas legais/institucionais padrão numa loja Shopify a partir de templates.

## Quando usar

- Deploy novo de cliente → precisa criar pages legais básicas
- Quality gate reporta menu items apontando pra `/pages/aviso-legal` etc que não existem
- Loja dev padrão precisa ter o conjunto base de páginas

## Páginas criadas

**BR** (6 páginas):
- `/pages/aviso-legal` — Aviso Legal
- `/pages/compra-segura` — Compra Segura
- `/pages/envios-e-prazos` — Envios e Prazos
- `/pages/opcoes-de-pagamento` — Opções de Pagamento
- `/pages/perguntas-frequentes` — Perguntas Frequentes (FAQ)
- `/pages/politica-de-privacidade` — Política de Privacidade

**EN** (3 páginas):
- `/pages/about-us` — About Us
- `/pages/faq` — Frequently Asked Questions
- `/pages/legal-notice` — Legal Notice

## Triggers (linguagem natural)

- "criar páginas legais"
- "criar aviso legal"
- "tem menu apontando pra páginas que não existem"
- "páginas padrão"

## Placeholders

Templates usam `{{client_name}}`, `{{support_email}}`, `{{support_phone}}`, `{{shipping_min_value}}`, `{{business_hours}}` — substituídos pelo briefing do cliente via `fetchBriefing()` e fallback pros defaults.

## Uso

```bash
# Dry-run: lista quais páginas seriam criadas (skip as existentes)
node .claude/skills/create-standard-pages/create-standard-pages.mjs "Loja de Desenvolvimento - BR"

# Apply
node .claude/skills/create-standard-pages/create-standard-pages.mjs "Loja de Desenvolvimento - BR" --apply

# Forçar idioma específico (default detecta pelo cliente)
node .claude/skills/create-standard-pages/create-standard-pages.mjs "Cliente X" --apply --lang=en
```

## Protocolo

VALIDATE → FETCH existentes → COMPUTE missing → PREVIEW → CONFIRM → CREATE → LOG

- **Skip páginas que já existem** — idempotente, rodar várias vezes é seguro
- Usa GraphQL `pageCreate` mutation
- Handle determinístico — sempre usa os mesmos handles padrão pra match com menus

## Detecção de idioma

Usa a mesma cascata do `import-missing`:
1. Nome do cliente contém "BR"/"Brasil"/"Brazilian" → BR
2. Domain termina em .com.br → BR
3. Nome contém "EN"/"English" → EN
4. Domain contém "-en." → EN
5. Fallback: BR (pt-BR é idioma padrão do Lever)
