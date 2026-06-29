# Especificação de Execução de Regras de Anúncios (`execution_spec`)

A `execution_spec` define **qual ação** será tomada nos objetos que atenderem aos critérios da `evaluation_spec`.

## Tipos de Execução (`execution_type`)

### Ações Gerais (SCHEDULE e TRIGGER)
- **`NOTIFICATION`**: Envia notificação (Facebook/Email) para o criador ou `user_ids` especificados.
- **`PAUSE`**: Pausa os objetos (Campanha, Conjunto ou Anúncio).
- **`UNPAUSE`**: Retoma (ativa) os objetos.

### Ações de Orçamento e Lance (Apenas SCHEDULE)
- **`CHANGE_BUDGET`**: Altera o orçamento de **conjuntos de anúncios**. Requer `change_spec`.
- **`CHANGE_CAMPAIGN_BUDGET`**: Altera o orçamento de **campanhas**. Requer `change_spec`.
- **`CHANGE_BID`**: Altera o lance de **conjuntos de anúncios**. Requer `change_spec`.
- **`REBALANCE_BUDGET`**: Pausa objetos e redistribui o orçamento restante. Requer `rebalance_spec`.

### Outras Ações
- **`ROTATE`** (SCHEDULE): Pausa o anúncio ativo e ativa o próximo no conjunto.
- **`PING_ENDPOINT`** (TRIGGER): Envia um ping via Webhook.

## Opções de Execução (`execution_options`)
Parâmetros adicionais para configurar a ação.

### `change_spec`
Define como o orçamento ou lance deve ser alterado.
- **Campos:** `amount`, `limit`, `unit`, `target_field`.
- **Uso:** Para `CHANGE_BUDGET`, `CHANGE_BID`.

### `rebalance_spec`
Define a lógica de rebalanceamento de orçamento.
- **Uso:** Para `REBALANCE_BUDGET`.

### Limites e Frequência
- **`execution_count_limit`**: Máximo de vezes que a ação pode ser executada por objeto.
- **`action_frequency`**: Tempo mínimo (em minutos) entre execuções da mesma ação no mesmo objeto (ex: esperar 7 dias antes de aumentar o orçamento novamente).

### `user_ids`
Lista de IDs de usuários para receber notificações ou resumos por email.
- **Email Diário:** Para regras SCHEDULE, um resumo é enviado às 00:30 (fuso da conta).
