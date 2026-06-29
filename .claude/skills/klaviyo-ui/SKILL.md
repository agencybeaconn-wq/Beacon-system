---
name: klaviyo-ui
description: Automate Klaviyo dashboard operations via Playwright (edit/review/publish flows, edit emails, edit forms, A/B discard, change conversion metric). Uses persistent profile — log in once, session lasts ~14 days. Run from `.claude/skills/klaviyo-ui/`.
---

# klaviyo-ui

Playwright skill para operar o dashboard Klaviyo no que a API não cobre.

## Quando usar

- Editar **subject / preview / from name / body** de email dentro de um flow
- Revisar estrutura de flow (steps, A/B, métricas)
- Publicar flow (draft → live)
- Descartar A/B test
- Trocar conversion metric do flow
- Editar regras de display / targeting de form

Para qualquer coisa que a [Klaviyo API](https://developers.klaviyo.com/) já resolve (criar perfil, disparar evento, list management, métricas), **use a API**, não esta skill.

## Setup (uma vez)

```bash
cd .claude/skills/klaviyo-ui
npm install
npx playwright install chromium
npm run login          # abre Chromium, você loga 1x manual, session persiste em profile/
```

Profile fica em `.claude/skills/klaviyo-ui/profile/` (gitignored). Sessão dura ~14d. Se expirar, rodar `npm run login` de novo.

## Uso

```bash
# Revisar um flow (lista steps, A/B, status, métricas básicas)
npm run flow -- review --name "Welcome Series"

# Editar email dentro de um flow step
npm run flow -- edit-email --flow "Welcome Series" --step 2 \
  --subject "Novo subject" --preview "Preview text"

# Publicar flow
npm run flow -- publish --name "Post-Purchase v2"

# Descartar A/B (escolhe winner ou descarta)
npm run flow -- discard-ab --flow "Welcome Series" --step 3 --keep A

# Trocar conversion metric
npm run flow -- change-conversion --flow "Welcome Series" --metric "Placed Order"

# Editar form (display rules, targeting)
npm run flow -- edit-form --name "Exit Intent UK" --delay 5 --frequency "once_per_session"
```

Cada run gera log + screenshots em `runs/<timestamp>/`.

## Estrutura

```
.claude/skills/klaviyo-ui/
  src/
    cli.ts                  ← entry, roteia pra cada flow
    lib/
      session.ts            ← persistent profile, helpers de browser
      selectors.ts          ← seletores centralizados (Klaviyo muda DOM, ajustar aqui)
      log.ts                ← timestamp + screenshot helpers
    flows/
      login.ts
      review-flow.ts
      edit-email.ts
      publish-flow.ts
      discard-ab.ts
      change-conversion.ts
      edit-form.ts
  profile/                  ← gitignored: cookies, localStorage
  runs/                     ← gitignored: logs + screenshots por run
  package.json
  tsconfig.json
```

## Por que perfil dedicado

Chrome 130+ bloqueia CDP em profile Default (security policy — ver memória
`reference_klaviyo_chrome_cdp_limitation`). Por isso usamos Chromium isolado do
Playwright com profile em `./profile/`. Zero interferência com seu Chrome real.

## Quando o Klaviyo muda a UI

Seletores ficam centralizados em `src/lib/selectors.ts`. Quando algo quebrar:

1. `npm run login -- --debug` abre headed, navega na UI, copia novo seletor (clique direito > Inspect > Copy selector, **prefira data-testid quando existir**)
2. Atualiza `selectors.ts`
3. `npm run flow -- review --name "X"` pra revalidar
