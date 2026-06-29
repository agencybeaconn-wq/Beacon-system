import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAcademyContext } from '@/contexts/AcademyContext';

export interface AcademyComment {
  id: string;
  lesson_id: string;
  student_id: string;
  parent_id: string | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // joined
  author_name?: string;
  likes_count?: number;
  liked_by_me?: boolean;
  replies?: AcademyComment[];
}

/**
 * Pool de comentários fake pra popular aulas sem comentário real.
 * Nomes variados pra dar vida. NÃO grava no banco — só pro render.
 */
const FAKE_POOL = [
  { author: 'Pedro Siqueira', initials: 'PS', body: 'Essa aula mudou meu workflow completamente. Já tô usando no projeto atual.', likes: 12, time: '2h atrás' },
  { author: 'Júlia Martins', initials: 'JM', body: 'Uma dúvida: o hook de PreCompact roda antes ou depois do summary ser gerado?', likes: 4, time: '5h atrás' },
  { author: 'Rodrigo Almeida', initials: 'RA', body: 'Excelente explicação. Só senti falta de um exemplo com memória persistente.', likes: 7, time: '1d atrás' },
  { author: 'Bianca Ferraz', initials: 'BF', body: 'Valeu! Consegui aplicar no meu e-commerce e já vi ganho de 40% em produtividade.', likes: 19, time: '3h atrás' },
  { author: 'Lucas Monteiro', initials: 'LM', body: 'Mano, explicação top. Uma sugestão: cobrir também o fluxo de hooks em monorepo.', likes: 6, time: '8h atrás' },
  { author: 'Ana Carolina', initials: 'AC', body: 'Consegui reproduzir tudo em 20 minutos. Material excelente!', likes: 14, time: '1d atrás' },
  { author: 'Felipe Rocha', initials: 'FR', body: 'Alguém já testou isso com Antigravity junto? Funciona bem?', likes: 3, time: '12h atrás' },
  { author: 'Mariana Castro', initials: 'MC', body: 'Na parte das skills, vale lembrar de sempre commitar o .claude/skills/ no git.', likes: 22, time: '4h atrás' },
  { author: 'Gabriel Nunes', initials: 'GN', body: 'Melhor aula sobre isso que já vi na internet, tá de parabéns.', likes: 28, time: '6h atrás' },
  { author: 'Carla Nogueira', initials: 'CN', body: 'Dúvida: tem como integrar isso com GitHub Actions?', likes: 5, time: '10h atrás' },
  { author: 'Thiago Vasconcelos', initials: 'TV', body: 'Implementei ontem e economizou várias horas de trabalho repetitivo. Recomendo.', likes: 16, time: '1d atrás' },
  { author: 'Luana Pires', initials: 'LP', body: 'Show! Só uma dica: o arquivo CLAUDE.md não precisa ficar muito longo, menos é mais.', likes: 11, time: '7h atrás' },
];

/** Gera N comentários fake determinísticos a partir do lesson_id */
export function fakeCommentsFor(lessonId: string, count = 3): Array<typeof FAKE_POOL[0]> {
  let hash = 0;
  for (let i = 0; i < lessonId.length; i++) hash = lessonId.charCodeAt(i) + ((hash << 5) - hash);
  const start = Math.abs(hash) % FAKE_POOL.length;
  const out = [];
  for (let i = 0; i < count; i++) out.push(FAKE_POOL[(start + i) % FAKE_POOL.length]);
  return out;
}

export function useAcademyComments(lessonId: string | null) {
  const { student } = useAcademyContext();
  const [comments, setComments] = useState<AcademyComment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const { data: rows } = await (supabase as any)
        .from('academy_comments')
        .select('*, student:academy_students(id, full_name)')
        .eq('lesson_id', lessonId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      const { data: likes } = await (supabase as any)
        .from('academy_comment_likes')
        .select('comment_id, student_id')
        .in('comment_id', (rows || []).map((r: any) => r.id));

      const likesByComment: Record<string, { total: number; mine: boolean }> = {};
      for (const l of likes || []) {
        if (!likesByComment[l.comment_id]) likesByComment[l.comment_id] = { total: 0, mine: false };
        likesByComment[l.comment_id].total++;
        if (student && l.student_id === student.id) likesByComment[l.comment_id].mine = true;
      }

      const enriched: AcademyComment[] = (rows || []).map((r: any) => ({
        ...r,
        author_name: r.student?.full_name || 'Aluno',
        likes_count: likesByComment[r.id]?.total || 0,
        liked_by_me: likesByComment[r.id]?.mine || false,
      }));

      // Nesting: parent → replies
      const byId: Record<string, AcademyComment> = {};
      for (const c of enriched) byId[c.id] = { ...c, replies: [] };
      const roots: AcademyComment[] = [];
      for (const c of enriched) {
        if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].replies!.push(byId[c.id]);
        else roots.push(byId[c.id]);
      }
      setComments(roots);
    } catch (e: any) {
      console.error('[useAcademyComments]', e);
    } finally {
      setLoading(false);
    }
  }, [lessonId, student?.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const post = async (body: string, parentId?: string) => {
    if (!lessonId || !student || !body.trim()) return;
    const { error } = await (supabase as any).from('academy_comments').insert({
      lesson_id: lessonId,
      student_id: student.id,
      parent_id: parentId || null,
      body: body.trim(),
    });
    if (error) { toast.error('Erro: ' + error.message); return false; }
    toast.success('Comentário publicado');
    await fetchComments();
    return true;
  };

  const toggleLike = async (commentId: string, liked: boolean) => {
    if (!student) return;
    if (liked) {
      await (supabase as any)
        .from('academy_comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('student_id', student.id);
    } else {
      await (supabase as any)
        .from('academy_comment_likes')
        .insert({ comment_id: commentId, student_id: student.id });
    }
    await fetchComments();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any)
      .from('academy_comments')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return false; }
    toast.success('Comentário removido');
    await fetchComments();
    return true;
  };

  return { comments, loading, refresh: fetchComments, post, toggleLike, remove };
}
