# Termos de Serviço para Públicos Personalizados (ToS)

Para usar Públicos Personalizados (especialmente os baseados em arquivos de clientes), a empresa e o usuário devem aceitar os Termos de Serviço (ToS).

## Requisitos de Aceite
1.  **Usuário Real:** Um usuário humano deve aceitar os termos.
2.  **Usuário do Sistema:** Não pode aceitar ToS diretamente. Um usuário real da empresa deve aceitar em nome da empresa para que os usuários do sistema possam operar.
3.  **Bloqueio de API:** A API retornará erros ao tentar criar/editar públicos se os ToS não forem aceitos.

## Cenários de Aceite
O aceite é vinculado à **Empresa** (Business Manager), mas realizado através de uma **Conta de Anúncios**.

| Status da Conta | Quem Aceita? | Resultado |
| :--- | :--- | :--- |
| Pertence à Empresa A | Usuário na Conta A | Aceita para Empresa A |
| Pertence à Empresa A, mas atua "Em nome de" Empresa B | Usuário na Conta A | Aceita para Empresa B |
| Pertence à Empresa A, compartilhada com Empresa B | Usuário na Conta A | Aceita para Empresa A |

## Link para Aceite Manual
O usuário pode aceitar os termos acessando:
`https://business.facebook.com/ads/manage/customaudiences/tos/?act=<AD_ACCOUNT_ID>`

## Verificação via API

### Verificar se a Empresa Aceitou
```bash
GET /act_<AD_ACCOUNT_ID>?fields=tos_accepted
```
**Resposta:**
```json
{
  "tos_accepted": {
    "custom_audience_tos": 1 // 1 = Aceito
  }
}
```

### Verificar se o Usuário Atual Aceitou
```bash
GET /act_<AD_ACCOUNT_ID>?fields=user_tos_accepted
```
**Resposta:**
```json
{
  "user_tos_accepted": {
    "custom_audience_tos": 1
  }
}
```

## Tipos de Público que Exigem ToS
*   `CUSTOM` (Arquivo de cliente)
*   `CUSTOM` (Baseado em valor - `is_value_based: 1`)
*   `MEASUREMENT`
