# Anúncios de Lead

Anúncios de lead permitem que clientes em potencial se cadastrem para receber ofertas, fornecendo informações de contato de forma rápida e confidencial.

## Pré-requisitos
- **Página do Facebook:** Todos os leads pertencem à Página.
- **App do Facebook:** Para integração via API.
- **Permissões:** `leads_retrieval`, `pages_manage_ads`.
- **Token de Acesso:** Recomendado usar Token de Acesso à Página.

## Fluxo de Criação
1. **Criar Formulário:** Crie um formulário de lead no Gerenciador de Anúncios ou via API.
2. **Criar Anúncio:** Associe o ID do formulário ao anúncio.

## Integração e Recuperação de Leads

### 1. Webhooks (Tempo Real)
Configure Webhooks para receber notificações instantâneas quando um novo lead for gerado.
- **Vantagem:** Integração em tempo real com CRM.
- **Funcionamento:** O Facebook envia uma notificação para o seu endpoint, e você usa a API para buscar os detalhes do lead.

### 2. Leitura em Massa (Graph API)
Faça chamadas periódicas para buscar novos leads.
- **Uso:** Para atualizações menos frequentes (ex: algumas vezes ao dia).

### 3. API de Conversões (CAPI)
Envie dados de volta para a Meta (CRM -> Meta) para otimizar a qualidade dos leads e o desempenho dos anúncios.

## Limitações
- Apps em modo de desenvolvimento não recuperam leads reais (apenas de usuários com função no app).
