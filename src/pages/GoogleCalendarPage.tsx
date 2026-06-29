/**
 * Google Calendar — Full Calendar View Page
 * 
 * Layout estilo Google Calendar com:
 * - Vista semanal/diária com time slots por hora
 * - Eventos como blocos coloridos
 * - Modal de criação ao clicar num horário
 * - Seleção de membros da equipe com avatar e cores
 * - Integração com Google Meet
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GoogleIntegrationService } from "@/services/googleIntegrationService";
import { useAgencyTeam } from "@/hooks/useAgencyTeam";
import { useDashboard } from "@/contexts/DashboardContext";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Video,
    MapPin,
    Users,
    Clock,
    ExternalLink,
    Loader2,
    AlertCircle,
    X,
    Check,
    Pencil,
    Building2,
    Tag,
    Trash2,
    Sparkles,
    Repeat,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 - 23:00

// Paleta oficial — as mesmas cores do gabarito de calls. `value` coincide com CALL_TYPES.value
// pra permitir auto-sync quando o tipo é escolhido (linha na criação de evento).
const EVENT_COLORS = [
    { label: 'Comercial',    value: 'comercial',    solid: '#E53935', googleColorId: '11' },
    { label: 'Alinhamento',  value: 'alinhamento',  solid: '#1E88E5', googleColorId: '9'  },
    { label: 'Briefing',     value: 'briefing',     solid: '#43A047', googleColorId: '10' },
    { label: 'Sócios',       value: 'socios',       solid: '#FDD835', googleColorId: '5'  },
    { label: 'Daily',        value: 'daily',        solid: '#AB47BC', googleColorId: '3'  },
    { label: 'X1',           value: 'x1',           solid: '#FF7043', googleColorId: '6'  },
    { label: 'Treinamento',  value: 'treinamento',  solid: '#26C6DA', googleColorId: '7'  },
    { label: 'Apresentação', value: 'apresentacao', solid: '#EC407A', googleColorId: '4'  },
    { label: 'Fechamento',   value: 'fechamento',   solid: '#8D6E63', googleColorId: '8'  },
    { label: 'Externo',      value: 'externo',      solid: '#78909C', googleColorId: '8'  },
];

// Gabarito oficial Lever Agency — Guia de Calls (cores hex do PDF).
const CALL_TYPES = [
    { value: 'comercial',    label: 'Call Comercial',              color: '#E53935' },
    { value: 'alinhamento',  label: 'Call de Alinhamento',         color: '#1E88E5' },
    { value: 'briefing',     label: 'Call de Briefing',            color: '#43A047' },
    { value: 'socios',       label: 'Reunião de Sócios',           color: '#FDD835' },
    { value: 'daily',        label: 'Daily da Equipe',             color: '#AB47BC' },
    { value: 'x1',           label: 'Call X1 (1:1)',               color: '#FF7043' },
    { value: 'treinamento',  label: 'Treinamento de Equipe',       color: '#26C6DA' },
    { value: 'apresentacao', label: 'Call de Apresentação',        color: '#EC407A' },
    { value: 'fechamento',   label: 'Call de Fechamento',          color: '#8D6E63' },
    { value: 'externo',      label: 'Reunião Externa / Parceiro',  color: '#78909C' },
];

// Tags antigas (pré-gabarito) → value canônico. Aplicado só na leitura — não reescreve o evento remoto.
const LEGACY_TYPE_MAP: Record<string, string> = {
    mensal:       'alinhamento',
    onboarding:   'fechamento',
    revisao:      'alinhamento',
    planejamento: 'socios',
    resultados:   'apresentacao',
    interna:      'socios',
    outro:        'externo',
};

function resolveCallType(rawValue: string | undefined | null) {
    if (!rawValue) return null;
    const v = rawValue.toLowerCase().trim();
    const canonical = LEGACY_TYPE_MAP[v] ?? v;
    return CALL_TYPES.find(t => t.value === canonical) ?? null;
}

// Opções de recorrência exibidas no modal. Mesma ordem do Google Calendar nativo.
const RECURRENCE_OPTIONS = [
    { value: 'none',     label: 'Não se repete' },
    { value: 'daily',    label: 'Todos os dias' },
    { value: 'weekdays', label: 'Dias úteis (seg-sex)' },
    { value: 'weekly',   label: 'Semanal' },
    { value: 'monthly',  label: 'Mensal' },
    { value: 'yearly',   label: 'Anual' },
] as const;

type RecurrenceValue = typeof RECURRENCE_OPTIONS[number]['value'];

// Converte opção do form → array de RRULE aceito pela Google Calendar API.
function recurrenceToRRule(value: RecurrenceValue): string[] | undefined {
    switch (value) {
        case 'daily':    return ['RRULE:FREQ=DAILY'];
        case 'weekdays': return ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'];
        case 'weekly':   return ['RRULE:FREQ=WEEKLY'];
        case 'monthly':  return ['RRULE:FREQ=MONTHLY'];
        case 'yearly':   return ['RRULE:FREQ=YEARLY'];
        default:         return undefined;
    }
}

// Inverso: lê o array retornado pelo Google e devolve a opção correspondente pra pré-carregar o form.
function rRuleToRecurrence(rules: string[] | undefined | null): RecurrenceValue {
    if (!rules || rules.length === 0) return 'none';
    const rule = rules.find(r => r.startsWith('RRULE:')) || '';
    const upper = rule.toUpperCase();
    if (upper.includes('FREQ=DAILY')) return 'daily';
    if (upper.includes('FREQ=WEEKLY') && upper.includes('BYDAY=MO,TU,WE,TH,FR')) return 'weekdays';
    if (upper.includes('FREQ=WEEKLY')) return 'weekly';
    if (upper.includes('FREQ=MONTHLY')) return 'monthly';
    if (upper.includes('FREQ=YEARLY')) return 'yearly';
    return 'none';
}
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const MEMBER_COLORS = [
    { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-300", solid: "#8b5cf6" },
    { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-300", solid: "#3b82f6" },
    { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", solid: "#10b981" },
    { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-300", solid: "#f59e0b" },
    { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-300", solid: "#f43f5e" },
    { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-300", solid: "#06b6d4" },
    { bg: "bg-pink-500/20", border: "border-pink-500/40", text: "text-pink-300", solid: "#ec4899" },
    { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-300", solid: "#f97316" },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    htmlLink: string;
    hangoutLink?: string;
    conferenceData?: {
        entryPoints?: Array<{ entryPointType: string; uri: string }>;
    };
    attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
    colorId?: string;
    location?: string;
    recurrence?: string[];
}

interface TeamMember {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
    colorIndex: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getWeekDays(date: Date): Date[] {
    const d = new Date(date);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(start);
        dd.setDate(start.getDate() + i);
        return dd;
    });
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatHour(h: number) {
    return `${String(h).padStart(2, "0")}:00`;
}

function getEventPosition(event: CalendarEvent, dayStart: Date) {
    const start = new Date(event.start.dateTime || event.start.date || "");
    const end = new Date(event.end.dateTime || event.end.date || "");
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = Math.max(0, startHour * 64); // 64px per hour, from midnight
    const height = Math.max(30, (endHour - startHour) * 64);
    return { top, height, startHour, endHour };
}

function getMeetLink(event: CalendarEvent): string | null {
    if (event.hangoutLink) return event.hangoutLink;
    return event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === "video")?.uri || null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function GoogleCalendarPage() {
    const { toast } = useToast();
    const { workspaceId } = useDashboard();
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Calendar navigation
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<"week" | "month">("week");

    // Events
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    // New event modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [eventForm, setEventForm] = useState({
        summary: "",
        description: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        attendees: [] as string[],
        location: "",
        addMeet: true,
        color: 'alinhamento',
        clientId: '' as string,
        callType: '' as string,
        isExternalClient: false,
        recurrence: 'none' as RecurrenceValue,
    });

    // Agency clients for selector
    const [agencyClients, setAgencyClients] = useState<{ id: string; name: string }[]>([]);
    useEffect(() => {
        if (!workspaceId) return;
        supabase.from('agency_clients').select('id, name').eq('workspace_id', workspaceId).eq('is_archived', false).order('name')
            .then(({ data }) => setAgencyClients(data || []));
    }, [workspaceId]);

    // Scroll ref so we can auto-scroll to current time
    const timeGridRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (timeGridRef.current) {
            const now = new Date();
            const scrollTo = Math.max(0, (now.getHours() - 1) * 64);
            timeGridRef.current.scrollTop = scrollTo;
        }
    }, [isConnected, viewMode]);


    // Event detail popup
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Team members
    const { members: rawTeamMembers } = useAgencyTeam();
    const teamMembers: TeamMember[] = useMemo(() => {
        return rawTeamMembers
            .filter(m => m.user_id && !m.user_id.startsWith("invited_"))
            .map((m, i) => ({
                id: m.user_id,
                name: m.profile?.full_name || "Membro",
                email: m.email || "",
                avatarUrl: m.profile?.avatar_url || undefined,
                colorIndex: i % MEMBER_COLORS.length,
            }));
    }, [rawTeamMembers]);

    // Selected attendees for new event
    const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
    const [attendeeEmail, setAttendeeEmail] = useState("");
    const [clientSearch, setClientSearch] = useState("");

    // ─── Init ────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (workspaceId) {
            loadConnectionStatus();
        }
    }, [workspaceId]);

    useEffect(() => {
        if (isConnected && workspaceId) loadEvents();
    }, [isConnected, workspaceId, currentDate]);

    async function loadConnectionStatus() {
        if (!workspaceId) return;
        try {
            setIsLoading(true);

            const { data: conn } = await (supabase as any)
                .from("google_connections")
                .select("id, status")
                .eq("workspace_id", workspaceId)
                .eq("status", "connected")
                .maybeSingle();
            setIsConnected(!!conn);

        } catch (err) {
            console.error("Error loading connection:", err);
        } finally {
            setIsLoading(false);
        }
    }

    // ─── Events ──────────────────────────────────────────────────────────────────

    async function loadEvents() {
        if (!workspaceId) return;
        setLoadingEvents(true);
        try {
            // Always fetch the entire month so week navigation doesn't lose events
            const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            timeMax.setHours(23, 59, 59, 999);

            const result = await GoogleIntegrationService.listEvents(
                workspaceId,
                timeMin.toISOString(),
                timeMax.toISOString(),
                200
            );
            setEvents((result as any).items || []);
        } catch (err: any) {
            console.error("Error loading events:", err);
        } finally {
            setLoadingEvents(false);
        }
    }

    // ─── Create Event ────────────────────────────────────────────────────────────

    function openCreateModal(date?: Date, hour?: number) {
        const d = date || new Date();
        const h = hour ?? d.getHours();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const startTime = `${String(h).padStart(2, "0")}:00`;
        const endTime = `${String(h + 1).padStart(2, "0")}:00`;

        setEventForm({
            summary: "",
            description: "",
            startDate: dateStr,
            startTime,
            endDate: dateStr,
            endTime,
            attendees: [],
            location: "",
            addMeet: true,
            color: 'alinhamento',
            clientId: '',
            callType: '',
            isExternalClient: false,
            recurrence: 'none',
        });
        setSelectedAttendees([]);
        setAttendeeEmail("");
        setEditingEvent(null);
        setSelectedSlot({ date: d, hour: h });
        setShowCreateModal(true);
    }

    function openEditModal(event: CalendarEvent) {
        const start = new Date(event.start.dateTime || event.start.date || '');
        const end = new Date(event.end.dateTime || event.end.date || '');
        const dateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const timeStr = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        // Parse metadata from description if stored
        const desc = event.description || '';
        const clientMatch = desc.match(/\[client:([^\]]+)\]/);
        const typeMatch = desc.match(/\[type:([^\]]+)\]/);
        const cleanDesc = desc.replace(/\[(client|type):[^\]]+\]/g, '').trim();
        setEventForm({
            summary: event.summary || '',
            description: cleanDesc,
            startDate: dateStr(start),
            startTime: timeStr(start),
            endDate: dateStr(end),
            endTime: timeStr(end),
            attendees: (event.attendees || []).map(a => a.email).filter(e => !teamMembers.some(m => m.email === e)),
            location: event.location || '',
            addMeet: !!getMeetLink(event),
            color: (resolveCallType(typeMatch?.[1])?.value) || 'alinhamento',
            clientId: clientMatch?.[1] || '',
            isExternalClient: clientMatch?.[1] === 'external',
            callType: typeMatch?.[1] || '',
            recurrence: rRuleToRecurrence(event.recurrence),
        });

        // Map team members that are present in the event to selectedAttendees state
        const teamAttendees = (event.attendees || [])
            .map(a => teamMembers.find(m => m.email && m.email === a.email)?.id)
            .filter(Boolean) as string[];
        setSelectedAttendees(teamAttendees);

        setAttendeeEmail('');
        setEditingEvent(event);
        setSelectedSlot(null);
        setShowCreateModal(true);
    }

    async function handleCreateEvent() {
        if (!workspaceId || !eventForm.summary || !eventForm.startDate || !eventForm.startTime) {
            toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
            return;
        }

        setCreatingEvent(true);
        try {
            const startDateTime = `${eventForm.startDate}T${eventForm.startTime}:00-03:00`;
            const endDate = eventForm.endDate || eventForm.startDate;
            const endTime = eventForm.endTime || (() => {
                const [h, m] = eventForm.startTime.split(":");
                return `${String(Math.min(23, Number(h) + 1)).padStart(2, "0")}:${m}`;
            })();
            const endDateTime = `${endDate}T${endTime}:00-03:00`;

            // Combine team member emails + manual emails
            const allAttendees: string[] = [];
            selectedAttendees.forEach(memberId => {
                const member = teamMembers.find(m => m.id === memberId);
                if (member?.email) allAttendees.push(member.email);
            });
            eventForm.attendees.forEach(email => {
                if (!allAttendees.includes(email)) allAttendees.push(email);
            });

            // Map color value (stored for display only; colorId not in MeetingData type)
            // Build enriched description with metadata tags
            const metaTags = [
                eventForm.clientId ? `[client:${eventForm.clientId}]` : eventForm.isExternalClient ? '[client:external]' : '',
                eventForm.callType ? `[type:${eventForm.callType}]` : '',
            ].filter(Boolean).join(' ');
            const descriptionFull = [eventForm.description, metaTags].filter(Boolean).join('\n');

            // Get Google Calendar colorId
            const selectedColor = EVENT_COLORS.find(c => c.value === eventForm.color);
            const googleColorId = selectedColor?.googleColorId;
            const recurrenceRule = recurrenceToRRule(eventForm.recurrence);

            const teamMemberIds = selectedAttendees.length > 0 ? [...selectedAttendees] : undefined;

            let result;
            if (editingEvent) {
                result = await GoogleIntegrationService.updateMeeting(workspaceId, editingEvent.id, {
                    summary: eventForm.summary,
                    description: descriptionFull,
                    startDateTime,
                    endDateTime,
                    attendees: allAttendees.length > 0 ? allAttendees : undefined,
                    timeZone: "America/Sao_Paulo",
                    location: eventForm.location || undefined,
                    addMeet: eventForm.addMeet,
                    colorId: googleColorId,
                    recurrence: recurrenceRule,
                    teamMemberIds,
                });
            } else {
                result = await GoogleIntegrationService.createMeeting(workspaceId, {
                    summary: eventForm.summary,
                    description: descriptionFull,
                    startDateTime,
                    endDateTime,
                    attendees: allAttendees.length > 0 ? allAttendees : undefined,
                    timeZone: "America/Sao_Paulo",
                    location: eventForm.location || undefined,
                    addMeet: eventForm.addMeet,
                    colorId: googleColorId,
                    recurrence: recurrenceRule,
                    teamMemberIds,
                });
            }

            const meetLink = result.meetLink;
            toast({
                title: editingEvent ? "✅ Evento atualizado!" : "✅ Evento criado!",
                description: meetLink ? `Google Meet: ${meetLink}` : "Evento salvo no Google Calendar.",
            });

            setShowCreateModal(false);
            loadEvents();
        } catch (err: any) {
            toast({ title: "Erro ao criar evento", description: err.message, variant: "destructive" });
        } finally {
            setCreatingEvent(false);
        }
    }

    function toggleAttendee(memberId: string) {
        setSelectedAttendees(prev =>
            prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
        );
    }

    function addManualAttendee() {
        if (!attendeeEmail.trim() || !attendeeEmail.includes("@")) return;
        setEventForm(prev => ({
            ...prev,
            attendees: [...prev.attendees, attendeeEmail.trim()],
        }));
        setAttendeeEmail("");
    }

    async function handleDeleteEvent(event: CalendarEvent) {
        if (!workspaceId) return;
        if (!confirm('Tem certeza que deseja excluir este evento? Isso também cancelará os convites enviados.')) return;
        try {
            await GoogleIntegrationService.deleteMeeting(workspaceId, event.id);
            toast({ title: '🗑️ Evento excluído com sucesso!' });
            setSelectedEvent(null);
            loadEvents();
        } catch (err: any) {
            toast({ title: 'Erro ao excluir evento', description: err.message, variant: 'destructive' });
        }
    }

    // ─── Navigation ──────────────────────────────────────────────────────────────

    function navigatePrev() {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
        else d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    }

    function navigateNext() {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
        else d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    }

    function goToToday() {
        setCurrentDate(new Date());
    }

    // ─── Computed ────────────────────────────────────────────────────────────────

    const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
    const today = new Date();

    // For month view: get all days of current month
    const monthDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: Date[] = [];
        // Pad start with days from prev month
        for (let i = 0; i < firstDay.getDay(); i++) {
            const d = new Date(firstDay);
            d.setDate(firstDay.getDate() - (firstDay.getDay() - i));
            days.push(d);
        }
        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push(new Date(year, month, d));
        }
        // Pad end
        while (days.length % 7 !== 0) {
            const last = days[days.length - 1];
            const next = new Date(last);
            next.setDate(last.getDate() + 1);
            days.push(next);
        }
        return days;
    }, [currentDate]);

    const daysToShow = weekDays; // always week for the time-grid; month view uses monthDays separately

    // Monthly analysis
    const monthEvents = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return events.filter(e => {
            const d = new Date(e.start.dateTime || e.start.date || '');
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }, [events, currentDate]);

    function getEventsForDay(day: Date) {
        return events.filter(e => {
            const eventDate = new Date(e.start.dateTime || e.start.date || "");
            return isSameDay(eventDate, day);
        });
    }

    function getEventColor(event: CalendarEvent) {
        // 1. Prioridade: tag de tipo na description ([type:xxx]) — gabarito manda.
        const desc = event.description || '';
        const typeMatch = desc.match(/\[type:([^\]]+)\]/);
        if (typeMatch) {
            const resolved = resolveCallType(typeMatch[1]);
            if (resolved) {
                const ec = EVENT_COLORS.find(c => c.value === resolved.value);
                if (ec) return ec;
            }
        }
        // 2. Fallback: Google colorId salvo no evento.
        const googleIdToValue: Record<string, string> = {
            '11': 'comercial',
            '9':  'alinhamento',
            '10': 'briefing',
            '5':  'socios',
            '3':  'daily',
            '6':  'x1',
            '7':  'treinamento',
            '4':  'apresentacao',
            '8':  'fechamento',
        };
        if (event.colorId) {
            const val = googleIdToValue[event.colorId];
            const ec = val ? EVENT_COLORS.find(c => c.value === val) : null;
            if (ec) return ec;
        }
        // 3. Último recurso: hash do summary → uma cor determinística.
        const hash = (event.summary || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return EVENT_COLORS[hash % EVENT_COLORS.length];
    }

    // ─── Render ──────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">Google Calendar</h1>
                <p className="text-muted-foreground mb-8">Gerencie sua agenda e reuniões.</p>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-8 text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                    <h3 className="text-lg font-semibold">Google não conectado</h3>
                    <p className="text-muted-foreground text-sm">
                        Conecte sua conta Google em <strong>Configurações → Conexões</strong>.
                    </p>
                    <Button onClick={() => window.location.href = "/settings?tab=Conexões"} className="bg-blue-600 hover:bg-blue-700">
                        Ir para Conexões
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            {/* ─── Header ───────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <CalendarIcon className="w-5 h-5 text-blue-500" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Agenda</h1>
                    </div>

                    <Button variant="outline" size="sm" onClick={goToToday} className="text-xs font-medium">
                        Hoje
                    </Button>

                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <h2 className="text-lg font-semibold text-foreground">
                        {viewMode === 'month'
                            ? `${MONTHS_PT[currentDate.getMonth()]} de ${currentDate.getFullYear()}`
                            : `${MONTHS_PT[weekDays[0].getMonth()]} de ${weekDays[0].getFullYear()}`
                        }
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {loadingEvents && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

                    <div className="flex rounded-lg border border-border/50 overflow-hidden">
                        <button
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
                            onClick={() => setViewMode("week")}
                        >
                            Semana
                        </button>
                        <button
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
                            onClick={() => setViewMode("month")}
                        >
                            Mês
                        </button>
                    </div>

                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openCreateModal()}>
                        <Plus className="w-4 h-4 mr-1" /> Criar
                    </Button>
                </div>
            </div>

            {/* ─── Body: Sidebar + Calendar ─────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT SIDEBAR */}
                <div className="w-64 shrink-0 border-r border-border/40 flex flex-col overflow-y-auto bg-muted/[0.03]">
                    {/* Mini Calendar */}
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold">{MONTHS_PT[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}</span>
                            <div className="flex gap-0.5">
                                <button onClick={navigatePrev} className="w-6 h-6 rounded hover:bg-muted/50 flex items-center justify-center">
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={navigateNext} className="w-6 h-6 rounded hover:bg-muted/50 flex items-center justify-center">
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        {/* Day row headers */}
                        <div className="grid grid-cols-7 mb-1">
                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-0.5">{d}</div>
                            ))}
                        </div>
                        {/* Mini calendar days */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {monthDays.map((day, i) => {
                                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                const isToday2 = isSameDay(day, today);
                                const dayEvts = getEventsForDay(day);
                                const hasEvents = dayEvts.length > 0;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => { setCurrentDate(day); setViewMode('week'); }}
                                        className={`relative w-7 h-7 rounded-full text-[11px] font-medium flex flex-col items-center justify-center transition-colors mx-auto
                                            ${isToday2 ? 'bg-blue-600 text-white' : isCurrentMonth ? 'hover:bg-muted/50 text-foreground' : 'text-muted-foreground/30'}`}
                                    >
                                        {day.getDate()}
                                        {hasEvents && !isToday2 && (
                                            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Gabarito de cores — legenda do guia de calls */}
                    <div className="px-4 pb-5 pt-4 border-t border-border/30">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Gabarito</p>
                        <div className="space-y-1">
                            {CALL_TYPES.map(ct => (
                                <div key={ct.value} className="flex items-center gap-2 text-[11px] text-foreground/80 py-1 px-1.5 rounded hover:bg-muted/20">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />
                                    <span className="truncate">{ct.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>


                {/* MAIN CALENDAR AREA */}
                <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>

                    {viewMode === 'month' ? (
                        /* ── MONTH GRID VIEW ─────────────────────────────────── */
                        <div className="flex-1 overflow-auto p-4">
                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                                    <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1">{d}</div>
                                ))}
                            </div>
                            {/* Month day cells */}
                            <div className="grid grid-cols-7 gap-1" style={{ gridAutoRows: 'minmax(90px, 1fr)' }}>
                                {monthDays.map((day, i) => {
                                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                    const isToday = isSameDay(day, today);
                                    const dayEvents = getEventsForDay(day);
                                    return (
                                        <div
                                            key={i}
                                            className={`rounded-lg border border-border/20 p-1.5 flex flex-col cursor-pointer hover:bg-muted/20 transition-colors ${isToday ? 'border-blue-500/50 bg-blue-500/5' : isCurrentMonth ? 'bg-muted/[0.03]' : 'opacity-40'
                                                }`}
                                            onClick={() => openCreateModal(day)}
                                        >
                                            <span className={`text-xs font-bold self-end w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-foreground'
                                                }`}>{day.getDate()}</span>
                                            <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
                                                {dayEvents.slice(0, 3).map(evt => {
                                                    const color = getEventColor(evt);
                                                    return (
                                                        <div
                                                            key={evt.id}
                                                            className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer border-l-2"
                                                            style={{
                                                                backgroundColor: `${color.solid}26`,
                                                                borderLeftColor: color.solid,
                                                                color: color.solid,
                                                            }}
                                                            onClick={e => { e.stopPropagation(); setSelectedEvent(evt); }}
                                                        >{evt.summary}</div>
                                                    );
                                                })}
                                                {dayEvents.length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} mais</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* ── WEEK TIME GRID ──────────────────────────────────── */
                        <>
                            {/* Day Headers - compact */}
                            <div className="flex border-b border-border/40 shrink-0">
                                {/* Time gutter */}
                                <div className="w-[64px] shrink-0" />

                                {
                                    daysToShow.map((day, i) => {
                                        const isToday = isSameDay(day, today);
                                        return (
                                            <div
                                                key={i}
                                                className={`flex-1 text-center py-1 border-l border-border/20 cursor-pointer hover:bg-muted/20 transition-colors ${isToday ? "bg-blue-500/5" : ""}`}
                                                onClick={() => { setCurrentDate(day); }}
                                            >
                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                                    {DAYS_PT[day.getDay()]}
                                                </span>
                                                <div className={`text-xl font-bold ${isToday ? "bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto" : "text-foreground"}`}>
                                                    {day.getDate()}
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>

                            {/* Time Grid */}
                            <div ref={timeGridRef} className="flex-1 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
                                <div className="flex" style={{ minWidth: '700px' }}>
                                    {/* Time Labels */}
                                    <div className="w-[64px] shrink-0 sticky left-0 z-10 bg-background">
                                        {HOURS.map(h => (
                                            <div key={h} className={`h-[64px] flex items-start justify-end pr-3 ${h === 0 ? 'pt-2' : 'pt-0'}`}>
                                                <span className={`text-[11px] text-muted-foreground/50 font-medium tabular-nums ${h === 0 ? '' : '-mt-2'}`}>
                                                    {formatHour(h)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Day Columns */}
                                    {daysToShow.map((day, dayIdx) => {
                                        const dayEvents = getEventsForDay(day);
                                        const isToday = isSameDay(day, today);

                                        return (
                                            <div
                                                key={dayIdx}
                                                className={`flex-1 relative border-l border-border/20 ${isToday ? "bg-blue-500/[0.02]" : ""}`}
                                            >
                                                {/* Hour lines */}
                                                {HOURS.map((h, hIdx) => (
                                                    <div
                                                        key={h}
                                                        className={`h-[64px] border-b border-border/10 hover:bg-white/[0.03] transition-colors cursor-pointer group ${hIdx % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                                                        onClick={() => openCreateModal(day, h)}
                                                    >
                                                        <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Plus className="w-4 h-4 text-muted-foreground/30" />
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Current time line */}
                                                {isToday && (() => {
                                                    const now = new Date();
                                                    const minutes = now.getHours() * 64 + Math.round(now.getMinutes() * 64 / 60);
                                                    if (minutes < 0) return null;
                                                    return (
                                                        <div
                                                            className="absolute left-0 right-0 z-20 pointer-events-none"
                                                            style={{ top: `${minutes}px` }}
                                                        >
                                                            <div className="flex items-center">
                                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                                                                <div className="flex-1 h-[2px] bg-red-500" />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Events */}
                                                {dayEvents.map((event) => {
                                                    const pos = getEventPosition(event, day);
                                                    const color = getEventColor(event);
                                                    const meetLink = getMeetLink(event);

                                                    return (
                                                        <div
                                                            key={event.id}
                                                            className="absolute left-1.5 right-1.5 rounded-lg px-2.5 py-1.5 cursor-pointer transition-all hover:shadow-lg hover:brightness-110 z-10 border-l-[3px]"
                                                            style={{
                                                                top: `${pos.top}px`,
                                                                height: `${pos.height}px`,
                                                                minHeight: "24px",
                                                                backgroundColor: `${color.solid}26`,
                                                                borderLeftColor: color.solid,
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                                                        >
                                                            <div className="flex flex-col h-full overflow-hidden">
                                                                <span className="text-xs font-semibold truncate" style={{ color: color.solid }}>
                                                                    {event.summary}
                                                                </span>
                                                                {pos.height > 40 && (
                                                                    <span className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                                        {new Date(event.start.dateTime || "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                                        {" – "}
                                                                        {new Date(event.end.dateTime || "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                                    </span>
                                                                )}
                                                                {pos.height > 60 && meetLink && (
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        <Video className="w-3 h-3 text-blue-400" />
                                                                        <span className="text-[10px] text-blue-400">Meet</span>
                                                                    </div>
                                                                )}
                                                                {pos.height > 80 && event.attendees && event.attendees.length > 0 && (
                                                                    <div className="flex items-center gap-0.5 mt-1">
                                                                        <Users className="w-3 h-3 text-muted-foreground" />
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {event.attendees.length}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>

            {/* ─── Event Details Modal (Read-Only) ─────────────────────────────────────── */}
            <Dialog open={!!selectedEvent && !showCreateModal} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
                <DialogContent className="sm:max-w-lg p-0 border-none bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                    {selectedEvent && (() => {
                        const meetLink = getMeetLink(selectedEvent);
                        const desc = selectedEvent.description || '';
                        const clientMatch = desc.match(/\[client:([^\]]+)\]/);
                        const typeMatch = desc.match(/\[type:([^\]]+)\]/);
                        const cleanDesc = desc.replace(/\[(client|type):[^\]]+\]/g, '').trim();
                        const rawType = typeMatch?.[1]?.toLowerCase().trim();
                        const resolvedType = resolveCallType(rawType);
                        const typeLabel = resolvedType?.label || (rawType && rawType !== 'outro' ? rawType : null);
                        const clientName = clientMatch?.[1] === 'external'
                            ? 'Externo (não cliente)'
                            : clientMatch?.[1]
                                ? agencyClients.find(c => c.id === clientMatch[1])?.name || null
                                : null;

                        const teamAtt = (selectedEvent.attendees || [])
                            .map(a => teamMembers.find(m => m.email && m.email.toLowerCase() === (a.email || '').toLowerCase()))
                            .filter(Boolean) as typeof teamMembers;
                        const externalCount = (selectedEvent.attendees || []).length - teamAtt.length;
                        const eventColor = getEventColor(selectedEvent);

                        return (
                            <>
                                <div className="h-2 w-full" style={{ backgroundColor: eventColor.solid || '#3b82f6' }} />
                                <div className="p-6 space-y-5">
                                    <DialogHeader className="p-0">
                                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground leading-tight">{selectedEvent.summary}</DialogTitle>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {typeLabel && (
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-1">
                                                    <Tag className="w-3 h-3" />{typeLabel}
                                                </span>
                                            )}
                                            {clientName && (
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-1">
                                                    <Building2 className="w-3 h-3" />{clientName}
                                                </span>
                                            )}
                                        </div>
                                    </DialogHeader>

                                    <div className="flex items-center gap-3 text-sm bg-muted/20 rounded-xl p-3">
                                        <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                                        <div>
                                            <p className="text-foreground font-medium">
                                                {new Date(selectedEvent.start.dateTime || "").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                                            </p>
                                            <p className="text-muted-foreground text-xs mt-0.5">
                                                {new Date(selectedEvent.start.dateTime || "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                {" – "}
                                                {new Date(selectedEvent.end.dateTime || "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    </div>

                                    {meetLink && (
                                        <div className="flex items-center gap-3 bg-blue-500/10 rounded-xl p-3">
                                            <Video className="w-4 h-4 text-blue-400 shrink-0" />
                                            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline truncate font-medium">
                                                Entrar no Google Meet
                                            </a>
                                        </div>
                                    )}

                                    {(teamAtt.length > 0 || externalCount > 0) && (
                                        <div className="space-y-2.5">
                                            <div className="flex items-center gap-2 text-sm text-foreground font-semibold">
                                                <Users className="w-4 h-4 text-blue-400 shrink-0" />
                                                <span>{(selectedEvent.attendees || []).length} Participantes</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pl-6">
                                                {teamAtt.map((t, i) => (
                                                    <div key={i} className="flex items-center gap-1.5 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-2.5 py-1 font-medium">
                                                        <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                                            {t.name[0]?.toUpperCase()}
                                                        </div>
                                                        <span className="truncate max-w-[130px]">{t.name}</span>
                                                    </div>
                                                ))}
                                                {externalCount > 0 && (
                                                    <div className="flex items-center gap-1.5 text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-full px-2.5 py-1 font-medium">
                                                        <Users className="w-3 h-3" />
                                                        <span>+{externalCount} Externos</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {cleanDesc && (
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/10 rounded-xl p-3 border border-border/20">
                                            {cleanDesc}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-2 pt-3 border-t border-border/20">
                                        {meetLink && (
                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                                                <a href={meetLink} target="_blank" rel="noopener noreferrer">
                                                    <Video className="w-4 h-4 mr-1.5" /> Entrar no Meet
                                                </a>
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => { const evt = selectedEvent; setSelectedEvent(null); openEditModal(evt!); }}>
                                            <Pencil className="w-4 h-4 mr-1.5" /> Editar
                                        </Button>
                                        <Button variant="outline" size="sm" asChild>
                                            <a href={selectedEvent.htmlLink} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir no Calendar
                                            </a>
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteEvent(selectedEvent!)}>
                                            <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
                                        </Button>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* ─── Create/Edit Event Modal ────────────────────────────────────────────── */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-none bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
                    {/* Modal Header + Title */}
                    <div className="px-8 pt-8 pb-4">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                {editingEvent ? 'Editar Evento' : 'Novo Evento'}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="mt-6">
                            <Input
                                placeholder="Adicionar título do evento"
                                value={eventForm.summary}
                                onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
                                className="text-2xl font-bold border-0 border-b-2 border-border/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-500 h-14 bg-transparent placeholder:text-muted-foreground/30 transition-colors"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Client Selector */}
                    <div className="px-8 py-5 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Cliente</span>
                        </div>
                        <div className="pl-12 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setEventForm(prev => ({ ...prev, clientId: '', isExternalClient: false }))}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${!eventForm.clientId && !eventForm.isExternalClient
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                        : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
                                        }`}
                                >Nenhum cliente</button>
                                <button
                                    onClick={() => setEventForm(prev => ({ ...prev, clientId: '', isExternalClient: true }))}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${eventForm.isExternalClient
                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                        : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
                                        }`}
                                >Não é cliente do sistema</button>
                            </div>
                            {agencyClients.length > 0 && (
                                <>
                                    <Input
                                        placeholder="Pesquisar cliente..."
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                        className="h-8 text-xs bg-muted/20 border-border/30 rounded-lg"
                                    />
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                        {agencyClients
                                            .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                                            .map(client => (
                                                <button
                                                    key={client.id}
                                                    onClick={() => setEventForm(prev => ({ ...prev, clientId: client.id, isExternalClient: false }))}
                                                    className={`px-3 py-2 rounded-xl text-xs font-medium border-2 text-left transition-all truncate ${eventForm.clientId === client.id
                                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                                        : 'bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/30 hover:border-border/50'
                                                        }`}
                                                >{client.name}</button>
                                            ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Call Type Selector */}
                    <div className="px-8 py-4 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <Tag className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Tipo de Reunião</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-12">
                            {CALL_TYPES.map(ct => {
                                const active = eventForm.callType === ct.value;
                                return (
                                    <button
                                        key={ct.value}
                                        type="button"
                                        onClick={() => setEventForm(prev => ({
                                            ...prev,
                                            callType: active ? '' : ct.value,
                                            // Auto-sincroniza cor com o tipo (gabarito oficial).
                                            color: active ? prev.color : ct.value,
                                        }))}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all hover:brightness-125"
                                        style={{
                                            borderColor: active ? ct.color : 'rgba(255,255,255,0.08)',
                                            backgroundColor: active ? `${ct.color}26` : 'rgba(255,255,255,0.03)',
                                            color: active ? ct.color : 'rgba(255,255,255,0.65)',
                                        }}
                                    >
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: ct.color }}
                                        />
                                        {ct.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="px-8 py-5 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Data e Horário</span>
                        </div>
                        <div className="grid grid-cols-2 gap-6 pl-12">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Início</Label>
                                <div className="flex gap-2">
                                    <Input type="date" value={eventForm.startDate} onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value, endDate: eventForm.endDate || e.target.value })} className="h-11 text-sm" />
                                    <Input type="time" value={eventForm.startTime} onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })} className="h-11 text-sm w-28" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Fim</Label>
                                <div className="flex gap-2">
                                    <Input type="date" value={eventForm.endDate} onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })} className="h-11 text-sm" />
                                    <Input type="time" value={eventForm.endTime} onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })} className="h-11 text-sm w-28" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recurrence */}
                    <div className="px-8 py-4 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <Repeat className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Repetição</span>
                        </div>
                        <div className="pl-12">
                            <select
                                aria-label="Repetição do evento"
                                title="Repetição do evento"
                                value={eventForm.recurrence}
                                onChange={(e) => setEventForm({ ...eventForm, recurrence: e.target.value as RecurrenceValue })}
                                className="h-11 w-full sm:w-72 px-3 rounded-md border border-border/40 bg-muted/10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                            >
                                {RECURRENCE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Team Members Section */}
                    <div className="px-8 py-5 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Participantes da Equipe</span>
                            {selectedAttendees.length > 0 && (
                                <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full font-semibold">
                                    {selectedAttendees.length} selecionados
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-12">
                            {teamMembers.map(member => {
                                const isSelected = selectedAttendees.includes(member.id);
                                const color = MEMBER_COLORS[member.colorIndex];
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => toggleAttendee(member.id)}
                                        className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium transition-all border-2 text-left ${isSelected
                                            ? `${color.bg} ${color.border} ${color.text} shadow-sm`
                                            : "bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/30 hover:border-border/50"
                                            }`}
                                    >
                                        <Avatar className="w-8 h-8 shrink-0">
                                            <AvatarImage src={member.avatarUrl} referrerPolicy="no-referrer" />
                                            <AvatarFallback className="text-[10px] font-bold" style={{ backgroundColor: color.solid + "30", color: color.solid }}>
                                                {member.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate flex-1">{member.name}</span>
                                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* External Attendees */}
                    <div className="px-8 py-5 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Convidados Externos</span>
                        </div>
                        <div className="pl-12 space-y-3">
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Digite o email do convidado e pressione Enter"
                                    value={attendeeEmail}
                                    onChange={(e) => setAttendeeEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addManualAttendee()}
                                    className="h-11 text-sm flex-1"
                                />
                                <Button variant="outline" className="h-11 px-4" onClick={addManualAttendee}>
                                    <Plus className="w-4 h-4 mr-1.5" /> Adicionar
                                </Button>
                            </div>
                            {eventForm.attendees.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {eventForm.attendees.map((email, i) => (
                                        <span key={i} className="text-sm bg-muted/30 rounded-lg px-3 py-1.5 flex items-center gap-2 border border-border/30">
                                            {email}
                                            <button onClick={() => setEventForm(prev => ({ ...prev, attendees: prev.attendees.filter((_, j) => j !== i) }))} className="hover:text-red-400 transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Google Meet & Location Row */}
                    <div className="px-8 py-5 border-t border-border/20">
                        <div className="flex items-start gap-5 pl-12">
                            <button
                                onClick={() => setEventForm(prev => ({ ...prev, addMeet: !prev.addMeet }))}
                                className={`flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium transition-all border-2 shrink-0 ${eventForm.addMeet
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-sm"
                                    : "bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/30"
                                    }`}
                            >
                                <Video className="w-5 h-5" />
                                <div className="text-left">
                                    <div className="font-semibold">Google Meet</div>
                                    <div className="text-[11px] opacity-70">Videoconferência automática</div>
                                </div>
                                {eventForm.addMeet && <Check className="w-4 h-4 ml-2" />}
                            </button>

                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Local</Label>
                                </div>
                                <Input
                                    placeholder="Sala, endereço ou link"
                                    value={eventForm.location}
                                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                                    className="h-11 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div className="px-8 py-4 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (EVENT_COLORS.find(c => c.value === eventForm.color) || EVENT_COLORS[0]).solid + '22' }}>
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: (EVENT_COLORS.find(c => c.value === eventForm.color) || EVENT_COLORS[0]).solid }} />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Cor do Evento</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-12">
                            {EVENT_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setEventForm(prev => ({ ...prev, color: c.value }))}
                                    title={c.label}
                                    className={`w-7 h-7 rounded-full transition-all border-2 ${eventForm.color === c.value ? 'scale-110 border-white/80 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                                        }`}
                                    style={{ backgroundColor: c.solid }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="px-8 py-5 border-t border-border/20">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Descrição</span>
                        </div>
                        <div className="pl-12">
                            <Textarea
                                placeholder="Descreva a pauta da reunião, adicione links úteis ou observações..."
                                value={eventForm.description}
                                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                                rows={4}
                                className="text-sm resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-5 border-t border-border/20 bg-muted/10 flex items-center justify-between rounded-b-lg">
                        <p className="text-xs text-muted-foreground">
                            {eventForm.addMeet && "🔗 Link do Google Meet será gerado automaticamente"}
                        </p>
                        <div className="flex gap-3">
                            <Button variant="outline" size="lg" onClick={() => setShowCreateModal(false)} className="px-6">
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCreateEvent}
                                disabled={creatingEvent || !eventForm.summary}
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700 px-8 font-semibold"
                            >
                                {creatingEvent ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                                ) : editingEvent ? (
                                    <><Check className="w-4 h-4 mr-2" /> Salvar Alterações</>
                                ) : (
                                    <><CalendarIcon className="w-4 h-4 mr-2" /> Criar Evento</>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

        </div >
    );
}
