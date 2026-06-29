# Requisitos de Mídia (Instagram)

Especificações técnicas para imagens e vídeos em anúncios do Instagram.

## Geral (Feed e Explorar)
- **Legendas:** Máximo 2.200 caracteres.
- **Resolução Mínima:** 600px de largura (Recomendado: 1080x1080px).
- **Proporções Suportadas:**
  - **1:1 (Quadrado):** Recomendado.
  - **1.91:1 (Paisagem):** Suportado.
  - **4:5 (Vertical):** Suportado.
- **Vídeo:**
  - Duração: 3 a 60 segundos.
  - Loop infinito no Instagram.
  - Tamanho máx: 2.3 GB.
  - Requer miniatura (`video_data`) com mesma proporção e largura >= 600px.

## Stories
- **Proporção:** 9:16 (Tela Cheia) recomendado.
  - Suporta também 1.91:1 a 4:5 (com barras de fundo personalizáveis).
- **Resolução Mínima:** 600px de largura.
- **Cortes:**
  - Vídeos **não** podem ser cortados via API.
  - Imagens podem ser cortadas (chaves: `90x160`, `100x100`, `191x100`).

## Verificação de Elegibilidade de Vídeo
Antes de usar um vídeo, verifique se ele é compatível com o Instagram:
```bash
curl -G \
  -d "fields=is_instagram_eligible" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<VIDEO_ID>"
```

## Regras de Corte Automático (Sem especificação)
- **Imagem > 1.91:1:** Cortada para 1.91:1.
- **Imagem > 4:5:** Cortada para 4:5.
