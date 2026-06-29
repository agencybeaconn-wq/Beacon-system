import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { toast } from 'sonner';

export interface LibraryList {
    id: string;
    workspace_id: string;
    title: string;
    description: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
    videos?: LibraryVideo[];
}

export interface LibraryVideo {
    id: string;
    list_id: string;
    workspace_id: string;
    title: string;
    description: string | null;
    video_url: string;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export function useLibrary() {
    const { workspaceId } = useDashboard();
    const [lists, setLists] = useState<LibraryList[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLists = useCallback(async () => {
        if (!workspaceId) return;
        setIsLoading(true);
        try {
            // Fetch lists
            const { data: listsData, error: listsError } = await (supabase as any)
                .from('library_lists')
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('sort_order', { ascending: true });

            if (listsError) throw listsError;

            // Fetch all videos for this workspace
            const { data: videosData, error: videosError } = await (supabase as any)
                .from('library_videos')
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('sort_order', { ascending: true });

            if (videosError) throw videosError;

            // Group videos by list_id
            const videosMap: Record<string, LibraryVideo[]> = {};
            (videosData || []).forEach((v: LibraryVideo) => {
                if (!videosMap[v.list_id]) videosMap[v.list_id] = [];
                videosMap[v.list_id].push(v);
            });

            const enrichedLists = (listsData || []).map((list: LibraryList) => ({
                ...list,
                videos: videosMap[list.id] || []
            }));

            setLists(enrichedLists);
        } catch (error: any) {
            console.error('[useLibrary] Error fetching:', error);
            toast.error('Erro ao carregar biblioteca: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    // === LIST CRUD ===
    const createList = async (title: string, description?: string) => {
        if (!workspaceId) return;
        try {
            const { data, error } = await (supabase as any)
                .from('library_lists')
                .insert({
                    workspace_id: workspaceId,
                    title,
                    description: description || null,
                    sort_order: lists.length
                })
                .select()
                .single();

            if (error) throw error;
            toast.success('Lista criada! 🎬');
            await fetchLists();
            return data;
        } catch (error: any) {
            console.error('[useLibrary] Error creating list:', error);
            toast.error('Erro ao criar lista: ' + error.message);
        }
    };

    const updateList = async (id: string, updates: { title?: string; description?: string }) => {
        try {
            const { error } = await (supabase as any)
                .from('library_lists')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            toast.success('Lista atualizada');
            await fetchLists();
        } catch (error: any) {
            toast.error('Erro ao atualizar lista: ' + error.message);
        }
    };

    const deleteList = async (id: string) => {
        try {
            const { error } = await (supabase as any)
                .from('library_lists')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Lista excluída');
            await fetchLists();
        } catch (error: any) {
            toast.error('Erro ao excluir lista: ' + error.message);
        }
    };

    // === VIDEO CRUD ===
    const uploadVideo = async (
        listId: string,
        file: File,
        title: string,
        description?: string
    ) => {
        if (!workspaceId) return;

        try {
            // 1. Upload to storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${workspaceId}/${listId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('library-videos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: urlData } = supabase.storage
                .from('library-videos')
                .getPublicUrl(fileName);

            const videoUrl = urlData.publicUrl;

            // 3. Insert DB record
            const list = lists.find(l => l.id === listId);
            const sortOrder = list?.videos?.length || 0;

            const { data, error: dbError } = await (supabase as any)
                .from('library_videos')
                .insert({
                    list_id: listId,
                    workspace_id: workspaceId,
                    title,
                    description: description || null,
                    video_url: videoUrl,
                    sort_order: sortOrder,
                })
                .select()
                .single();

            if (dbError) throw dbError;

            toast.success('Vídeo adicionado! 🎥');
            await fetchLists();
            return data;
        } catch (error: any) {
            console.error('[useLibrary] Error uploading video:', error);
            toast.error('Erro ao enviar vídeo: ' + error.message);
        }
    };

    const updateVideo = async (id: string, updates: { title?: string; description?: string }) => {
        try {
            const { error } = await (supabase as any)
                .from('library_videos')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            toast.success('Vídeo atualizado');
            await fetchLists();
        } catch (error: any) {
            toast.error('Erro ao atualizar vídeo: ' + error.message);
        }
    };

    const deleteVideo = async (id: string, videoUrl: string) => {
        try {
            // Delete from storage
            const path = videoUrl.split('/library-videos/')[1];
            if (path) {
                await supabase.storage.from('library-videos').remove([path]);
            }

            // Delete from DB
            const { error } = await (supabase as any)
                .from('library_videos')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Vídeo excluído');
            await fetchLists();
        } catch (error: any) {
            toast.error('Erro ao excluir vídeo: ' + error.message);
        }
    };

    return {
        lists,
        isLoading,
        refresh: fetchLists,
        createList,
        updateList,
        deleteList,
        uploadVideo,
        updateVideo,
        deleteVideo
    };
}
