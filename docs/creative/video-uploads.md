# Carregamento de Vídeos para Anúncios

O carregamento de vídeos usa um protocolo "retomável" (resumable upload) e é feito em fases.

## Especificações de Vídeo
- **Formato:** MP4 (recomendado).
- **Resolução:** 1280x720 (recomendado).
- **Tamanho Máximo:** 10 GB.
- **Duração:** Varia conforme o posicionamento.

## Fluxo de Carregamento

### 1. Inicializar Sessão (`upload_phase=start`)
Obtenha um `video_id` e uma `upload_url`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/video_ads" \
  -F "upload_phase=start" \
  -F "access_token=<ACCESS_TOKEN>"
```

### 2. Carregar o Vídeo
Envie o arquivo binário para a `upload_url` recebida.

**Arquivo Local:**
```bash
curl -X POST "https://rupload.facebook.com/video-ads-upload/v24.0/<VIDEO_ID>" \
  -H "Authorization: OAuth <ACCESS_TOKEN>" \
  -H "offset: 0" \
  -H "file_size: <TOTAL_BYTES>" \
  --data-binary "@/path/to/file.mp4"
```

**URL Hospedada (CDN):**
```bash
curl -X POST "https://rupload.facebook.com/video-ads-upload/v24.0/<VIDEO_ID>" \
  -H "Authorization: OAuth <ACCESS_TOKEN>" \
  -H "file_url: https://cdn.example.com/video.mp4"
```

### 3. Verificar Status (Opcional)
Verifique se o processamento terminou.

```bash
curl -X GET "https://graph.facebook.com/v24.0/<VIDEO_ID>?fields=status" \
  -H "Authorization: OAuth <ACCESS_TOKEN>"
```

### 4. Finalizar e Publicar (`upload_phase=finish`)
Confirme o carregamento para disponibilizar o vídeo na conta de anúncios.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/video_ads" \
  -F "upload_phase=finish" \
  -F "video_id=<VIDEO_ID>" \
  -F "access_token=<ACCESS_TOKEN>"
```
