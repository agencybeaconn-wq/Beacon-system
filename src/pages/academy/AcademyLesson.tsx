import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { VideoPlayer } from '@/components/academy/VideoPlayer';
import { CommentsSection } from '@/components/academy/CommentsSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAcademy, AcademyLesson, AcademyModule as TModule } from '@/hooks/useAcademy';
import { useAcademyProgress } from '@/hooks/useAcademyProgress';
import { useAcademyMaterials } from '@/hooks/useAcademyMaterials';
import { MaterialGrid } from '@/components/academy/MaterialCard';
import { MaterialsUsageGuide } from '@/components/academy/MaterialsUsageGuide';
import { Package } from 'lucide-react';

export default function AcademyLessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const navigate = useNavigate();
  const { fetchLessons } = useAcademy();
  const { getProgress, saveProgress, flushProgress, markCompleted, getLessonCompletionMap } = useAcademyProgress();

  const [module, setModule] = useState<TModule | null>(null);
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [current, setCurrent] = useState<AcademyLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialTime, setInitialTime] = useState<number | undefined>();
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  // Guarda último progresso conhecido pra flushar ao sair/terminar
  const lastStateRef = useRef<{ sec: number; dur: number }>({ sec: 0, dur: 0 });

  useEffect(() => {
    (async () => {
      if (!slug || !lessonId) return;
      setLoading(true);
      setInitialTime(undefined); setIsCompleted(false);
      const { data: mod } = await (supabase as any)
        .from('academy_modules')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!mod) { setLoading(false); return; }
      setModule(mod);
      const ls = await fetchLessons(mod.id);
      setLessons(ls);
      const cur = ls.find(l => l.id === lessonId) || null;
      setCurrent(cur);
      setLoading(false);

      // Progresso da aula atual
      if (cur) {
        const prog = await getProgress(cur.id);
        if (prog) {
          setInitialTime(prog.watched_seconds);
          setIsCompleted(!!prog.completed_at);
        }
      }
      // Completion map do módulo inteiro pra sidebar
      const map = await getLessonCompletionMap(mod.id);
      setCompletionMap(map);
    })();
  }, [slug, lessonId, fetchLessons, getProgress, getLessonCompletionMap]);

  // Flush ao desmontar
  useEffect(() => {
    return () => {
      if (current && lastStateRef.current.sec > 0) {
        flushProgress(current.id, lastStateRef.current.sec, lastStateRef.current.dur);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const handleTimeUpdate = (sec: number, dur: number) => {
    if (!current) return;
    lastStateRef.current = { sec, dur };
    saveProgress(current.id, sec, dur);
  };

  const handleEnded = async (dur: number) => {
    if (!current) return;
    await markCompleted(current.id, dur);
    setIsCompleted(true);
    setCompletionMap(prev => ({ ...prev, [current.id]: true }));
  };

  if (loading) {
    return <AcademyLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AcademyLayout>;
  }
  if (!module || !current) {
    return <AcademyLayout><p className="text-muted-foreground">Aula não encontrada.</p></AcademyLayout>;
  }

  const idx = lessons.findIndex(l => l.id === current.id);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;

  return (
    <AcademyLayout>
      <Button variant="ghost" size="sm" className="mb-4 font-bold tracking-tight" onClick={() => navigate(`/academy/curso/${slug}`)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao módulo
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <VideoPlayer
            src={current.video_url}
            poster={current.thumbnail_url}
            autoPlay
            initialTime={initialTime}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary">{module.title}</p>
              {isCompleted && (
                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 font-bold text-[10px] tracking-[0.1em] uppercase rounded-md gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Concluída
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] leading-tight mb-3">{current.title}</h1>
            {current.description && (
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed font-light">{current.description}</p>
            )}
            <LessonMaterialsList lessonId={current.id} />
          </div>

          <div className="mt-8 flex gap-2">
            {prev && (
              <Button variant="outline" asChild className="flex-1 rounded-xl h-12 font-bold tracking-tight">
                <Link to={`/academy/curso/${slug}/aula/${prev.id}`}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Aula anterior
                </Link>
              </Button>
            )}
            {next && (
              <Button className="flex-1 rounded-xl h-12 font-bold tracking-tight" asChild>
                <Link to={`/academy/curso/${slug}/aula/${next.id}`}>
                  Próxima aula <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>

          <div className="mt-10 pt-8 border-t border-border/40">
            <CommentsSection lessonId={current.id} />
          </div>
        </div>

        <aside className="space-y-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Aulas do módulo
          </h3>
          {lessons.map((l, i) => {
            const active = l.id === current.id;
            const done = completionMap[l.id];
            return (
              <Link
                key={l.id}
                to={`/academy/curso/${slug}/aula/${l.id}`}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border text-sm transition-colors',
                  active
                    ? 'bg-primary/10 border-primary text-foreground'
                    : 'bg-card border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <span className="font-extrabold text-xs opacity-60 w-5 text-center">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-bold tracking-tight truncate flex-1">{l.title}</span>
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />}
              </Link>
            );
          })}
        </aside>
      </div>
    </AcademyLayout>
  );
}

function LessonMaterialsList({ lessonId }: { lessonId: string }) {
  const { materials, loading, list } = useAcademyMaterials();
  useEffect(() => { list(lessonId); }, [lessonId, list]);

  if (loading) return null;
  if (materials.length === 0) return null;

  const githubMaterial = materials.find(m => m.is_external_url && /github\.com/.test(m.file_url));
  const guideMaterial = materials.find(m =>
    m.is_external_url
    && /GETTING_STARTED|getting-started|guia/i.test(m.file_url + ' ' + m.title)
  );

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-primary" />
        <h3 className="font-extrabold text-lg tracking-tight">Materiais desta aula</h3>
        <span className="text-xs text-muted-foreground font-light">({materials.length})</span>
      </div>
      {githubMaterial && <MaterialsUsageGuide fullGuideUrl={guideMaterial?.file_url} />}
      <MaterialGrid materials={materials} />
    </div>
  );
}
