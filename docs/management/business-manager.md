# Gerenciador de Negócios (Business Manager)

Representa um negócio no Facebook. Permite gerenciar contas de anúncios, páginas, aplicativos e permissões de usuários e parceiros.

## Leitura
Recupera informações sobre um Business Manager específico.

**Endpoint:** `GET /{business_id}`

### Campos Principais
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | string | ID do Business Manager. |
| `name` | string | Nome do negócio. |
| `primary_page` | Page | Página principal do negócio. |
| `created_by` | User | Usuário que criou o negócio. |
| `vertical` | string | Indústria vertical do negócio. |
| `verification_status` | enum | Status de verificação (ex: `verified`, `not_verified`). |
| `two_factor_type` | enum | Tipo de autenticação de dois fatores exigida (`none`, `admin_required`, `all_required`). |
| `link` | string | Link para a página de perfil do negócio. |
| `payment_account_id` | string | ID da conta de pagamento. |

### Bordas (Relacionamentos)
O objeto Business possui diversas bordas para acessar ativos conectados:
*   `ad_accounts`, `client_ad_accounts`, `owned_ad_accounts`
*   `pages`, `client_pages`, `owned_pages`
*   `pixels`, `client_pixels`, `owned_pixels`
*   `instagram_accounts`, `owned_instagram_accounts`
*   `agencies`, `clients`
*   `business_users`, `system_users`
*   `product_catalogs`
*   `apps`

## Criação
A criação de Business Managers via API é restrita e geralmente requer permissões especiais (`BUSINESS_MANAGEMENT`) ou é feita através de fluxos específicos de parceiros.

**Endpoint:** `POST /{user_id}/businesses`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do negócio. | **Sim** |
| `vertical` | enum | Indústria vertical. | **Sim** |
| `primary_page` | string | ID da página principal. | **Sim** |
| `timezone_id` | int | ID do fuso horário. | **Sim** |
| `survey_business_type` | enum | Tipo de negócio (AGENCY, ADVERTISER, etc). | Não |

## Atualização
Atualiza detalhes do Business Manager.

**Endpoint:** `POST /{business_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `name` | string | Novo nome. |
| `primary_page` | string | Nova página principal. |
| `two_factor_type` | enum | Configuração de 2FA. |

## Gerenciamento de Ativos (Associação/Dissociação)

### Adicionar Agência a um Pixel
**Endpoint:** `POST /{ads_pixel_id}/agencies`
*   `business`: ID da agência.
*   `permitted_tasks`: Lista de permissões (`ANALYZE`, `ADVERTISE`, `UPLOAD`, `EDIT`).

### Remover (Dissociar) Ativos
Geralmente feito via método `DELETE` na borda correspondente.

*   **Remover Agência:** `DELETE /{business_id}/agencies`
*   **Remover Cliente:** `DELETE /{business_id}/clients`
*   **Remover Página:** `DELETE /{business_id}/pages`
*   **Remover Conta de Anúncios:** `DELETE /{business_id}/ad_accounts`
*   **Remover Usuário:** `DELETE /{user_id}/businesses`

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **3918** | Página já pertence a outro Business Manager. |
| **3947** | Nome duplicado (já existe um BM com esse nome que você gerencia). |
| **415** | Autenticação de dois fatores necessária. |
