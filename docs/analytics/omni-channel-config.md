# Guia de Configuração Técnica Omni

Boas práticas e requisitos para uma integração robusta de dados online e offline, essencial para estratégias omnichannel.

## Configuração de Eventos
Parâmetros essenciais para otimização e atribuição via API de Conversões (CAPI) e Pixel.

### Parâmetros de Eventos
*   `event_name`
*   `event_time`
*   `action_source`
*   `client_user_agent` (Web)
*   `event_source_url` (Web)
*   **Dados Personalizados (Custom Data):**
    *   `content_ids`, `content_type`, `contents`
    *   `quantity`
    *   `currency` (Obrigatório para compras)
    *   `value` (Obrigatório para compras)

### Parâmetros de Informações do Cliente (PII)
*   Email, Telefone, Nome, Sobrenome
*   IP Address (Web), User Agent (Web)
*   `fbc` (Click ID), `fbp` (Browser ID)

## Qualidade da Correspondência (Match Quality)

### Eventos Web (EMQ)
*   **Pontuação:** 1 a 10.
*   **Fatores:** Presença e qualidade de chaves como Email, Telefone, IP, FBP, FBC.

### Dados Offline (ODQ)
*   **Pontuação:** 0 a 10.
*   **Fatores:**
    *   **Frequência:** Regularidade de envio (ideal: diário/horário).
    *   **Atualidade (Freshness):** Tempo entre ocorrência e envio.
    *   **Cobertura:** % de eventos com chaves fortes.
    *   **Atribuição:** Rastreamento automático habilitado.
*   **Interpretação:**
    *   8-10: Forte.
    *   4-7: Média (espaço para melhoria).
    *   0-3: Fraca.

## Atualidade dos Dados (Data Freshness)
Priorize o envio em **tempo real** para Web e o mais frequente possível (horário/diário) para Offline.

![Data Freshness](/Users/joaovithorbauer/.gemini/antigravity/brain/9c2b7915-9b24-459d-8627-f340ba521ae1/uploaded_image_1_1764623460261.png)

## Desduplicação
Essencial quando se usa Pixel e CAPI simultaneamente para evitar contagem dupla.

### Eventos Web
*   **Chaves:** `event_name` + `event_id` (Recomendado) ou `external_id`/`fbp`.
*   **Janela:** 48 horas.

### Eventos Offline
*   **Chaves:** `order_id` (Padrão) ou chaves de usuário.
*   **Janela:** 7 dias.
*   **Nota:** Não divida um pedido em múltiplos eventos; envie um evento com múltiplos itens.

## Qualidade do Evento
Verifique a correção dos parâmetros, especialmente para Catálogos.

![Event Quality](/Users/joaovithorbauer/.gemini/antigravity/brain/9c2b7915-9b24-459d-8627-f340ba521ae1/uploaded_image_2_1764623460261.png)

### Parâmetros Críticos
1.  **Content IDs:** Deve corresponder exatamente ao ID no catálogo.
2.  **Contents:** Estrutura recomendada: `[{id: '123', quantity: 2}]`.
3.  **Content Type:** `product` ou `product_group`.
4.  **Currency & Value:** Obrigatórios para compras.

## Configuração do Catálogo
*   **Taxa de Correspondência:** Ideal > 90%.
*   **Conexão:** Vincule o Conjunto de Dados (Dataset) ao Catálogo no Gerenciador de Comércio.
*   **Rastreamento Automático:** Habilite para atribuição automática.

![Catalog Match Rate](/Users/joaovithorbauer/.gemini/antigravity/brain/9c2b7915-9b24-459d-8627-f340ba521ae1/uploaded_image_0_1764623460261.png)

## Público Omni
Permite criar públicos baseados em atividades cruzadas (ex: viu no site, comprou na loja).
*   **Requisito:** Alta taxa de correspondência e dados atualizados.
