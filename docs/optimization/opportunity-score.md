# Pontuação de Oportunidade e Recomendações

Ferramenta para avaliar a otimização da conta de anúncios (0-100) e aplicar melhorias automáticas.

## Pontuação de Oportunidade
*   **Intervalo:** 0 a 100.
*   **Significado:** Quanto maior, melhor otimizada está a conta.
*   **Atualização:** Quase em tempo real.

## Recomendações
Boas práticas personalizadas que, quando aplicadas, aumentam a pontuação e potencialmente o desempenho.

### Buscar Recomendações
```bash
GET /v24.0/act_<AD_ACCOUNT_ID>/recommendations
```
**Resposta:**
```json
{
  "data": [
    {
      "recommendation_signature": "1234567",
      "type": "AUTOFLOW_OPT_IN",
      "object_ids": ["<AD_ID>"],
      "recommendation_content": {
        "lift_estimate": "Up to 3% more Traffic",
        "opportunity_score_lift": "14"
      }
    }
  ]
}
```

### Aplicar Recomendações
```bash
POST /v24.0/act_<AD_ACCOUNT_ID>/recommendations
```
**Parâmetros:**
*   `recommendation_signature`: ID único da recomendação (obrigatório).
*   `music_parameters`: Para recomendações do tipo `MUSIC`.
*   `autoflow_parameters`: Para recomendações do tipo `AUTOFLOW_OPT_IN`.
*   `fragmentation_parameters`: Para recomendações do tipo `FRAGMENTATION`.

**Exemplo:**
```bash
curl -X POST \
  -d 'recommendation_signature="1234567"' \
  -d 'music_parameters={"object_selection": ["<AD_ID>"]}' \
  ...
```

## Tipos de Recomendação (Exemplos)
*   **MUSIC:** Adiciona música automaticamente aos anúncios.
*   **AUTOFLOW_OPT_IN:** Habilita aprimoramentos padrão (Standard Enhancements).
*   **FRAGMENTATION:** Combina conjuntos de anúncios semelhantes para sair da fase de aprendizado mais rápido.
*   **CREATIVE_FATIGUE:** Sugere novos criativos quando os atuais estão saturados.
*   **ADVANTAGE_PLUS_AUDIENCE:** Sugere uso de públicos Advantage+.
*   **SCALE_GOOD_CAMPAIGN:** Sugere aumentar orçamento de campanhas com bom desempenho.
*   **DELIVERY_ERROR:** Alerta sobre erros que impedem a veiculação.

![Pontuação de Oportunidade](/Users/joaovithorbauer/.gemini/antigravity/brain/9c2b7915-9b24-459d-8627-f340ba521ae1/uploaded_image_0_1764623369324.png)
![Lista de Recomendações](/Users/joaovithorbauer/.gemini/antigravity/brain/9c2b7915-9b24-459d-8627-f340ba521ae1/uploaded_image_1_1764623369324.png)
