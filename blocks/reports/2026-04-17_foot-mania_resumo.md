# Relatório: Foot Mania — 2026-04-17

- **O que foi feito:** merge cirúrgico main-product.liquid + buy-buttons verde
- **Blocos usados:**
  - benefits_grid
  - custom_image
  - buy-buttons green CTA
- **Erros:**
  - String.replace com $109 disparou backreference (corrigido com callback)
  - CRLF em settings_schema.json quebrou JSON.parse (normalizado)
- **Melhorias:**
  - schema diff deveria ser auto no início
  - visual consistency check pra buy-buttons
- **Candidato?:** pendente
