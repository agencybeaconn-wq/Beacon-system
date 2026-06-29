# Code Blocks — Contexto Completo

Construido em 2026-04-08 em horas de conversa entre Pedro e o Claude Boss.
Qualquer Claude que precise entender o PORQUÊ desta skill, leia este arquivo.

---

## Por que existe

A Lever cria lojas Shopify de altissima qualidade. Quando um trabalho de horas fica
excelente em uma loja, esse trabalho se perdia. Esta skill resolve: o melhor de UMA
loja vira padrao pra TODAS.

## Analogias do Pedro

**Retroescavadeira:** Abre a pa (le origem), fecha (extrai), gira (adapta), despeja
(aplica no destino). Nao vem com terra — so funciona quando o operador aponta.

**Quebra-cabeca:** Formato da peca (interfaces) deve ser igual. Imagem (logica interna)
pode mudar. Mesma peca melhor? Encaixa. Formato diferente? Nao sobe.

**Time de futebol:** Categorias = posicoes. Candidatos = jogadores. Template = time
titular. Colaborador = tecnico que escala.

## Evolucao da skill (8 iteracoes)

1. Blocos pre-definidos → Pedro rejeitou ("nao quero pre-definido")
2. Export/import → Pedro ajustou ("tem que ter contexto")
3. Retroescavadeira dinamica → aprovado
4. Validacao CI/CD → Pedro pediu ("igual GitHub")
5. Suporte a melhorias → Pedro explicou ("GitHub nao aceita melhoria, eu quero")
6. Ranking de candidatos → Pedro explicou ("igual time de futebol")
7. Historico/armazenamento → Pedro pediu ("a terra nao pode se perder")
8. Contexto completo → Pedro pediu ("todos os Claudes tem que saber")

## Sessao original (2026-04-08)

1. Importaram 28 patches BR→EN na TG Jerseys (precos BRL→USD, 68 colecoes, 208 regras)
2. Melhoraram carrinho lateral: removeram Choose Player, corrigiram bugs JS,
   patches como propriedade, qty selector condicional, layout empilhado,
   botao verde, filtro milestones, savings calculator
3. Criaram esta skill a partir da experiencia

## Erros e licoes

- **}); solto** — Remover bloco JS deixou fechamento orfao. LICAO: contar chaves.
- **Variaveis deletadas** — nameInput/numberInput dentro do bloco removido.
  LICAO: verificar dependencias antes de deletar.
- **image_url em URL completa** — Filtro Liquid corrompia CDN URL.
  LICAO: URL completa = usar direto sem filtro.
- **CSS !important conflitante** — Arquivo externo ganhava por especificidade.
  LICAO: checar TODOS os arquivos que estilizam o mesmo elemento.

## Visao de futuro

- Micro-skills de auto-correcao dentro desta skill
- Aprendizado continuo com erros anteriores
- Loja rascunho como laboratorio (ainda nao existe)
- Projeto de MESES — nao apressar
