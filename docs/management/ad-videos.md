# Vídeos de Anúncio (Ad Videos)

Gerenciamento de vídeos (`AdVideo`) na biblioteca da conta de anúncios.

## Leitura
Recupera uma lista de vídeos associados à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/advideos`

### Parâmetros de Filtro
*   `max_aspect_ratio` / `min_aspect_ratio`: Filtrar por proporção de aspecto.
*   `maxheight` / `minheight`: Filtrar por altura.
*   `maxwidth` / `minwidth`: Filtrar por largura.
*   `maxlength` / `minlength`: Filtrar por duração.
*   `title`: Filtrar por nome do vídeo.

### Resposta
Retorna uma lista de nós `Video`.
```json
{
    "data": [],
    "paging": {},
    "summary": { "total_count": 120 }
}
```

## Criação (Upload)
Envia um vídeo para a biblioteca da conta de anúncios. Suporta upload direto e em partes (chunked upload).

**Endpoint:** `POST /act_{ad_account_id}/advideos`

### Parâmetros Principais
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `source` | file | O arquivo de vídeo (form data). |
| `title` | string | Título do vídeo. |
| `description` | string | Descrição do vídeo. |
| `file_url` | string | URL para download do vídeo (alternativa ao upload direto). |
| `source_instagram_media_id` | string | ID de mídia do Instagram para importar. |

### Upload em Partes (Chunked Upload)
Para arquivos grandes, use o parâmetro `upload_phase`:
1.  `start`: Inicia a sessão de upload. Retorna `upload_session_id`.
2.  `transfer`: Envia partes do arquivo (`video_file_chunk`) com `start_offset` e `upload_session_id`.
3.  `finish`: Finaliza o upload.

### Retorno
```json
{
  "id": "123456789",
  "success": true
}
```

## Exclusão
Remove um vídeo da conta de anúncios.

**Endpoint:** `DELETE /act_{ad_account_id}/advideos`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `video_id` | string | ID do vídeo na biblioteca da conta. | Sim |

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **352** | Formato de vídeo não suportado. |
| **382** | Arquivo de vídeo muito pequeno. |
| **6000/6001** | Problema genérico no upload. Tente novamente. |
| **613** | Limite de taxa excedido. |
