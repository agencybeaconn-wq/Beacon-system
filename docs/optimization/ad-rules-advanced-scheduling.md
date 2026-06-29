# Programação Avançada de Regras de Anúncios (Advanced Scheduling)

Permite definir horários específicos e complexos para a execução de regras usando `schedule_type: "CUSTOM"`.

## Campos da Programação (`schedule`)

Cada objeto na lista `schedule` pode conter:

| Campo | Descrição |
| :--- | :--- |
| **`start_minute`** | Minutos após a meia-noite (múltiplo de 30). Se `end_minute` não for definido, define o horário exato. Se omitido, executa a cada 30 min (SEMI_HOURLY) nos dias especificados. |
| **`end_minute`** | Minutos após a meia-noite (múltiplo de 30, > start). Define o fim de uma faixa de tempo. |
| **`days`** | Lista de dias (0=Domingo, 1=Segunda, ..., 6=Sábado). Se omitido, aplica-se a todos os dias. |

> **Nota:** Múltiplos objetos na lista `schedule` funcionam como uma lógica **OU** (OR).

## Exemplos

### 1. Todos os dias às 10:00
`600` minutos = 10 horas * 60 minutos.

```json
"schedule_spec": {
  "schedule_type": "CUSTOM",
  "schedule": [
    {
      "start_minute": 600
    }
  ]
}
```

### 2. A cada 30 minutos nos Finais de Semana
Omissão de `start_minute` implica execução `SEMI_HOURLY`.

```json
"schedule_spec": {
  "schedule_type": "CUSTOM",
  "schedule": [
    {
      "days": [0, 6]
    }
  ]
}
```

### 3. Quartas-feiras às 02:00
`120` minutos = 2 horas * 60 minutos.

```json
"schedule_spec": {
  "schedule_type": "CUSTOM",
  "schedule": [
    {
      "start_minute": 120,
      "days": [3]
    }
  ]
}
```

### 4. Programação Mista (Dias de Semana vs. Fim de Semana)
- **Dias de Semana (1-5):** Executa o dia todo (implícito pela omissão de horário, ou seja, SEMI_HOURLY). *Nota: O exemplo original diz "executada o dia inteiro", o que geralmente implica SEMI_HOURLY se não houver start/end, ou pode depender de outros contextos, mas a estrutura JSON abaixo segue o exemplo.*
- **Finais de Semana (0, 6):** Apenas das 12:00 às 13:00 (`720` a `780`).

```json
"schedule_spec": {
  "schedule_type": "CUSTOM",
  "schedule": [
    {
      "days": [1, 2, 3, 4, 5]
    },
    {
      "start_minute": 720,
      "end_minute": 780,
      "days": [0, 6]
    }
  ]
}
```
