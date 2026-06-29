# Conta de Anúncios (Ad Account)

Entidade que representa uma empresa ou pessoa que cria e gerencia anúncios no Facebook.

## Limites e Volume de Anúncios

### Volume de Anúncios (Ads Volume)
Número de anúncios "em execução ou em análise" (`ads_running_or_in_review_count`).
*   **Limite:** 6.000 anúncios não arquivados/não excluídos por conta regular (50.000 para contas bulk).
*   **Consequência:** Se atingido, novos anúncios não são publicados e ações em existentes são limitadas a pausar/arquivar.
*   **Consulta:**
    ```bash
    curl -G -d "access_token=<TOKEN>" "https://graph.facebook.com/v24.0/act_<ID>/ads_volume"
    ```

### Outros Limites
*   **Contas de Anúncios por Pessoa:** 25
*   **Pessoas por Conta:** 25
*   **Conjuntos de Anúncios:** 6.000 (regular) / 10.000 (bulk)
*   **Campanhas:** 6.000 (regular) / 10.000 (bulk)
*   **Objetos Arquivados:** 100.000 por tipo.

## Digital Services Act (DSA)
Informações de beneficiário e pagador são obrigatórias para conformidade na UE.
*   **Campos:** `default_dsa_payor`, `default_dsa_beneficiary`.
*   **Leitura:**
    ```bash
    curl -X GET "https://graph.facebook.com/v24.0/act_<ID>?fields=default_dsa_payor,default_dsa_beneficiary&access_token=<TOKEN>"
    ```

## Gerenciamento da Conta

### Leitura (Campos Principais)
*   `account_id`, `name`, `account_status`, `currency`, `timezone_id`
*   `amount_spent`, `spend_cap`, `balance`
*   `business`, `owner`, `partner`, `media_agency`, `end_advertiser`
*   `funding_source`, `funding_source_details`
*   `user_tasks`, `capabilities`

### Criação
Requer `name`, `currency`, `timezone_id`, `end_advertiser`, `media_agency`, `partner`.
```bash
curl \
-F "name=MyAdAccount" \
-F "currency=USD" \
-F "timezone_id=1" \
-F "end_advertiser=<PAGE_OR_APP_ID>" \
-F "media_agency=NONE" \
-F "partner=NONE" \
-F "access_token=<TOKEN>" \
"https://graph.facebook.com/v24.0/<BUSINESS_ID>/adaccount"
```

### Atualização
Atualize campos como `name`, `spend_cap`, `agency_client_declaration`.
```bash
POST /act_<AD_ACCOUNT_ID>
```

### Atribuição de Usuários
```bash
POST /act_<AD_ACCOUNT_ID>/assigned_users
-F "user=<UID>"
-F "tasks=['MANAGE','ADVERTISE']"
```

## Códigos de Erro Comuns
*   **100:** Parâmetro inválido.
*   **200:** Erro de permissão.
*   **613 / 80004:** Limite de taxa (Rate limit) excedido.
*   **3979:** Limite de contas de anúncios no Business Manager excedido.
