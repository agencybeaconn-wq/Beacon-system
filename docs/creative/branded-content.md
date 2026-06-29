# Conteúdo de Marca (Branded Content)

Permite que criadores e empresas de mídia compartilhem conteúdo influenciado por um parceiro de negócios, marcando-o no post.

## Visão Geral
- **Sponsor Tag (`sponsor_id`):** Marca a Página do parceiro de negócios.
- **Direct Share (`direct_share_status`):** Permite que o parceiro impulsione (boost) o post.
  - `1`: Permite impulsionamento.
  - `0`: Não permite.

## Criando Conteúdo de Marca

### 1. Atualização de Status
Faça um POST no feed da Página.
```bash
curl -X POST "https://graph.facebook.com/PAGE_ID/feed" \
  -F "access_token=TOKEN" \
  -F "message=Confira estes produtos incríveis!" \
  -F "direct_share_status=1" \
  -F "sponsor_id=<SPONSOR_PAGE_ID>"
```

### 2. Fotos
Adicione `url` ou carregue a imagem.
```bash
curl -X POST "https://graph.facebook.com/PAGE_ID/feed" \
  -F "access_token=TOKEN" \
  -F "message=Foto patrocinada" \
  -F "direct_share_status=1" \
  -F "sponsor_id=<SPONSOR_PAGE_ID>" \
  -F "url=https://exemplo.com/foto.jpg"
```

### 3. Vídeos
Requer fluxo de upload de vídeo. O `sponsor_id` é definido na fase `finish`.
```bash
curl -X POST "https://graph-video.facebook.com/VERSION/PAGE_ID/videos" \
  -F "access_token=$at" \
  -F "upload_phase=finish" \
  -F "upload_session_id=SESSION_ID" \
  -F "sponsor_id=<SPONSOR_PAGE_ID>" \
  -F "direct_share_status=1"
```

### 4. Vídeo Ao Vivo (Live)
1. Crie o objeto de Vídeo Ao Vivo.
2. Atualize o objeto adicionando `sponsor_id`.
3. Inicie o stream.

## Atualizando Conteúdo (Pós-Publicação)
Adicione ou altere o patrocinador e a permissão de impulsionamento em posts existentes.

```bash
curl -X POST "https://graph.facebook.com/PAGE_POST_ID" \
  -F "access_token=TOKEN" \
  -F "sponsor_id=<NEW_SPONSOR_ID>" \
  -F "direct_share_status=1"
```
