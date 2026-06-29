# Personalização de Stories (Cores de Fundo)

Personalize o fundo de anúncios que não preenchem a tela inteira (não 9:16) no Stories (Instagram, Facebook, Messenger).

## Configuração (`portrait_customizations`)
Defina cores hexadecimais para o topo e o fundo do story.

```json
{
  "portrait_customizations": {
    "specifications": [
      {
        "background_color": {
          "top_color": "CC8400",    // Cor Superior (HEX)
          "bottom_color": "0D3F0C"  // Cor Inferior (HEX)
        }
      }
    ]
  }
}
```

### Exemplo de Criação
```bash
curl -X POST \
  -F 'name=Story Ad with Custom Background' \
  -F 'object_story_spec={...}' \
  -F 'portrait_customizations={ "specifications": [ { "background_color": { "top_color": "CC8400", "bottom_color": "0D3F0C" } } ] }' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

## Limitações
- Não suportado para Anúncios de Catálogo Advantage+ ou Coleção.
- Funciona apenas para preencher o espaço vazio de ativos que não são 9:16.
