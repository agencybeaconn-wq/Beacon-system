# Códigos de Erro da API de Marketing

Referência completa dos códigos de erro retornados pela API, suas causas e subcódigos.

> [!IMPORTANT]
> O gerenciamento de erros deve ser feito **somente** pelos códigos de erro (`code` e `error_subcode`). A mensagem de texto (`message`) pode mudar sem aviso prévio.

## Estrutura do Erro
```json
{
  "error": {
    "message": "Message describing the error",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463,
    "error_user_title": "A title",
    "error_user_msg": "A message to display to the user",
    "fbtrace_id": "Ej..."
  }
}
```

## Tabela de Erros Comuns

| Código | Subcódigo | Descrição | Ação Recomendada |
| :--- | :--- | :--- | :--- |
| **1** | - | Erro desconhecido. | Tente novamente. Se persistir, contate o suporte. |
| **1** | 99 | Erro desconhecido (nível incorreto). | Verifique se você está usando `campaign` em vez de `adset` no parâmetro `level` se aplicável. |
| **4** | - | Limite de requisições da aplicação atingido. | Aguarde e reduza a frequência de chamadas. |
| **17** | - | Limite de requisições do usuário atingido. | Aguarde e reduza a frequência de chamadas. |
| **100** | - | Parâmetro inválido. | Verifique a sintaxe e os valores enviados. |
| **100** | 33 | Post request não suportado (permissão). | Adicione o usuário do sistema como Admin na conta de anúncios. |
| **100** | 1487694 | Categoria de direcionamento inválida. | A categoria (ex: comportamento) foi depreciada. Remova-a. |
| **100** | 1752129 | Combinação de tarefas inválida. | Verifique as permissões e funções atribuídas ao usuário. |
| **102** | - | Sessão inválida. | O token de acesso expirou ou é inválido. Gere um novo. |
| **190** | - | Token de acesso inválido. | O token de acesso expirou ou foi revogado. Faça login novamente. |
| **200** | 1870034 | Termos de Públicos não aceitos. | Aceite os termos de Públicos Personalizados no Gerenciador de Negócios. |
| **2607** | - | Moeda inválida. | A moeda especificada não é suportada para anúncios. |
| **2654** | 1713092 | Sem permissão de escrita. | O desenvolvedor não tem permissão para criar públicos nesta conta. |
| **1487901** | - | Orçamento muito baixo. | Aumente o orçamento diário ou vitalício. |
| **1815199** | - | Sem acesso ao Instagram. | Verifique a conexão entre a Página e a conta do Instagram. |
| **1885272** | - | Orçamento muito baixo. | Aumente o orçamento. |
| **2446867** | - | Limite de campanhas Advantage+ atingido. | Use campanhas manuais ou exclua campanhas existentes. |

## Diagnóstico de Campos (`blame_field_specs`)
Quando ocorre um erro de validação, a API pode retornar `blame_field_specs` dentro de `error_data`. Isso indica exatamente qual campo causou o erro.

**Exemplo de Resposta:**
```json
{
  "error": {
    "code": 1487901,
    "message": "The budget for your Ad-Set is too low...",
    "error_data": {
      "blame_field_specs": [
        ["daily_budget"]
      ]
    }
  }
}
```
Neste exemplo, o erro está no campo `daily_budget`. Use essa informação para destacar o campo problemático na UI do seu aplicativo.
