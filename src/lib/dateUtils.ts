/**
 * 🔥 TIMEZONE AWARE: Funções para trabalhar com datas no timezone correto
 * Evita pedir dados do futuro quando estamos em horário próximo à meia-noite
 */

/**
 * Obtém a data de hoje no timezone do Brasil (America/Sao_Paulo)
 * Garante que não estamos pedindo dados do futuro quando já passou da meia-noite em UTC
 */
export function getTodayInBrazil(): Date {
  try {
    // Usar Intl.DateTimeFormat para obter a data no timezone do Brasil
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const parts = formatter.formatToParts(now);
    
    // Construir a data no timezone do Brasil (meia-noite local)
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // month é 0-indexed
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    
    return new Date(year, month, day);
  } catch (error) {
    // Fallback: usar data local se Intl falhar
    console.warn('Erro ao obter data do Brasil, usando data local:', error);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

/**
 * Formata uma data como string YYYY-MM-DD no timezone do Brasil
 */
export function formatDateInBrazil(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const parts = formatter.formatToParts(date);
    
    const year = parts.find(p => p.type === 'year')?.value || '0';
    const month = parts.find(p => p.type === 'month')?.value || '0';
    const day = parts.find(p => p.type === 'day')?.value || '0';
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    // Fallback: usar formatação local se Intl falhar
    console.warn('Erro ao formatar data do Brasil, usando formatação local:', error);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Obtém a string de hoje no formato YYYY-MM-DD no timezone do Brasil
 */
export function getTodayStringInBrazil(): string {
  return formatDateInBrazil(getTodayInBrazil());
}

