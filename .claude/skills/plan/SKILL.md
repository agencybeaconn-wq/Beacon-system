---
name: plan
description: Planejamento Socrático — analisa a situação, questiona, e decompõe em passos mapeados para skills existentes. Não executa nada.
argument-hint: [o que precisa ser feito]
---

# Planejamento Socrático

Este skill analisa uma demanda, faz perguntas direcionadas, verifica o estado atual do cliente e produz um plano passo-a-passo mapeado para skills existentes. **NUNCA executa operações — apenas planeja.**

---

## Etapa 1: UNDERSTAND — Perguntas Direcionadas

Antes de qualquer análise, faça perguntas objetivas ao colaborador para entender o escopo. Pergunte apenas o que for necessário (pule perguntas cujas respostas já estejam claras no pedido):

- **Qual(is) cliente(s)?** — Nome ou slug do cliente no banco.
- **Qual o resultado esperado?** — O que deve estar diferente ao final?
- **Tem prazo ou prioridade?** — Urgência, data limite.
- **Alguma restrição?** — Produtos específicos, coleções, faixas de preço, etc.

Aguarde as respostas antes de prosseguir. Se o pedido já contiver todas as informações necessárias, siga direto para a Etapa 2.

---

## Etapa 2: ANALYZE — Verificação Read-Only do Estado Atual

Faça uma verificação rápida e leve para entender onde o cliente está agora. Use chamadas read-only — **não altere nada**.

### Checklist de verificação:

1. **Cliente no banco** — Busque em `agency_clients` via supaRest para confirmar que o cliente existe e obter `id`, `shopify_domain`, `shopify_connected`.
2. **Shopify conectada?** — Verifique se `shopify_domain` e `shopify_access_token` existem.
3. **Briefing existe?** — Busque em `briefings` filtrando por `client_id`.
4. **Pricing existe?** — Busque em `client_pricing` filtrando por `client_id`.
5. **Contagens (opcional, se relevante)** — Via proxy Shopify, busque contagem de produtos (`products/count`), coleções (`custom_collections/count` + `smart_collections/count`) e páginas (`pages/count`). Mantenha leve — não busque listas completas.

Resuma o estado atual de forma concisa.

---

## Etapa 3: DECOMPOSE — Decompor em Passos Mapeados

Quebre o trabalho em passos numerados. Cada passo DEVE ser mapeado para uma skill existente. Use exatamente este formato:

```
## Plano para [nome do cliente]

### Estado Atual
- Shopify: [conectada/desconectada] ([domain].myshopify.com)
- Briefing: [preenchido/pendente]
- Pricing: [configurado/pendente] ([detalhes resumidos])
- Produtos: [N] | Coleções: [N] | Páginas: [N]

### Passos

1. `/skill [cliente]` — Descrição breve do que será feito
2. `/skill [cliente]` — Descrição breve do que será feito
3. ...

### Estimativa
- ~[N] min execução total
- ~[N] chamadas de skill sequenciais
```

---

## Skills Disponíveis para Mapeamento

Consulte a **tabela de gatilhos em linguagem natural** no [CLAUDE.md](../../../CLAUDE.md#regra-zero-skill-first) para o mapeamento completo (user natural → skill).

| Skill | Descrição | Categoria |
|---|---|---|
| `/audit-store` | Auditoria completa de saúde da loja (11 checks) | Diagnóstico |
| `/quality-gate` | Radar rápido (<20s): preços, estoque, imagens, SEO, coleções vazias | Diagnóstico |
| `/deploy-store` | Deploy completo de loja nova (coleções + menus + páginas + tema + produtos) | Deploy |
| `/implement` | Executar tasks do kanban automaticamente | Deploy |
| `/configure-theme` | Configurar settings do tema (header, footer, frete, milestones) via briefing | Tema |
| `/lever-theme` | Editar tema local (pull/push-dev/propagate), workflow dev-first | Tema |
| `/update-prices` | Atualizar preços a partir de texto livre (WhatsApp/briefing) + salvar no banco | Preços |
| `/bulk-fix-prices` | Auditar + corrigir discrepâncias entre banco e Shopify | Preços |
| `/create-discount` | Criar cupons BXGY (PAGUE2LEVE3, PAGUE3LEVE5, etc) | Promoções |
| `/import-missing` | Importar produtos do template que faltam no cliente | Produtos |
| `/clean-titles` | Remover marcas (Nike, Adidas) + corrigir typos de gênero (Feminino→Feminina) | Produtos |
| `/fix-options` | Padronizar opções (Tamanho/Personalizar) + escassez PP/5GG | Produtos |
| `/fix-handles` | Corrigir handles PT→EN em lojas internacionais | Produtos |
| `/sort-collections` | Reordenar produtos (Ano → Tipo → Número) | Coleções |
| `/code-blocks` | Copiar features/seções entre lojas | Propagação |
| `/shopify` | **Fallback** genérico — operações ad-hoc não cobertas acima | Genérico |
| `/component` | Criar componente React interno | Dev interno |
| `/edge-function` | Criar edge function Supabase interna | Dev interno |

---

## Etapa 4: PRESENT — Apresentar o Plano

Apresente o plano formatado ao colaborador. Ele decidirá a ordem de execução e executará cada passo manualmente, um por um.

**Regras finais:**
- NUNCA execute operações. Apenas planeje.
- Se o pedido for ambíguo, pergunte antes de montar o plano.
- Se um passo não se encaixar em nenhuma skill existente, descreva-o como passo manual e sinalize.
- Priorize passos que desbloqueiam outros (ex: importar antes de corrigir preços).
- Se múltiplos clientes forem mencionados, crie um plano separado para cada um.
