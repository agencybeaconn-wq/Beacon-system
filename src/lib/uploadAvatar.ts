import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export interface UploadAvatarResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * Upload avatar to Supabase Storage and update profile
 */
export async function uploadAvatar(file: File, userId: string): Promise<UploadAvatarResult> {
    try {
        // Validate file
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return { success: false, error: 'Formato inválido. Use PNG, JPEG ou WebP.' };
        }

        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            return { success: false, error: 'Arquivo muito grande. Máximo 2MB.' };
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${uuidv4()}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return { success: false, error: 'Erro ao fazer upload da imagem.' };
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Update auth user metadata
        await supabase.auth.updateUser({
            data: { avatar_url: publicUrl }
        });

        // Update profile with new avatar URL
        const { error: updateError } = await (supabase as any)
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);

        if (updateError) {
            console.error('Profile update error:', updateError);
            // Try to delete uploaded file since profile update failed
            await supabase.storage.from('avatars').remove([fileName]);
            return { success: false, error: 'Erro ao atualizar perfil.' };
        }

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'Erro inesperado ao fazer upload.' };
    }
}

/**
 * Delete old avatar from storage
 */
export async function deleteAvatar(avatarUrl: string): Promise<void> {
    try {
        // Extract file path from URL
        const urlParts = avatarUrl.split('/avatars/');
        if (urlParts.length < 2) return;

        const filePath = urlParts[1];
        await supabase.storage.from('avatars').remove([filePath]);
    } catch (error) {
        console.error('Error deleting old avatar:', error);
    }
}
