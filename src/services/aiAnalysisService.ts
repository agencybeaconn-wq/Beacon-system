/**
 * AiAnalysisService — Frontend Client
 * 
 * Serviço ISOLADO para chamadas ao Gemini Pro via Edge Function.
 * Não tem nenhuma dependência das integrações Google OAuth.
 * 
 * Usa supabase.functions.invoke('gemini-ai', ...) — fallback enquanto Claude sem crédito. Trocar pra 'claude-ai' quando credito adicionado.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AnalysisRequest {
    prompt: string;
    temperature?: number;  // 0.0 - 1.0 (default: 0.7)
    maxTokens?: number;    // default: 8192
}

export interface AnalysisWithContextRequest extends AnalysisRequest {
    context: Record<string, unknown>;
}

export interface AnalysisResponse {
    text: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason: string;
}

// ─── Service Class ─────────────────────────────────────────────────────────────

export class AiAnalysisService {

    /**
     * Envia um prompt simples para o Gemini Pro.
     * Usa a System Instruction base configurada no backend.
     * 
     * @example
     * const result = await AiAnalysisService.analyze({
     *   prompt: 'Quais são as melhores práticas para campanhas de remarketing no Meta Ads?',
     * });
     * console.log(result.text);
     */
    static async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
        const { data, error } = await supabase.functions.invoke('gemini-ai', {
            body: {
                action: 'analyze',
                prompt: request.prompt,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
            },
        });

        if (error) throw new Error(`AI analyze failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'AI analysis failed');

        return data.data as AnalysisResponse;
    }

    /**
     * Envia um prompt com dados de contexto para análise enriquecida.
     * O contexto é formatado automaticamente no backend e injetado no prompt.
     * 
     * @example
     * const result = await AiAnalysisService.analyzeWithContext({
     *   prompt: 'Analise o desempenho deste cliente e sugira melhorias.',
     *   context: {
     *     clientName: 'Acme Corp',
     *     adSpend: 15000,
     *     leads: 142,
     *     costPerLead: 105.63,
     *     campaigns: ['Brand Awareness Q1', 'Conversão Março'],
     *   },
     * });
     */
    static async analyzeWithContext(
        request: AnalysisWithContextRequest
    ): Promise<AnalysisResponse> {
        const { data, error } = await supabase.functions.invoke('gemini-ai', {
            body: {
                action: 'analyzeWithContext',
                prompt: request.prompt,
                context: request.context,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
            },
        });

        if (error) throw new Error(`AI analyzeWithContext failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'AI analysis with context failed');

        return data.data as AnalysisResponse;
    }
}
