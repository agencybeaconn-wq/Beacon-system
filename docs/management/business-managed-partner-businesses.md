# Negócios Parceiros Gerenciados pelo Negócio (Business Managed Partner Businesses)

Permite que um negócio agregador crie e gerencie negócios parceiros (*managed partner businesses*).

## Criação
**Endpoint:** `POST /{business_id}/managed_partner_businesses`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do negócio parceiro. | **Sim** |
| `catalog_id` | numeric string | ID do catálogo. | **Sim** |
| `seller_external_website_url` | URI | URL do site externo do vendedor. | **Sim** |
| `seller_targeting_countries` | array<string> | Países de segmentação do vendedor. | **Sim** |
| `vertical` | enum | Vertical do negócio (ex: `ECOMMERCE`, `RETAIL`). | **Sim** |
| `ad_account_currency` | string | Moeda da conta de anúncios. | Não |
| `child_business_external_id` | string | ID externo do negócio filho. | Não |
| `credit_limit` | int64 | Limite de crédito. | Não |
| `line_of_credit_id` | numeric string | ID da linha de crédito. | Não |
| `no_ad_account` | boolean | Se verdadeiro, não cria conta de anúncios. | Não |
| `page_name` | string | Nome da página. | Não |
| `page_profile_image_url` | URI | URL da imagem de perfil da página. | Não |
| `partner_facebook_page_url` | string | URL da página do Facebook do parceiro. | Não |
| `partner_registration_countries` | array<string> | Países de registro do parceiro. | Não |
| `sales_rep_email` | string | Email do representante de vendas. | Não |
| `skip_partner_page_creation` | boolean | Pular criação da página do parceiro. | Não |
| `survey_business_type` | enum | Tipo de negócio pesquisado. | Não |
| `survey_num_assets` | int64 | Número de ativos pesquisados. | Não |
| `survey_num_people` | int64 | Número de pessoas pesquisadas. | Não |
| `timezone_id` | enum | ID do fuso horário. | Não |

### Retorno
Este endpoint suporta *read-after-write* e retornará o objeto criado.
```json
{
    "id": "123456789",
    "name": "Nome do Negócio Parceiro"
}
```

## Exclusão (Dissociar)
**Endpoint:** `DELETE /{business_id}/managed_partner_businesses`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `child_business_external_id` | string | Identificador atribuído ao parceiro gerenciado pelo negócio agregador. |
| `child_business_id` | numeric string | O ID do negócio parceiro gerenciado. |

### Retorno
```json
{
    "success": true,
    "id": "123456789"
}
```

## Operações Não Suportadas
*   **Leitura:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **1800001** | O ID do fornecedor já está em uso. |
| **1800002** | O nome do negócio não atende aos requisitos do Facebook. |
| **1800007** | Não foi possível encontrar o negócio parceiro gerenciado. |
| **1800102** | Você não tem acesso ao ID do catálogo inserido. |
