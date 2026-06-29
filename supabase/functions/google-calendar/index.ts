/**
 * Google Calendar Service — Edge Function
 * 
 * Operações disponíveis via campo `action` no body:
 * - createMeeting: Cria evento no Calendar com Google Meet link e convites por email.
 * - listEvents: Lista eventos futuros do calendário (opcional, para uso futuro).
 * 
 * Usa getValidToken() para autenticação transparente.
 */

import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getValidToken, createSupabaseAdmin } from '../_shared/google-auth.ts'
import { calendarPayloadSchema } from '../_shared/calendar-schemas.ts'
import { syncMeetingReminders, deleteMeetingReminders, notifyAttendeesAdded } from './reminders.ts'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CreateMeetingPayload {
    action: 'createMeeting' | 'updateMeeting'
    workspaceId: string
    eventId?: string            // only required for updateMeeting
    summary: string
    description?: string
    startDateTime: string       // ISO 8601 format
    endDateTime: string         // ISO 8601 format
    attendees?: string[]        // Array of email addresses
    timeZone?: string           // e.g. 'America/Sao_Paulo'
    location?: string
    addMeet?: boolean           // whether to create/keep Google Meet link
    colorId?: string            // Google Calendar color ID (1-11)
    recurrence?: string[]       // RRULE array, ex: ['RRULE:FREQ=WEEKLY']
    teamMemberIds?: string[]    // IDs de team_members vinculados (para lembrete WhatsApp)
}

