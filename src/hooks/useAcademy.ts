import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AcademyModule {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  level: string | null;
  sort_order: number;
  is_published: boolean;
  type?: 'course' | 'mentoria';
  created_at: string;
  updated_at: string;
}

export interface AcademyLesson {
  id: string;
  module_id: string | null;
  student_id?: string | null;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademyStudent {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  plan: string;
  status: string;
  is_admin: boolean;
  is_mentorship_client?: boolean;
  enrolled_at: string;
  created_at: string;
}

export interface AcademyEnrollment {
  id: string;
  student_id: string;
  module_id: string;
  granted_at: string;
  expires_at: string | null;
}

const BUCKET = 'academy-videos';
const COVERS_BUCKET = 'academy-covers';

export function useAcademy() {
  const [modules, setModules] = useState<AcademyModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('academy_modules')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setModules(data || []);
    } catch (e: any) {
      console.error('[useAcademy] fetchModules:', e);
      toast.error('Erro ao carregar módulos: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  // ─── Modules ─────────────────────────────────────────────────────────
  const createModule = async (input: Partial<AcademyModule> & { title: string; slug: string }) => {
    const { data, error } = await (supabase as any)
      .from('academy_modules')
      .insert({ sort_order: modules.length, ...input })
      .select()
      .single();
    if (error) { toast.error('Erro ao criar módulo: ' + error.message); return null; }
    toast.success('Módulo criado');
    await fetchModules();
    return data;
  };

  const updateModule = async (id: string, updates: Partial<AcademyModule>) => {
    const { error } = await (supabase as any)
      .from('academy_modules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar: ' + error.message); return false; }
    toast.success('Módulo atualizado');
    await fetchModules();
    return true;
  };

  const deleteModule = async (id: string) => {
    const { error } = await (supabase as any).from('academy_modules').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return false; }
    toast.success('Módulo excluído');
    await fetchModules();
    return true;
  };

  // ─── Covers ──────────────────────────────────────────────────────────
  const uploadCover = async (file: File, moduleId: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `modules/${moduleId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(COVERS_BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      toast.error('Erro ao subir capa: ' + e.message);
      return null;
    }
  };

  const reorderModules = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, i) =>
      (supabase as any).from('academy_modules').update({ sort_order: i, updated_at: new Date().toISOString() }).eq('id', id)
    );
    await Promise.all(updates);
    await fetchModules();
  };

  // ─── Lessons ─────────────────────────────────────────────────────────
  // useCallback ESTÁVEL (sem deps) pra evitar loop em useEffect consumers.
  const fetchLessons = useCallback(async (moduleId: string): Promise<AcademyLesson[]> => {
    const { data, error } = await (supabase as any)
      .from('academy_lessons')
      .select('*')
      .eq('module_id', moduleId)
      .order('sort_order', { ascending: true });
    if (error) { toast.error('Erro ao carregar aulas: ' + error.message); return []; }
    return (data || []) as AcademyLesson[];
  }, []);

  const uploadLesson = async (
    moduleId: string,
    file: File,
    meta: { title: string; description?: string; sortOrder?: number }
  ) => {
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${moduleId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { data, error: dbErr } = await (supabase as any)
        .from('academy_lessons')
        .insert({
          module_id: moduleId,
          title: meta.title,
          description: meta.description || null,
          video_url: urlData.publicUrl,
          sort_order: meta.sortOrder ?? 0,
        })
        .select()
        .single();
      if (dbErr) throw dbErr;
      toast.success('Aula adicionada');
      return data as AcademyLesson;
    } catch (e: any) {
      console.error('[useAcademy] uploadLesson:', e);
      toast.error('Erro ao enviar aula: ' + e.message);
      return null;
    }
  };

  const createLessonFromUrl = async (
    moduleId: string,
    videoUrl: string,
    meta: { title: string; description?: string; sortOrder?: number }
  ) => {
    try {
      const { data, error } = await (supabase as any)
        .from('academy_lessons')
        .insert({
          module_id: moduleId,
          title: meta.title,
          description: meta.description || null,
          video_url: videoUrl,
          sort_order: meta.sortOrder ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success('Aula adicionada (link externo)');
      return data as AcademyLesson;
    } catch (e: any) {
      console.error('[useAcademy] createLessonFromUrl:', e);
      toast.error('Erro ao criar aula: ' + e.message);
      return null;
    }
  };

  const updateLesson = async (id: string, updates: Partial<AcademyLesson>) => {
    const { error } = await (supabase as any)
      .from('academy_lessons')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar aula: ' + error.message); return false; }
    toast.success('Aula atualizada');
    return true;
  };

  const deleteLesson = async (id: string, videoUrl: string) => {
    try {
      const path = videoUrl.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      const { error } = await (supabase as any).from('academy_lessons').delete().eq('id', id);
      if (error) throw error;
      toast.success('Aula excluída');
      return true;
    } catch (e: any) {
      toast.error('Erro ao excluir aula: ' + e.message);
      return false;
    }
  };

  // ─── Enrollments ─────────────────────────────────────────────────────
  const grantEnrollment = async (studentId: string, moduleId: string, expiresAt?: string | null) => {
    const { error } = await (supabase as any)
      .from('academy_enrollments')
      .insert({ student_id: studentId, module_id: moduleId, expires_at: expiresAt || null });
    if (error) { toast.error('Erro ao conceder acesso: ' + error.message); return false; }
    toast.success('Acesso concedido');
    return true;
  };

  const revokeEnrollment = async (enrollmentId: string) => {
    const { error } = await (supabase as any).from('academy_enrollments').delete().eq('id', enrollmentId);
    if (error) { toast.error('Erro ao revogar: ' + error.message); return false; }
    toast.success('Acesso revogado');
    return true;
  };

  const reorderLessons = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, i) =>
      (supabase as any).from('academy_lessons').update({ sort_order: i, updated_at: new Date().toISOString() }).eq('id', id)
    );
    await Promise.all(updates);
  };

  return {
    modules,
    isLoading,
    refresh: fetchModules,
    createModule,
    updateModule,
    deleteModule,
    uploadCover,
    reorderModules,
    fetchLessons,
    uploadLesson,
    createLessonFromUrl,
    updateLesson,
    deleteLesson,
    reorderLessons,
    grantEnrollment,
    revokeEnrollment,
  };
}
