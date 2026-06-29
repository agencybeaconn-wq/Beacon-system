import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, PlayCircle, Package } from 'lucide-react';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { VideoPlayer } from '@/components/academy/VideoPlayer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { AcademyLesson } from '@/hooks/useAcademy';
import { useAcademyMaterials } from '@/hooks/useAcademyMaterials';
import { MaterialGrid } from '@/components/academy/MaterialCard';
import { MaterialsUsageGuide } from '@/components/academy/MaterialsUsageGuide';
import { useAcademyPrivateLessons } from '@/hooks/useAcademyPrivateLessons';
import { toast } from 'sonner';

export default function AcademyPrivateLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { student, isLoading: authLoading } = useAcademyContext();
  const { listMyPrivateLessons } = useAcademyPrivateLessons();

  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [current, setCurrent] = useState<AcademyLesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!student) {
      navigate('/academy/login');
      return;
    }
    if (!student.is_mentorship_client) {
      toast.error('Esta área é exclusiva pra alunos de mentoria');
      navigate('/academy');
      return;
    }
    (async () => {
      setLoading(true);
      const all = await listMyPrivateLessons(student.id);
      setLessons(all);
      const cur = all.find(l => l.id === lessonId);
      setCurrent(cur || all[0] || null);
      setLoading(false);
    })();
  }, [student, authLoading, lessonId, listMyPrivateLessons, navigate]);

  if (loading || authLoading) {
    return (
      <AcademyLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AcademyLayout>
    );
  }

  if (!current) {
    return (
      <AcademyLayout>
        <div className="max-w-md mx-auto py-20 text-center">
          <PlayCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h2 className="text-xl font-extrabold tracking-tight mb-2">Nenhuma aula ainda</h2>
          <p className="text-sm text-muted-foreground font-light mb-6">
            Suas aulas de mentoria aparecerão aqui quando forem gravadas.
          </p>
          <Button onClick={() => navigate('/academy')} variant="outline" className="rounded-xl font-bold tracking-tight">
            Voltar pro Academy
          </Button>
        </div>
      </AcademyLayout>
    );
  }

  return (
    <AcademyLayout>
      <Link to="/academy" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" /> Voltar pro Academy
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div>
          <div className="rounded-2xl overflow-hidden bg-black aspect-video mb-6">
            <VideoPlayer src={current.video_url} />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">🎯 Mentoria — aula privada</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] leading-tight mb-3">{current.title}</h1>
            {current.description && (
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed font-light">{current.description}</p>
            )}
            <PrivateLessonMaterialsList lessonId={current.id} />
          </div>
        </div>

        <aside className="space-y-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Minhas aulas ({lessons.length})
          </h3>
          {lessons.map((l, i) => {
            const active = l.id === current.id;
            return (
              <Link
                key={l.id}
                to={`/academy/minhas-aulas/${l.id}`}
                className={`block p-3 rounded-xl border transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border'}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Aula {String(i + 1).padStart(2, '0')}</p>
                <p className="text-sm font-bold tracking-tight line-clamp-2">{l.title}</p>
              </Link>
            );
          })}
        </aside>
      </div>
    </AcademyLayout>
  );
}

function PrivateLessonMaterialsList({ lessonId }: { lessonId: string }) {
  const { materials, loading, list } = useAcademyMaterials();
  useEffect(() => { list(lessonId); }, [lessonId, list]);
  if (loading || materials.length === 0) return null;

  // Detecta se tem algum material que seja repositório GitHub — se sim, mostra o guia
  const githubMaterial = materials.find(m => m.is_external_url && /github\.com/.test(m.file_url));
  const guideMaterial = materials.find(m =>
    m.is_external_url
    && /GETTING_STARTED|getting-started|guia/i.test(m.file_url + ' ' + m.title)
  );

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-primary" />
        <h3 className="font-extrabold text-lg tracking-tight">Materiais da aula</h3>
        <span className="text-xs text-muted-foreground font-light">({materials.length})</span>
      </div>
      {githubMaterial && <MaterialsUsageGuide fullGuideUrl={guideMaterial?.file_url} />}
      <MaterialGrid materials={materials} />
    </div>
  );
}
