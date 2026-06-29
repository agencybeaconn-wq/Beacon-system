# Leitura de Comentários de Anúncios

Guia para entender como buscar e gerenciar comentários em posts de anúncios via API do Meta.

## ⚠️ Requisitos Importantes

Para ler comentários de posts de anúncios, você precisa de:

1. **Page Access Token** (não apenas User Access Token)
2. **Permissão `pages_read_engagement`** aprovada no App Review
3. **Acesso de Admin à Página** que publicou o anúncio
4. **Página padrão configurada** no `account_settings`

## Conceitos Importantes

### IDs Relevantes

| ID | Descrição | Exemplo |
|---|---|---|
| `effective_object_story_id` | ID do post usado no anúncio (formato: `PAGE_ID_POST_ID`) | `611928968680087_122167498286913266` |
| `effective_instagram_media_id` | ID do post no Instagram (para anúncios no IG) | `17895695668004550` |
| `ad_creative_id` | ID do criativo do anúncio | `120200...` |

### Tipos de Tokens

| Token | Uso | Como Obter |
|---|---|---|
| **User Access Token** | Gerenciar anúncios e contas | OAuth flow |
| **Page Access Token** | Ler/gerenciar comentários da página | Via `/me/accounts` |

> [!IMPORTANT]
> Para ler comentários de posts de anúncios, você **PRECISA** de um **Page Access Token**, não apenas do User Access Token.

## Permissões Disponíveis vs Necessárias

### Permissões Atuais (sem App Review adicional)

```
ads_management
ads_read
business_management
pages_read_engagement    ← Usada para ler comentários
pages_show_list
catalog_management
instagram_basic
```

### Permissões que Requerem App Review

| Permissão | Uso | Status |
|---|---|---|
| `pages_read_user_content` | Ler conteúdo de usuários em páginas | **Requer App Review** |
| `pages_manage_engagement` | Criar/editar/excluir comentários | **Requer App Review** |

> [!CAUTION]
> Se você tentar adicionar `pages_read_user_content` ao OAuth sem ter passado pelo App Review, o Meta retornará erro "Invalid Scopes" e o login falhará.

## Fluxo de Obtenção do Page Access Token

### 1. Obter páginas gerenciadas pelo usuário

```bash
curl -G \
  -d "fields=id,name,access_token" \
  -d "access_token=<USER_ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/me/accounts"
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "611928968680087",
      "name": "Minha Página",
      "access_token": "EAA...PAGE_TOKEN..."
    }
  ]
}
```

### 2. Usar o Page Access Token para ler comentários

```bash
curl -G \
  -d "fields=id,message,from,created_time,like_count,comment_count,is_hidden" \
  -d "access_token=<PAGE_ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<EFFECTIVE_OBJECT_STORY_ID>/comments"
```

## Lógica Implementada (scan-ad-comments)

### Passo a Passo

1. **Buscar anúncios ativos** com User Access Token
2. **Extrair `effective_object_story_id`** de cada anúncio
3. **Obter Page Access Token** via `/me/accounts` usando o patriarch token
4. **Ler comentários** de cada post usando o Page Access Token
5. **Filtrar** comentários não respondidos pela página

### Fallback

Se não conseguir obter o Page Access Token, o sistema tenta usar o patriarch token (User Token), mas isso geralmente falha com erro de permissão.

## Troubleshooting

### Erro: `(#10) This endpoint requires the 'pages_read_engagement' permission`

**Causas mais comuns:**

1. **Page Access Token não foi obtido** - O sistema está usando User Token em vez de Page Token
2. **Usuário não é admin da página** - O token só retorna páginas onde o usuário é admin
3. **Página padrão não configurada** - `default_page_id` está null no `account_settings`
4. **A página usada no anúncio é diferente** da página configurada

**Verificações:**

#### 1. Verificar `default_page_id` configurado
```sql
SELECT default_page_id FROM account_settings WHERE ad_account_id = 'act_XXX';
```

Se for `null`, configure a página padrão nas configurações da conta.

#### 2. Verificar se a página está na lista de páginas gerenciadas

Teste manualmente:
```bash
curl -G \
  -d "fields=id,name" \
  -d "access_token=<USER_TOKEN>" \
  "https://graph.facebook.com/v24.0/me/accounts"
```

A página do `default_page_id` deve aparecer nessa lista.

#### 3. Verificar logs da função `scan-ad-comments`

Procure por estas mensagens nos logs:

| Log | Significado |
|---|---|
| `📄 Default Page ID: not set` | Página não configurada |
| `⚠️ Page XXX NOT found in managed pages!` | Usuário não é admin da página |
| `🔑 SUCCESS! Found Page Access Token` | ✅ Token obtido com sucesso |
| `🔐 PERMISSION ERROR detected` | Erro de permissão - verificar token |

### Erro: "Invalid Scopes: pages_read_user_content"

O app tentou solicitar uma permissão que **requer App Review**.

**Solução:** NÃO adicione `pages_read_user_content` ao OAuth sem passar pelo App Review primeiro.

### Nenhum comentário encontrado, mas ads têm comentários

Pode ser que o Page Access Token não está sendo obtido para a página correta.

**Verificar:**
1. O `default_page_id` está configurado?
2. A página configurada é a mesma que publica os anúncios?
3. O usuário tem acesso admin à página?

## Logs de Diagnóstico

A função `scan-ad-comments` produz logs detalhados:

```
💬 [scan-ad-comments] Scanning ADS for UNANSWERED comments: act_123456789
🔑 [scan-ad-comments] Token retrieved from ad_accounts. Length: 250
🔐 [scan-ad-comments] Patriarch token decrypted. Length: 280
📄 [scan-ad-comments] Default Page ID: 611928968680087
📄 [scan-ad-comments] Found 2 managed pages: Página 1 (111...), Página 2 (222...)
🔑 [scan-ad-comments] SUCCESS! Found Page Access Token for "Página 1". Length: 285
📋 [scan-ad-comments] Found 5 active ads.
📊 [scan-ad-comments] Found 12 unanswered comments out of 45 total.
```

## Solução de Longo Prazo: App Review

Para ter acesso completo a comentários, você pode submeter o app para App Review solicitando:

1. **`pages_read_user_content`** - Para ler conteúdo de usuários (comentários)
2. **`pages_manage_engagement`** - Para responder/moderar comentários

### Como submeter para App Review

1. Acesse [Meta for Developers](https://developers.facebook.com/apps/)
2. Vá em **App Review** > **Permissions and Features**
3. Solicite as permissões desejadas
4. Grave um screencast mostrando o caso de uso
5. Aguarde aprovação (pode levar algumas semanas)

## Referências

- [Documentação Oficial: Pages API](https://developers.facebook.com/docs/pages-api)
- [Permissões: pages_read_engagement](https://developers.facebook.com/docs/permissions/reference/pages_read_engagement)
- [Permissões: pages_read_user_content](https://developers.facebook.com/docs/permissions/reference/pages_read_user_content)
- [App Review](https://developers.facebook.com/docs/app-review)
