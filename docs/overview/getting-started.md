# Primeiros Passos com a API de Marketing

Para usar a API de Marketing com eficiência, é necessário configurar o ambiente e garantir acesso aos recursos.

## Requisitos

### 1. Conta de Anúncios
É necessário ter uma conta de anúncios ativa para gerenciar campanhas, configurações de cobrança e limites de gastos.

**Como localizar o número da sua conta de anúncios:**
1. Entre no Facebook e acesse o **Gerenciador de Anúncios**.
2. Clique em **Configurações da conta de anúncios** (menu no canto inferior esquerdo).
3. Na tela de Configurações, você encontrará o **número da sua conta de anúncios** (Ad Account ID).

### 2. Conta de Desenvolvedor da Meta
Você precisa se inscrever como desenvolvedor da Meta para criar aplicativos e acessar as APIs.

### 3. Criar um App
É necessário criar e configurar um app no Painel de Apps da Meta para obter as chaves de API (App ID e App Secret).

## Autorização e Autenticação

Para acessar a API de Marketing, você precisará de um **Token de Acesso** com as permissões corretas.

- **Verificação:** O processo garante que apenas usuários e apps autorizados acessem os dados.
- **Permissões:** Você deve solicitar permissões específicas (como `ads_management`, `ads_read`) durante o login ou configuração do app.
- **Tokens:** A API é usada para obter, estender (long-lived tokens) e renovar tokens de acesso.
