# Elementos Interativos (Tags de Produto)

Adicione tags de produtos clicáveis em anúncios de imagem, vídeo ou carrossel no Instagram.

## Tag Manual (`interactive_components_spec`)
Defina manualmente quais produtos marcar e suas posições.

### Imagem/Vídeo Único
```bash
curl -F 'interactive_components_spec={
  "components": [
    {
      "type": "product_tag",
      "product_tag_spec": { "product_id": 123456789 },
      "position_spec": { "x": 0.5, "y": 0.5 }
    }
  ]
}' ...
```

### Carrossel
Use `child_attachments` para definir tags para cada cartão.
```bash
curl -F 'interactive_components_spec={
  "child_attachments": [
    {
      "components": [
        {
          "type": "product_tag",
          "position_spec": { "x": 0.5, "y": 0.5 },
          "product_tag_spec": { "product_id": 123456789 }
        }
      ]
    },
    ...
  ]
}' ...
```

## Tag Automática
O Facebook tenta marcar produtos automaticamente com base na imagem ou URL de destino.
- **Habilitado por padrão** para anúncios estáticos.
- **Desativar:** Defina `enroll_status: "opt_out"`.

```json
"interactive_components_spec": {
  "components": [
    {
      "type": "product_tag",
      "enroll_status": "opt_out"
    }
  ]
}
```
**Nota:** Não use `enroll_status` e `product_tag_spec` juntos.
