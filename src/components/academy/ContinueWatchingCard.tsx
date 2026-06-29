import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import type { ContinueWatchingItem } from '@/hooks/useAcademyProgress';

function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 45%) 0%, hsl(${(h1 + 45) % 360} 65% 30%) 100%)`;
}

export function ContinueWatchingCard({ item }: { item: ContinueWatchingItem }) {
  const bg = item.lesson_thumbnail_url ? undefined : gradientFor(item.module_slug + '-' + item.lesson_id);

  return (
    <Link
      to={`/academy/curso/${item.module_slug}/aula/${item.lesson_id}`}
      className="group flex items-center gap-4 p-3 rounded-2xl border border-border/40 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all"
    >
      <div
        className="relative w-28 md:w-36 aspect-video rounded-xl overflow-hidden flex-shrink-0"
        style={bg ? { background: bg } : undefined}
      >
        {item.lesson_thumbnail_url && (
          <img src={item.lesson_thumbnail_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <PlayCircle className="w-8 h-8 text-white drop-shadow-lg" />
        </div>
        {item.percent > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${item.percent}%` }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary mb-1 truncate">
          {item.module_title}
        </p>
        <h4 className="font-bold text-sm md:text-base tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
          {item.lesson_title}
        </h4>
        {item.percent > 0 && (
          <p className="text-[11px] text-muted-foreground font-light mt-1">
            {item.percent}% assistido · continuar
          </p>
        )}
      </div>
    </Link>
  );
}
