import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AcademyMaterial {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  is_external_url: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export function useAcademyMaterials() {
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  const list = useCallback(async (lessonId: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('academy_lesson_materials')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setMaterials(data || []);
      return (data || []) as AcademyMaterial[];
    } catch (e: any) {
      toast.error('Erro ao carregar materiais: ' + e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const upload = useCallback(async (lessonId: string, file: File, meta?: { title?: string; description?: string }) => {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${lessonId}/${Date.now()}-${safe}`;

      const { error: upErr } = await supabase.storage
        .from('academy-materials')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('academy-materials').getPublicUrl(storagePath);
      const fileUrl = urlData.publicUrl;

      const { data, error } = await (supabase as any)
        .from('academy_lesson_materials')
        .insert({
          lesson_id: lessonId,
          title: meta?.title || file.name,
          description: meta?.description || null,
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
        })
        .select('*')
        .single();
      if (error) throw error;

      toast.success('Material enviado');
      await list(lessonId);
      return data as AcademyMaterial;
    } catch (e: any) {
      toast.error('Erro ao enviar material: ' + e.message);
      throw e;
    }
  }, [list]);

  const addExternalUrl = useCallback(async (
    lessonId: string,
    url: string,
    meta: { title: string; description?: string }
  ) => {
    try {
      // Deriva file_name a partir do URL (último path segment ou hostname)
      let fileName = 'link';
      try {
        const u = new URL(url);
        const lastSeg = u.pathname.split('/').filter(Boolean).pop();
        fileName = lastSeg || u.hostname;
      } catch {
        // URL inválida — deixa passar pra backend validar
      }

      const { data, error } = await (supabase as any)
        .from('academy_lesson_materials')
        .insert({
          lesson_id: lessonId,
          title: meta.title,
          description: meta.description || null,
          file_url: url,
          file_name: fileName,
          file_size: null,
          mime_type: null,
          is_external_url: true,
        })
        .select('*')
        .single();
      if (error) throw error;

      toast.success('Link externo adicionado');
      await list(lessonId);
      return data as AcademyMaterial;
    } catch (e: any) {
      toast.error('Erro ao salvar link: ' + e.message);
      throw e;
    }
  }, [list]);

  const remove = useCallback(async (material: AcademyMaterial) => {
    try {
      // Só tenta deletar do storage se for arquivo (não URL externa)
      if (!material.is_external_url) {
        const match = material.file_url.match(/academy-materials\/(.+)$/);
        if (match) {
          await supabase.storage.from('academy-materials').remove([match[1]]);
        }
      }

      const { error } = await (supabase as any)
        .from('academy_lesson_materials')
        .delete()
        .eq('id', material.id);
      if (error) throw error;

      toast.success('Material removido');
      await list(material.lesson_id);
    } catch (e: any) {
      toast.error('Erro ao remover: ' + e.message);
    }
  }, [list]);

  return { materials, loading, list, upload, addExternalUrl, remove };
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fileIcon(mimeType: string | null, fileName: string, isExternal = false): string {
  if (isExternal) {
    if (/github\.com/.test(fileName)) return '🐙';
    return '🔗';
  }
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (mimeType?.startsWith('image/')) return '🖼️';
  if (mimeType?.startsWith('video/')) return '🎬';
  if (mimeType?.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📕';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'cpp', 'c', 'php', 'swift', 'kt'].includes(ext)) return '💻';
  if (['md', 'txt'].includes(ext)) return '📝';
  if (['doc', 'docx'].includes(ext)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📈';
  return '📎';
}
