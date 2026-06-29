# Lances e Otimização (Bidding & Optimization)

Entenda como funcionam os lances, orçamentos e metas de otimização no leilão de anúncios da Meta.

## Conceitos Principais

- **Estratégia de Lance (`bid_strategy`):** Como você quer controlar seus gastos (ex: menor custo, limite de custo).
- **Meta de Otimização (`optimization_goal`):** O resultado que você quer que o sistema priorize (ex: cliques, impressões, conversões).
- **Evento de Cobrança (`billing_event`):** O evento pelo qual você paga (ex: impressões - CPM, cliques - CPC).
- **Valor do Lance (`bid_amount`):** Quanto você está disposto a pagar pelo resultado (se aplicável à estratégia).

## Configuração de Exemplo
Para gastar ~US$ 10,00 por 1.000 visualizações diárias exclusivas:
- **Objetivo da Campanha:** `APP_INSTALLS`
- **Meta de Otimização:** `REACH`
- **Evento de Cobrança:** `IMPRESSIONS`

Para gastar ~US$ 10,00 por instalação:
- **Objetivo da Campanha:** `APP_INSTALLS`
- **Meta de Otimização:** `APP_INSTALLS`
- **Evento de Cobrança:** `IMPRESSIONS`

## Mapeamento de Objetivos e Metas de Otimização

Alguns objetivos de campanha aceitam apenas metas de otimização específicas.

| Objetivo da Campanha (`objective`) | Meta Padrão (`optimization_goal`) | Outras Metas Válidas |
| :--- | :--- | :--- |
| `APP_INSTALLS` | `APP_INSTALLS` | `IMPRESSIONS`, `POST_ENGAGEMENT`, `OFFSITE_CONVERSIONS`, `LINK_CLICKS`, `REACH`, `VALUE` |
| `BRAND_AWARENESS` | `AD_RECALL_LIFT` | `REACH` |
| `CONVERSIONS` | `OFFSITE_CONVERSIONS` | `IMPRESSIONS`, `LINK_CLICKS`, `POST_ENGAGEMENT`, `REACH`, `VALUE`, `LANDING_PAGE_VIEWS`, `CONVERSATIONS` |
| `EVENT_RESPONSES` | `EVENT_RESPONSES` | `IMPRESSIONS`, `REACH`, `POST_ENGAGEMENT` |
| `LEAD_GENERATION` | `LEAD_GENERATION` | `QUALITY_LEAD`, `LINK_CLICKS`, `QUALITY_CALL` |
| `LINK_CLICKS` | `LINK_CLICKS` | `IMPRESSIONS`, `POST_ENGAGEMENT`, `REACH`, `LANDING_PAGE_VIEWS` |
| `MESSAGES` | `CONVERSATIONS` | `IMPRESSIONS`, `POST_ENGAGEMENT`, `LEAD_GENERATION`, `LINK_CLICKS` |
| `PAGE_LIKES` | `PAGE_LIKES` | `IMPRESSIONS`, `POST_ENGAGEMENT`, `REACH` |
| `POST_ENGAGEMENT` | `POST_ENGAGEMENT` | `IMPRESSIONS`, `REACH`, `LINK_CLICKS` |
| `PRODUCT_CATALOG_SALES` | `OFFSITE_CONVERSIONS` ou `LINK_CLICKS` | `IMPRESSIONS`, `POST_ENGAGEMENT`, `REACH`, `CONVERSATIONS`, `VALUE` |
| `REACH` | `REACH` | `IMPRESSIONS` |
| `VIDEO_VIEWS` | `THRUPLAY` | - |

> **Nota:** A partir da v17.0, alguns objetivos antigos foram depreciados. Verifique a documentação de mapeamento de objetivos ODAX (Outcome-Driven Ad Experiences) se estiver usando a nova estrutura simplificada (`OUTCOME_*`).

## Casos de Uso Comuns
- **CBO (Campaign Budget Optimization):** Otimiza a distribuição do orçamento entre conjuntos de anúncios.
- **Alcance e Frequência:** Lance para alcance único previsto e controle de frequência.
- **Multiplicadores de Lances:** Estratégia diferenciada em um único conjunto de anúncios (disponibilidade limitada).
