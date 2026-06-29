import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { ModuleCard } from '@/components/academy/ModuleCard';
import { ModulePreviewDialog } from '@/components/academy/ModulePreviewDialog';
import { ContinueWatchingCard } from '@/components/academy/ContinueWatchingCard';
import { useAcademy, AcademyModule, AcademyLesson } from '@/hooks/useAcademy';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { useAcademyProgress, ContinueWatchingItem } from '@/hooks/useAcademyProgress';
import { useAcademyPrivateLessons } from '@/hooks/useAcademyPrivateLessons';

// Catálogo exibido quando o aluno não tem módulos reais desbloqueados.
// Cada entrada tem aulas pra poder abrir o preview dialog.
interface CatalogModule extends AcademyModule {
  lessons: string[];
}

const PLACEHOLDER_CATALOG: CatalogModule[] = [
  {
    id: 'catalog-claude-code',
    slug: 'claude-code-pratica',
    title: 'Claude Code na Prática',
    description: 'Do setup ao workflow real: skills, hooks, MCP, CLAUDE.md, sessões longas.',
    cover_url: 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/storage/v1/object/public/academy-covers/catalog/claude-code-pratica-1776350836578.jpeg',
    level: 'Iniciante',
    sort_order: 0,
    is_published: true,
    created_at: '', updated_at: '',
    lessons: [
      'Instalação e primeiro prompt',
      'Configurando CLAUDE.md',
      'Skills e comandos customizados',
      'Hooks e automações',
      'Sessões longas e compactação',
      'Integração com VS Code',
      'Projeto final: automação pessoal',
    ],
  },
  {
    id: 'catalog-antigravity',
    slug: 'antigravity-pratica',
    title: 'Antigravity na Prática',
    description: 'Ambiente agentic-first: múltiplos agentes, tool orchestration e memória persistente.',
    cover_url: 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/storage/v1/object/public/academy-covers/catalog/antigravity-pratica-1776350857548.jpeg',
    level: 'Intermediário',
    sort_order: 1,
    is_published: true,
    created_at: '', updated_at: '',
    lessons: [
      'Primeiros passos no Antigravity',
      'Agentes especialistas',
      'Orquestração paralela',
      'Memória e contexto longo',
      'Debugging multi-agente',
      'Deploy em produção',
    ],
  },
  {
    id: 'catalog-geracao-imagens',
    slug: 'geracao-imagens-ia',
    title: 'Geração de Imagens com IA',
    description: 'Midjourney, DALL-E, Flux e workflows automatizados para criativos reais.',
    cover_url: 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/storage/v1/object/public/academy-covers/catalog/geracao-imagens-ia-1776350880394.jpeg',
    level: 'Iniciante',
    sort_order: 2,
    is_published: true,
    created_at: '', updated_at: '',
    lessons: [
      'Overview dos modelos',
      'Prompt engineering visual',
      'Midjourney avançado',
      'Flux no ComfyUI',
      'Automação com APIs',
      'Pipeline de criativos Meta Ads',
    ],
  },
  {
    id: 'catalog-shopify-cli',
    slug: 'shopify-cli-com-ia',
    title: 'Shopify CLI com IA',
    description: 'Automatize desenvolvimento de temas e apps usando Claude com Shopify CLI.',
    cover_url: 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/storage/v1/object/public/academy-covers/catalog/shopify-cli-com-ia-1776350902414.jpeg',
    level: 'Intermediário',
    sort_order: 3,
    is_published: true,
    created_at: '', updated_at: '',
    lessons: [
      'Setup CLI e autenticação',
      'Theme dev com hot reload',
      'Claude editando Liquid',
      'Edge Functions via IA',
      'Deploy controlado com CI',
    ],
  },
  {
    id: 'catalog-claude-skills',
    slug: 'claude-skills-shopify',
    title: 'Claude Skills, Terminal & Sessions na Shopify',
    description: 'Construa skills reutilizáveis, workflows background-safe e sessões longas gerenciando lojas em paralelo.',
    cover_url: 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/storage/v1/object/public/academy-covers/catalog/claude-skills-shopify-1776350924305.jpeg',
    level: 'Avançado',
    sort_order: 4,
    is_published: true,
    created_at: '', updated_at: '',
    lessons: [
      'Arquitetura de skills',
      'Background-safe workflows',
      'Terminal prompt patterns',
      'Sessions persistentes',
      'Multi-loja e paralelismo',
      'Rate limiting Shopify',
      'Skills que chamam skills',
      'Case study: 10 lojas em paralelo',
    ],
  },
];

