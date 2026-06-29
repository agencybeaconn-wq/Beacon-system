# Configurar Contas do Instagram no Gerenciador de Negócios

Guia completo para configurar contas do Instagram no Meta Business Manager para veicular anúncios.

## Etapas de Configuração

### Etapa 1: Criar Conta Comercial no Instagram
Sua empresa precisa ter uma conta comercial no Instagram. Consulte "Como configurar uma conta comercial no Instagram" na Central de Ajuda do Meta.

### Etapa 2: Reivindicar no Gerenciador de Negócios
Para associar uma conta do Instagram a uma empresa, você precisa do nome de usuário e senha da conta. Consulte "Como adicionar uma conta do Instagram ao Gerenciador de Negócios".

### Etapa 3 (Opcional): Atribuir uma Agência
Se um terceiro quiser veicular anúncios em seu nome, atribua-o como parceiro:
- No Gerenciador de Negócios, clique em **Atribuir parceiros**
- Insira a identificação empresarial da agência

### Etapa 4: Atribuir Contas de Anúncios à Conta do Instagram

> ⚠️ **IMPORTANTE**: O endpoint `InstagramUserID` está obsoleto na versão v22.0 e será descontinuado a partir de 21/04/2025. Use o endpoint `IGUserID` da plataforma do Instagram como alternativa.

**Atribuir conta de anúncios:**
```bash
curl -F "access_token=<ACCESS_TOKEN>" \
  -F "business=<BUSINESS_ID>" \
  -F "account_id=<AD_ACCOUNT_ID>" \
  "https://graph.facebook.com/<API_VERSION>/<IG_USER_ID>/authorized_adaccounts"
```

**Requisitos da conta de anúncios:**
- Pertencer à empresa OU
- Poder ser acessada pela empresa E pertencer à empresa proprietária da conta do Instagram

**Listar contas de anúncios autorizadas:**
```bash
curl -G \
  -d "access_token=<ACCESS_TOKEN>" \
  -d "business=<BUSINESS_ID>" \
  "https://graph.facebook.com/<API_VERSION>/<IG_USER_ID>/authorized_adaccounts"
```

### Etapa 5: Ver Contas Associadas

**Por Empresa (Business):**
```bash
curl -G \
  -d "access_token=<ACCESS_TOKEN>" \
  -d "fields=username,profile_pic" \
  "https://graph.facebook.com/<API_VERSION>/<BUSINESS_ID>/instagram_accounts"
```

**Por Conta de Anúncios:**
```bash
curl -G \
  -d "access_token=<ACCESS_TOKEN>" \
  -d "fields=username,profile_pic" \
  "https://graph.facebook.com/<API_VERSION>/act_<AD_ACCOUNT_ID>/instagram_accounts"
```

**Resposta:**
```json
{
  "data": [
    {
      "username": "jaspersmarket",
      "profile_pic": "https://...",
      "id": "1023317097692584"
    }
  ]
}
```

## Campos Retornados

| Campo | Descrição |
| :--- | :--- |
| `id` | Identificação da conta do Instagram. **Obrigatório para criação de anúncios** como `instagram_user_id`. |
| `username` | Nome de usuário do Instagram. |
| `profile_pic` | URL da foto do perfil. |

## Connection Objects (Importante)

> ⚠️ **ATENÇÃO**: Após criar uma conta do Instagram, você **NÃO PODE** usar Connection Objects para visualizá-la. Use os endpoints de assets da empresa em vez disso.

**Endpoints corretos para contas do Instagram:**
- `{business_id}/instagram_accounts`
- `act_{adaccount_id}/instagram_accounts`
- `{page_id}/instagram_accounts`

## Permissões

- Não é possível conceder permissões diretamente por meio de uma conta do Instagram
- Conceda permissões para a Página ou empresa conectada à conta do Instagram
- Qualquer usuário com permissão de veiculação em uma conta de anúncios vinculada pode veicular anúncios para a conta do Instagram associada
