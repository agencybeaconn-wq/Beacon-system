import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { toast } from 'sonner';

export interface ClientDocument {
    id: string;
    client_id: string;
    workspace_id: string;
    title: string;
    description: string | null;
    doc_type: 'file' | 'contract' | 'external_link' | 'folder';
    category: 'legal' | 'strategy' | 'creatives' | 'other';
    file_url: string | null;
    external_url: string | null;
    file_name: string | null;
    file_size: number | null;
    mime_type: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export function useClientDocuments(clientId: string | null) {
    const { workspaceId } = useDashboard();
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDocuments = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('client_documents')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error: any) {
            console.error('[useClientDocuments] Error fetching:', error);
            toast.error('Erro ao carregar documentos: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const uploadDocument = async (
        file: File,
        title: string,
        category: ClientDocument['category'],
        docType: ClientDocument['doc_type'] = 'file',
        description?: string
    ) => {
        if (!clientId || !workspaceId) {
            toast.error('Cliente ou workspace não selecionado');
            return;
        }

        try {
            // 1. Upload file to storage
            // Sanitize filename: remove special chars that break Supabase Storage paths
            const safeName = file.name
                .replace(/[^a-zA-Z0-9._-]/g, '_') // replace spaces & special chars with _
                .replace(/_+/g, '_');               // collapse multiple underscores
            const fileName = `${workspaceId}/${clientId}/${Date.now()}_${safeName}`;

            const { error: uploadError } = await supabase.storage
                .from('client-documents')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: urlData } = supabase.storage
                .from('client-documents')
                .getPublicUrl(fileName);

            const fileUrl = urlData.publicUrl;

            // 3. Get current user
            const { data: { user } } = await supabase.auth.getUser();

            // 4. Insert DB record
            const { error: dbError } = await (supabase as any)
                .from('client_documents')
                .insert({
                    client_id: clientId,
                    workspace_id: workspaceId,
                    title,
                    description: description || null,
                    doc_type: docType,
                    category,
                    file_url: fileUrl,
                    file_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                    created_by: user?.id || null,
                });

            if (dbError) throw dbError;

            toast.success('Documento enviado com sucesso! 📄');
            await fetchDocuments();
        } catch (error: any) {
            console.error('[useClientDocuments] Upload error:', error);
            toast.error('Erro ao enviar documento: ' + error.message);
        }
    };

    const addExternalLink = async (
        title: string,
        externalUrl: string,
        category: ClientDocument['category'],
        description?: string
    ) => {
        if (!clientId || !workspaceId) {
            toast.error('Cliente ou workspace não selecionado');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await (supabase as any)
                .from('client_documents')
                .insert({
                    client_id: clientId,
                    workspace_id: workspaceId,
                    title,
                    description: description || null,
                    doc_type: 'external_link',
                    category,
                    external_url: externalUrl,
                    created_by: user?.id || null,
                });

            if (error) throw error;

            toast.success('Link adicionado com sucesso! 🔗');
            await fetchDocuments();
        } catch (error: any) {
            console.error('[useClientDocuments] Add link error:', error);
            toast.error('Erro ao adicionar link: ' + error.message);
        }
    };

    const deleteDocument = async (doc: ClientDocument) => {
        try {
            // If it has a file, remove from storage first
            if (doc.file_url) {
                const path = doc.file_url.split('/client-documents/')[1];
                if (path) {
                    await supabase.storage.from('client-documents').remove([decodeURIComponent(path)]);
                }
            }

            // Delete from DB
            const { error } = await (supabase as any)
                .from('client_documents')
                .delete()
                .eq('id', doc.id);

            if (error) throw error;

            toast.success('Documento excluído');
            await fetchDocuments();
        } catch (error: any) {
            console.error('[useClientDocuments] Delete error:', error);
            toast.error('Erro ao excluir documento: ' + error.message);
        }
    };

    return {
        documents,
        isLoading,
        refresh: fetchDocuments,
        uploadDocument,
        addExternalLink,
        deleteDocument,
    };
}
