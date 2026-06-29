# Estratégias de Lance (Bid Strategies)

Controle como o sistema define lances nos leilões para atingir seus objetivos de custo e resultado.

## Tipos de Estratégia

### 1. Menor Custo sem Limite (`LOWEST_COST_WITHOUT_CAP`)
- **Objetivo:** Gastar todo o orçamento e obter o máximo de resultados possível.
- **Controle:** Nenhum controle de custo específico.
- **Uso:** Quando a prioridade é volume e entrega total do orçamento.

### 2. Limite de Custo (`COST_CAP`)
- **Objetivo:** Maximizar resultados mantendo um custo médio (CPA/CPI) definido.
- **Configuração:** Requer `bid_amount` (o valor do limite).
- **Nota:** Adesão ao limite não é garantida. Pode haver sub-entrega se o limite for muito baixo.
- **Requisitos:** `billing_event=IMPRESSIONS`.

```bash
curl -X POST ... \
  -F 'bid_strategy=COST_CAP' \
  -F 'bid_amount=200' \
  ...
```

### 3. Menor Custo com Limite de Lance (`LOWEST_COST_WITH_BID_CAP`)
- **Objetivo:** Controlar o lance máximo em cada leilão individual.
- **Configuração:** Requer `bid_amount` (o teto do lance).
- **Uso:** Para controle rígido de quanto se paga por leilão, não necessariamente o custo final por resultado.

```bash
curl -X POST ... \
  -F 'bid_strategy=LOWEST_COST_WITH_BID_CAP' \
  -F 'bid_amount=300' \
  ...
```

### 4. ROAS Mínimo (`LOWEST_COST_WITH_MIN_ROAS`)
- **Objetivo:** Garantir um retorno mínimo sobre o investimento em publicidade (ROAS).
- **Requisitos:**
  - `optimization_goal=VALUE`.
  - Conta qualificada para otimização de valor.
- **Configuração:** Usa `bid_constraints` com `roas_average_floor`.
- **Formato do Valor:** Inteiro escalado por 10.000.
  - `100` = 0.01 (1%)
  - `10000` = 1.00 (100%)
  - `15000` = 1.50 (150%)

```bash
curl -X POST ... \
  -F 'optimization_goal=VALUE' \
  -F 'bid_strategy=LOWEST_COST_WITH_MIN_ROAS' \
  -F 'bid_constraints={"roas_average_floor": 15000}' \
  ...
```

## Considerações iOS 14.5+
- Estratégias `COST_CAP` e `LOWEST_COST_WITH_MIN_ROAS` exigem campanhas com duração mínima de **3 dias**.
- `target_cost` está obsoleto (use `COST_CAP`).
