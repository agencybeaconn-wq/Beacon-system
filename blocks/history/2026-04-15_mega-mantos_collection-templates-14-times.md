# Bloco: Collection Templates — 14 Times Brasileirão

## Operação
- **Data:** 2026-04-15
- **Origem:** Mega Mantos — "Tema para COPA DO MUNDO" (publicado, id 180589559919)
- **Destino:** Mega Mantos — "Tema Lever / Mega Mantos" (id 181274935407)
- **Idioma:** BR → BR
- **Status:** Aplicado (14 templates + 2 sections dependentes)

## Arquivos tocados
Templates (14):
- collection.atletico-mineiro.json ← atletico-mg (9509 B)
- collection.bahia.json ← bahia (3796 B)
- collection.botafogo.json ← botafogo (3802 B)
- collection.corinthians.json ← corinthians (sobrescrito, 7190 B)
- collection.cruzeiro.json ← cruzeiro (8709 B)
- collection.flamengo.json ← flamengo (sobrescrito, 9962 B)
- collection.fluminense.json ← fluminense (9970 B)
- collection.fortaleza.json ← fortaleza (3804 B)
- collection.gremio.json ← gremio (3798 B)
- collection.internacional.json ← internacional (6798 B)
- collection.palmeiras.json ← palmeiras (7596 B)
- collection.santos.json ← santos (3798 B)
- collection.sao-paulo.json ← sao-paulo (9158 B)
- collection.vasco.json ← vasco (4252 B)

Sections dependentes (copiadas 1ª, senão PUT falhava 422):
- sections/players-caroussel.liquid (18475 B)
- sections/video-commerce.liquid (15954 B)

## Notas
- 1º tentativa falhou com 422 — JSONs referenciavam sections inexistentes no Lever. Resolvido copiando as 2 sections antes dos templates.
- Templates contêm as settings de banner (imagens shopify://files da mesma loja, continuam válidas).
- Mapeamento especial: menu aponta pra `/collections/atletico-mineiro` mas o template da origem era `atletico-mg` — criado como `atletico-mineiro` pra bater com o handle da coleção.
- Colaborador vai ajustar imagens/coleções e publicar no editor do tema.

## Candidato?
Não — conteúdo específico de Mega Mantos (banners por time).
