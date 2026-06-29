# Bloco: Patches por Competicao (BR)

## Operacao
- **Data:** 2026-04-08
- **Origem:** Golaco (smyvkp-2j.myshopify.com)
- **Idioma:** BR
- **Status:** Candidato pra Template BR
- **Resultado:** 27 patches, 49 colecoes, 155 regras, 0 erros + fix Serie A

## O que faz
Atribui cada patch aos times/selecoes que jogam aquela competicao. Titulos em portugues.

## Patches (27 — titulos BR)
- Kit Patch Campeao Libertadores TETRA 2025
- Kit Patches Copa do Mundo 2026 Qualifiers Play With Heart & FOUNDATION
- Patch Brasileirao / Bundesliga / Champions League / Copa do Brasil / LaLiga / Liga MX / Liga Portugal / Ligue 1 / Premier League / Serie A / Sudamericana Participacao
- Patch Champions League 15/7/6/5 Trofeus
- Patch FIFA Copa do Mundo 2026 Participacao / Qualifiers
- Patch Final Libertadores 2025
- Patch Libertadores Participacao
- Patch World Champions / World Cup 2025 Participacao
- Patches Cruz 2024/25
- Patches Libertadores 2/3 Trofeus
- Patches UEFA Champions 2025/26

## Mapeamento times → patches
Mesmo mapeamento global (ver arquivo original). Regras usam `title contains "Patch X Participacao"`.

## Fix aplicado: Serie A
Bug: regra `OR title not_contains "juventus da mocca"` pegava TODOS os 1.131 produtos.
Fix: removida a regra. Colecao agora so tem regras validas de times italianos.

## Fix aplicado: exclusao de patches de regioes
Colecoes AND (Brasil, Masculino Brasil): adicionado `title not_contains "Patch"`.
Colecoes OR (America, Europa, Selecoes, Lancamentos): vazamento aceito (nao tem como excluir em OR).

## Cuidados BR
- Precos em BRL (R$30, compare_at R$119,99/R$149,90)
- Labels: "Participacao" nao "Participation", "Trofeus" nao "Trophies"
- Nao tem Patch Supercopa del Rey (so existe na EN)
- Cuidado com colecoes OR que tem regras not_contains — podem puxar tudo
