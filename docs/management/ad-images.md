# Imagens de Anúncios (Ad Images)

Gerencia as imagens usadas nos criativos de anúncios. As imagens são carregadas independentemente e referenciadas por um `hash` durante a criação do anúncio.

## Visão Geral
*   **Formatos Suportados:** BMP, JPEG, GIF, PNG, TIFF.
*   **Uso:** O `hash` retornado no upload é usado no campo `image_hash` do objeto `AdCreative`.
*   **Armazenamento:** As imagens são armazenadas na biblioteca da conta de anúncios.

## Leitura
Recupera todas as imagens disponíveis na conta de anúncios ou detalhes de imagens específicas.

**Endpoint:** `GET /act_{ad_account_id}/adimages`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `hashes` | list<string> | Lista de hashes para filtrar imagens específicas. |

### Campos Retornados
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | string | ID da imagem. |
| `hash` | string | Hash único da imagem (usado em criativos). |
| `url` | string | URL temporária da imagem. |
| `url_128` | string | URL da imagem redimensionada (128x128). |
| `width` | int | Largura da imagem. |
| `height` | int | Altura da imagem. |
| `name` | string | Nome do arquivo. |
| `status` | enum | `ACTIVE`, `INTERNAL`, `DELETED`. |
| `creatives` | list<id> | IDs de criativos que usam esta imagem. |

## Criação (Upload)
Carrega uma imagem (arquivo único ou zip) para a conta de anúncios.

**Endpoint:** `POST /act_{ad_account_id}/adimages`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `bytes` | string | Conteúdo da imagem em Base64. | Sim (ou arquivo) |
| `filename` | file | Arquivo de imagem enviado via multipart/form-data. | Sim (ou bytes) |

### Exemplo (cURL)
```bash
curl \
  -F 'bytes=<BASE64_STRING>' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adimages
```

## Cópia de Imagens
Copia uma imagem de uma conta para outra.

**Endpoint:** `POST /act_{destination_account_id}/adimages`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `copy_from` | JSON | Objeto com `source_account_id` e `hash`. | Sim |

### Exemplo
```json
{
  "source_account_id": "<SOURCE_ID>",
  "hash": "02bee5277ec507b6fd0f9b9ff2f22d9c"
}
```

## Exclusão
Remove uma imagem da conta de anúncios. **Nota:** Só é possível excluir imagens que não estão sendo usadas em nenhum criativo ativo.

**Endpoint:** `DELETE /act_{ad_account_id}/adimages`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `hash` | string | Hash da imagem a ser excluída. | **Sim** |

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva. |
| **613** | Limite de taxa excedido. |
| **80004** | Muitas chamadas para esta conta. |
