# Negócios Próprios do Negócio (Business Owned Businesses)

Gerencia os negócios clientes (child businesses) que pertencem a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/owned_businesses`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `child_business_external_id` | string | ID definido na criação pelo chamador do app de terceiros. Usado para busca. |
| `client_user_id` | UID | Usuário do sistema ou usuário que foi usado para criar o negócio filho. |

### Campos Retornados
A resposta contém uma lista de nós `Business`.
Campos adicionais:
*   `relationship`: Relacionamento do agregador de negócios.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação
Para criar outros Gerenciadores de Negócios, seu negócio precisa obter `BUSINESS_MANAGEMENT` durante o processo de análise do aplicativo.

**Endpoint:** `POST /{business_id}/owned_businesses`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome da entidade para exibição. Deve corresponder ao nome público. | **Sim** |
| `page_permitted_tasks` | array<enum> | Tarefas permitidas na página. Ex: `MANAGE`, `ADVERTISE`. | **Sim** |
| `shared_page_id` | numeric string | ID da página compartilhada. | **Sim** |
| `child_business_external_id` | string | ID externo para identificar o negócio filho. | Não |
| `timezone_id` | enum | ID do fuso horário. | Não |

### Retorno
Este endpoint suporta *read-after-write*.
```json
{
    "id": "123456789",
    "name": "Nome do Negócio"
}
```

## Exclusão (Dissociar)
Para excluir um Gerenciador de Negócios filho que possui uma linha de crédito, certifique-se de que todas as contas de anúncios nele tenham sido alteradas para um método de pagamento diferente.

**Endpoint:** `DELETE /{business_id}/owned_businesses`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `client_id` | numeric string | ID do Negócio Filho que você deseja excluir. | **Sim** |

### Retorno
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Atualização:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva ou não permitida. |
| **3912** | Problema técnico, alterações não salvas. |
| **3913** | Sem permissão para criar um novo Gerenciador de Negócios. |
| **3947** | Nome do Gerenciador de Negócios já existe. |
| **3974** | Nome do Gerenciador de Negócios inválido. |
| **1690062** | O nome fornecido já está em uso. |
| **1690090** | O nome escolhido não é válido. |
| **1690111** | Conta de pagamento desativada. |
| **1690138** | Deve ser administrador da página primária para criar um negócio usando-a. |
| **1690165** | Este negócio agregador já tem um negócio cliente existente associado a este usuário. |
| **1690192** | App deve existir e ser de propriedade ou compartilhado com o negócio agregador. |
| **1690232** | Negócios não têm páginas primárias (garanta IDs únicos). |
| **1752089** | Um usuário só pode criar uma conta comercial por vez. |
| **2859040** | Tentativa de criar negócio cliente com `shared_page_id` de um negócio não permitido. |
