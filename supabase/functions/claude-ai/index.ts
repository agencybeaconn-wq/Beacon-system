/**
 * Claude AI Analysis Service — Edge Function
 *
 * Serviço ISOLADO de análise com IA via Anthropic Claude API.
 * Usa fetch() direto pra /v1/messages — sem SDK (Deno compat).
 *
 * Contrato idêntico ao gemini-ai para drop-in replacement:
 * - analyze: prompt simples
 * - analyzeWithContext: prompt + contexto estruturado
 */

import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

// ─── System Instruction ────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Você é um assistente de IA da plataforma Beacon Agency.
Sua função é analisar dados de marketing, vendas e operações para agências de marketing digital.
Responda sempre de forma objetiva, profissional e com insights acionáveis.
Quando apresentar dados numéricos, use formatação clara e organizada.
Priorize recomendações práticas que possam ser implementadas imediatamente.
Sempre em português brasileiro.`

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnalyzePayload {
    action: 'analyze'
    prompt: string
    temperature?: number
    maxTokens?: number
    model?: string
}

interface AnalyzeWithContextPayload {
    action: 'analyzeWithContext'
    prompt: string
    context: Record<string, unknown>
    temperature?: number
    maxTokens?: number
    model?: string
}

type ClaudePayload = AnalyzePayload | AnalyzeWithContextPayload

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_MAX_TOKENS = 2048
const DEFAULT_TEMPERATURE = 0.7
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// ─── Core call to Anthropic API ────────────────────────────────────────────────

async function callAnthropic(params: {
    prompt: string
    model: string
    maxTokens: number
    temperature: number
}): Promise<Record<string, unknown>> {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set')

    const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: params.model,
            max_tokens: params.maxTokens,
            temperature: params.temperature,
            system: SYSTEM_INSTRUCTION,
            messages: [{ role: 'user', content: params.prompt }],
        }),
    })

    if (!res.ok) {
        const errText = await res.text()
        let parsed: any = null
        try { parsed = JSON.parse(errText) } catch { /* ignore */ }
        const msg = parsed?.error?.message || errText || `HTTP ${res.status}`
        console.error(`[claude-ai] Anthropic API ${res.status}: model=${params.model} msg=${msg}`)
        throw new Error(`Anthropic API ${res.status}: ${msg}`)
    }

    const body = await res.json() as any
    const textBlock = Array.isArray(body.content)
        ? body.content.find((b: any) => b?.type === 'text')
        : null
    const text: string = textBlock?.text ?? ''

    return {
        text,
        usage: {
            promptTokens: body?.usage?.input_tokens ?? 0,
            completionTokens: body?.usage?.output_tokens ?? 0,
            totalTokens: (body?.usage?.input_tokens ?? 0) + (body?.usage?.output_tokens ?? 0),
        },
        finishReason: body?.stop_reason ?? 'UNKNOWN',
        model: body?.model ?? params.model,
    }
}

// ─── Analysis Functions ────────────────────────────────────────────────────────

async function analyze(
    prompt: string,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    model = DEFAULT_MODEL,
): Promise<Record<string, unknown>> {
    return await callAnthropic({ prompt, model, maxTokens, temperature })
}

async function analyzeWithContext(
    prompt: string,
    context: Record<string, unknown>,
    temperature?: number,
    maxTokens?: number,
    model?: string,
): Promise<Record<string, unknown>> {
    const contextBlock = Object.entries(context)
        .map(([key, value]) => {
            const formatted = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
            return `### ${key}\n${formatted}`
        })
        .join('\n\n')

    const enrichedPrompt = `## Dados de Contexto\n\n${contextBlock}\n\n---\n\n## Solicitação\n\n${prompt}`
    return await analyze(enrichedPrompt, temperature, maxTokens, model)
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(instrument("claude-ai", async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed. Use POST.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }

    // Auth Bearer
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
        return new Response(
            JSON.stringify({ error: 'Not authenticated' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAuth = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
        return new Response(
            JSON.stringify({ error: 'Invalid or expired token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }

    try {
        const payload: ClaudePayload = await req.json()
        const { action } = payload

        if (!payload.prompt || payload.prompt.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'prompt is required and cannot be empty' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
        }

        let result: Record<string, unknown>

        switch (action) {
            case 'analyze': {
                const { prompt, temperature, maxTokens, model } = payload as AnalyzePayload
                result = await analyze(prompt, temperature, maxTokens, model)
                break
            }

            case 'analyzeWithContext': {
                const { prompt, context, temperature, maxTokens, model } = payload as AnalyzeWithContextPayload
                if (!context || Object.keys(context).length === 0) {
                    throw new Error('context object is required for analyzeWithContext')
                }
                result = await analyzeWithContext(prompt, context, temperature, maxTokens, model)
                break
            }

            default:
                return new Response(
                    JSON.stringify({ error: `Unknown action: ${action}. Available: analyze, analyzeWithContext` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
                )
        }

        return new Response(
            JSON.stringify({ success: true, data: result }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('claude-ai error:', error)

        let status = 500
        if (message.includes('API_KEY') || message.includes('authentication')) status = 401
        else if (message.includes('429')) status = 429

        return new Response(
            JSON.stringify({ error: message }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
}))
