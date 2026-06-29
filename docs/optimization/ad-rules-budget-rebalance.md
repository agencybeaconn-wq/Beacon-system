# Regras de Reequilíbrio de Orçamento (`REBALANCE_BUDGET`)

Permite redistribuir orçamentos entre conjuntos de anúncios com base no desempenho (ROI).

## Especificação de Reequilíbrio (`rebalance_spec`)

Define como o orçamento é movido dos "doadores" (objetos que atendem aos filtros da regra) para os "destinatários".

| Campo | Descrição |
| :--- | :--- |
| **`type`** | Método de distribuição. (`EVEN`, `PROPORTIONAL`, `NO_PAUSE_PROPORTIONAL`, `MATCHED_ONLY_PROPORTIONAL`). |
| **`target_field`** | Métrica usada para classificar o desempenho (ex: `cpa`, `impressions`). Obrigatório se não for `EVEN`. |
| **`target_count`** | Número (K) de destinatários principais a receber o orçamento. |
| **`is_cross_campaign`** | Se `true`, permite mover orçamento entre campanhas diferentes. |
| **`is_inverse`** | Se `true`, inverte a classificação (menor valor = melhor desempenho, útil para CPA). |

## Tipos de Distribuição

### 1. `EVEN` e `PROPORTIONAL`
- **Comportamento:** Pausa os objetos doadores (baixo desempenho) e move seu orçamento para os destinatários.
- **Destinatários:** Objetos que **NÃO** passaram na avaliação (bom desempenho).
- **Ajuste:** `EVEN` divide igualmente; `PROPORTIONAL` divide com base no `target_field`.

### 2. `NO_PAUSE_PROPORTIONAL`
- **Comportamento:** **NÃO** pausa os doadores. Apenas ajusta os orçamentos.
- **Lógica:** Analisa todos os objetos juntos e transfere orçamento dos piores para os melhores.

### 3. `MATCHED_ONLY_PROPORTIONAL`
- **Comportamento:** **NÃO** pausa. Analisa **apenas** os objetos que passaram na avaliação.
- **Lógica:** Redistribui o orçamento total desse grupo proporcionalmente entre eles mesmos.

## Exemplos

### 1. Reequilíbrio Inverso (CPA)
Pausa conjuntos com CPA > $3.00 e redistribui para os 10 melhores (menor CPA).
```json
"rebalance_spec": {
  "type": "INVERSE_PROPORTIONAL",
  "target_field": "cost_per_mobile_app_install",
  "target_count": 10,
  "is_cross_campaign": true
}
```

### 2. Reequilíbrio Uniforme (`EVEN`)
Pausa conjuntos com > 8000 impressões e > 70% de alcance, redistribuindo igualmente para os demais.
```json
"rebalance_spec": {
  "type": "EVEN"
}
```

### 3. Sem Pausa (`NO_PAUSE_PROPORTIONAL`)
Transfere orçamento de conjuntos com poucas visualizações de vídeo para os que têm mais, sem pausar ninguém.
```json
"rebalance_spec": {
  "type": "NO_PAUSE_PROPORTIONAL",
  "target_field": "video_view"
}
```
