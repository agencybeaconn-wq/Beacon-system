/**
 * Formata dados de campanhas, conjuntos ou anúncios para análise da IA
 */

interface CampaignData {
  name: string;
  status: string;
  spent: string;
  conversions?: number;
  cpa: string;
  budget?: string;
  platform?: string;
  spentChange?: string;
  conversionChange?: string;
}

export function formatCampaignDataForAI(
  items: any[],
  entityType: 'campanhas' | 'conjuntos' | 'anuncios'
): string {
  if (!items || items.length === 0) {
    return '';
  }

  const entityName = entityType === 'campanhas' ? 'Campanha' : 
                     entityType === 'conjuntos' ? 'Conjunto' : 'Anúncio';

  // Calcular ROAS estimado (assumindo valor médio de conversão de R$ 50)
  // Nota: Em produção real, isso viria dos dados reais
  const calculateROAS = (spent: string, conversions: number) => {
    const spentValue = parseFloat(spent.replace('R$', '').replace('.', '').replace(',', '.').trim());
    const revenue = conversions * 50; // Valor médio estimado
    return (revenue / spentValue).toFixed(2);
  };

  let formattedText = `📊 DADOS PARA ANÁLISE:\n\n`;
  formattedText += `Total de ${entityType}: ${items.length}\n`;
  formattedText += `${'='.repeat(80)}\n\n`;

  items.forEach((item, index) => {
    const roas = item.conversions ? calculateROAS(item.spent, item.conversions) : 'N/A';
    
    formattedText += `${index + 1}. [${entityName}: ${item.name}]\n`;
    formattedText += `   📍 Status: ${item.status}\n`;
    
    if (item.platform) {
      formattedText += `   🎯 Plataforma: ${item.platform}\n`;
    }
    
    if (item.budget) {
      formattedText += `   💰 Orçamento: ${item.budget}\n`;
    }
    
    formattedText += `   💸 Gasto: ${item.spent}`;
    if (item.spentChange) {
      formattedText += ` (${item.spentChange})`;
    }
    formattedText += `\n`;
    
    if (item.conversions !== undefined) {
      formattedText += `   ✅ Conversões: ${item.conversions}`;
      if (item.conversionChange) {
        formattedText += ` (${item.conversionChange})`;
      }
      formattedText += `\n`;
    }
    
    formattedText += `   📈 CPA: ${item.cpa}\n`;
    formattedText += `   🎲 ROAS Estimado: ${roas}x\n`;
    formattedText += `\n`;
  });

  formattedText += `${'='.repeat(80)}\n\n`;
  formattedText += `⚠️ ATENÇÃO: Analise criticamente esses dados e forneça recomendações IMEDIATAS de otimização.\n`;

  return formattedText;
}

/**
 * Formata dados de forma compacta para o contexto do chat
 */
export function formatCampaignDataCompact(items: any[]): string {
  if (!items || items.length === 0) {
    return '';
  }

  return items.map(item => 
    `[${item.name}] Status: ${item.status} | Gasto: ${item.spent} | CPA: ${item.cpa} | Conversões: ${item.conversions || 0}`
  ).join('\n');
}