interface ListEventsPayload {
    action: 'listEvents'
    workspaceId: string
    timeMin?: string        // ISO 8601 — defaults to now
    timeMax?: string        // ISO 8601
    maxResults?: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

// ─── Calendar Operations ───────────────────────────────────────────────────────

async function createMeeting(
    accessToken: string,
    payload: CreateMeetingPayload
): Promise<Record<string, unknown>> {
    const {
        summary,
        description,
        startDateTime,
        endDateTime,
        attendees,
        timeZone = 'America/Sao_Paulo',
        location,
        addMeet = true,
        colorId,
        recurrence,
    } = payload

    const isUpdate = payload.action === 'updateMeeting'

    // Em update, fazer lookup ANTES de montar o body — precisamos saber se o evento ja tem Meet
    // para nao reenviar conferenceData.createRequest (Google rejeita com 400 em evento que ja tem Meet).
    // Tambem redireciona o PATCH pro master event se for instancia expandida (caso contrario o Google
    // ignora o campo `recurrence` silenciosamente).
    let targetEventId = payload.eventId
    let existing: Record<string, unknown> | null = null
    if (isUpdate && payload.eventId) {
        const lookupRes = await fetch(
            `${CALENDAR_API_BASE}/calendars/primary/events/${payload.eventId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (lookupRes.ok) {
            existing = await lookupRes.json()
            const recurringEventId = (existing as { recurringEventId?: string })?.recurringEventId
            if (recurringEventId) {
                console.log(`[google-calendar] redirecting PATCH to master event ${recurringEventId}`)
                targetEventId = recurringEventId
                const masterRes = await fetch(
                    `${CALENDAR_API_BASE}/calendars/primary/events/${recurringEventId}`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                )
                if (masterRes.ok) {
                    existing = await masterRes.json()
                }
            }
        } else {
            const lookupBody = await lookupRes.text()
            console.error(`[google-calendar] lookup failed ${lookupRes.status}: ${lookupBody}`)
        }
    }

    const existingConference = existing?.conferenceData as { conferenceId?: string } | undefined
    const existingHasMeet = !!(existing?.hangoutLink || existingConference?.conferenceId)

    const event: Record<string, unknown> = {
        summary,
        description: description || '',
        start: {
            dateTime: startDateTime,
            timeZone,
        },
        end: {
            dateTime: endDateTime,
            timeZone,
        },
        // Reminders
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 30 },
                { method: 'popup', minutes: 10 },
            ],
        },
    }

    // Color
    if (colorId) {
        event.colorId = colorId
    }

    // Recorrência (RRULE). Se array vazio ou undefined em update → remove recorrência.
    if (recurrence && recurrence.length > 0) {
        event.recurrence = recurrence
    } else if (isUpdate) {
        event.recurrence = null
    }

    // Google Meet — regras por caso:
    //  create + addMeet=true                    → criar (createRequest)
    //  update + addMeet=true  + ja tem Meet     → NAO enviar conferenceData (preserva o existente)
    //  update + addMeet=true  + nao tem Meet    → criar (createRequest)
    //  update + addMeet=false + ja tem Meet     → enviar null para remover
    //  update + addMeet=false + nao tem Meet    → nao enviar conferenceData
    if (isUpdate) {
        if (addMeet && !existingHasMeet) {
            event.conferenceData = {
                createRequest: {
                    requestId: crypto.randomUUID(),
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            }
        } else if (!addMeet && existingHasMeet) {
            event.conferenceData = null
        }
    } else if (addMeet) {
        event.conferenceData = {
            createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        }
    }

    if (location) {
        event.location = location
    } else if (isUpdate) {
        event.location = ''
    }

    if (attendees && attendees.length > 0) {
        event.attendees = attendees.map((email: string) => ({ email }))
    } else if (isUpdate) {
        event.attendees = []
    }

    const params = new URLSearchParams({
        conferenceDataVersion: '1',  // Required to create Meet link
        sendUpdates: 'all',          // Send email invitations to attendees
    })

    console.log(`[google-calendar] ${payload.action} body:`, JSON.stringify({
        eventId: targetEventId,
        recurrence: event.recurrence,
        summary: event.summary,
    }))

    const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/primary/events${isUpdate && targetEventId ? `/${targetEventId}` : ''}?${params.toString()}`,
        {
            method: isUpdate ? 'PATCH' : 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
        }
    )

    if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[google-calendar] ${payload.action} failed:`, response.status, errorBody)
        throw new Error(`Calendar ${payload.action} failed (${response.status}): ${errorBody}`)
    }

    const created = await response.json()

    // Extract Meet link from response
    const meetLink = created.conferenceData?.entryPoints?.find(
        (ep: Record<string, string>) => ep.entryPointType === 'video'
    )?.uri || null

    return {
        eventId: created.id,
        htmlLink: created.htmlLink,
        meetLink,
        status: created.status,
        summary: created.summary,
        start: created.start,
        end: created.end,
        attendees: created.attendees || [],
    }
}

async function listEvents(
    accessToken: string,
    payload: ListEventsPayload
): Promise<Record<string, unknown>> {
    const {
        timeMin = new Date().toISOString(),
        timeMax,
        maxResults = 20,
    } = payload

    const params = new URLSearchParams({
        timeMin,
        maxResults: String(maxResults),
        singleEvents: 'true',
        orderBy: 'startTime',
    })

    if (timeMax) {
        params.set('timeMax', timeMax)
    }

    const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/primary/events?${params.toString()}`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Calendar listEvents failed: ${JSON.stringify(error)}`)
    }

    return await response.json()
}

async function deleteMeeting(
    accessToken: string,
    eventId: string
): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({ sendUpdates: 'all' })
    const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}?${params.toString()}`,
        {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    )

    if (!response.ok && response.status !== 204) {
        const error = await response.text()
        throw new Error(`Calendar deleteMeeting failed: ${error}`)
    }

    return { deleted: true, eventId }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(instrument("google-calendar", async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const rawPayload = await req.json()
        const parsed = calendarPayloadSchema.safeParse(rawPayload)

        if (!parsed.success) {
            const details = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
            console.error('[google-calendar] payload invalido:', details)
            return new Response(
                JSON.stringify({ error: `Payload invalido: ${details}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const payload = parsed.data
        const { action, workspaceId } = payload

        const supabase = createSupabaseAdmin()
        const accessToken = await getValidToken(supabase, workspaceId)

        let result: Record<string, unknown>

        switch (action) {
            case 'createMeeting':
            case 'updateMeeting': {
                const meetingPayload = payload as CreateMeetingPayload
                result = await createMeeting(accessToken, meetingPayload)

                // Sync lembretes WhatsApp. Falha aqui NAO deve quebrar a operacao de calendario.
                const googleEventId = (result.eventId as string | undefined) ?? meetingPayload.eventId
                if (googleEventId) {
                    try {
                        const syncResult = await syncMeetingReminders(supabase, {
                            workspaceId,
                            googleEventId,
                            teamMemberIds: meetingPayload.teamMemberIds ?? [],
                            summary: meetingPayload.summary,
                            meetLink: (result.meetLink as string | null) ?? null,
                            startDateTime: meetingPayload.startDateTime,
                            recurrence: meetingPayload.recurrence ?? null,
                        })
                        console.log(`[google-calendar] reminders sync → deleted=${syncResult.deleted} inserted=${syncResult.inserted} skipped=${syncResult.skipped.length}`)
                        result.reminders = syncResult
                    } catch (remErr) {
                        console.error('[google-calendar] reminders sync falhou:', remErr)
                        result.reminders = { error: remErr instanceof Error ? remErr.message : 'unknown' }
                    }

                    // Notificacao imediata aos vinculados (na criacao ou re-vinculacao).
                    try {
                        const notifyResult = await notifyAttendeesAdded(supabase, {
                            workspaceId,
                            teamMemberIds: meetingPayload.teamMemberIds ?? [],
                            summary: meetingPayload.summary,
                            startDateTime: meetingPayload.startDateTime,
                            meetLink: (result.meetLink as string | null) ?? null,
                            action,
                            recurrence: meetingPayload.recurrence ?? null,
                        })
                        console.log(`[google-calendar] notify on-create → sent=${notifyResult.sent} skipped=${notifyResult.skipped}`)
                        result.notify = notifyResult
                    } catch (notifyErr) {
                        console.error('[google-calendar] notify on-create falhou:', notifyErr)
                        result.notify = { error: notifyErr instanceof Error ? notifyErr.message : 'unknown' }
                    }
                }
                break
            }

            case 'listEvents': {
                result = await listEvents(accessToken, payload as ListEventsPayload)
                break
            }

            case 'deleteMeeting': {
                // Limpa lembretes locais ANTES de chamar o Google (CASCADE na FK faria sozinho,
                // mas tambem removemos o google_event_id caso a FK seja por workspace apenas).
                await deleteMeetingReminders(supabase, workspaceId, payload.eventId)
                result = await deleteMeeting(accessToken, payload.eventId)
                break
            }
        }

        return new Response(
            JSON.stringify({ success: true, data: result }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('google-calendar error:', error)
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}))
