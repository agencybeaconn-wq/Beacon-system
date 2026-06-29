/**
 * Google Ferramentas — Página de gestão Google Calendar e Google Drive
 * 
 * Permite criar reuniões, listar eventos, gerenciar arquivos no Drive.
 * Usa os serviços GoogleIntegrationService e edge functions.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GoogleIntegrationService } from "@/services/googleIntegrationService";
import {
    Calendar,
    HardDrive,
    Video,
    Plus,
    RefreshCw,
    ChevronDown,
    Clock,
    MapPin,
    Users,
    FileUp,
    FolderPlus,
    ExternalLink,
    Loader2,
    Link2,
    AlertCircle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    htmlLink: string;
    hangoutLink?: string;
    conferenceData?: {
        entryPoints?: Array<{ entryPointType: string; uri: string }>;
    };
    attendees?: Array<{ email: string; responseStatus?: string }>;
}

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    size?: string;
    webViewLink?: string;
    iconLink?: string;
}

import { useDashboard } from "@/contexts/DashboardContext";

export default function GoogleTools() {
    const { toast } = useToast();
    const { workspaceId } = useDashboard();
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Calendar state
    const [calendarOpen, setCalendarOpen] = useState(true);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [creatingMeeting, setCreatingMeeting] = useState(false);
    const [meetingForm, setMeetingForm] = useState({
        summary: "",
        description: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        attendees: "",
        location: "",
    });

    // Drive state
    const [driveOpen, setDriveOpen] = useState(true);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    // ─── Init ────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (workspaceId) {
            loadConnectionStatus();
        }
    }, [workspaceId]);

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

    // ─── Calendar Functions ──────────────────────────────────────────────────────

    async function loadEvents() {
        if (!workspaceId) return;
        setLoadingEvents(true);
        try {
            const result = await GoogleIntegrationService.listEvents(workspaceId, undefined, undefined, 20);
            setEvents((result as any).items || []);
        } catch (err: any) {
            toast({ title: "Erro ao carregar eventos", description: err.message, variant: "destructive" });
        } finally {
            setLoadingEvents(false);
        }
    }

    async function handleCreateMeeting() {
        if (!workspaceId) return;
        if (!meetingForm.summary || !meetingForm.startDate || !meetingForm.startTime) {
            toast({ title: "Preencha os campos obrigatórios", description: "Título, data e hora são obrigatórios.", variant: "destructive" });
            return;
        }

        setCreatingMeeting(true);
        try {
            const startDateTime = `${meetingForm.startDate}T${meetingForm.startTime}:00-03:00`;
            const endDate = meetingForm.endDate || meetingForm.startDate;
            const endTime = meetingForm.endTime || (() => {
                const [h, m] = meetingForm.startTime.split(":");
                return `${String(Number(h) + 1).padStart(2, "0")}:${m}`;
            })();
            const endDateTime = `${endDate}T${endTime}:00-03:00`;

            const attendees = meetingForm.attendees
                ? meetingForm.attendees.split(",").map(e => e.trim()).filter(Boolean)
                : undefined;

            const result = await GoogleIntegrationService.createMeeting(workspaceId, {
                summary: meetingForm.summary,
                description: meetingForm.description,
                startDateTime,
                endDateTime,
                attendees,
                timeZone: "America/Sao_Paulo",
                location: meetingForm.location || undefined,
            });

            toast({
                title: "✅ Reunião criada!",
                description: result.meetLink
                    ? `Link do Meet: ${result.meetLink}`
                    : "Evento criado no Google Calendar.",
            });

            // Reset form
            setMeetingForm({ summary: "", description: "", startDate: "", startTime: "", endDate: "", endTime: "", attendees: "", location: "" });

            // Reload events
            loadEvents();
        } catch (err: any) {
            toast({ title: "Erro ao criar reunião", description: err.message, variant: "destructive" });
        } finally {
            setCreatingMeeting(false);
        }
    }

    // ─── Drive Functions ─────────────────────────────────────────────────────────

    async function loadFiles() {
        if (!workspaceId) return;
        setLoadingFiles(true);
        try {
            const result = await GoogleIntegrationService.listClientFiles(workspaceId);
            setFiles(result.files || []);
        } catch (err: any) {
            toast({ title: "Erro ao carregar arquivos", description: err.message, variant: "destructive" });
        } finally {
            setLoadingFiles(false);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!workspaceId || !e.target.files?.length) return;
        setUploadingFile(true);
        try {
            const file = e.target.files[0];
            await GoogleIntegrationService.uploadFile(workspaceId, file);
            toast({ title: "✅ Arquivo enviado!", description: `${file.name} foi enviado para o Google Drive.` });
            loadFiles();
        } catch (err: any) {
            toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
        } finally {
            setUploadingFile(false);
            e.target.value = "";
        }
    }

    async function handleCreateFolder() {
        if (!workspaceId || !newFolderName.trim()) return;
        setCreatingFolder(true);
        try {
            await GoogleIntegrationService.createFolder(workspaceId, newFolderName.trim());
            toast({ title: "✅ Pasta criada!", description: `Pasta "${newFolderName}" criada no Google Drive.` });
            setNewFolderName("");
            loadFiles();
        } catch (err: any) {
            toast({ title: "Erro ao criar pasta", description: err.message, variant: "destructive" });
        } finally {
            setCreatingFolder(false);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    function formatDateTime(dt: string | undefined) {
        if (!dt) return "—";
        return new Date(dt).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }

    function formatFileSize(bytes: string | undefined) {
        if (!bytes) return "";
        const size = parseInt(bytes);
        if (size < 1024) return `${size} B`;
        if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / 1048576).toFixed(1)} MB`;
    }

    function getMeetLink(event: CalendarEvent): string | null {
        if (event.hangoutLink) return event.hangoutLink;
        return event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === "video")?.uri || null;
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
                <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">Google Ferramentas</h1>
                <p className="text-muted-foreground mb-8">Gerencie Calendar e Drive integrados ao seu workspace.</p>
                <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-6 text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                        <h3 className="text-lg font-semibold">Google não conectado</h3>
                        <p className="text-muted-foreground text-sm">
                            Conecte sua conta Google em <strong>Configurações → Conexões</strong> para usar Calendar e Drive.
                        </p>
                        <Button onClick={() => window.location.href = "/settings?tab=Conexões"} className="bg-blue-600 hover:bg-blue-700">
                            Ir para Conexões
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Google Ferramentas</h1>
                <p className="text-muted-foreground mt-1">Gerencie Calendar, Meet e Drive integrados ao seu workspace.</p>
            </div>

            {/* ─── CALENDAR SECTION ─────────────────────────────────────────────────── */}
            <Collapsible open={calendarOpen} onOpenChange={setCalendarOpen}>
                <Card className="border-border/50">
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Google Calendar</CardTitle>
                                        <CardDescription>Crie reuniões com Google Meet e veja eventos agendados</CardDescription>
                                    </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
                            </div>
                        </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <CardContent className="space-y-6 pt-0">
                            {/* Create Meeting Form */}
                            <div className="rounded-lg border border-border/50 p-4 space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Nova Reunião
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <Label>Título *</Label>
                                        <Input
                                            placeholder="Ex: Reunião com cliente"
                                            value={meetingForm.summary}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, summary: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <Label>Data início *</Label>
                                        <Input
                                            type="date"
                                            value={meetingForm.startDate}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label>Hora início *</Label>
                                        <Input
                                            type="time"
                                            value={meetingForm.startTime}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, startTime: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <Label>Data fim</Label>
                                        <Input
                                            type="date"
                                            value={meetingForm.endDate}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, endDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label>Hora fim</Label>
                                        <Input
                                            type="time"
                                            value={meetingForm.endTime}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, endTime: e.target.value })}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <Label>Descrição</Label>
                                        <Textarea
                                            placeholder="Descreva a pauta da reunião..."
                                            value={meetingForm.description}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                                            rows={2}
                                        />
                                    </div>

                                    <div>
                                        <Label>Convidados (emails separados por vírgula)</Label>
                                        <Input
                                            placeholder="email1@gmail.com, email2@gmail.com"
                                            value={meetingForm.attendees}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label>Local</Label>
                                        <Input
                                            placeholder="Sala 1 ou endereço"
                                            value={meetingForm.location}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <Button
                                    onClick={handleCreateMeeting}
                                    disabled={creatingMeeting}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {creatingMeeting ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
                                    ) : (
                                        <><Video className="w-4 h-4 mr-2" /> Criar Reunião com Google Meet</>
                                    )}
                                </Button>
                            </div>

                            {/* Events List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Próximos Eventos</h3>
                                    <Button variant="outline" size="sm" onClick={loadEvents} disabled={loadingEvents}>
                                        {loadingEvents ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        <span className="ml-2">Carregar</span>
                                    </Button>
                                </div>

                                {events.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                        Clique em "Carregar" para listar seus próximos eventos.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {events.map((event) => {
                                            const meetLink = getMeetLink(event);
                                            return (
                                                <div key={event.id} className="rounded-lg border border-border/50 p-3 hover:bg-muted/20 transition-colors">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate">{event.summary}</p>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {formatDateTime(event.start?.dateTime || event.start?.date)}
                                                                </span>
                                                                {event.attendees && event.attendees.length > 0 && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Users className="w-3 h-3" />
                                                                        {event.attendees.length} convidados
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {meetLink && (
                                                                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                                                                    <a href={meetLink} target="_blank" rel="noopener noreferrer">
                                                                        <Video className="w-3 h-3 mr-1" /> Meet
                                                                    </a>
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="sm" className="h-7" asChild>
                                                                <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* ─── DRIVE SECTION ────────────────────────────────────────────────────── */}
            <Collapsible open={driveOpen} onOpenChange={setDriveOpen}>
                <Card className="border-border/50">
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <HardDrive className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Google Drive</CardTitle>
                                        <CardDescription>Envie arquivos e crie pastas no Drive do workspace</CardDescription>
                                    </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${driveOpen ? "rotate-180" : ""}`} />
                            </div>
                        </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <CardContent className="space-y-6 pt-0">
                            {/* Actions Row */}
                            <div className="flex flex-wrap gap-3">
                                {/* Upload File */}
                                <div>
                                    <input
                                        type="file"
                                        id="drive-upload"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={uploadingFile}
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => document.getElementById("drive-upload")?.click()}
                                        disabled={uploadingFile}
                                    >
                                        {uploadingFile ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                                        ) : (
                                            <><FileUp className="w-4 h-4 mr-2" /> Upload de Arquivo</>
                                        )}
                                    </Button>
                                </div>

                                {/* Create Folder */}
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Nome da pasta"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        className="w-48"
                                        onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={handleCreateFolder}
                                        disabled={creatingFolder || !newFolderName.trim()}
                                    >
                                        {creatingFolder ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <><FolderPlus className="w-4 h-4 mr-2" /> Criar Pasta</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Files List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Arquivos no Drive</h3>
                                    <Button variant="outline" size="sm" onClick={loadFiles} disabled={loadingFiles}>
                                        {loadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        <span className="ml-2">Carregar</span>
                                    </Button>
                                </div>

                                {files.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                        Clique em "Carregar" para listar os arquivos do Drive.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {files.map((file) => (
                                            <div key={file.id} className="rounded-lg border border-border/50 p-3 hover:bg-muted/20 transition-colors">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        {file.iconLink && (
                                                            <img src={file.iconLink} alt="" className="w-5 h-5" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-sm truncate">{file.name}</p>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                {file.modifiedTime && (
                                                                    <span>{formatDateTime(file.modifiedTime)}</span>
                                                                )}
                                                                {file.size && (
                                                                    <Badge variant="secondary" className="text-[10px]">
                                                                        {formatFileSize(file.size)}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {file.webViewLink && (
                                                        <Button variant="ghost" size="sm" className="h-7 shrink-0" asChild>
                                                            <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
        </div>
    );
}
