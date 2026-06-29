/**
 * Gemini AI Analysis Service — Edge Function
 * 
 * Serviço ISOLADO de análise com IA (sem dependência de Google OAuth).
 * Usa a lib @google/generative-ai com o modelo gemini-1.5-pro.
 * 
 * Ações disponíveis via campo `action` no body:
 * - analyze: Enviar prompt simples
 * - analyzeWithContext: Enviar prompt + dados de contexto (cliente, métricas, etc.)
 * 
 * A System Instruction base é definida na constante SYSTEM_INSTRUCTION.
 */

import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

// ─── System Instruction (placeholder para definição futura) ────────────────────

const SYSTEM_INSTRUCTION = `Você é um assistente de IA da plataforma Beacon Agency.
Sua função é analisar dados de marketing, vendas e operações para agências de marketing digital.
Responda sempre de forma objetiva, profissional e com insights acionáveis.
Quando apresentar dados numéricos, use formatação clara e organizada.
Priorize recomendações práticas que possam ser implementadas imediatamente.`

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnalyzePayload {
    action: 'analyze'
    prompt: string
    temperature?: number
    maxTokens?: number
}

interface AnalyzeWithContextPayload {
    action: 'analyzeWithContext'
    prompt: string
    context: Record<string, unknown>
    temperature?: number
    maxTokens?: number
}

type GeminiPayload = AnalyzePayload | AnalyzeWithContextPayload

// ─── Gemini Client Factory ─────────────────────────────────────────────────────

function createGeminiModel(temperature = 0.7, maxTokens = 8192) {
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set')
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    return genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            topP: 0.95,
            topK: 40,
        },
    })
}

// ─── Analysis Functions ────────────────────────────────────────────────────────

async function analyze(
    prompt: string,
    temperature?: number,
    maxTokens?: number
): Promise<Record<string, unknown>> {
    const model = createGeminiModel(temperature, maxTokens)
    const result = await model.generateContent(prompt)
    const response = result.response

    return {
        text: response.text(),
        usage: {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
        finishReason: response.candidates?.[0]?.finishReason || 'UNKNOWN',
    }
}

async function analyzeWithContext(
    prompt: string,
    context: Record<string, unknown>,
    temperature?: number,
    maxTokens?: number
): Promise<Record<string, unknown>> {
    // Build enriched prompt with structured context
    const contextBlock = Object.entries(context)
        .map(([key, value]) => {
            const formattedValue = typeof value === 'object'
                ? JSON.stringify(value, null, 2)
                : String(value)
            return `### ${key}\n${formattedValue}`
        })
        .join('\n\n')

    const enrichedPrompt = `## Dados de Contexto\n\n${contextBlock}\n\n---\n\n## Solicitação\n\n${prompt}`

    return await analyze(enrichedPrompt, temperature, maxTokens)
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(instrument("gemini-ai", async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Only accept POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed. Use POST.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // --- AUTH: Validate the requesting user ---
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
        return new Response(
            JSON.stringify({ error: 'Not authenticated' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Service role key bypass (pra scripts de backend, cron, triage, etc)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const isServiceRole = !!serviceRoleKey && token === serviceRoleKey

    if (!isServiceRole) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '')
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
    }

    try {
        const payload: GeminiPayload = await req.json()
        const { action } = payload

        if (!payload.prompt || payload.prompt.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'prompt is required and cannot be empty' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let result: Record<string, unknown>

        switch (action) {
            case 'analyze': {
                const { prompt, temperature, maxTokens } = payload as AnalyzePayload
                result = await analyze(prompt, temperature, maxTokens)
                break
            }

            case 'analyzeWithContext': {
                const { prompt, context, temperature, maxTokens } = payload as AnalyzeWithContextPayload
                if (!context || Object.keys(context).length === 0) {
                    throw new Error('context object is required for analyzeWithContext')
                }
                result = await analyzeWithContext(prompt, context, temperature, maxTokens)
                break
            }

            default:
                return new Response(
                    JSON.stringify({ error: `Unknown action: ${action}. Available: analyze, analyzeWithContext` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
        }

        return new Response(
            JSON.stringify({ success: true, data: result }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('gemini-ai error:', error)

        const status = message.includes('API_KEY') ? 401 : 500
        return new Response(
            JSON.stringify({ error: message }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}))
