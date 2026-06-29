/**
 * GoogleIntegrationService — Frontend Client
 * 
 * Classe estática que encapsula todas as chamadas às Edge Functions
 * de Google Drive e Google Calendar. Usa supabase.functions.invoke()
 * para comunicação com o backend.
 * 
 * Extensível: Para adicionar Sheets, basta criar novos métodos
 * estáticos que invocam a futura Edge Function google-sheets.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GoogleAuthState {
    returnUrl: string;
    userId: string;
    workspaceId: string;
}

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    size?: string;
    webViewLink?: string;
    iconLink?: string;
}

export interface DriveFolder {
    id: string;
    name: string;
    mimeType: string;
}

export interface DriveListResponse {
    files: DriveFile[];
    nextPageToken?: string;
}

export interface MeetingData {
    summary: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: string[];
    timeZone?: string;
    location?: string;
    addMeet?: boolean;
    colorId?: string;
    recurrence?: string[];
    // IDs de team_members vinculados ao evento — usados pelo backend para agendar lembretes WhatsApp.
    teamMemberIds?: string[];
}

export interface MeetingResult {
    eventId: string;
    htmlLink: string;
    meetLink: string | null;
    status: string;
    summary: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    attendees: Array<{ email: string; responseStatus?: string }>;
}

export interface CalendarEvent {
    id: string;
    summary: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    htmlLink: string;
}

// ─── Service Class ─────────────────────────────────────────────────────────────

export class GoogleIntegrationService {

    // ─── Auth ──────────────────────────────────────────────────────────────────

    /**
     * Gera a URL de autorização do Google OAuth2.
     * O frontend deve redirecionar o usuário para essa URL.
     */
    static getAuthUrl(workspaceId: string, userId: string): string {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-callback`;

        const state: GoogleAuthState = {
            returnUrl: window.location.origin,
            userId,
            workspaceId,
        };

        const scopes = [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'openid',
            'email',
            'profile',
        ].join(' ');

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scopes,
            access_type: 'offline',
            prompt: 'consent',
            state: JSON.stringify(state),
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    // ─── Drive ─────────────────────────────────────────────────────────────────

    /**
     * Cria uma pasta no Google Drive do workspace.
     */
    static async createFolder(
        workspaceId: string,
        folderName: string,
        parentFolderId?: string
    ): Promise<DriveFolder> {
        const { data, error } = await supabase.functions.invoke('google-drive', {
            body: {
                action: 'createFolder',
                workspaceId,
                folderName,
                parentFolderId,
            },
        });

        if (error) throw new Error(`createFolder failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'createFolder failed');

        return data.data as DriveFolder;
    }

    /**
     * Upload de arquivo para o Google Drive.
     * Aceita um File object e converte para base64 internamente.
     */
    static async uploadFile(
        workspaceId: string,
        file: File,
        folderId?: string,
        fileName?: string
    ): Promise<DriveFile> {
        // Convert File to base64
        const base64Content = await GoogleIntegrationService.fileToBase64(file);

        const { data, error } = await supabase.functions.invoke('google-drive', {
            body: {
                action: 'uploadFile',
                workspaceId,
                fileName: fileName || file.name,
                mimeType: file.type || 'application/octet-stream',
                base64Content,
                folderId,
            },
        });

        if (error) throw new Error(`uploadFile failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'uploadFile failed');

        return data.data as DriveFile;
    }

    /**
     * Lista arquivos do Google Drive do workspace.
     * Suporta filtragem por pasta e busca por nome.
     */
    static async listClientFiles(
        workspaceId: string,
        folderId?: string,
        query?: string,
        pageSize?: number,
        pageToken?: string
    ): Promise<DriveListResponse> {
        const { data, error } = await supabase.functions.invoke('google-drive', {
            body: {
                action: 'listClientFiles',
                workspaceId,
                folderId,
                query,
                pageSize,
                pageToken,
            },
        });

        if (error) throw new Error(`listClientFiles failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'listClientFiles failed');

        return data.data as DriveListResponse;
    }

    /**
     * Renomeia um arquivo ou pasta no Google Drive.
     */
    static async renameDriveFile(workspaceId: string, fileId: string, newName: string): Promise<void> {
        const { data, error } = await supabase.functions.invoke('google-drive', {
            body: { action: 'renameFile', workspaceId, fileId, newName },
        });
        if (error) throw new Error(`renameFile failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'renameFile failed');
    }

    /**
     * Exclui (move para lixeira) um arquivo ou pasta do Google Drive.
     */
    static async deleteDriveFile(workspaceId: string, fileId: string): Promise<void> {
        const { data, error } = await supabase.functions.invoke('google-drive', {
            body: { action: 'deleteFile', workspaceId, fileId },
        });
        if (error) throw new Error(`deleteFile failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'deleteFile failed');
    }

    /**
     * Move um arquivo ou pasta para outra pasta no Google Drive.
     */
    static async moveDriveFile(workspaceId: string, fileId: string, newParentId: string): Promise<void> {
        const { data, error } = await supabase.functions.invoke('google-drive', {
            body: { action: 'moveFile', workspaceId, fileId, newParentId },
        });
        if (error) throw new Error(`moveFile failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'moveFile failed');
    }

    // ─── Calendar ──────────────────────────────────────────────────────────────

    /**
     * Cria uma reunião no Google Calendar com link do Google Meet.
     * Envia convites por email para todos os attendees.
     */
    static async createMeeting(
        workspaceId: string,
        meetingData: MeetingData
    ): Promise<MeetingResult> {
        const { data, error } = await supabase.functions.invoke('google-calendar', {
            body: {
                action: 'createMeeting',
                workspaceId,
                ...meetingData,
            },
        });

        if (error) throw new Error(`createMeeting failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'createMeeting failed');

        return data.data as MeetingResult;
    }

    /**
     * Atualiza uma reunião existente no Google Calendar.
     */
    static async updateMeeting(
        workspaceId: string,
        eventId: string,
        meetingData: MeetingData
    ): Promise<MeetingResult> {
        const { data, error } = await supabase.functions.invoke('google-calendar', {
            body: {
                action: 'updateMeeting',
                workspaceId,
                eventId,
                ...meetingData,
            },
        });

        if (error) throw new Error(`updateMeeting failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'updateMeeting failed');

        return data.data as MeetingResult;
    }

    /**
     * Lista eventos futuros do calendário do workspace.
     */
    static async listEvents(
        workspaceId: string,
        timeMin?: string,
        timeMax?: string,
        maxResults?: number
    ): Promise<{ items: CalendarEvent[] }> {
        const { data, error } = await supabase.functions.invoke('google-calendar', {
            body: {
                action: 'listEvents',
                workspaceId,
                timeMin,
                timeMax,
                maxResults,
            },
        });

        if (error) throw new Error(`listEvents failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'listEvents failed');

        return data.data as { items: CalendarEvent[] };
    }

    /**
     * Deleta um evento do Google Calendar.
     */
    static async deleteMeeting(
        workspaceId: string,
        eventId: string
    ): Promise<{ deleted: boolean }> {
        const { data, error } = await supabase.functions.invoke('google-calendar', {
            body: {
                action: 'deleteMeeting',
                workspaceId,
                eventId,
            },
        });

        if (error) throw new Error(`deleteMeeting failed: ${error.message}`);
        if (!data?.success) throw new Error(data?.error || 'deleteMeeting failed');

        return data.data as { deleted: boolean };
    }

    // ─── Utils ─────────────────────────────────────────────────────────────────

    /**
     * Converte um File para base64 string (sem o prefixo data:...).
     */
    private static fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove the data URL prefix (e.g., "data:image/png;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}
