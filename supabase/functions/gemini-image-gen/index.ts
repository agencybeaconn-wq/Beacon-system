import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

Deno.serve(instrument("gemini-image-gen", async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
        return new Response(
            JSON.stringify({ error: 'Not authenticated' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const isServiceRole = token === serviceRoleKey

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
        const {
            prompt,
            model = 'gemini-2.5-flash-image',
            aspectRatio = '1:1',
            referenceImages = [],
        } = await req.json()

        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured')
        }

        if (!prompt || prompt.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'prompt is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Build parts: reference images first, then text prompt
        const parts: Record<string, unknown>[] = []

        for (const ref of referenceImages as { base64: string; mimeType: string }[]) {
            if (ref.base64 && ref.mimeType) {
                parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } })
            }
        }

        // Append aspect ratio instruction to prompt
        const aspectInstruction = aspectRatio !== '1:1'
            ? `\n\nIMPORTANT: Generate the image in ${aspectRatio} aspect ratio.`
            : '\n\nIMPORTANT: Generate the image in square 1:1 aspect ratio.'
        parts.push({ text: prompt + aspectInstruction })

        const geminiUrl = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`
        const geminiBody = {
            contents: [{ parts }],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
            },
        }

        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiBody),
        })

        if (!geminiRes.ok) {
            const errText = await geminiRes.text()
            console.error('Gemini API error:', errText)
            throw new Error(`Gemini API error (${geminiRes.status}): ${errText}`)
        }

        const geminiData = await geminiRes.json()

        const candidates = geminiData.candidates || []
        if (candidates.length === 0) {
            throw new Error('No candidates returned from Gemini')
        }

        const resParts = candidates[0].content?.parts || []
        const imagePart = resParts.find((p: { inlineData?: { mimeType: string } }) =>
            p.inlineData?.mimeType?.startsWith('image/')
        )
        const textPart = resParts.find((p: { text?: string }) => p.text)

        if (!imagePart?.inlineData) {
            const reason = candidates[0].finishReason || 'unknown'
            const safetyRatings = candidates[0].safetyRatings || []
            const blocked = safetyRatings.some((r: { probability: string }) =>
                r.probability === 'HIGH' || r.probability === 'MEDIUM'
            )
            throw new Error(
                blocked
                    ? 'A imagem foi bloqueada por filtros de seguranca. Tente um prompt diferente.'
                    : `Gemini nao retornou imagem (reason: ${reason}). Tente reformular o prompt.`
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                imageBase64: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
                textResponse: textPart?.text || null,
                driveFileId: null,
                driveUrl: null,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('gemini-image-gen error:', error)

        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}))
