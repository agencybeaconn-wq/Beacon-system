import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AcademyLesson } from './useAcademy';

export interface LessonStudent {
  student_id: string;
  full_name: string;
  email: string;
}

export interface PrivateLessonLibraryItem {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  student_count: number;
}

export function useAcademyPrivateLessons() {
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [loading, setLoading] = useState(false);

  const listByStudent = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('list_student_private_lessons', { target_student_id: studentId });
      if (error) throw error;
      setLessons(data || []);
      return (data || []) as AcademyLesson[];
    } catch (e: any) {
      toast.error('Erro ao carregar aulas privadas: ' + e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const listMyPrivateLessons = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('list_student_private_lessons', { target_student_id: studentId });
      if (error) throw error;
      const published = (data || []).filter((l: AcademyLesson) => l.is_published);
      setLessons(published);
      return published as AcademyLesson[];
    } catch (e: any) {
      toast.error('Erro ao carregar aulas: ' + e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Biblioteca: todas as aulas privadas existentes (pro admin escolher e compartilhar)
  const listAllPrivate = useCallback(async (): Promise<PrivateLessonLibraryItem[]> => {
    try {
      const { data, error } = await (supabase as any).rpc('list_all_private_lessons');
      if (error) throw error;
      return (data || []) as PrivateLessonLibraryItem[];
    } catch (e: any) {
      toast.error('Erro ao carregar biblioteca: ' + e.message);
      return [];
    }
  }, []);

  const listLessonStudents = useCallback(async (lessonId: string): Promise<LessonStudent[]> => {
    try {
      const { data, error } = await (supabase as any).rpc('list_lesson_students', { target_lesson_id: lessonId });
      if (error) throw error;
      return (data || []) as LessonStudent[];
    } catch (e: any) {
      toast.error('Erro ao listar alunos da aula: ' + e.message);
      return [];
    }
  }, []);

  // Insere a aula uma vez (sem student_id) e atribui a N alunos via junction
  const attachStudents = async (lessonId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return;
    const rows = studentIds.map(sid => ({ lesson_id: lessonId, student_id: sid }));
    const { error } = await (supabase as any)
      .from('academy_lesson_students')
      .upsert(rows, { onConflict: 'lesson_id,student_id' });
    if (error) throw error;
  };

  const detachStudent = useCallback(async (lessonId: string, studentId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('academy_lesson_students')
        .delete()
        .eq('lesson_id', lessonId)
        .eq('student_id', studentId);
      if (error) throw error;
      toast.success('Acesso removido');
      return true;
    } catch (e: any) {
      toast.error('Erro ao remover acesso: ' + e.message);
      return false;
    }
  }, []);

  // Upload de arquivo — cria a aula e atribui aos alunos via junction
  const uploadShared = useCallback(async (
    studentIds: string[],
    file: File,
    meta: { title: string; description?: string }
  ) => {
    if (studentIds.length === 0) {
      toast.error('Selecione pelo menos 1 aluno');
      return null;
    }
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `shared/${Date.now()}-${safe}`;

      const { error: upErr } = await supabase.storage
        .from('academy-videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'video/mp4',
        });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('academy-videos').getPublicUrl(storagePath);
      const videoUrl = urlData.publicUrl;

      const { data: lesson, error } = await (supabase as any)
        .from('academy_lessons')
        .insert({
          module_id: null,
          student_id: null,
          title: meta.title,
          description: meta.description || null,
          video_url: videoUrl,
          is_published: true,
        })
        .select('*')
        .single();
      if (error) throw error;

      await attachStudents(lesson.id, studentIds);
      toast.success(`Aula enviada pra ${studentIds.length} aluno${studentIds.length > 1 ? 's' : ''}`);
      return lesson as AcademyLesson;
    } catch (e: any) {
      toast.error('Erro ao enviar aula: ' + e.message);
      throw e;
    }
  }, []);

  // Cria aula por URL (Loom/YouTube/Vimeo) e atribui aos alunos
  const createFromUrlShared = useCallback(async (
    studentIds: string[],
    videoUrl: string,
    meta: { title: string; description?: string }
  ) => {
    if (studentIds.length === 0) {
      toast.error('Selecione pelo menos 1 aluno');
      return null;
    }
    try {
      const { data: lesson, error } = await (supabase as any)
        .from('academy_lessons')
        .insert({
          module_id: null,
          student_id: null,
          title: meta.title,
          description: meta.description || null,
          video_url: videoUrl,
          is_published: true,
        })
        .select('*')
        .single();
      if (error) throw error;

      await attachStudents(lesson.id, studentIds);
      toast.success(`Aula adicionada pra ${studentIds.length} aluno${studentIds.length > 1 ? 's' : ''}`);
      return lesson as AcademyLesson;
    } catch (e: any) {
      toast.error('Erro ao salvar aula: ' + e.message);
      throw e;
    }
  }, []);

  // Compartilha uma aula já existente com mais alunos
  const shareWithStudents = useCallback(async (lessonId: string, studentIds: string[]) => {
    try {
      await attachStudents(lessonId, studentIds);
      toast.success(`Aula compartilhada com ${studentIds.length} aluno${studentIds.length > 1 ? 's' : ''}`);
      return true;
    } catch (e: any) {
      toast.error('Erro ao compartilhar: ' + e.message);
      return false;
    }
  }, []);

  // LEGACY — mantém pra compat (upload direto pra 1 aluno via student_id)
  const upload = useCallback(async (studentId: string, file: File, meta: { title: string; description?: string }) => {
    return uploadShared([studentId], file, meta);
  }, [uploadShared]);

  const createFromUrl = useCallback(async (studentId: string, videoUrl: string, meta: { title: string; description?: string }) => {
    return createFromUrlShared([studentId], videoUrl, meta);
  }, [createFromUrlShared]);

  const update = useCallback(async (lessonId: string, patch: Partial<AcademyLesson>) => {
    try {
      const { error } = await (supabase as any)
        .from('academy_lessons')
        .update(patch)
        .eq('id', lessonId);
      if (error) throw error;
      toast.success('Aula atualizada');
    } catch (e: any) {
      toast.error('Erro ao atualizar: ' + e.message);
    }
  }, []);

  const remove = useCallback(async (lesson: AcademyLesson) => {
    try {
      // Se for arquivo no storage, tenta deletar
      const match = lesson.video_url.match(/academy-videos\/(.+)$/);
      if (match) {
        await supabase.storage.from('academy-videos').remove([match[1]]);
      }
      const { error } = await (supabase as any)
        .from('academy_lessons')
        .delete()
        .eq('id', lesson.id);
      if (error) throw error;
      toast.success('Aula removida');
    } catch (e: any) {
      toast.error('Erro ao remover: ' + e.message);
    }
  }, []);

  return {
    lessons, loading,
    listByStudent, listMyPrivateLessons,
    listAllPrivate, listLessonStudents,
    upload, createFromUrl,
    uploadShared, createFromUrlShared,
    shareWithStudents, detachStudent,
    update, remove,
  };
}
