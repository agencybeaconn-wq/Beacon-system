---
name: component
description: Cria componentes React seguindo os padrões do projeto Lever System (shadcn/ui, Tailwind, TypeScript, Supabase).
argument-hint: [nome do componente] [o que ele faz]
---

# React Component Skill

Quando o usuario pedir para criar ou atualizar um componente React, siga estes passos:

## 1. Verificar se componente similar ja existe

Procure em `src/components/` e `src/pages/` se ja existe um componente com funcionalidade parecida. Evite duplicacao.

## 2. Estrutura padrao do componente

Use esta estrutura como base:

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface ComponentNameProps {
  // props tipadas
}

export function ComponentName({ ...props }: ComponentNameProps) {
  const { toast } = useToast()

  // component logic

  return (
    // JSX
  )
}
```

## 3. Regras obrigatorias

- **TypeScript**: Sempre tipar props com `interface`. Nunca usar `any` sem necessidade.
- **shadcn/ui**: Usar componentes de `@/components/ui/` (Button, Card, Input, Select, Dialog, Table, Badge, Tabs, etc.). Nunca criar componentes UI do zero se shadcn ja tem.
- **Tailwind CSS**: Todo styling via classes Tailwind. Nunca criar arquivos CSS separados.
- **Supabase**: Usar `supabase` de `@/integrations/supabase/client` para dados. Seguir o padrao useQuery/useState do projeto.
- **Toast**: Usar `useToast()` de `@/hooks/use-toast` para notificacoes de sucesso/erro.
- **Icones**: Usar Lucide icons de `lucide-react`. Nunca instalar outra lib de icones.
- **Exports**: Usar `export function` (named export), nao `export default`.

## 4. Localizacao dos arquivos

### Se for uma PAGINA:
- Criar em `src/pages/<NomeDaPagina>.tsx`
- Adicionar rota em `App.tsx` seguindo o padrao existente
- Paginas usam layout com sidebar (verificar como outras paginas fazem)

### Se for um COMPONENTE reutilizavel:
- Criar em `src/components/<modulo>/ComponentName.tsx`
- Seguir a organizacao de modulos existente:
  - `lever-os/` — gestao de tarefas e kanban
  - `financial/` — funcionalidades financeiras
  - `estudio-ia/` — funcionalidades de IA
  - `clients/` — gestao de clientes
  - `shopify/` — funcionalidades Shopify
  - `briefing/` — formularios de briefing
  - `dashboard/` — cards e widgets do dashboard

## 5. Hooks existentes

Antes de criar logica custom, verifique os hooks disponiveis em `src/hooks/`. Use-os quando aplicavel para manter consistencia.

## 6. Padrao de dados com Supabase

Para buscar dados:
```tsx
const [data, setData] = useState<TipoDosDados[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  async function fetchData() {
    const { data, error } = await supabase
      .from('tabela')
      .select('*')
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      setData(data || [])
    }
    setLoading(false)
  }
  fetchData()
}, [])
```

Para mutations (insert/update/delete), sempre mostrar toast de sucesso ou erro.

## 7. Boas praticas do projeto

- Componentes devem ser responsivos (mobile-first com Tailwind breakpoints)
- Loading states com Skeleton ou spinner
- Empty states informativos quando nao ha dados
- Tratar erros de forma visivel para o usuario (toast)
- Manter componentes focados — dividir em subcomponentes se ficar grande
