# Cortes de Imagem (Image Crops)

O Facebook permite especificar taxas de proporção para imagens em diferentes posicionamentos de anúncio. Se as proporções não forem fornecidas, o Facebook utilizará seus próprios padrões de corte para exibição.

## Como Funciona

Você deve fornecer um valor como coordenadas `(x, y)` para os cantos **superior esquerdo** e **inferior direito** do retângulo de corte.
*   A chave de corte (`crop key`) descreve uma taxa de proporção (ex: `"100x100"`).
*   A taxa de proporção da caixa especificada pela largura e altura deve ser o mais próximo possível da proporção na chave de corte.
*   A origem da imagem `(0, 0)` fica no canto **superior esquerdo**.
*   O ponto `(width - 1, height - 1)` fica no canto **inferior direito**.

### Exemplo de Uso

1.  **Carregar a imagem:**
    ```bash
    curl \
    -F 'filename=@<IMAGE_PATH>' \
    -F 'access_token=<ACCESS_TOKEN>' \
    https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adimages
    ```

2.  **Criar o anúncio com o corte:**
    Referencie o hash da imagem retornado e especifique o corte no campo `image_crops` dentro de `object_story_spec`.

    ```bash
    curl -X POST \
    -F 'name="Image crop creative"' \
    -F 'object_story_spec={
        "page_id": "<PAGE_ID>",
        "link_data": {
            "image_crops": {
                "100x100": [[0,0],[100,100]]
            },
            "image_hash": "<IMAGE_HASH>",
            "link": "<URL>",
            "message": "<AD_MESSAGE>"
        }
    }' \
    -F 'access_token=<ACCESS_TOKEN>' \
    https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
    ```

### Estrutura do `image_crops`
Os cortes contêm pares de chave-valor:
*   **Chave:** Uma `crop key` que representa a proporção (ex: `"100x100"`).
*   **Valor:** As dimensões em pixels do corte, definidas por dois pontos `[[x1, y1], [x2, y2]]`.

Exemplo:
```json
{
    "100x100": [ [330, 67], [1080, 817] ]
}
```

## Especificações
*   Quando usado, esse recurso deve ser aplicado a **todos os posicionamentos** onde um anúncio pode aparecer.
    *   *Exemplo:* Se fornecer proporção para a coluna da direita e quiser usar o mesmo anúncio no Feed de Notícias, é necessário informar o corte para o feed também.

## Limitações
*   Funciona apenas para criativos de anúncio com `image_file` ou `image_hash`.
*   **Page posts** não são compatíveis.
*   **Facebook Stories** não são compatíveis com cortes de imagem.
*   **Restrições de Valores:**
    *   Os pontos `(x, y)` devem estar **dentro** da imagem. Retângulos que se estendem além dos limites são inválidos.
    *   O retângulo deve manter a mesma proporção especificada pela chave de corte.
    *   As coordenadas não podem conter valores negativos.
