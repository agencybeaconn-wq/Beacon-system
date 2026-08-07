# NODE — Direção de Arte da Home

> Estágio 1 do plano de qualidade. Escrito DEPOIS do canvas (erro de processo: a skill
> manda escrever antes) — por isso serve tanto de direção quanto de **auditoria** do que já
> existe. Cada seção marca o que está `OK`, o que é `DÍVIDA` e o que é `NOVO`.
>
> Estado congelado antes deste documento: `_backup-v2-4atos/`

---

## 1. Tese

**A NODE é o cérebro que opera a loja.** A página inteira é uma descida do pensamento até a
execução, e a arte generativa é o argumento — não decoração:

| Ato | Arte | Significado | Seção |
|---|---|---|---|
| 1 | Cérebro à direita | a inteligência | Hero |
| 2 | Cérebro à esquerda | a engenharia por trás | Soluções |
| 3 | Neurônio pulsando à direita | o sinal virando operação | Resultados |
| 4 | Campo explodido na tela | sistemas rodando em escala | FAQ → Rodapé |

Consequência editorial: **cada seção precisa provar o ato em que está.** Resultados não pode
ser só número — precisa mostrar a operação real. Daí os banners das lojas.

---

## 2. Paleta (papéis, não lista de cores)

Regra que mandou nesta escolha: a cor da interface tem que ser **a mesma tese** da arte. Hoje
não é — a arte é violeta/âmbar/azul e a UI é branco e cinza puros. É a maior causa da
sensação de "duas coisas coladas".

| Token | Valor | Papel |
|---|---|---|
| `--bg` | `#08090C` | base — off-black **azulado**, nunca `#050505` chapado |
| `--bg-elev` | `#0E1017` | superfície elevada (cards, banners) |
| `--fg` | `#EEF1F7` | texto principal — **gelo**, nunca `#ffffff` puro |
| `--muted` | `#8A90A2` | texto secundário (AA sobre `--bg`) |
| `--line` | `rgba(190,200,225,.11)` | bordas — azuladas, não cinza neutro |
| `--accent` | `#8B6FE0` | **única cor de acento** — hsl(260,62%,66%), sat 62% ✓ |
| `--accent-hi` | `#A48CEE` | hover / estado ativo |
| `--accent-dim` | `rgba(139,111,224,.14)` | preenchimento sutil, glow de borda |

**Por que violeta:** é o único matiz presente nos três atos (violeta no cérebro, meio do
gradiente do neurônio, e nos cubos do finale). A UI adotar violeta faz a página inteira virar
uma peça só.

**O âmbar (`#F4A94A`) fica DENTRO do canvas**, no núcleo do neurônio. Não vira token de UI —
uma cor de acento só, conforme a regra. Se um dia precisar sair do canvas, é exclusivo de
"resultado comprovado", nunca decorativo.

- `DÍVIDA` — `--bg:#050505`, `--fg:#ffffff` e `--line` cinza neutro precisam migrar.
- `DÍVIDA` — nenhum link, borda, foco ou hover usa acento hoje. Tudo branco.

---

## 3. Tipografia

`DÍVIDA CRÍTICA` — a home usa **Inter Tight**, e a regra do projeto proíbe Inter/Roboto/Arial.
Trocar por **Geist** (display + texto) ou **Satoshi**. Mono atual (JetBrains Mono) fica: o
papel de etiqueta técnica está correto.

Escala e papéis:

| Papel | Spec |
|---|---|
| Display (hero) | `clamp(2.8rem, 6.4vw, 5.4rem)`, peso 500, `letter-spacing:-.035em`, `line-height:.98` |
| H2 de seção | `clamp(2rem, 3.6vw, 3.1rem)`, peso 500, `-.03em` |
| Numeral de resultado | `clamp(2.4rem, 4.4vw, 3.8rem)`, peso 400, tabular-nums |
| Corpo | `1.02rem`, `line-height:1.62`, **max-width 62ch** |
| Etiqueta mono | `.72rem`, `letter-spacing:.16em`, uppercase |

`NOVO` — **momentos editoriais** (hoje inexistentes; tudo tem o mesmo peso visual):
1. Um numeral gigante sangrando pra fora da coluna em Resultados.
2. O passo do Processo com o índice `01–04` em escala grande e opacidade baixa, atrás do título.
3. Uma linha do hero com peso/tratamento diferente do resto (a palavra que carrega a tese).

---

## 4. Motion

Uma duração e uma curva pro site inteiro — já correto e **deve ser preservado**:

```
--dur: .7s
--ease: cubic-bezier(.22, 1, .36, 1)
```

`DÍVIDA` — as rampas dos atos são **lineares** (`ramp()` puro). Falta personalidade de tempo:
aplicar smootherstep (`t³(t(6t−15)+10)`) na rampa para dar antecipação e assentamento. A sua
palavra original foi "pensante"; interpolação linear lê como "deslocante".

Regras fixas: animar só `transform`/`opacity`; `prefers-reduced-motion` desliga tudo; interpolação
de estado sempre por `state += (alvo − state) * k` no rAF, nunca aplicando o alvo direto.

---

## 5. Luz e profundidade (o pedido "iluminação completa, imersivo")

