/**
 * Calendar Schemas — Validacao Zod dos payloads da edge function google-calendar.
 *
 * Diretriz arquitetural: toda entrada de dados no backend e validada via Zod.
 * O frontend e apenas UX; a fonte de verdade e o schema aqui.
 */

import { z } from 'https://esm.sh/zod@3.25.76'

const isoDateTime = z
    .string()
    .min(1, 'datetime nao pode ser vazio')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'datetime ISO 8601 invalido')

const rruleLine = z
    .string()
    .regex(/^RRULE:/i, 'linha de recorrencia deve comecar com "RRULE:"')

const meetingBase = z.object({
    workspaceId: z.string().uuid('workspaceId deve ser UUID'),
    summary: z.string().min(1, 'summary obrigatorio').max(1024),
    description: z.string().max(8192).optional(),
    startDateTime: isoDateTime,
    endDateTime: isoDateTime,
    attendees: z.array(z.string().email('email de attendee invalido')).max(200).optional(),
    timeZone: z.string().min(1).max(64).optional(),
    location: z.string().max(1024).optional(),
    addMeet: z.boolean().optional(),
    colorId: z.string().regex(/^\d{1,2}$/).optional(),
    recurrence: z.array(rruleLine).max(5).optional(),
    teamMemberIds: z.array(z.string().uuid('teamMemberId deve ser UUID')).max(200).optional(),
})

export const createMeetingSchema = meetingBase.extend({
    action: z.literal('createMeeting'),
})

export const updateMeetingSchema = meetingBase.extend({
    action: z.literal('updateMeeting'),
    eventId: z.string().min(1, 'eventId obrigatorio para updateMeeting'),
})

export const deleteMeetingSchema = z.object({
    action: z.literal('deleteMeeting'),
    workspaceId: z.string().uuid('workspaceId deve ser UUID'),
    eventId: z.string().min(1, 'eventId obrigatorio para deleteMeeting'),
})

export const listEventsSchema = z.object({
    action: z.literal('listEvents'),
    workspaceId: z.string().uuid('workspaceId deve ser UUID'),
    timeMin: isoDateTime.optional(),
    timeMax: isoDateTime.optional(),
    maxResults: z.number().int().positive().max(2500).optional(),
})

export const calendarPayloadSchema = z.discriminatedUnion('action', [
    createMeetingSchema,
    updateMeetingSchema,
    deleteMeetingSchema,
    listEventsSchema,
])

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>
export type DeleteMeetingInput = z.infer<typeof deleteMeetingSchema>
export type ListEventsInput = z.infer<typeof listEventsSchema>
export type CalendarPayload = z.infer<typeof calendarPayloadSchema>
