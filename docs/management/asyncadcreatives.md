# Ad Account Asyncadcreatives

## Leitura

Async ad creative jobs from this Ad Account.

## Exemplo
```http
/* make the API call */
FB.api(
    "/{ad-account-id}/asyncadcreatives",
    function (response) {
      if (response && !response.error) {
        /* handle the result */
      }
    }
);
```

## Parâmetros
| Parâmetro | Descrição |
|---|---|
| **is_completed** | `boolean` – If true, we only return completed ad request sets. |

## Campos
A leitura desta borda retornará um resultado formatado em JSON:
```json
{
    "data": [],
    "paging": {}
}
```

- **data** – Uma lista de nós `AdAsyncRequestSet`.
- **paging** – Para saber mais detalhes sobre paginação, consulte o Guia da Graph API.

## Error Codes
| Erro | Descrição |
|---|---|
| 80004 | There have been too many calls to this ad-account. Wait a bit and try again. |

## Criando
You can make a POST request to `asyncadcreatives` edge from the following paths:
```
/act_{ad_account_id}/asyncadcreatives
```
When posting to this edge, no Graph object will be created.

### Parâmetros
| Parâmetro | Descrição |
|---|---|
| **creative_spec** | `AdCreative` – Specs for ad creative |
| **name** | `UTF-8 encoded string` – Name of async job |
| **notification_mode** | `enum{OFF, ON_COMPLETE}` – Specify 0 for no notifications and 1 for notification on completion. |
| **notification_uri** | `URL` – If notifications are enabled, specify the URL to send them. |

### Return Type
This endpoint supports read-after-write and will read the node represented by `id` in the return type.
```json
{
  "id": "numeric string"
}
```

## Error Codes (Creation)
| Erro | Descrição |
|---|---|
| 100 | Invalid parameter |

## Atualizando
Não é possível executar esta operação neste ponto de extremidade.

## Excluindo
Não é possível executar esta operação neste ponto de extremidade.
