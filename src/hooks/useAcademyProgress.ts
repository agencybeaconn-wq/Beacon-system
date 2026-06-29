import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAcademyContext } from '@/contexts/AcademyContext';

export interface LessonProgress {
  id: string;
  lesson_id: string;
  student_id: string;
  watched_seconds: number;
  completed_at: string | null;
  last_seen_at: string;
}

export interface ModuleProgress {
  total: number;
  completed: number;
  percent: number;
  lastLessonId: string | null;
}

export interface ContinueWatchingItem {
  lesson_id: string;
  lesson_title: string;
  lesson_thumbnail_url: string | null;
  module_id: string;
  module_slug: string;
  module_title: string;
  watched_seconds: number;
  duration_seconds: number | null;
  percent: number;
  last_seen_at: string;
}

const SAVE_THROTTLE_MS = 10_000; // 10s
const COMPLETION_RATIO = 0.9;

export function useAcademyProgress() {
  const { student } = useAcademyContext();
  // Por-aula: último momento em que salvamos progresso (pra throttle)
  const lastSavedRef = useRef<Record<string, number>>({});

  const getProgress = useCallback(async (lessonId: string): Promise<LessonProgress | null> => {
    if (!student) return null;
    const { data } = await (supabase as any)
      .from('academy_lesson_progress')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('student_id', student.id)
      .maybeSingle();
    return data || null;
  }, [student?.id]);

  const saveProgress = useCallback(async (
    lessonId: string,
    watchedSeconds: number,
    durationSeconds: number | null
  ) => {
    if (!student) return;
    const now = Date.now();
    const last = lastSavedRef.current[lessonId] || 0;
    if (now - last < SAVE_THROTTLE_MS) return; // throttle
    lastSavedRef.current[lessonId] = now;

    const watched = Math.max(0, Math.floor(watchedSeconds));
    const completed = durationSeconds && durationSeconds > 0
      ? (watched / durationSeconds) >= COMPLETION_RATIO
      : false;

    await (supabase as any)
      .from('academy_lesson_progress')
      .upsert({
        student_id: student.id,
        lesson_id: lessonId,
        watched_seconds: watched,
        last_seen_at: new Date().toISOString(),
        ...(completed ? { completed_at: new Date().toISOString() } : {}),
      }, { onConflict: 'student_id,lesson_id' });
  }, [student?.id]);

  /** Força salvar sem throttle (usar no onEnded ou unload) */
  const flushProgress = useCallback(async (
    lessonId: string,
    watchedSeconds: number,
    durationSeconds: number | null
  ) => {
    if (!student) return;
    lastSavedRef.current[lessonId] = 0; // reset
    await saveProgress(lessonId, watchedSeconds, durationSeconds);
  }, [saveProgress, student?.id]);

  const markCompleted = useCallback(async (lessonId: string, durationSeconds: number) => {
    if (!student) return;
    await (supabase as any)
      .from('academy_lesson_progress')
      .upsert({
        student_id: student.id,
        lesson_id: lessonId,
        watched_seconds: Math.floor(durationSeconds),
        completed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'student_id,lesson_id' });
  }, [student?.id]);

  const getModuleProgress = useCallback(async (moduleId: string): Promise<ModuleProgress> => {
    if (!student) return { total: 0, completed: 0, percent: 0, lastLessonId: null };

    const { data: lessons } = await (supabase as any)
      .from('academy_lessons')
      .select('id')
      .eq('module_id', moduleId)
      .eq('is_published', true);

    const total = (lessons || []).length;
    if (total === 0) return { total: 0, completed: 0, percent: 0, lastLessonId: null };

    const lessonIds = lessons.map((l: any) => l.id);
    const { data: progress } = await (supabase as any)
      .from('academy_lesson_progress')
      .select('*')
      .eq('student_id', student.id)
      .in('lesson_id', lessonIds);

    const completed = (progress || []).filter((p: any) => p.completed_at).length;
    const sorted = [...(progress || [])].sort((a: any, b: any) =>
      new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
    );
    const lastLessonId = sorted[0]?.lesson_id || null;

    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      lastLessonId,
    };
  }, [student?.id]);

  const getContinueWatching = useCallback(async (limit = 6): Promise<ContinueWatchingItem[]> => {
    if (!student) return [];
    const { data } = await (supabase as any)
      .from('academy_lesson_progress')
      .select(`
        lesson_id, watched_seconds, last_seen_at, completed_at,
        lesson:academy_lessons!inner(id, title, thumbnail_url, duration_seconds, is_published, module_id,
          module:academy_modules!inner(id, slug, title, is_published))
      `)
      .eq('student_id', student.id)
      .is('completed_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(limit);

    return (data || [])
      .filter((r: any) => r.lesson?.is_published && r.lesson?.module?.is_published)
      .map((r: any): ContinueWatchingItem => {
        const duration = r.lesson.duration_seconds || 0;
        const percent = duration > 0 ? Math.min(100, Math.round((r.watched_seconds / duration) * 100)) : 0;
        return {
          lesson_id: r.lesson_id,
          lesson_title: r.lesson.title,
          lesson_thumbnail_url: r.lesson.thumbnail_url,
          module_id: r.lesson.module.id,
          module_slug: r.lesson.module.slug,
          module_title: r.lesson.module.title,
          watched_seconds: r.watched_seconds,
          duration_seconds: r.lesson.duration_seconds,
          percent,
          last_seen_at: r.last_seen_at,
        };
      });
  }, [student?.id]);

  /** Mapa { lesson_id: isCompleted } pras aulas de um módulo */
  const getLessonCompletionMap = useCallback(async (moduleId: string): Promise<Record<string, boolean>> => {
    if (!student) return {};
    const { data: lessons } = await (supabase as any)
      .from('academy_lessons')
      .select('id')
      .eq('module_id', moduleId);
    if (!lessons?.length) return {};
    const { data: progress } = await (supabase as any)
      .from('academy_lesson_progress')
      .select('lesson_id, completed_at')
      .eq('student_id', student.id)
      .in('lesson_id', lessons.map((l: any) => l.id));
    const map: Record<string, boolean> = {};
    for (const p of progress || []) map[p.lesson_id] = !!p.completed_at;
    return map;
  }, [student?.id]);

  return {
    getProgress,
    saveProgress,
    flushProgress,
    markCompleted,
    getModuleProgress,
    getContinueWatching,
    getLessonCompletionMap,
  };
}
