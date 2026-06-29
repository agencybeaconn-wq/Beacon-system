# Lever Landing System — Contrato

Sistema interno pra construir LPs do Lever Site (Vite + React + Tailwind) com qualidade consistente. **Toda LP em [src/pages/landing/](../../pages/landing/) consome blocks daqui.**

## Regra ouro

Se um valor visual (cor, fonte, espaçamento, radius) está dentro de uma LP em forma de string Tailwind crua, **está errado**. Tem que vir de [`tokens/`](tokens/index.ts).

## Anatomia de uma LP

```
src/pages/landing/<slug>/
  page.tsx        ← composição pura de blocks + LandingShell
  (assets/)       ← imagens locais opcionais
```

`page.tsx` faz **apenas** três coisas:
1. Define o objeto `meta` (slug, title, description, path)
2. Define props de cada block
3. Compõe `<LandingShell><Hero/><CTA/>...</LandingShell>`

Lógica de negócio (fetch, form submit, auth) **NÃO** mora em LP. Se precisar, cria hook em `landing-system/hooks/` ou usa componente do app.

## Blocks disponíveis

- `Hero` — header da página (1 por LP, H1 único)
- `CTA` — seção de conversão (variants: muted / accent / invert)
- `Footer` — rodapé com grupos de links

Para adicionar block novo:
1. Cria `blocks/<Nome>.tsx` exportando componente + `interface <Nome>Props`
2. Adiciona ao barrel [`index.ts`](index.ts)
3. Block usa SÓ classes vindas de `tokens` pra cor/spacing/tipografia

## Critérios de qualidade (QA — bloqueante)

Antes de uma LP entrar em produção:

- **Tipografia**: zero `text-Nxl` solto fora de `tokens.typography`
- **Cor**: zero `bg-[#hex]` ou `text-[#hex]` — sempre tokens semânticos
- **Espaçamento**: padding/margin sempre múltiplo de 4 (Tailwind nativo já garante)
- **Headings**: exatamente 1 `<h1>`, hierarquia sequencial (h1 → h2 → h3)
- **Acessibilidade**: toda `<img>` com `alt` não vazio; CTAs com label descritivo (não "Clique aqui")
- **Performance**: Hero image com `loading="eager"`, demais com `loading="lazy"`; sem dep nova > 30kb sem justificativa
- **Meta**: `LandingShell` recebe `meta` preenchido — title < 60 chars, description 120-155 chars
- **Tracking**: CTAs disparam evento `landing_cta_click` (default do `CTAButton`)

## Origem do conteúdo: AI Studio

Fluxo padrão:
1. Brief vai em [`_briefs/<slug>.md`](_briefs/)
2. Output cru do Gemini vai em [`_raw/<slug>.tsx`](_raw/) (NÃO comitar — gitignored)
3. Tradução pra blocks vira `src/pages/landing/<slug>/page.tsx`

`_raw/` é area de staging — nunca importar dele em runtime.

## Tokens — quando criar token novo

Criar entry em `tokens/index.ts` quando o mesmo padrão visual aparece em **2+ blocks**. Antes disso, fica como classe local no block. Token prematuro é pior que duplicação.

## Fora de escopo (hoje)

- Internacionalização de LP (pode usar `i18next` existente caso necessário)
- CMS / conteúdo dinâmico
- A/B testing built-in
- Server-side rendering (Vite SPA, OK pra LP marketing por enquanto)
