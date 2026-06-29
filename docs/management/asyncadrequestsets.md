# Ad Account Asyncadrequestsets

## Leitura

Async ad request sets from this Ad Account.

## Exemplo
```http
/* make the API call */
FB.api(
    "/{ad-account-id}/asyncadrequestsets",
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
| 200 | Permissions error |

## Criando
You can make a POST request to `asyncadrequestsets` edge from the following paths:
```
/act_{ad_account_id}/asyncadrequestsets
```
When posting to this edge, no Graph object will be created.

### Parâmetros
| Parâmetro | Descrição |
|---|---|
| **ad_specs** | `list<dictionary { non-empty string : <string> }>` – Specs for ads in the request set |
| **name** | `UTF-8 encoded string` – Name of the request set |
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