Hoje a luz vive **só dentro do canvas**. Fora dele: preto chapado, borda de 1px, texto branco.
É por isso que lê como "tema escuro" e não como cinema. Três camadas a construir:

**5.1 Vazamento de luz (`NOVO`)** — a arte tem uma posição conhecida a cada ato (direita →
esquerda → direita → tela toda). Superfícies próximas a ela devem acender **na borda voltada
para a luz**: borda em gradiente (mais clara do lado da arte), e um leve `--accent-dim` no canto.

**5.2 Superfície com matéria (`NOVO`)** — cards e banners deixam de ser retângulo com borda:
`background: rgba(190,200,225,.035)` + `backdrop-filter: blur(14px)` + borda em gradiente.
Dá material que capta luz em vez de buraco preto.

**5.3 Profundidade real (`NOVO`)** — hoje só as partículas têm eixo Z; o conteúdo é um plano
rígido. Três camadas em velocidades diferentes:
- fundo: canvas (`fixed`)
- meio: banners/cards com `translateY` de ~40px no range de scroll
- frente: texto (velocidade normal)

---

## 6. Registro por seção — **o gap número um**

Hoje as 7 telas usam a mesma receita: fundo preto + partículas + texto branco. Sem o texto,
ninguém distingue uma seção da outra. Sites de referência alternam registro.

| # | Seção | Registro | Status |
|---|---|---|---|
| 01 | Hero | Imersivo escuro · arte à direita · texto à esquerda | `OK` |
| 02 | Soluções | Imersivo escuro · arte à esquerda · texto à direita · **cards com matéria** | `DÍVIDA` (cards chapados) |
| 03 | Resultados | **Prova real**: banners das lojas enfileirados à esquerda + neurônio à direita | `NOVO` ← implementado agora |
| 04 | Processo | **INVERTIDO**: fundo claro (gelo), texto escuro, arte recuada/mascarada | `NOVO` ← maior quebra de ritmo |
| 05 | FAQ | Imersivo escuro · campo explodido | `OK` |
| 06 | CTA + Rodapé | Imersivo denso · fechamento | `DÍVIDA` (hoje é só rodapé) |

A seção 04 invertida é a mudança mais barata com maior impacto: quebra a monotonia e prova
que o sistema de cor funciona nos dois modos.

---

## 7. Prova real — banners de operação (seção 03)

**Intenção: excelência de entrega, não conversão.** É portfólio, não anúncio. Sem preço, sem
"compre", sem métrica de venda no card — só a loja, o que ela é, e o link.

- Três banners **enfileirados na coluna esquerda**, um por linha.
- Cada um: miniatura real da home (capturada em 1280×800, recortada 16:10), nome da loja,
  uma linha do que foi entregue, e o domínio.
- Clicáveis, abrindo em nova aba com `rel="noopener noreferrer"`.
- Hover: eleva 4px, borda assume `--accent`, miniatura sai de 92% para 100% de saturação.
- A imagem entra com `loading="lazy"` e `aspect-ratio` fixo — nada de layout shift.

Lojas: **Pace Run** (lojapacerun.com.br) · **TH Imports** (thimportsloja.com.br) ·
**Mundo Timão** (mundotimao.com.br).

---

## 8. Interação (`DÍVIDA` quase total)

A página inteira tem **uma** micro-interação: o cérebro reage ao mouse. Falta, por prioridade:

1. Hover dos banners/cards **perturbando o campo de partículas** (a luz reage ao toque).
2. Estado de foco visível com `--accent` (acessibilidade + acabamento).
3. Indicador de progresso dos 4 atos na lateral — dá mapa ao usuário.
4. Coreografia de entrada: hero monta em ~900ms com a arte assentando.
5. Cursor próprio: **opcional** e último — só se não custar legibilidade.

---

## 9. Critério de aceite (o que define "chegamos")

Sem critério nomeado, iteração vira gosto e não converge.

- [ ] Cobrir o texto e ainda assim distinguir as 6 seções pelo registro visual
- [ ] Nenhum `#ffffff` puro, nenhum `#000000`, nenhuma fonte da família Inter
- [ ] O acento violeta aparece em link, borda, foco e hover — a UI participa da tese
- [ ] Toda superfície elevada capta luz (borda em gradiente do lado da arte)
- [ ] Pelo menos 3 camadas de profundidade em movimento no scroll
- [ ] Produto real visível na página (3 banners de loja, clicáveis)
- [ ] Uma seção em registro invertido (claro)
- [ ] Texto legível sobre a arte em TODOS os atos, desktop e 390px
- [ ] Zero erro de console; `prefers-reduced-motion` desliga o movimento

---

## 10. Ordem de execução

1. **Banners de prova real** (seção 03) — entrega visível, introduz imagem na página ← *feito*
2. **Tokens + fonte** — paleta com acento e troca da Inter Tight; toca tudo, faz de uma vez
3. **Seção 04 invertida** — a quebra de ritmo
4. **Matéria e vazamento de luz** — cards/banners que captam luz
5. **Profundidade em camadas** — parallax de 3 velocidades
6. **Interação e coreografia** — hover no campo, foco, entrada
7. **Momentos editoriais de tipografia** — os 3 da seção 3

Regras de processo que valem aqui (`references/arte-generativa.md`): uma variável por rodada,
verificação antes de mostrar, e nada de git sem "sobe".
