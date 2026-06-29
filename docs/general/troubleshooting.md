# Solução de Problemas (Troubleshooting)

Guia para identificar e resolver problemas comuns ao trabalhar com a API de Marketing da Meta.

## Erros Comuns

### 1. Erros de Autorização
*   **Causa:** Tokens expirados, inválidos ou sem permissões (escopos) necessários.
*   **Solução:** Implemente um fluxo de atualização de tokens e verifique os escopos solicitados no login.

### 2. Parâmetros Inválidos
*   **Causa:** Dados de entrada incorretos, mal formatados ou ausentes.
*   **Solução:** Valide todos os dados antes de enviar a requisição. Use bibliotecas de validação de esquema.

### 3. Recurso Não Encontrado
*   **Causa:** ID incorreto ou objeto excluído.
*   **Solução:** Verifique a existência do objeto antes de tentar operações de atualização ou leitura.

## Limitação de Volume (Rate Limiting)
A API impõe limites para garantir estabilidade.

### Estratégias de Mitigação
1.  **Recuo Exponencial (Exponential Backoff):** Se receber um erro de limite, aguarde um tempo progressivamente maior antes de tentar novamente.
2.  **Filas de Requisições:** Implemente um sistema de filas para controlar o ritmo de chamadas, garantindo que não excedam os limites permitidos.

## Otimização e Manutenção

### Estratégias de Cache
Armazene dados acessados frequentemente (ex: insights de público, métricas estáticas) para reduzir chamadas à API e melhorar a performance do app.

### Controle de Versão
*   Acompanhe o [Changelog](https://developers.facebook.com/docs/graph-api/changelog) da API.
*   Especifique a versão da API em todas as chamadas (ex: `v24.0`).
*   Encapsule chamadas de API em funções modulares para facilitar atualizações de versão.

### Logging e Monitoramento
Implemente logs detalhados de erros e respostas da API para identificar padrões de falha e agir proativamente.
