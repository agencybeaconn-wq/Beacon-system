---
name: build-league-submenus
description: Cria submenus no Menu Principal a partir das ligas (Brasileirão, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Seleções). Para cada item de liga no menu, adiciona como sub-itens as coleções de clubes/seleções pertencentes àquela liga que tenham pelo menos 1 produto.
argument-hint: [nome do cliente] [--apply] [--menu=main-menu]
---

# build-league-submenus — Submenus de clubes por liga

Toda loja de camisas com menu organizado por ligas (Brasileirão, Premier League, La Liga, etc) deve ter cada item de liga expandido em sub-itens com os clubes/seleções daquela liga **que possuem coleção com produto**. Sem isso, o usuário não navega entre times — só vê uma lista plana por liga.

## Quando usar

- Loja nova: depois de `/deploy-store` e do tema configurado, quando o menu principal já tem as ligas mas sem submenus
- Loja existente: quando coleções de clubes foram criadas/preenchidas e o menu ainda mostra só a liga sem expansão
- Linguagem natural: "criar submenus de clubes", "adicionar times no menu por liga", "expandir Premier League no menu", "Brasileirão tá só com a liga, falta os clubes"

## Regra fundamental

**Só vira submenu coleção que tem ≥1 produto.** Coleções vazias são ignoradas — submenu apontando pra coleção vazia é experiência ruim.

A ordem dentro de cada liga é alfabética (case-insensitive, com normalização de acentos).

## Mapeamento liga → clubes

A skill mantém um mapa autoritativo `LEAGUE_CLUBS` no `.mjs` com os handles canônicos de cada liga:

| Liga (handle no menu) | Clubes/Seleções esperados (handles) |
|---|---|
| `brasileirao` | atletico-mineiro, botafogo, corinthians, cruzeiro, flamengo, fluminense, fortaleza, gremio, internacional, palmeiras, sao-paulo, vasco, bahia, santos, athletico-paranaense, atletico-pr, ceara, juventude, mirassol, sport, vitoria, bragantino, red-bull-bragantino |
| `premier-league` | arsenal, aston-villa, brighton, chelsea, everton, fulham, leeds, liverpool, manchester-city, manchester-united, newcastle, nottingham-forest, tottenham, west-ham, wolverhampton |
| `la-liga` | atletico-de-madrid, barcelona, real-betis, real-madrid, real-sociedad, sevilla, valencia, villarreal, athletic-bilbao, athletic-club |
| `serie-a` | inter-de-milao, juventus, lazio, milan, ac-milan, napoli, roma, as-roma, atalanta, fiorentina, torino |
| `bundesliga` | bayer-leverkusen, bayern-de-munique, bayern-munich, borussia-dortmund, borussia-monchengladbach, eintracht-frankfurt, rb-leipzig, schalke-04, vfb-stuttgart, werder-bremen, wolfsburg |
| `ligue-1` | psg, paris-saint-germain, olympique-de-marseille, marseille, olympique-lyonnais, lyon, monaco, lille, nice, rennes |
| `selecoes` | alemanha, argentina, belgica, brasil, canada, colombia, costa-rica, croacia, dinamarca, equador, escocia, espanha, estados-unidos, franca, holanda, inglaterra, italia, jamaica, japao, marrocos, mexico, paraguai, peru, polonia, portugal, senegal, suica, uruguai |

Aliases (PT/EN) são suportados — se ambos `bayern-de-munique` e `bayern-munich` existem com produto, a skill usa só o primeiro encontrado e ignora o duplicado por título.

## Triggers (linguagem natural)

- "criar submenus de clubes nas ligas"
- "expandir Brasileirão / Premier League no menu"
- "menu sem times, só com a liga"
- "adicionar Arsenal, Chelsea... como submenu da Premier League"
- "submenus por liga"

## Uso

```bash
# Dry-run (default) — mostra o preview sem aplicar
node .claude/skills/build-league-submenus/build-league-submenus.mjs "Golaço"

# Aplicar — atualiza o main-menu via menuUpdate
node .claude/skills/build-league-submenus/build-league-submenus.mjs "Golaço" --apply

# Outro menu (não main-menu)
node .claude/skills/build-league-submenus/build-league-submenus.mjs "Golaço" --apply --menu=mega-menu
```

## Protocolo

`VALIDATE → FETCH menu + collections → MAP leagues → FILTER produtos≥1 → PREVIEW → CONFIRM → menuUpdate → LOG`

1. **VALIDATE**: cliente existe, Shopify conectada
2. **FETCH menu**: lê o menu (default `main-menu`) e identifica os items que apontam para `/collections/<handle-de-liga-conhecido>`
3. **FETCH collections**: lista smart + custom collections, calcula `products_count` de cada uma
4. **MAP**: pra cada liga encontrada no menu, intersecciona `LEAGUE_CLUBS[liga]` com handles existentes na loja
5. **FILTER**: descarta clubes com 0 produtos
6. **PREVIEW**: imprime árvore do menu novo (lojas grandes — ex: 7 ligas × ~5 clubes = 35+ subitems)
7. **CONFIRM**: requer `--apply` pra escrever
8. **menuUpdate**: GraphQL `menuUpdate(id, title, handle, items)` reenviando a árvore inteira

## Limitações

- **Não cria coleções**: se PSG não tem coleção, ele não vira submenu. Pra criar coleções de clubes faltantes, use `/shopify` ou `/deploy-store` antes.
- **Mapeamento estático**: novos clubes precisam ser adicionados em `LEAGUE_CLUBS` no `.mjs`. Se o time não tá no mapa, a skill não sabe a qual liga ele pertence.
- **Single menu por execução**: rode novamente com `--menu=` se precisar atualizar mais de um.
- **Não toca em items que não são liga**: "Página Inicial", "Lançamentos", "Inverno", "Retrô" e qualquer item que não mapeie pra uma liga conhecida ficam intactos (sem submenus, sem alteração).

## Verificação

```bash
# Antes
# Menu mostra: Brasileirão / Premier League / La Liga / ... (sem subs)

node .claude/skills/build-league-submenus/build-league-submenus.mjs "Golaço" --apply

# Depois
# Brasileirão (+10 subs)
# Premier League (+5 subs)
# La Liga (+3 subs)
# Serie A (+5 subs)
# ...
```

Re-rodar é seguro — gera o mesmo menu se o catálogo não mudou (idempotente).
