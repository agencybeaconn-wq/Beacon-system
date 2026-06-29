# Bloco: Hero Video + Video Banner Center

## Operação
- **Data:** 2026-04-15
- **Origem:** Mega Mantos — "Tema para COPA DO MUNDO" (publicado, id 180589559919)
- **Destino:** Mega Mantos — "Tema Lever / Mega Mantos" (unpublished, id 181274935407)
- **Idioma:** BR → BR
- **Validação:** 100% (validateAll ok nas duas sections)
- **Status:** Aplicado (só arquivos; colaborador vai montar no index.json manualmente)

## Arquivos tocados
| Arquivo | Antes | Depois | Diff |
|---|---|---|---|
| sections/hero-video.liquid | inexistente | 1749 bytes | novo |
| sections/video-banner-center.liquid | inexistente | 7563 bytes | novo |

## Features adicionadas
- **hero-video:** video_url (mp4), título, subtítulo, botão com link. Settings da instância original: "PRODUTOS COPA DO MUNDO FIFA 26", CTA "COMPRAR AGORA!" → collection `copa-do-mundo-2026`.
- **video-banner-center:** vídeo fundo + bandeira (PNG), subtítulo, título, botão com cor/radius/bg configuráveis, overlay opacity. Instância original: "BRASIL RUMO AO HEXA" / LANÇAMENTOS, CTA "VER MAIS" → collection `brasil`, botão amarelo `#e3b505`.

## Traduções
Nenhuma — BR → BR.

## Notas
- Vídeos são `shopify://files/...` da própria Mega Mantos — referências preservadas (mesma loja).
- Colaborador pediu só criar os arquivos, sem alterar `templates/index.json`. Vai inserir manualmente no editor.
- Não houve conflito: Lever theme não tinha nenhuma das duas sections antes.

## Candidato?
Possível — são sections genéricas de vídeo hero úteis em qualquer loja BR de camisas. Aguardar colaborador.
