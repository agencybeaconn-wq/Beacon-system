// ════════════════════════════════════════════════════════════════════════════
// _shared/logger.ts — Carimbo unico de observabilidade do Lever-System.
//
// Toda edge function registra aqui o que tentou fazer, com qual resultado.
// Grava na tabela `system_logs`. Duas APIs:
//   1. createLogger(fn) → log.success / log.failure / log.critical / log.warn / log.info
//   2. instrument(fn, handler) → envolve o Deno.serve e captura erros nao tratados
//
// Regras de ouro:
//   • NUNCA lanca excecao: falha de log nao pode derrubar a funcao de negocio.
//   • SO grava em PRODUCAO: runs locais/dev nao poluem a tabela nem alertam.
//   • Sanitiza PII no context (telefone, email, token, etc.).
// ════════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type Severity = 'info' | 'warn' | 'error' | 'critical'
export type LogStatus = 'success' | 'failure' | 'partial'
export type Environment = 'production' | 'staging' | 'local'

// Header que uma function pode setar na Response pra avisar o instrument()
// que ja logou explicitamente — evita log duplicado do mesmo 5xx.
export const LOGGED_HEADER = 'x-system-logged'

// ── Deteccao de ambiente ─────────────────────────────────────────────────────
// Override explicito via LEVER_ENV; senao deduz pela SUPABASE_URL (local tem
// localhost/kong). Em producao (URL https://<ref>.supabase.co) → 'production'.
// Assim funciona out-of-the-box no deploy e auto-pula em dev, sem secret extra.
function detectEnvironment(): Environment {
    const override = Deno.env.get('LEVER_ENV')
    if (override === 'production' || override === 'staging' || override === 'local') {
        return override
    }
    const url = Deno.env.get('SUPABASE_URL') || ''
    if (/localhost|127\.0\.0\.1|kong|host\.docker\.internal/i.test(url)) {
        return 'local'
    }
    return 'production'
}

export const ENVIRONMENT: Environment = detectEnvironment()

// ── Client service_role (singleton lazy) ─────────────────────────────────────
let _client: SupabaseClient | null = null
function getClient(): SupabaseClient | null {
    if (_client) return _client
    const url = Deno.env.get('SUPABASE_URL') || ''
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!url || !key) return null
    _client = createClient(url, key, { auth: { persistSession: false } })
    return _client
}

// ── Utilitarios ──────────────────────────────────────────────────────────────

interface NormalizedError {
    name: string
    message: string
    stack?: string
}

function normalizeError(err: unknown): NormalizedError | null {
    if (err === null || err === undefined) return null
    if (err instanceof Error) {
        return { name: err.name, message: err.message, stack: err.stack?.slice(0, 4000) }
    }
    if (typeof err === 'string') return { name: 'Error', message: err }
    try {
        return { name: 'Error', message: JSON.stringify(err).slice(0, 2000) }
    } catch {
        return { name: 'Error', message: String(err) }
    }
}

// Hash FNV-1a 32-bit (sincrono, deterministico) pra agrupar erros recorrentes.
function fnv1a(str: string): string {
    let h = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(16).padStart(8, '0')
}

// Normaliza a mensagem antes de hashear: "lead 123" e "lead 456" viram a mesma
// assinatura. Remove uuids e numeros pra agrupar recorrencias do mesmo erro.
function normalizeForSignature(msg: string): string {
    return msg
        .toLowerCase()
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>')
        .replace(/\d+/g, '<n>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
}

function computeSignature(functionName: string, action: string, err: NormalizedError | null, message: string): string {
    const base = `${functionName}|${action}|${err?.name ?? ''}|${normalizeForSignature(err?.message ?? message)}`
    return fnv1a(base)
}

// Sanitizacao de PII no context. Mascara valores de chaves sensiveis e trunca
// strings/arrays grandes. JEB: nunca logar PII crua no payload.
const SENSITIVE_KEYS = /(senha|password|pass_|token|secret|apikey|api_key|authorization|^auth$|cpf|cnpj|email|telefone|phone|whatsapp_number|phone_number)/i

function sanitize(value: unknown, depth = 0): unknown {
    if (depth > 4) return '<deep>'
    if (value === null || value === undefined) return value
    if (typeof value === 'string') return value.length > 500 ? value.slice(0, 500) + '…' : value
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1))
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = SENSITIVE_KEYS.test(k) ? '<redacted>' : sanitize(v, depth + 1)
        }
        return out
    }
    return String(value)
}

