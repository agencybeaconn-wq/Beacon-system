import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, PlayCircle, Lock } from 'lucide-react';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { LessonListItem } from '@/components/academy/LessonListItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAcademy, AcademyLesson, AcademyModule as TModule } from '@/hooks/useAcademy';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { useAcademyProgress, ModuleProgress } from '@/hooks/useAcademyProgress';

export default function AcademyModulePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { fetchLessons } = useAcademy();
  const { hasAccessTo, isAdmin } = useAcademyContext();
  const { getModuleProgress, getLessonCompletionMap } = useAcademyProgress();

  const [module, setModule] = useState<TModule | null>(null);
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ModuleProgress | null>(null);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      const { data } = await (supabase as any)
        .from('academy_modules')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) { setLoading(false); return; }
      setModule(data);
      const ls = await fetchLessons(data.id);
      setLessons(ls);
      setLoading(false);

      // Progresso do módulo + mapa por aula
      if (hasAccessTo(data.id) || isAdmin) {
        const [p, map] = await Promise.all([
          getModuleProgress(data.id),
          getLessonCompletionMap(data.id),
        ]);
        setProgress(p);
        setCompletionMap(map);
      }
    })();
  }, [slug, fetchLessons, getModuleProgress, getLessonCompletionMap, hasAccessTo, isAdmin]);

  if (loading) {
    return <AcademyLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AcademyLayout>;
  }
  if (!module) {
    return <AcademyLayout><p className="text-muted-foreground">Módulo não encontrado.</p></AcademyLayout>;
  }

  const canWatch = hasAccessTo(module.id) || isAdmin;

  return (
    <AcademyLayout>
      <Button variant="ghost" size="sm" className="mb-4 font-bold tracking-tight" onClick={() => navigate('/academy')}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      <div className="mb-8 p-6 md:p-8 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-card to-card">
        <div className="flex items-start gap-6 flex-col md:flex-row">
          <div className="flex-1">
            {module.level && (
              <Badge className="mb-3 bg-background/90 text-foreground border-0 font-bold text-[10px] tracking-[0.1em] uppercase rounded-md">
                {module.level}
              </Badge>
            )}
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-[-0.03em] leading-[1.05] mb-3">{module.title}</h1>
            {module.description && (
              <p className="text-muted-foreground text-base md:text-lg font-light leading-relaxed">{module.description}</p>
            )}

            {/* Progresso */}
            {canWatch && progress && progress.total > 0 ? (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
                    {progress.completed} de {progress.total} {progress.total === 1 ? 'aula' : 'aulas'} concluídas
                  </p>
                  <span className="text-xs font-extrabold tracking-tight">{progress.percent}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground mt-5">
                {lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}
              </p>
            )}
          </div>
          {module.cover_url && (
            <img
              src={module.cover_url}
              alt={module.title}
              className="w-full md:w-56 aspect-[2/3] object-cover rounded-xl"
            />
          )}
        </div>
      </div>

      {!canWatch ? (
        <div className="text-center py-12 border border-border/40 rounded-2xl bg-muted/20">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <p className="text-lg font-extrabold tracking-tight mb-1">Acesso bloqueado</p>
          <p className="text-sm text-muted-foreground font-light">
            Você ainda não tem acesso a este módulo. Fale com o suporte.
          </p>
        </div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          Nenhuma aula ainda neste módulo.
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map((l, i) => (
            <LessonListItem
              key={l.id}
              lesson={l}
              moduleSlug={module.slug}
              index={i}
              completed={completionMap[l.id]}
            />
          ))}
        </div>
      )}
    </AcademyLayout>
  );
}