export default function AcademyHome() {
  const { modules, isLoading } = useAcademy();
  const { hasAccessTo, student, isAdmin } = useAcademyContext();
  const { getContinueWatching, getModuleProgress } = useAcademyProgress();
  const [preview, setPreview] = useState<CatalogModule | null>(null);
  const [continueItems, setContinueItems] = useState<ContinueWatchingItem[]>([]);
  const [moduleProgresses, setModuleProgresses] = useState<Record<string, number>>({});

  const { listMyPrivateLessons } = useAcademyPrivateLessons();
  const [privateLessons, setPrivateLessons] = useState<AcademyLesson[]>([]);

  useEffect(() => {
    if (!student?.id || !student?.is_mentorship_client) { setPrivateLessons([]); return; }
    (async () => {
      const ll = await listMyPrivateLessons(student.id);
      setPrivateLessons(ll);
    })();
  }, [student?.id, student?.is_mentorship_client, listMyPrivateLessons]);

  const visibleReal = useMemo(
    () => modules.filter(m => m.is_published || isAdmin),
    [modules, isAdmin]
  );
  const withAccess = visibleReal.filter(m => hasAccessTo(m.id));
  // Cursos públicos bloqueados aparecem no catálogo. Mentorias bloqueadas NÃO — só por convite.
  const lockedReal = visibleReal.filter(m => !hasAccessTo(m.id) && m.type !== 'mentoria');
  const mentoriasComAcesso = withAccess.filter(m => m.type === 'mentoria');
  const cursosComAcesso = withAccess.filter(m => m.type !== 'mentoria');

  // Carrega "continue assistindo" e progresso dos módulos desbloqueados
  useEffect(() => {
    (async () => {
      if (!student) return;
      const cw = await getContinueWatching(6);
      setContinueItems(cw);
      if (withAccess.length > 0) {
        const pairs = await Promise.all(
          withAccess.map(async m => [m.id, (await getModuleProgress(m.id)).percent] as const)
        );
        setModuleProgresses(Object.fromEntries(pairs));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, withAccess.length]);

  // Placeholders do catálogo pra slugs que ainda não têm módulo real
  const lockedCatalog = PLACEHOLDER_CATALOG.filter(
    c => !visibleReal.some(m => m.slug === c.slug)
  );

  const showEverything = withAccess.length === 0 && lockedReal.length === 0 && !isLoading;

  return (
    <AcademyLayout>
      <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-3">
          Beacon Academy
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] leading-[1.05] mb-3">
          Olá, {student?.full_name?.split(' ')[0] || 'aluno'}
        </h1>
        <p className="text-muted-foreground text-base md:text-lg font-light tracking-tight max-w-2xl">
          Sua área de membros. Cursos e mentorias adquiridos aparecerão aqui automaticamente.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Continue assistindo */}
      {continueItems.length > 0 && (
        <section className="mb-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">Retome de onde parou</p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] leading-tight">Continue assistindo</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {continueItems.map(item => (
              <ContinueWatchingCard key={item.lesson_id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Aulas privadas — só pra cliente de mentoria */}
      {student?.is_mentorship_client && privateLessons.length > 0 && (
        <section className="mb-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">🎓 Exclusivas pra você</p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] leading-tight">Minhas aulas</h2>
              <p className="text-sm text-muted-foreground font-light mt-1">Aulas gravadas especialmente pra você na sua mentoria.</p>
            </div>
            <span className="text-xs text-muted-foreground font-light pb-1">{privateLessons.length} {privateLessons.length === 1 ? 'aula' : 'aulas'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {privateLessons.map((l, i) => (
              <Link
                key={l.id}
                to={`/academy/minhas-aulas/${l.id}`}
                className="p-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:border-primary/40 transition-colors"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary mb-2">Aula {String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-extrabold tracking-tight text-base leading-tight line-clamp-2 mb-1">{l.title}</h3>
                {l.description && <p className="text-xs text-muted-foreground font-light line-clamp-2">{l.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Minhas Mentorias (acesso por convite) */}
      {mentoriasComAcesso.length > 0 && (
        <section className="mb-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">🎯 Exclusivo</p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] leading-tight">Suas mentorias</h2>
            </div>
            <span className="text-xs text-muted-foreground font-light pb-1">{mentoriasComAcesso.length} {mentoriasComAcesso.length === 1 ? 'mentoria' : 'mentorias'}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {mentoriasComAcesso.map(m => (
              <ModuleCard
                key={m.id}
                module={m}
                hasAccess={true}
                progressPercent={moduleProgresses[m.id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Seus cursos (com acesso) */}
      {cursosComAcesso.length > 0 && (
        <section className="mb-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">Desbloqueados</p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] leading-tight">Seus cursos</h2>
            </div>
            <span className="text-xs text-muted-foreground font-light pb-1">{cursosComAcesso.length} {cursosComAcesso.length === 1 ? 'curso' : 'cursos'}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {cursosComAcesso.map(m => (
              <ModuleCard
                key={m.id}
                module={m}
                hasAccess={true}
                progressPercent={moduleProgresses[m.id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Catálogo disponível (bloqueados reais + placeholders) */}
      {(lockedReal.length > 0 || lockedCatalog.length > 0) && (
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">
                {showEverything ? 'Em breve' : 'Mais conteúdo'}
              </p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] leading-tight">
                {showEverything ? 'Catálogo de cursos' : 'Disponíveis para adquirir'}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground font-light pb-1">
              {lockedReal.length + lockedCatalog.length} cursos
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {lockedReal.map(m => (
              <ModuleCard key={m.id} module={m} hasAccess={false} />
            ))}
            {lockedCatalog.map(m => (
              <ModuleCard
                key={m.id}
                module={m}
                hasAccess={false}
                lessonCount={m.lessons.length}
                onPreview={() => setPreview(m)}
              />
            ))}
          </div>
        </section>
      )}

      <ModulePreviewDialog
        module={preview}
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      />
    </AcademyLayout>
  );
}
