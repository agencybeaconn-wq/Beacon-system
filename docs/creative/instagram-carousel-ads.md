# Anúncios em Carrossel no Instagram

Crie anúncios com múltiplos cartões (imagens ou vídeos) para Feed e Stories.

## Requisitos Gerais (Feed)
- **Mínimo de Cartões:** 3 para Instalação de App, 2 para outros objetivos.
- **Máximo:** 5 cartões iniciais (se `multi_share_optimized` for false).
- **Diferenças do Facebook:**
  - `multi_share_optimized` não funciona (ordem fixa).
  - `multi_share_end_card` não suportado (sem cartão final de perfil).
  - Imagens devem ser >= 600x600px.
  - Vídeos devem ser quadrados, máx 60s.

## Carrossel no Stories
- **Cartões:** Até 10 imagens ou vídeos.
- **Duração de Vídeo:** Até 120s (ou 15s se `fixed_num_cards`).
- **Proporção:** 9:16 (Tela Cheia) recomendado.

### Modos de Entrega (`carousel_delivery_mode`)
1. **`optimal_num_cards` (Padrão):** O Instagram decide quantos cartões mostrar antes do "Expandir Story".
2. **`fixed_num_cards`:** Mostra um número fixo (máx 3) antes de expandir.

### Exemplo de Criação (Stories com Número Fixo)
```bash
curl -X POST \
  -F 'object_story_spec={ 
    "instagram_user_id": "<IG_USER_ID>", 
    "page_id": "<PAGE_ID>", 
    "link_data": { 
      "child_attachments": [ 
        { "link": "<LINK>", "image_hash": "<HASH1>" }, 
        { "link": "<LINK>", "image_hash": "<HASH2>" }, 
        { "link": "<LINK>", "image_hash": "<HASH3>" } 
      ], 
      "message": "Confira!", 
      "multi_share_end_card": false, 
      "multi_share_optimized": false 
    } 
  }' \
  -F 'portrait_customizations={ "carousel_delivery_mode": "fixed_num_cards" }' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```
