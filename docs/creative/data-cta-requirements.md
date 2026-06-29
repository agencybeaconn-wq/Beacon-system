# Requisitos de Dados e Chamada para Ação (CTA)

Compatibilidade entre objetivos, tipos de dados (`link_data`, `video_data`, `photo_data`) e regras de CTA.

## Compatibilidade de Objetivos e Dados

| Objetivo | LINK_DATA (Carrossel/Único) | VIDEO_DATA | PHOTO_DATA |
| :--- | :---: | :---: | :---: |
| `LINK_CLICKS` | ✅ | ✅ | ❌ |
| `VIDEO_VIEWS` | ❌ | ✅ | ❌ |
| `MOBILE_APP_INSTALLS` | ✅ | ✅ | ❌ |
| `CONVERSIONS` | ✅ | ✅ | ❌ |
| `POST_ENGAGEMENT` | ✅ | ✅ | ✅ |
| `MOBILE_APP_ENGAGEMENT` | ✅ | ✅ | ❌ |

## Regras de Call to Action (CTA)
- **Padrão:** Se não especificado em `link_data`, o padrão é `LEARN_MORE`.
- **Obrigatório:** Para `video_data`, `MOBILE_APP_INSTALLS` e `MOBILE_APP_ENGAGEMENT`.
- **Links:** O link da CTA deve coincidir com o link principal do `link_data`.
- **App Ads:** Devem apontar para App Store ou Google Play (Deep links permitidos).

## Limitações de Texto
- **Máximo:** 2.200 caracteres para `message`, `description` ou `caption`.
- **Hashtags:** Recomendado (máx 30).
- **Hiperlinks:** Não são clicáveis no texto do Instagram.

## Sobreposição de URL
- **Anúncios com Link:** Mostram o "URL de exibição" (`caption`) ou o domínio do link em uma sobreposição.
- **App Ads:** Mostram "Visualizar na App Store/Play Store".

## Instagram Stories
- **Suporte:** `photo_data` (apenas REACH), `link_data` (apenas LINK_CLICKS), `video_data` (REACH, VIDEO_VIEWS, LINK_CLICKS).
- **CTA no Stories:** Obrigatório para objetivos de resposta direta (LINK_CLICKS, CONVERSIONS). Alguns tipos como `CALL_NOW` ou `GET_DIRECTIONS` não são suportados.
