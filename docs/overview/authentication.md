# Autenticação na API de Marketing

Na API de Marketing, é preciso enviar um **token de acesso** como parâmetro em cada chamada de API.

## Tipos de Tokens de Acesso

### 1. Tokens de Acesso do Usuário
Podem ser obtidos via **Explorador da Graph API**.
- **Validade:** Curta duração (1-2 horas).
- **Extensão:** Podem ser trocados por tokens de longa duração (aprox. 60 dias).

**Como obter:**
1. Acesse o Explorador da Graph API.
2. Selecione o App e o Usuário.
3. Adicione permissões (`ads_read`, `ads_management`).
4. Gere o token.

**Como estender (Long-Lived Token):**
Use o **Depurador de Token de Acesso** ou a API `oauth/access_token` para trocar um token curto por um longo.

### 2. Tokens de Acesso de Usuário do Sistema
Associados a um **Usuário do Sistema** no Gerenciador de Negócios.
- **Validade:** NÃO expiram (Persistentes).
- **Uso:** Ideal para scripts, servidores e automações (S2S).
- **Vantagem:** Menos propensos a invalidação.

## Fluxo OAuth (Para Contas Gerenciadas)

Quando um usuário autoriza seu app, você recebe um `code`. Troque esse código por um token:

**Passo 1: Redirecionamento**
O usuário acessa:
`http://www.facebook.com/v24.0/dialog/oauth?client_id=<APP_ID>&redirect_uri=<URL>&scope=ads_management`

**Passo 2: Troca de Código por Token**
Faça uma chamada GET:
```
https://graph.facebook.com/v24.0/oauth/access_token?
  client_id=<YOUR_APP_ID>
  &redirect_uri=<YOUR_URL>
  &client_secret=<YOUR_APP_SECRET>
  &code=<AUTHORIZATION_CODE>
```

## Armazenamento e Segurança

### Boas Práticas
- **HTTPS:** Sempre use conexões seguras.
- **Armazenamento Seguro:** Banco de dados criptografado.
- **Escopo Mínimo:** Solicite apenas o necessário.
- **Validação:** Verifique a validade do token regularmente.

### Invalidação de Tokens
Tokens podem se tornar inválidos se:
- A senha do usuário mudar.
- O usuário revogar as permissões.
- O app deve estar preparado para solicitar re-autenticação.
