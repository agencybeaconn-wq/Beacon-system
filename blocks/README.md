# Lever Blocks — Biblioteca canônica de blocos de loja

Esta pasta guarda **versões canônicas** de blocos/features que usamos em lojas Shopify de clientes. A ideia é ter uma fonte única de verdade local, versionada no git, que não dependa de clonar uma loja Shopify cada vez que quisermos aplicar uma feature.

## Arquitetura

```
blocks/
├── <bloco>/
│   ├── manifest.md           # O que é, pra que serve, requisitos, como aplicar
│   ├── <arquivo>.liquid      # Os arquivos do bloco (snippets, sections, etc)
│   ├── <arquivo>.js
│   └── <arquivo>.css
```

Cada pasta representa **um bloco canônico**. O `manifest.md` descreve:
- Origem (de qual loja foi extraído e em qual data)
- Função do bloco
- Arquivos que compõem
- Settings do tema que precisam existir
- Dependências (outros blocos, assets, snippets do Dawn)
- Como aplicar numa loja nova (passo a passo pro script/skill)

## Princípios

1. **Canônico = uma versão só por feature**. Se existem 3 implementações diferentes de progress bar, o `blocks/cart-progress-bar/` tem **apenas a mais atualizada**. A decisão de qual é a canônica vive no Obsidian em `blocos/_ranking`.
2. **Não commitar tema inteiro** — só os arquivos Lever-customizados. Arquivos Dawn sem modificação não entram aqui.
3. **Idioma-neutro** — strings hard-coded em PT devem ser substituídas por settings ou locale keys. Se ainda tem PT hard-coded, marcar no manifesto como `i18n: pending`.
4. **Zero dependência runtime** — blocos são arquivos estáticos lidos pelo skill `deploy-store` na hora de aplicar numa loja.

## Blocos disponíveis

| Bloco | Status | Origem | Uso |
|---|---|---|---|
| `cart-progress-bar/` | canônico | Golaço (2026-04-11) | Progress bar 2-milestone com sliding window |
| `cart-drawer/` | canônico | Golaço (2026-04-11) | Drawer com qty inline, patches thumb, savings |
| `cart-page/` | canônico | Golaço (2026-04-11) | Template cart.json + main-cart-items + footer |
| `shipping-calculator/` | canônico | Golaço (2026-04-11) | Calculadora CEP Correios |

## Processo de promoção

Para promover um bloco de uma loja cliente a canônico:

1. Identificar o bloco na loja via skill `code-blocks` no Obsidian
2. Comparar com o canônico atual (se existir)
3. Se for melhor, substituir o conteúdo aqui e atualizar o `manifest.md`
4. Atualizar `Obsidian: blocos/_ranking` apontando pra versão nova
5. Commitar com mensagem `blocks: promover <bloco> de <loja origem>`

Ver [processo de deploy de loja nova](../../Inteligencia lever/Lever QI/Shopify/processos/deploy-loja-nova.md) no Obsidian.
