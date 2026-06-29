# Estimativa de Resultados Diários (Delivery Estimate)

API para obter estimativas de lance, alcance diário/mensal (DAU/MAU) e curva de resultados (previsão de performance baseada em gasto).

## Endpoints

### 1. Nível da Conta (`/delivery_estimate`)
Use este endpoint para simular estimativas antes de criar o conjunto de anúncios, passando as especificações manualmente.

```bash
GET /{AD_ACCOUNT_ID}/delivery_estimate
```

**Parâmetros Principais:**
*   `targeting_spec`: Especificações de direcionamento.
*   `optimization_goal`: Meta de otimização (ex: `LINK_CLICKS`, `IMPRESSIONS`).
*   `promoted_object`: Objeto promovido (se aplicável).

### 2. Nível do Conjunto de Anúncios (`/delivery_estimate`)
Use este endpoint para obter estimativas de um Ad Set existente.

```bash
GET /{AD_SET_ID}/delivery_estimate
```
*   Os parâmetros são opcionais; o sistema usa as configurações atuais do Ad Set por padrão.

## O Que a Resposta Inclui
*   **Estimativa de Lance:** Faixa sugerida de lance.
*   **Estimativa de Público:** Pessoas ativas diariamente e mensalmente.
*   **Curva de Resultados:** Pontos de dados mostrando a relação estimada entre Gasto vs. Alcance/Resultados.

## Notas Importantes
*   **Variabilidade:** A estimativa de lance pode variar para o mesmo direcionamento em contas diferentes, pois considera o histórico de performance da conta.
*   **Uso no Gerenciador:** Esses dados alimentam os gráficos de "Alcance Diário Estimado" e "Resultados Diários Estimados" na interface de criação de anúncios.
