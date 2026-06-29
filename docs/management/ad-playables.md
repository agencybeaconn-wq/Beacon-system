# Ativos Jogáveis (Ad Playables)

Gerenciamento de ativos jogáveis (`PlayableContent`), geralmente arquivos HTML5 usados em anúncios interativos.

## Leitura
Recupera uma lista de ativos jogáveis associados à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/adplayables`

### Resposta
Retorna uma lista de nós `PlayableContent`.
```json
{
    "data": []
}
```

## Criação
Faz o upload de um novo ativo jogável.

**Endpoint:** `POST /act_{ad_account_id}/adplayables`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do ativo jogável. | Sim |
| `source` | file | Caminho do arquivo local do ativo HTML jogável. | Sim |

### Retorno
```json
{
  "id": "123456789"
}
```

## Operações Não Suportadas
*   **Atualização:** Não é possível atualizar ativos jogáveis neste endpoint.
*   **Exclusão:** Não é possível excluir ativos jogáveis neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
