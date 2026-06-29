---
name: lever-agent
description: Agente de atendimento que usa os MCP servers oficiais da Shopify (Storefront MCP) pra buscar produtos, responder dúvidas de políticas/FAQs e sugerir checkout em linguagem natural. MVP — busca + detalhes + link. Não é bot conversacional completo ainda.
---

# lever-agent — Agente MCP sobre Shopify

Cliente dos MCP servers oficiais da Shopify. Permite buscar produtos de um cliente específico
via linguagem natural e responder perguntas sobre política da loja.

Backed by `.claude/lib/shopify-mcp.mjs`.

## Quando usar

- Usuário pergunta "quais camisas do Flamengo temos na loja X em tamanho M?"
- Usuário quer gerar um link de checkout/carrinho pronto pra um produto
- Usuário precisa responder uma dúvida de política específica da loja
- Teste/validação de que o MCP server da loja está funcionando

## Comandos

### Buscar produtos
```bash
node .claude/skills/lever-agent/lever-agent.mjs search "<cliente>" "<query em linguagem natural>"

# Ex:
node .claude/skills/lever-agent/lever-agent.mjs search "De Boleiro" "camisa flamengo tamanho M"
node .claude/skills/lever-agent/lever-agent.mjs search "De Boleiro" "algo feminino retrô"
```

### Listar tools do MCP server da loja
```bash
node .claude/skills/lever-agent/lever-agent.mjs tools "<cliente>"
```

### Consultar política/FAQ
```bash
node .claude/skills/lever-agent/lever-agent.mjs policy "<cliente>" "<pergunta>"

# Ex:
node .claude/skills/lever-agent/lever-agent.mjs policy "De Boleiro" "qual o prazo de entrega?"
```

## Arquitetura

```
user → lever-agent.mjs
           │
           ├─ resolve cliente → agency_clients.shopify_domain
           │
           ├─ search → storefrontSearch() → POST https://{shop}/api/mcp
           │                                  tool: search_catalog (UCP)
           │                                  payload: { catalog: { query, context } }
           │
           └─ policy → storefrontMCP(tool: search_shop_policies_and_faqs)
```

## MCP Servers disponíveis (referência rápida)

| Server | Endpoint | Auth | Escopo |
|---|---|---|---|
| Storefront MCP | `https://{shop}/api/mcp` | nenhum | 1 loja, público |
| Catalog MCP | `https://discover.shopifyapps.com/global/mcp` | JWT (client_credentials) | todas as lojas Shopify |
| Checkout MCP (UCP) | `https://{shop}/api/ucp/mcp` | JWT | 1 loja, checkout |

## Limitações conhecidas

- Os nomes das tools mudaram entre versões da doc e o que está ativo nos servers reais. A lib tenta `search_catalog` (UCP atual) com fallback pra `search_shop_catalog` (legacy).
- Response format MCP normalmente vem como `content[0].text` (string JSON). `parseMCPTextContent()` extrai automaticamente.
- Catalog MCP requer client_credentials do Dev Dashboard (`client_id` + `client_secret`) — não configurado ainda. Storefront MCP não precisa.
- Checkout MCP requer Dev Dashboard também e não tá integrado ainda.

## Próximos passos (roadmap)

1. Catalog MCP — precisa config de client credentials no env
2. Checkout MCP — criar carrinho + link de checkout pronto
3. Agente conversacional — wrapping tudo num loop de turnos com contexto
4. Integrar no dashboard Lever OS como chat widget

## Ver também

- [shopify-docs skill](../shopify-docs/SKILL.md) — consultar doc Shopify
- [.claude/lib/shopify-mcp.mjs](../../lib/shopify-mcp.mjs) — cliente raw
- [.claude/reference/shopify-mcp.md](../../reference/shopify-mcp.md) — cheatsheet
