# Controles da Conta de Anúncios (Account Controls)

Gerenciamento de restrições de negócios (`AdAccountBusinessConstraints`) associadas a uma conta de anúncios, como controles de público e exclusões de posicionamento.

## Leitura
Obtenha os campos padrão do nó `AdAccountBusinessConstraints`.

```javascript
FB.api(
  "/{ad-account-id}/account_controls",
  function (response) {
    // handle response
  }
);
```

## Criação
Para definir controles, faça uma requisição POST para a borda `account_controls`.

**Endpoint:** `POST /act_{ad_account_id}/account_controls`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `audience_controls` | JSON/Array | Controles de público (obrigatório). |
| `placement_controls` | JSON/Array | Controles de posicionamento, especificamente exclusões. |

### Exclusão de Posicionamentos (`placement_controls`)
Use o campo `placement_exclusions` dentro de `placement_controls` para excluir posicionamentos específicos.

**Formato:** `publisher_platform` + `_` + `position`

**Valores Permitidos para Exclusão:**
*   `audience_network_classic`: Posições nativas, banner e intersticial da Audience Network.
*   `audience_network_rewarded_video`: Vídeos premiados da Audience Network.
*   `audience_network_instream_video`: Vídeos in-stream da Audience Network.
*   `facebook_marketplace`: Seção Marketplace no Facebook.
*   `facebook_rhc`: Coluna da direita no Facebook.

**Exemplo de Payload:**
```json
{
  "placement_controls": {
    "placement_exclusions": ["audience_network_rewarded_video"]
  }
}
```

## Atualização e Exclusão
*   **Atualização:** Não suportada neste endpoint.
*   **Exclusão:** Não suportada neste endpoint.

## Códigos de Erro
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **2641** | O anúncio inclui ou exclui localizações atualmente restritas. |
