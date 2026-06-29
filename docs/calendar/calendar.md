# Profit Calendar: Visual & UX Documentation

O **Profit Calendar** é um componente central da visão geral (Overview) do Leverads, projetado para fornecer uma visão clara e estética do lucro estimado através de diferentes granularidades temporais.

## 🎨 Filosofia de Design

O componente segue a estética **Premium Matte**, utilizando um grid sutil com bordas suaves e uma paleta de cores focada em legibilidade e contraste emocional (Verde para lucro, Vermelho para prejuízo).

---

## 📅 Visualização Mensal (Month View)
A visão mensal foca na consistência histórica e tendências diárias dentro de um grid de calendário tradicional.

### Características Visuais:
- **Grid 7x1**: Dias organizados de domingo a sábado.
- **Indicadores de Tendência**: Ícones `TrendingUp` (Verde) ou `TrendingDown` (Vermelho) posicionados ao lado do número do dia quando há dados significativos.
- **Valores Compactos**: Valores monetários são abreviados (ex: `1.2k`) para manter a limpeza visual do grid.
- **Hover Dinâmico**: Ao passar o mouse sobre um dia, um tooltip flutuante revela o **ROAS** exato daquele período.
- **Destaque do Dia Atual**: O dia de hoje recebe um "ring" sutil e um background levemente diferenciado.

---

## 📊 Visualização Semanal (Week View)
A visão semanal é otimizada para comparação de performance entre os dias da semana atual, utilizando elementos verticais.

### Características Visuais:
- **Gráfico de Barras Vertical**: Cada célula contém uma barra de progresso vertical cuja altura representa a magnitude do lucro/prejuízo em relação ao maior valor da semana.
- **Linhas de Grade Internas**: Quatro linhas horizontais tracejadas (`border-dashed`) criam uma escala visual de profundidade atrás das barras.
- **Exposição de ROAS**: Diferente da mensal, o ROAS é exibido diretamente abaixo do valor do lucro, permitindo análise rápida sem interação.
- **Barras Coloridas**:
  - `bg-emerald-500/20`: Lucro positivo.
  - `bg-red-500/20`: Prejuízo ou gasto sem retorno.

---

## 🕒 Visualização Diária / Hoje (Today View)
Para o dia atual, o calendário se transforma em um monitor de distribuição horária.

### Características Visuais:
- **Layout de Lista Horizontal**: As horas são listadas verticalmente, com barras horizontais expandindo para a direita.
- **Barras de Distribuição**:
  - Mostram como o lucro foi gerado ao longo das 24 horas.
  - A largura da barra é proporcional à contribuição daquela hora para o lucro total do dia.
- **Tipografia Tabular**: Utiliza fontes mono-espaçadas para os valores monetários, garantindo que os números fiquem perfeitamente alinhados verticalmente.

---

## 🛠️ Especificações Técnicas Estéticas

| Elemento | Especificação |
| :--- | :--- |
| **Bordas** | `border-border/40` com `shadow-sm` |
| **Grid Desktop** | Grid gap de `1px` com fundo `bg-gray-200` (Light) ou `white/5` (Dark) para criar linhas divisórias sutis. |
| **Cores de Status** | Lucro: `text-emerald-500` \| Perjuízo: `text-red-500` |
| **Tipografia** | `tracking-tight` para títulos e `text-[10px]` para labels secundários. |
| **Transições** | `transition-all duration-500` nas barras para um efeito de carregamento suave. |

---

> [!TIP]
> O componente ajusta automaticamente sua densidade visual com base no filtro global de data, alternando entre o grid completo (`grid-cols-7`) e a lista horária de forma fluida.
