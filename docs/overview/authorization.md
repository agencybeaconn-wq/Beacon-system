# Autorização e Permissões da API de Marketing

O processo de autorização verifica os usuários e apps que terão acesso à API de Marketing e concede permissões a eles.

## Funções do App
No painel do app, é possível definir funções como Administrador, Desenvolvedor, Testador. Dependendo do caso de uso, pode ser necessário enviar o app para análise (App Review).

## Níveis de Acesso e Recursos

Os apps de empresa possuem dois níveis de acesso principais para permissões e recursos: **Acesso Padrão** e **Acesso Avançado**.

### Mapeamento de Acesso

| Acesso à API de Marketing | Acesso Padrão ao Gerenciamento de Anúncios | Ação |
| :--- | :--- | :--- |
| **Acesso ao desenvolvimento** | Acesso padrão | Por padrão |
| **Acesso padrão** | Acesso avançado | Solicitar no Painel de Apps |

## Permissões e Recursos

### Permissões Principais
- **ads_read**: Ler dados de anúncios.
- **ads_management**: Criar, editar e gerenciar anúncios.

### Recursos
- **Acesso Padrão ao Gerenciamento de Anúncios**: Recurso comum para quem gerencia anúncios.

### Comparação de Níveis de Acesso

| Recurso | Acesso Padrão | Acesso Avançado |
| :--- | :--- | :--- |
| **Limites de contas** | Ilimitado (para Admins/Devs do app) | Ilimitado (com permissões `ads_read`/`ads_management`) |
| **Limites de volume** | Extremamente limitados (Desenvolvimento) | Ligeiramente limitados (Produção) |
| **Gerenciador de Negócios** | Acesso limitado | Acesso total às APIs |
| **Usuário do sistema** | 1 usuário + 1 admin | 10 usuários + 1 admin |
| **Criação da Página** | Não | Não |

## Como Obter Acesso Avançado

Para obter o acesso avançado, seu app precisa:
1. Ter feito ao menos **1.500 chamadas** da API de Marketing com sucesso nos últimos 15 dias.
2. Ter uma **taxa de erro menor do que 15%** nos últimos 15 dias.

### Solicitação de Permissões (OAuth)
Se estiver gerenciando anúncios de terceiros, use o parâmetro `scope`:

```
https://www.facebook.com/v24.0/dialog/oauth?client_id=<YOUR_APP_ID>&redirect_uri=<YOUR_URL>&scope=ads_management
```

## Exemplos de Caso de Uso

| Caso de uso | O que solicitar |
| :--- | :--- |
| Ler e gerenciar anúncios (próprios ou concedidos) | Permissão: `ads_management`<br>Recurso: Acesso Padrão ao Gerenciamento de Anúncios |
| Ler relatórios de anúncios | Permissão: `ads_read`<br>Recurso: Acesso Padrão ao Gerenciamento de Anúncios |
| Relatórios de uns clientes + Gerenciamento de outros | Permissões: `ads_management` e `ads_read`<br>Recurso: Acesso Padrão ao Gerenciamento de Anúncios |

## Verificação da Empresa
Necessária para apps que acessam dados sensíveis. Confirma a identidade da entidade corporativa.
