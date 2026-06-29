# 🎓 Campo de Treinamento dos AGENTES — Lever Dev BR

> Ambiente de treino prático onde os 4 agentes Lever exercitam as skills (especialmente as 7 novas do `quality-gate` v4).
> **Loja:** `testeloja-9899.myshopify.com` (Loja de Desenvolvimento - BR)
> **Tema-alvo:** `Campo de treinamento dos AGENTES` (ID `162148253938`, role=unpublished)
> **Tema main publicado (NÃO TOCAR):** `Tema Lever Atualizado 18/03` (ID `160282804466`)

## Por que existe

Agentes que só LEEM docs não pegam a malícia do operacional. Aqui eles:
1. Recebem uma loja sabotada (Boss injetou bugs reais)
2. Descobrem os bugs via `quality-gate` v4 + `audit-store`
3. Consertam usando as skills da própria competência
4. Validam que tudo voltou ao normal

Se um agente NÃO consegue, Boss refatora a skill faltante (não o agente erra — é a ferramenta).

## Sistema de tasks

Cada agente tem um arquivo `tasks/XX-<nome>.md` com:
- Loja + tema-alvo + flags
- Missão (sem dizer EXATAMENTE quais bugs — agente descobre)
- Skills disponíveis (apenas as que ele já invoca por padrão)
- Critério de sucesso (quality-gate verde nos checks da sua área)
- Onde salvar relatório

## Ordem sequencial (1 agente por vez)

| # | Agente | Task | Tempo estimado |
|---|---|---|---|
| 1 | lever-qa baseline | `01-lever-qa-baseline.md` | ~3min |
| 2 | lever-tema | `02-lever-tema.md` | ~15min |
| 3 | lever-deploy | `03-lever-deploy.md` | ~15min |
| 4 | lever-catalogo | `04-lever-catalogo.md` | ~10min |
| 5 | lever-qa final | `05-lever-qa-final.md` | ~3min |

## Snapshot pra reversão

Boss salvou TUDO que sabotou em `tmp_caos_snapshot/caos-log-AAAA-MM-DDTHH-MM-SS.json` antes de aplicar. Se um agente travar:
- Boss reverte manualmente lendo o log
- Boss refatora a skill que faltou
- Re-rodar o treino

## Regras do campo

1. **Não mexer no tema main publicado** (`160282804466`). Só no Campo de Treinamento (`162148253938`).
2. **Não deletar produtos** — só editar variantes/imagens. Restauração via skill, não manual.
3. **Sempre rodar quality-gate ANTES e DEPOIS** de cada conserto pra medir progresso.
4. **Marcar produtos sabotados com tag `_caos_treino`** (Boss já fez) — facilita identificação.
5. **Coleções sabotadas têm prefix `_CAOS`** — fácil de filtrar/deletar.
6. **Salvar relatório de execução** em `tasks/relatorios/<agente>-AAAA-MM-DD.md`.

## Comando-base pra quality-gate v4

```bash
node .claude/skills/quality-gate/quality-gate.mjs "Loja de Desenvolvimento - BR" --theme-id=162148253938 --triggered-by=campo-treino
```

Flag `--theme-id` (recém-implementada) mira o tema unpublished.
