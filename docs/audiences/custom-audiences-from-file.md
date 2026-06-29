# Públicos Personalizados de Arquivo de Cliente

Criação de públicos usando dados próprios (CRM) como emails, telefones e IDs.

> **Restrições (Setembro 2025):** Públicos que sugerem condições de saúde ou status financeiro serão bloqueados (`operation_status: 471`).

## Processo de Criação

### 1. Criar o Público Vazio
```bash
curl -X POST \
-F 'name="My new Custom Audience"' \
-F 'subtype="CUSTOM"' \
-F 'description="People who purchased on my website"' \
-F 'customer_file_source="USER_PROVIDED_ONLY"' \
-F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences
```
- **`customer_file_source`**: `USER_PROVIDED_ONLY` (direto do cliente), `PARTNER_PROVIDED_ONLY` (via parceiro), `BOTH_USER_AND_PARTNER_PROVIDED`.

### 2. Adicionar Usuários (`/users`)
Envio em lotes (máx 10.000 registros por requisição).

```json
{
  "session": {
    "session_id": 9778993,
    "batch_seq": 1,
    "last_batch_flag": false,
    "estimated_num_total": 100000
  },
  "payload": {
    "schema": "EMAIL_SHA256",
    "data": [
      ["<HASHED_DATA>"],
      ["<HASHED_DATA>"]
    ]
  }
}
```

## Hashing e Normalização
Todos os dados PII (Personal Identifiable Information) devem ser normalizados e depois convertidos em hash **SHA256**.

| Chave | Normalização |
| :--- | :--- |
| **EMAIL** | Minúsculas, sem espaços. |
| **PHONE** | Apenas números, sem zeros à esquerda, com código do país. |
| **GEN** | `m` ou `f`. |
| **DOBY/M/D** | AAAA, MM, DD. |
| **FN/LN** | Minúsculas, a-z, UTF-8. |
| **COUNTRY** | ISO 3166-1 alfa-2 (ex: `US`, `BR`). |

## Uso Limitado de Dados (LDU) - Califórnia
Para conformidade com CCPA/CPRA.
- **Habilitar LDU:** Adicionar `["LDU"]` na matriz de dados de cada usuário.
- **Habilitar com Geolocalização:** `["LDU", 1, 1000]` (onde 1=país, 1000=estado).

## Correspondência Multi-Chave
Aumenta a taxa de correspondência enviando múltiplos identificadores para o mesmo usuário.

```json
"payload": {
  "schema": ["FN", "LN", "EMAIL"],
  "data": [
    ["<HASH_FN>", "<HASH_LN>", "<HASH_EMAIL>"]
  ]
}
```

## API de Substituição (`/usersreplace`)
Remove todos os usuários atuais e substitui pela nova lista em uma única operação (sem resetar o aprendizado do conjunto de anúncios).

- **Janela de Sessão:** 90 minutos.
- **Status:** `replace_in_progress` -> `Normal` (ou `replace_error`).

```bash
curl -X POST \
https://graph.facebook.com/v24.0/<CUSTOM_AUDIENCE_ID>/usersreplace
```

## Identificadores Externos (`EXTERN_ID`)
IDs próprios do anunciante (ex: User ID do banco de dados).
- Não requer hash (mas PII associado sim).
- Validade de 90 dias.
