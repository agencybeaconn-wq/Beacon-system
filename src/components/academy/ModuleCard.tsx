import { Link } from 'react-router-dom';
import { Lock, PlayCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AcademyModule } from '@/hooks/useAcademy';

interface Props {
  module: AcademyModule;
  hasAccess: boolean;
  lessonCount?: number;
  progressPercent?: number;
  onPreview?: () => void;
}

/**
 * Gera gradiente determinístico a partir do slug.
 * Mesma capa pro mesmo curso, sempre.
 */
function gradientFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 45%) 0%, hsl(${h2} 65% 30%) 100%)`;
}

export function ModuleCard({ module, hasAccess, lessonCount, progressPercent, onPreview }: Props) {
  const bg = module.cover_url ? undefined : gradientFor(module.slug || module.title);
  const isCompleted = typeof progressPercent === 'number' && progressPercent >= 100;
  const hasProgress = typeof progressPercent === 'number' && progressPercent > 0;

  const Content = (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/40 bg-card cursor-pointer transition-all duration-300',
        'hover:border-primary/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10'
      )}
    >
      {/* Capa vertical 2:3 (feed Instagram) */}
      <div
        className="relative aspect-[2/3] overflow-hidden"
        style={bg ? { background: bg } : undefined}
      >
        {module.cover_url && (
          <img
            src={module.cover_url}
            alt={module.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        )}

        {/* Overlay gradient baixo (sempre, pra dar legibilidade) */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

        {/* Level badge top-left */}
        {module.level && (
          <Badge className="absolute top-3 left-3 bg-background/90 text-foreground border-0 font-bold text-[10px] tracking-[0.1em] uppercase rounded-md backdrop-blur">
            {module.level}
          </Badge>
        )}

        {/* Lock badge bloqueado */}
        {!hasAccess && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary shadow-xl shadow-primary/40 flex items-center justify-center ring-4 ring-background/30 backdrop-blur-sm">
              <Lock className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
        )}

        {/* Play icon access = yes, sem cover */}
        {hasAccess && !module.cover_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="w-14 h-14 text-white/80 group-hover:scale-110 transition-transform" />
          </div>
        )}

        {/* Badge concluído */}
        {hasAccess && isCompleted && (
          <Badge className="absolute top-3 right-3 bg-green-500/90 text-white border-0 font-bold text-[10px] tracking-[0.1em] uppercase rounded-md backdrop-blur gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Concluído
          </Badge>
        )}

        {/* Info overlay no rodapé da capa */}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="text-base md:text-lg font-extrabold tracking-[-0.02em] leading-tight line-clamp-2 mb-1">
            {module.title}
          </h3>
          {typeof lessonCount === 'number' && (
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">
              {lessonCount} {lessonCount === 1 ? 'aula' : 'aulas'}
            </p>
          )}
        </div>

        {/* Barrinha de progresso */}
        {hasAccess && hasProgress && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, progressPercent!)}%` }}
            />
          </div>
        )}
      </div>

      {/* Rodapé: descrição + CTA */}
      {module.description && (
        <div className="p-4 border-t border-border/40">
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 font-light leading-relaxed">
            {module.description}
          </p>
          {!hasAccess && (
            <div className="mt-3 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
              <span>Desbloquear curso</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </div>
      )}
    </article>
  );

  // Bloqueado com preview: abre dialog
  if (!hasAccess && onPreview) {
    return <button onClick={onPreview} className="text-left w-full">{Content}</button>;
  }
  // Acessível com slug real: navega pro módulo
  if (hasAccess && module.slug && module.slug !== '#') {
    return <Link to={`/academy/curso/${module.slug}`} className="block">{Content}</Link>;
  }
  // Fallback
  return <div>{Content}</div>;
}
