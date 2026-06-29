# Direcionamento Avançado (Advanced Targeting)

Opções granulares de segmentação, incluindo dispositivos, demografia avançada, educação, trabalho e automação (Advantage+).

## 1. Dispositivos Móveis
Útil para campanhas de instalação de app ou comportamento específico.

- **`user_os`**: Sistema Operacional.
    - `['iOS']`, `['Android']`, `['iOS_ver_14.0_and_above']`.
- **`user_device`**: Modelos específicos (ex: `['Galaxy S6']`).
- **`wireless_carrier`**: `['Wifi']` para segmentar apenas usuários no Wi-Fi.

```json
"targeting": {
  "user_os": ["iOS"],
  "user_device": ["iPhone XS", "iPhone 13"],
  "wireless_carrier": ["Wifi"]
}
```

## 2. Demografia Avançada
Requer IDs obtidos via `GET /search`.

- **`life_events`**: Acontecimentos (ex: Recém-casados, Mudança recente).
- **`relationship_statuses`**: `[1]` (Solteiro), `[2]` (Relacionamento), `[3]` (Casado), `[4]` (Noivo).
- **`industries`**: Setores de atuação.
- **`income`**: Faixa de renda (disponibilidade limitada por região).
- **`family_statuses`**: Pais, etc.

## 3. Trabalho e Educação
- **Educação:** `education_schools`, `education_statuses` (ex: `4`=Ensino Médio, `9`=Mestrado), `education_majors`.
- **Trabalho:** `work_employers` (Empresas), `work_positions` (Cargos).

## 4. Públicos Personalizados no Targeting
Inclusão e Exclusão de Custom Audiences (CA) no nível do Ad Set.

```json
"targeting": {
  "custom_audiences": [{"id": "123456"}],         // Incluir
  "excluded_custom_audiences": [{"id": "789012"}] // Excluir
}
```

## 5. Automação e Advantage+ (`targeting_automation`)
Permite que a Meta expanda o público além do definido se houver probabilidade de melhor performance.

### Sugestões de Idade e Gênero (Advantage+ Audience)
Define idade/gênero como "sugestão" em vez de "regra rígida".

```json
"targeting_automation": {
  "individual_setting": {
    "age": 1,    // 1 = Habilitar expansão de idade
    "gender": 1  // 1 = Habilitar expansão de gênero
  }
}
```

### Expansão Geográfica (Cidades/Regiões)
Alcançar pessoas interessadas nas cidades selecionadas, não apenas residentes.
```json
"targeting_automation": {
  "individual_setting": {
    "geo": 1
  }
}
```

## 6. Categorias Amplas (`user_adclusters`)
Segmentação por clusters comportamentais amplos (ex: "Donos de Pequenas Empresas", "Culinária").

```json
"targeting": {
  "user_adclusters": [
    {"id": 6002714898572, "name": "Small Business Owners"}
  ]
}
```

## Limitações
- **Categorias Especiais:** Restrições severas se aplicam a anúncios de Moradia, Emprego e Crédito (sem idade/gênero/CEP, interesses limitados).
- **Dispositivos:** Não é possível segmentar versão mínima de uma plataforma e outra plataforma genérica ao mesmo tempo de forma conflitante.
