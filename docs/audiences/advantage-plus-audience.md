# Público Advantage+ (Advantage+ Audience)

O Público Advantage+ usa IA para encontrar o público mais amplo possível para seus anúncios, expandindo além dos critérios definidos quando há oportunidade de melhor performance.

## Configuração (`targeting_automation`)

Para ativar ou desativar, use o campo `advantage_audience` dentro de `targeting_automation` no objeto `targeting`.

*   `1`: **Ativado** (Aceitar).
*   `0`: **Desativado** (Recusar).

**Comportamento da API (v24.0+):**
Ao criar novos conjuntos de anúncios, `advantage_audience` é predefinido como `1` ou deve ser definido explicitamente.

## O que é Expandido?
A Meta expande critérios de direcionamento detalhado, lookalikes e outros sinais.

## O que NÃO é Expandido (Restrições Rígidas)
*   Localização
*   Idade mínima
*   Idioma
*   Exclusões de Público Personalizado

## Interação com Idade (`age_range`)
Quando o Público Advantage+ está **ativado**:

1.  Você pode definir `age_range` (ex: `[25, 35]`) como uma **sugestão**.
2.  `age_min` deve ser entre 18 e 25.
3.  `age_max` é fixado em 65 (não pode ser alterado pelo anunciante).
4.  Se `age_range` não for enviado, a faixa etária é criada a partir dos limites padrão.

**Exemplo de Payload:**
```json
"targeting": {
  "age_max": 65,
  "age_min": 18,
  "age_range": [25, 35],
  "geo_locations": { "countries": ["US", "GB"] },
  "targeting_automation": {
    "advantage_audience": 1
  }
}
```

## Casos de Uso Padrão e Flexível
O sistema assume `advantage_audience: 1` automaticamente se:
1.  **Padrão:** Você usa valores padrão (ou omite) para idade, gênero, custom audiences e direcionamento detalhado.
2.  **Flexível:** Você usa `flexible_spec` e ativa explicitamente o relaxamento (`targeting_relaxation_types`) para os critérios usados.

**Erro de Configuração:**
Se você usar configurações não-padrão (ex: `age_max: 50`) sem ativar explicitamente a automação ou relaxamento, a API retornará um erro exigindo que você defina `advantage_audience` como `1` ou `0`.
