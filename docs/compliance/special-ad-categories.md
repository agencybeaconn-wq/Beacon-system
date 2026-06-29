# Categorias de Anúncio Especial (Special Ad Categories)

Requisitos de conformidade para anúncios relacionados a Crédito, Emprego, Moradia e Temas Sociais/Política.

## Categorias Disponíveis
O campo `special_ad_categories` é **obrigatório** para todas as campanhas.

- **`HOUSING`**: Anúncios de imóveis, oportunidades de moradia.
- **`EMPLOYMENT`**: Ofertas de emprego, estágios, feiras de carreira.
- **`FINANCIAL_PRODUCTS_SERVICES`**: Cartões de crédito, empréstimos, financiamento.
    - *Nota:* Substitui `CREDIT` a partir de 14 de Jan de 2025.
- **`ISSUES_ELECTIONS_POLITICS`**: Temas sociais, eleições, figuras políticas.
- **`NONE`**: Para campanhas que não se enquadram nas categorias acima (enviar array vazio `[]` ou `NONE`).

## Criação de Campanha

### Exemplo Básico (`EMPLOYMENT`)
```bash
curl -X POST \
  -F 'name="Hiring Campaign"' \
  -F 'objective="OUTCOME_LEADS"' \
  -F 'special_ad_categories=["EMPLOYMENT"]' \
  -F 'special_ad_category_country=["US"]' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns
```

### Exemplo Sem Categoria Especial (`NONE`)
```bash
curl -X POST \
  -F 'name="Generic Campaign"' \
  -F 'special_ad_categories=[]' \
  ...
```

## Restrições de Direcionamento (Housing, Employment, Financial)
Para evitar discriminação, as seguintes restrições são aplicadas automaticamente ou geram erros se violadas:

- **Idade:** Fixa em 18-65+ (exceto Crédito na Europa em casos específicos).
- **Gênero:** Deve incluir **todos** os gêneros.
- **Localização:**
    - Exclusão de localização não permitida.
    - Raio mínimo de 15 milhas (25km) para cidades/pinos.
    - CEPs (ZIP codes) não permitidos.
- **Direcionamento Detalhado:**
    - Muitas opções demográficas e comportamentais removidas.
    - Exclusão de interesses não permitida.
    - Expansão de direcionamento desabilitada.
- **Públicos Semelhantes (Lookalikes):** Não disponíveis.

### Ajuste Automático (`tune_for_category`)
No nível do Ad Set, você pode usar `tune_for_category` para aplicar as restrições automaticamente.

```bash
curl -X POST \
  -F 'tune_for_category=EMPLOYMENT' \
  https://graph.facebook.com/v24.0/<ADSET_ID>
```

## Temas Sociais e Política (`ISSUES_ELECTIONS_POLITICS`)
- **Autorização:** Exige que o usuário e a Página sejam autorizados no país de veiculação.
- **País Obrigatório:** `special_ad_category_country` deve ser especificado (código ISO Alpha 2, ex: `['US']`).
- **Rótulo:** Anúncios devem ter `authorization_category` definido (ex: `POLITICAL`).

## Solução de Problemas (`WITH_ISSUES`)
Se o status da campanha for `WITH_ISSUES`, verifique o campo `issues_info`.

**Erros Comuns:**
- `2909035`: Seleção de idade/gênero/localização inválida para a categoria.
- `2859024`: Certificação de não-discriminação exigida (aceitar no Business Manager).
