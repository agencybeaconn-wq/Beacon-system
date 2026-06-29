# Tags de URL para Rastreamento

Use `url_tags` no criativo para adicionar parâmetros de rastreamento (UTM) aos seus links.

## Formato
Chave-valor separados por `&`.
Exemplo: `utm_source=facebook&utm_medium=cpc&campaign=summer_sale`

## Macros Dinâmicas
O Facebook substitui automaticamente estes valores quando o anúncio é exibido:

- `{{campaign.id}}`
- `{{adset.id}}`
- `{{ad.id}}`
- `{{campaign.name}}`
- `{{adset.name}}`
- `{{ad.name}}`
- `{{site_source_name}}` (fb, ig, msg, an)
- `{{placement}}` (Facebook_Desktop_Feed, Instagram_Stories, etc.)

### Comportamento dos Nomes
As macros de nome (`.name`) usam um **snapshot** do nome no momento da publicação. Se você renomear a campanha depois, a tag continuará usando o nome original para manter a consistência dos dados históricos.

### Exemplo de Uso
```json
{
  "url_tags": "utm_source=facebook&utm_campaign={{campaign.name}}&ad_id={{ad.id}}"
}
```
Isso resultará em algo como: `...&utm_campaign=Verao2025&ad_id=123456789`