// ── API do logger ────────────────────────────────────────────────────────────

export interface LogInput {
    action: string
    message: string
    workspaceId?: string | null
    context?: Record<string, unknown>
    error?: unknown
    requestId?: string
    durationMs?: number
    severity?: Severity
}

export interface Logger {
    write(status: LogStatus, severity: Severity, input: LogInput): Promise<void>
    success(input: LogInput): Promise<void>
    partial(input: LogInput): Promise<void>
    failure(input: LogInput): Promise<void>
    critical(input: LogInput): Promise<void>
    warn(input: LogInput): Promise<void>
    info(input: LogInput): Promise<void>
}

export function createLogger(functionName: string): Logger {
    async function write(status: LogStatus, severity: Severity, input: LogInput): Promise<void> {
        try {
            const err = normalizeError(input.error)
            const sev = input.severity ?? severity

            // Em dev/local: so console, nunca grava na tabela de producao.
            if (ENVIRONMENT !== 'production') {
                const tag = `[${functionName}] ${status}/${sev} ${input.action}: ${input.message}`
                if (sev === 'error' || sev === 'critical') console.error(tag, err ?? '')
                else console.log(tag)
                return
            }

            const client = getClient()
            if (!client) {
                console.error(`[logger] sem SUPABASE_URL/SERVICE_ROLE_KEY — log perdido: ${functionName} ${input.action}`)
                return
            }

            const row = {
                function_name: functionName,
                action: input.action,
                status,
                severity: sev,
                workspace_id: input.workspaceId ?? null,
                message: input.message,
                context: sanitize(input.context ?? {}) as Record<string, unknown>,
                error: err,
                error_signature: computeSignature(functionName, input.action, err, input.message),
                request_id: input.requestId ?? null,
                environment: ENVIRONMENT,
                duration_ms: input.durationMs ?? null,
            }

            const { error: insertError } = await client.from('system_logs').insert(row)
            if (insertError) {
                console.error(`[logger] falha ao gravar system_logs (${functionName}):`, insertError.message)
            }
        } catch (loggerErr) {
            // Blindagem final: logger NUNCA propaga erro pro caller.
            console.error(`[logger] erro interno (${functionName}):`, loggerErr)
        }
    }

    return {
        write,
        success: (input) => write('success', 'info', input),
        partial: (input) => write('partial', 'warn', input),
        failure: (input) => write('failure', 'error', input),
        critical: (input) => write('failure', 'critical', input),
        warn: (input) => write('partial', 'warn', input),
        info: (input) => write('success', 'info', input),
    }
}

// ── Wrapper instrument() ─────────────────────────────────────────────────────
// Envolve o handler do Deno.serve. Da observabilidade-base em 1 linha por
// function: gera request_id, mede duracao, captura excecao nao tratada e loga
// respostas 5xx. Nao loga preflight (OPTIONS) nem respostas < 500.

// info = 2o argumento que o Deno.serve/serve passam (ServeHandlerInfo: remoteAddr
// etc.). O wrapper repassa TUDO pro handler pra nao alterar o comportamento.
type Handler = (req: Request, info?: unknown) => Promise<Response> | Response

export function instrument(functionName: string, handler: Handler): Handler {
    return async (req: Request, info?: unknown): Promise<Response> => {
        const requestId = crypto.randomUUID()
        const started = Date.now()
        const log = createLogger(functionName)
        let path = req.url
        try {
            path = new URL(req.url).pathname
        } catch {
            // mantem req.url
        }

        try {
            const res = await handler(req, info)

            // Se a function ja logou explicitamente, nao duplica o 5xx.
            const alreadyLogged = res.headers.get(LOGGED_HEADER) === '1'
            if (res.status >= 500 && !alreadyLogged) {
                await log.failure({
                    action: `${req.method} ${path}`,
                    message: `HTTP ${res.status}`,
                    severity: 'error',
                    requestId,
                    durationMs: Date.now() - started,
                    context: { method: req.method, status: res.status },
                })
            }
            return res
        } catch (err) {
            // Excecao nao tratada: registra e RE-LANCA, preservando 100% o
            // comportamento original da function (nao engole, nao troca a resposta).
            await log.critical({
                action: `${req.method} ${path}`,
                message: err instanceof Error ? err.message : 'Erro nao tratado',
                error: err,
                requestId,
                durationMs: Date.now() - started,
            })
            throw err
        }
    }
}
