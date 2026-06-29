import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BUCKET_NAME = 'task-images';

interface UseImageUploadOptions {
    onSuccess?: (url: string) => void;
    onError?: (error: Error) => void;
}

export function useImageUpload(options?: UseImageUploadOptions) {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const uploadImage = async (file: File, taskId?: string): Promise<string | null> => {
        if (!file) return null;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            toast.error('Tipo de arquivo inválido. Use JPG, PNG, WebP ou GIF.');
            return null;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('Arquivo muito grande. Máximo 5MB.');
            return null;
        }

        setIsUploading(true);
        setProgress(0);

        try {
            // Generate unique filename
            const timestamp = Date.now();
            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = taskId
                ? `${taskId}/${timestamp}.${ext}`
                : `temp/${timestamp}.${ext}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(data.path);

            const publicUrl = urlData.publicUrl;

            setProgress(100);
            options?.onSuccess?.(publicUrl);

            return publicUrl;
        } catch (error: any) {
            console.error('[useImageUpload] Upload failed:', error);
            console.error('[useImageUpload] Error details:', {
                message: error.message,
                statusCode: error.statusCode,
                error: error.error,
                name: error.name,
            });

            // Provide specific error messages
            let errorMessage = 'Erro ao fazer upload da imagem';
            if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
                errorMessage = 'Bucket de armazenamento não encontrado. Crie o bucket "task-images" no Supabase.';
            } else if (error.message?.includes('security') || error.message?.includes('policy') || error.message?.includes('RLS')) {
                errorMessage = 'Permissão negada. Verifique as políticas de acesso do bucket.';
            } else if (error.message?.includes('size') || error.statusCode === 413) {
                errorMessage = 'Arquivo muito grande para o servidor.';
            } else if (error.message) {
                errorMessage = `Erro no upload: ${error.message}`;
            }

            toast.error(errorMessage);
            options?.onError?.(error);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const deleteImage = async (url: string): Promise<boolean> => {
        if (!url) return false;

        try {
            // Extract path from URL
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/task-images\/(.+)/);

            if (!pathMatch) {
                console.warn('[useImageUpload] Could not parse image path from URL');
                return false;
            }

            const filePath = pathMatch[1];

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .remove([filePath]);

            if (error) {
                throw error;
            }

            return true;
        } catch (error: any) {
            console.error('[useImageUpload] Delete failed:', error);
            return false;
        }
    };

    return {
        uploadImage,
        deleteImage,
        isUploading,
        progress
    };
}
