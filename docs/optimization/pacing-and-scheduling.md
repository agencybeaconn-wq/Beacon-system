# Regularidade e Programação (Pacing & Scheduling)

Controle como o orçamento é gasto ao longo do tempo e quando os anúncios são exibidos.

## Tipos de Regularidade (`pacing_type`)

- **`standard` (Padrão):** Distribui o gasto uniformemente ao longo do dia/período. Ajusta o lance para obter o melhor custo-benefício.
- **`no_pacing` (Acelerada):** Gasta o orçamento o mais rápido possível.
  - **Uso:** Promoções relâmpago, eventos ao vivo.
  - **Risco:** Pode esgotar o orçamento muito cedo e aumentar o custo.
  - **Requisito:** Requer controle manual de lance.
- **`day_parting`:** Permite agendamento específico (dias/horas). Requer `lifetime_budget`.

### Exemplo: Veiculação Acelerada
```bash
curl -X POST ... \
  -F 'pacing_type=["no_pacing"]' \
  -F 'bid_amount=200' \
  ...
```

## Programação de Anúncios (`adset_schedule`)

Permite especificar dias e horários para veiculação.
- **Requisito:** `lifetime_budget` e `pacing_type=["day_parting"]`.
- **Fuso Horário:** Por padrão, usa o fuso horário do visualizador (`user`), não da conta de anúncios.

### Estrutura do Objeto
- **`days`**: Array de inteiros (0=Domingo, 1=Segunda, ..., 6=Sábado).
- **`start_minute`**: Minuto do dia (0-1439).
- **`end_minute`**: Minuto do dia (0-1439).
- **Regra:** Diferença mínima de 60 minutos. Para alcance e frequência, mínimo de 4 horas.

### Exemplo: Programação Específica
Segunda a Sexta (Dias 1-5), das 09:00 (540 min) às 12:00 (720 min).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Scheduled Ad Set' \
  -F 'lifetime_budget=100000' \
  -F 'pacing_type=["day_parting"]' \
  -F 'adset_schedule=[
       {
         "days": [1, 2, 3, 4, 5],
         "start_minute": 540,
         "end_minute": 720
       }
     ]' \
  -F 'access_token=<ACCESS_TOKEN>' \
  ...
```

### Leitura da Programação
```bash
curl -G "https://graph.facebook.com/v24.0/<AD_SET_ID>" \
  -d 'fields=adset_schedule' \
  -d 'access_token=<ACCESS_TOKEN>'
```
