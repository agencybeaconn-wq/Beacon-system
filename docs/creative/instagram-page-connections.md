# Configurar Contas do Instagram com Páginas

Métodos alternativos para obter o ID do Instagram sem usar o Gerenciador de Negócios.

## Opção 1: Contas do Instagram Conectadas a Páginas

### Requisitos
- Conta comercial no Instagram
- Imagem de perfil configurada
- Conta não pode ser privada

### Configuração
1. Conecte a conta do Instagram à Página do Facebook
2. Qualquer pessoa com função de **advertiser** na Página poderá veicular anúncios

### Obter ID da Conta
Após conectar, use a API para obter a identificação:

```bash
curl -G \
  -d "access_token=<PAGE_ACCESS_TOKEN>" \
  -d "fields=id,username,profile_pic" \
  "https://graph.facebook.com/<API_VERSION>/<PAGE_ID>/instagram_accounts"
```

### Criar Anúncios
Ao fornecer o criativo do anúncio:
- Informe `instagram_user_id` e `page_id`
- O `page_id` deve ser da Página conectada à conta do Instagram
- Não é possível usar uma conta do Instagram conectada à Página com outra Página

> ⚠️ Uma Página pode ter apenas **uma** conta do Instagram conectada E **uma** PBIA.

---

## Opção 2: Contas do Instagram Associadas a Páginas (PBIA)

Cria uma conta "sombra" no Instagram espelhada na Página do Facebook. Útil para quem não quer gerenciar um perfil real.

### Criar PBIA
Requer função de **ADVERTISER**, **MANAGER** ou **CONTENT_CREATOR** na Página.

```bash
curl -F "access_token=<PAGE_ACCESS_TOKEN>" \
  "https://graph.facebook.com/<API_VERSION>/<PAGE_ID>/page_backed_instagram_accounts"
```

Em caso de sucesso, retorna a identificação da conta do Instagram.  
Se a Página já tiver uma PBIA, retorna a identificação existente.

### Ler PBIA Existente
```bash
curl -G \
  -d "access_token=<PAGE_ACCESS_TOKEN>" \
  -d "fields=username,profile_pic" \
  "https://graph.facebook.com/<API_VERSION>/<PAGE_ID>/page_backed_instagram_accounts"
```

### Usar PBIA no Criativo
- Use a identificação como `instagram_user_id`
- Não é necessário atribuir contas de anúncios à PBIA
- O `page_id` do criativo precisa corresponder à Página associada à PBIA
- A conta do Instagram tem o mesmo nome e foto da Página

### Limitações da PBIA
- ❌ Não é possível fazer posts orgânicos
- ❌ Não é possível comentar como o perfil
- ✅ Pode visualizar/excluir comentários em anúncios (via Gerenciador ou API)

---

## Comparação de Métodos

| Requisito | Gerenciador de Negócios | Conta IG da Página | PBIA |
| :--- | :---: | :---: | :---: |
| Precisa de conta IG real | Sim | Sim | **Não** |
| Precisa de BM configurado | Sim | Não | Não |
| Pode fazer posts orgânicos | Sim | Sim | ❌ Não |
| Pode comentar como perfil | Sim | Sim | ❌ Não |
| Pode moderar comentários de anúncios | Sim | Sim | Sim |
| Conta de anúncios de usuário | Não | Sim | Sim |
| Conta de anúncios de empresa | Sim | Sim | Sim |

---

## Connection Objects

> ⚠️ Após criar uma conta do Instagram, use os endpoints de assets em vez de Connection Objects:

- `{business_id}/instagram_accounts`
- `act_{adaccount_id}/instagram_accounts`
- `{page_id}/instagram_accounts`
