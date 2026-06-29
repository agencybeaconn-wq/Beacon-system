import React from 'react';

interface ThinkingIndicatorProps {
    lastUserMessage?: string;
}

export function ThinkingIndicator({ lastUserMessage }: ThinkingIndicatorProps) {
    // Determine contextual message based on user input
    const getContextualMessage = () => {
        if (!lastUserMessage) return "Beacon AI está pensando...";

        const lowerMessage = lastUserMessage.toLowerCase();

        if (lowerMessage.match(/\b(criar|subir|fazer|lançar|campanha)\b/)) {
            return "Estruturando campanha...";
        }
        if (lowerMessage.match(/\b(analisar|analis|ver|como|está|desempenho|relat[oó]rio)\b/)) {
            return "Analisando dados...";
        }
        if (lowerMessage.match(/\b(ajustar|mudar|pausar|alterar|modificar|editar)\b/)) {
            return "Aplicando alterações...";
        }
        if (lowerMessage.match(/\b(buscar|procurar|encontrar|pesquisar)\b/)) {
            return "Buscando informações...";
        }

        return "Beacon AI está pensando...";
    };

    return (
        <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                {getContextualMessage()}
            </span>
        </div>
    );
}
