# Pós-processamento Assíncrono (Async Post-Processing)

Para evitar timeouts e erros em operações pesadas, a API (v4.0+) utiliza um fluxo de pós-processamento assíncrono para criação e edição de anúncios.

## Status `IN_PROCESS`
Quando um objeto (Campanha, Conjunto, Anúncio, Criativo) é criado ou editado, ele pode entrar temporariamente no estado `IN_PROCESS`.

### Impacto nos Campos
*   **Campanhas/Conjuntos/Anúncios:** O campo `effective_status` mostrará `IN_PROCESS`.
*   **Criativos:** O campo `status` mostrará `IN_PROCESS`.

![Fluxo de Pós-processamento](/Users/joaovithorbauer/.gemini/antigravity/brain/9c2b7915-9b24-459d-8627-f340ba521ae1/uploaded_image_1764623709677.png)

## Verificando o Status
Consulte o objeto periodicamente para verificar se o processamento foi concluído.

**Exemplo (Criativo):**
```bash
GET /<creative_id>?fields=status
```

**Resposta (Em Processamento):**
```json
{
 "status": "IN_PROCESS",
 "id": "<creative_id>"
}
```

**Resposta (Sucesso):**
```json
{
 "status": "ACTIVE",
 "id": "<creative_id>"
}
```

## Tratamento de Falhas
Se o processamento falhar, o status mudará para `WITH_ISSUES` e o campo `issues_info` conterá os detalhes do erro.

**Exemplo de Falha:**
```json
{
 "status": "WITH_ISSUES",
 "issues_info": [
  {
   "level": "CREATIVE",
   "error_code": 1815869,
   "error_summary": "Ad post is not available",
   "error_message": "The Facebook post associated with your ad is not available..."
  }
 ],
 "id": "<creative_id>"
}
```

> [!NOTE]
> Mesmo quando um objeto está `IN_PROCESS`, você pode enviar novas atualizações para ele.
