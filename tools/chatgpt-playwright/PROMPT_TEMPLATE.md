# Prompt Template — Adaptação Criativo Brasileiríssimo → Time Brasileiro

**Validado em**: 2026-05-22 — gerou `corinthians-adaptado-03.png` perfeito (5ª tentativa).

## Variáveis a preencher

- `{TIME}` — nome do time em maiúsculo. Ex: `CORINTHIANS`, `FLAMENGO`, `PALMEIRAS`
- `{ANO_TEMPORADA}` — ex: `2026/27`
- `{LOJA}` — nome da loja origem. Ex: `Brasileiríssimo`
- `{CORES_TIME}` — cores principais do time. Ex: `PRETO, BRANCO, CINZA` (Corinthians) / `VERMELHO E PRETO` (Flamengo) / `VERDE E BRANCO` (Palmeiras)
- `{CORES_EVITAR}` — cores da arte original que NÃO devem aparecer. Ex: `amarelo, verde nem azul (cores do Brasil/seleção)`
- `{TACA}` — competição relevante. Ex: `taça da Libertadores`, `taça do Brasileirão`, `taça da Copa Sul-Americana`

## Template

```
Adapte esta arte (primeira imagem em anexo) COMPLETAMENTE para o {TIME}. Alterações obrigatórias: 
(1) Troque o texto principal grande 'BRASIL' por '{TIME}'. 
(2) Substitua a taça da Copa do Mundo pela {TACA}. 
(3) Substitua a camisa exibida pela do {TIME} {ANO_TEMPORADA} (use as demais imagens em anexo como referência exata da camisa). 
(4) Mantenha o logo da {LOJA} no topo (segunda imagem em anexo). 
(5) MUITO IMPORTANTE: adapte TODAS as cores do fundo, padronagens, estrelas e elementos decorativos para a identidade visual do {TIME} — paleta {CORES_TIME} e tons sóbrios. NÃO use {CORES_EVITAR}. O background deve refletir as cores do {TIME}, como uma arte oficial do clube. 
Mantenha estrutura, layout, tipografia e promoções idênticas ao original.
```

## Ordem dos anexos (obrigatória)

1. **Arte de referência** (9:16) — `inputs/referencia.jpg`
2. **Logo da loja origem** — `inputs/logo-{loja}.png`
3-N. **Fotos do produto do time** (Shopify) — `inputs/{time}-NN.webp`

## Aprendizados

- Sem "ALTERAÇÕES OBRIGATÓRIAS" enumeradas, ChatGPT trata o prompt como sugestão
- Sem `MUITO IMPORTANTE` nas cores, ele mantém paleta da arte original (BR=amarelo)
- O detalhe das texturas/elementos decorativos (estrelas, ano de fundação, textura do gramado) ele faz sozinho bem
- Pegar até números de fundação (1910 pro Corinthians) e gírias da torcida ("INVASÃO") quando o time é conhecido
- Tempo médio: ~60-90 segundos por geração com 9 anexos
- Sempre rodar com `--timeout 360000` (6 min) quando tem muitos anexos

## Exemplo de comando (Corinthians)

```bash
npm run generate -- \
  --prompt "Adapte esta arte (primeira imagem em anexo) COMPLETAMENTE para o CORINTHIANS. Alterações obrigatórias: (1) Troque o texto principal grande 'BRASIL' por 'CORINTHIANS'. (2) Substitua a taça da Copa do Mundo pela taça da Libertadores. (3) Substitua a camisa exibida pela do Corinthians 2026/27 (use as demais imagens em anexo como referência exata da camisa). (4) Mantenha o logo da Brasileiríssimo no topo (segunda imagem em anexo). (5) MUITO IMPORTANTE: adapte TODAS as cores do fundo, padronagens, estrelas e elementos decorativos para a identidade visual do Corinthians — paleta PRETO, BRANCO, CINZA e tons sóbrios. NÃO use amarelo, verde nem azul (cores do Brasil/seleção). O background deve ser escuro/preto com texturas em tons de cinza, como uma arte oficial do Corinthians. Mantenha estrutura, layout, tipografia e promoções idênticas ao original." \
  --ref "./inputs/referencia.jpg" \
  --ref "./inputs/logo-brasileirissimo.png" \
  --ref "./inputs/corinthians-01.webp" --ref "./inputs/corinthians-02.webp" --ref "./inputs/corinthians-03.webp" \
  --ref "./inputs/corinthians-04.webp" --ref "./inputs/corinthians-05.webp" --ref "./inputs/corinthians-06.webp" --ref "./inputs/corinthians-07.webp" \
  --out "./output/corinthians-adaptado.png" \
  --timeout 360000 --debug
```
