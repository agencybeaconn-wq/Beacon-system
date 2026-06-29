import { Lock, Clock, ArrowRight, X, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PreviewModule {
  title: string;
  slug: string;
  description?: string | null;
  level?: string | null;
  cover_url?: string | null;
  lessons: string[];
}

interface Props {
  module: PreviewModule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Gradiente colorido determinístico por slug */
function gradientFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 45%) 0%, hsl(${h2} 65% 30%) 100%)`;
}

/** Gradiente P&B determinístico por string — pra thumbs de aulas bloqueadas */
function grayscaleFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const l1 = 25 + (Math.abs(hash) % 20);
  const l2 = 10 + (Math.abs(hash >> 4) % 15);
  const angle = Math.abs(hash >> 8) % 360;
  return `linear-gradient(${angle}deg, hsl(0 0% ${l1}%) 0%, hsl(0 0% ${l2}%) 100%)`;
}

export function ModulePreviewDialog({ module, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  if (!module) return null;
  const bg = module.cover_url ? undefined : gradientFor(module.slug);

  const openLessonPreview = (index: number) => {
    onOpenChange(false);
    navigate(`/academy/preview/${module.slug}/${index}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl border-border/40">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div
          className="relative aspect-[5/2] overflow-hidden"
          style={bg ? { background: bg } : undefined}
        >
          {module.cover_url && (
            <img src={module.cover_url} alt={module.title} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary shadow-2xl shadow-primary/50 flex items-center justify-center ring-4 ring-white/20">
              <Lock className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            {module.level && (
              <Badge className="mb-3 bg-background/90 text-foreground border-0 font-bold text-[10px] tracking-[0.1em] uppercase rounded-md">
                {module.level}
              </Badge>
            )}
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-[-0.02em] leading-tight">
              {module.title}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {module.description && (
            <p className="text-sm text-muted-foreground font-light leading-relaxed mb-5">
              {module.description}
            </p>
          )}

          <div className="flex items-end justify-between mb-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
              Conteúdo do curso
            </p>
            <span className="text-xs text-muted-foreground font-light">
              {module.lessons.length} aulas
            </span>
          </div>

          <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {module.lessons.map((lesson, i) => {
              const thumbBg = grayscaleFor(module.slug + '-' + i);
              return (
                <li key={i}>
                  <button
                    onClick={() => openLessonPreview(i)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-all group text-left"
                  >
                    {/* Thumbnail P&B 16:9 */}
                    <div
                      className="relative w-16 h-10 rounded-md overflow-hidden flex-shrink-0"
                      style={{ background: thumbBg }}
                    >
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="w-3 h-3 text-white/80" />
                      </div>
                    </div>

                    <span className="flex-shrink-0 w-6 text-center font-extrabold text-[11px] text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-sm font-bold tracking-tight truncate">{lesson}</span>
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                    <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                  </button>
                </li>
              );
            })}
          </ul>

          <Button className="w-full mt-6 rounded-xl font-extrabold tracking-tight gap-2 h-12">
            Desbloquear curso completo
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-[11px] text-center text-muted-foreground font-light mt-3">
            Entre em contato com o suporte para adquirir este curso.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
