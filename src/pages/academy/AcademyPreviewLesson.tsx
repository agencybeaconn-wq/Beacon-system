import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, PlayCircle } from 'lucide-react';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CommentsSection } from '@/components/academy/CommentsSection';
import { toast } from 'sonner';

// Catálogo placeholder — mesmo do AcademyHome, replicado aqui pra independência.
// Quando tiver conteúdo real, essa página some e o aluno usa AcademyLesson com video_url do banco.
const CATALOG: Record<string, { title: string; level: string; description: string; lessons: string[] }> = {
  'claude-code-pratica': {
    title: 'Claude Code na Prática',
    level: 'Iniciante',
    description: 'Do setup ao workflow real: skills, hooks, MCP, CLAUDE.md, sessões longas.',
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
  'antigravity-pratica': {
    title: 'Antigravity na Prática',
    level: 'Intermediário',
    description: 'Ambiente agentic-first: múltiplos agentes, tool orchestration e memória persistente.',
    lessons: ['Primeiros passos no Antigravity', 'Agentes especialistas', 'Orquestração paralela', 'Memória e contexto longo', 'Debugging multi-agente', 'Deploy em produção'],
  },
  'geracao-imagens-ia': {
    title: 'Geração de Imagens com IA',
    level: 'Iniciante',
    description: 'Midjourney, DALL-E, Flux e workflows automatizados para criativos reais.',
    lessons: ['Overview dos modelos', 'Prompt engineering visual', 'Midjourney avançado', 'Flux no ComfyUI', 'Automação com APIs', 'Pipeline de criativos Meta Ads'],
  },
  'shopify-cli-com-ia': {
    title: 'Shopify CLI com IA',
    level: 'Intermediário',
    description: 'Automatize desenvolvimento de temas e apps usando Claude com Shopify CLI.',
    lessons: ['Setup CLI e autenticação', 'Theme dev com hot reload', 'Claude editando Liquid', 'Edge Functions via IA', 'Deploy controlado com CI'],
  },
  'claude-skills-shopify': {
    title: 'Claude Skills, Terminal & Sessions na Shopify',
    level: 'Avançado',
    description: 'Construa skills reutilizáveis, workflows background-safe e sessões longas gerenciando lojas em paralelo.',
    lessons: ['Arquitetura de skills', 'Background-safe workflows', 'Terminal prompt patterns', 'Sessions persistentes', 'Multi-loja e paralelismo', 'Rate limiting Shopify', 'Skills que chamam skills', 'Case study: 10 lojas em paralelo'],
  },
};

function grayscaleFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const l1 = 25 + (Math.abs(hash) % 20);
  const l2 = 10 + (Math.abs(hash >> 4) % 15);
  const angle = Math.abs(hash >> 8) % 360;
  return `linear-gradient(${angle}deg, hsl(0 0% ${l1}%) 0%, hsl(0 0% ${l2}%) 100%)`;
}

export default function AcademyPreviewLesson() {
  const { slug, idx } = useParams<{ slug: string; idx: string }>();
  const navigate = useNavigate();

  const module = slug ? CATALOG[slug] : null;
  const lessonIdx = parseInt(idx || '0', 10);
  const lessonTitle = module?.lessons[lessonIdx];
  const fakeLessonId = `preview-${slug}-${lessonIdx}`;

  const thumbBg = useMemo(
    () => grayscaleFor((slug || '') + '-' + lessonIdx),
    [slug, lessonIdx]
  );

  if (!module || !lessonTitle) {
    return (
      <AcademyLayout>
        <p className="text-muted-foreground">Aula não encontrada.</p>
      </AcademyLayout>
    );
  }

  const prev = lessonIdx > 0 ? lessonIdx - 1 : null;
  const next = lessonIdx < module.lessons.length - 1 ? lessonIdx + 1 : null;

  return (
    <AcademyLayout>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 font-bold tracking-tight"
        onClick={() => navigate('/academy')}
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8">
        {/* Main */}
        <div>
          {/* Player placeholder P&B */}
          <div
            className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl shadow-primary/5"
            style={{ background: thumbBg }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
            {/* "Play button" de placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary shadow-2xl shadow-primary/60 flex items-center justify-center ring-4 ring-white/20">
                <Lock className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            {/* Barra de "progresso" falsa */}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full w-0 bg-primary" />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-white/70 uppercase tracking-[0.12em]">
                <span>Pré-visualização bloqueada</span>
                <span>—:— / 12:34</span>
              </div>
            </div>
          </div>

          {/* Header aula */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-[10px] tracking-[0.12em] uppercase rounded-md">
                {module.level}
              </Badge>
              <span className="text-xs text-muted-foreground font-bold tracking-[0.1em] uppercase">
                Aula {String(lessonIdx + 1).padStart(2, '0')} · {module.title}
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-[-0.03em] leading-[1.1] mb-3">
              {lessonTitle}
            </h1>
            <p className="text-muted-foreground font-light leading-relaxed">
              Esta aula faz parte do curso <strong className="font-bold text-foreground">{module.title}</strong>. Para assistir o conteúdo completo, desbloqueie o curso ou fale com o suporte.
            </p>

            <Button className="mt-5 rounded-xl font-extrabold tracking-tight gap-2 h-11">
              Desbloquear curso completo
              <PlayCircle className="w-4 h-4" />
            </Button>
          </div>

          {/* Comentários em modo preview (fakes) */}
          <div className="mt-10 pt-8 border-t border-border/40">
            <CommentsSection
              lessonId={fakeLessonId}
              isPreview
              onPreviewPost={() => toast.info('Comentários liberados após desbloquear o curso.')}
            />
          </div>

          {/* Navegação */}
          <div className="mt-8 pt-6 border-t border-border/40 flex gap-3">
            {prev !== null ? (
              <Button variant="outline" asChild className="flex-1 rounded-xl h-12 font-bold tracking-tight">
                <Link to={`/academy/preview/${slug}/${prev}`}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Aula anterior
                </Link>
              </Button>
            ) : <div className="flex-1" />}
            {next !== null && (
              <Button asChild className="flex-1 rounded-xl h-12 font-bold tracking-tight">
                <Link to={`/academy/preview/${slug}/${next}`}>
                  Próxima aula
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar: lista de aulas */}
        <aside>
          <div className="sticky top-4">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-1">
                  {module.title}
                </p>
                <h3 className="text-base font-extrabold tracking-[-0.02em]">
                  {module.lessons.length} aulas
                </h3>
              </div>
            </div>
            <ul className="space-y-1.5">
              {module.lessons.map((l, i) => {
                const isCurrent = i === lessonIdx;
                const thumb = grayscaleFor((slug || '') + '-' + i);
                return (
                  <li key={i}>
                    <Link
                      to={`/academy/preview/${slug}/${i}`}
                      className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border/40 hover:border-primary/40'
                      }`}
                    >
                      <div
                        className="relative w-14 h-9 rounded-md overflow-hidden flex-shrink-0"
                        style={{ background: thumb }}
                      >
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-3 h-3 text-white/80" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold tracking-tight truncate ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {String(i + 1).padStart(2, '0')}. {l}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </AcademyLayout>
  );
}
