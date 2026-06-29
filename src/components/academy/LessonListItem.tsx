import { Link } from 'react-router-dom';
import { PlayCircle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AcademyLesson } from '@/hooks/useAcademy';

interface Props {
  lesson: AcademyLesson;
  moduleSlug: string;
  isActive?: boolean;
  index: number;
  completed?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LessonListItem({ lesson, moduleSlug, isActive, index, completed }: Props) {
  return (
    <Link
      to={`/academy/curso/${moduleSlug}/aula/${lesson.id}`}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border transition-all group',
        isActive
          ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
          : 'bg-card border-border/40 hover:bg-muted/50 hover:border-primary/30'
      )}
    >
      <div className={cn(
        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-extrabold text-sm transition-colors',
        completed
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : 'bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground'
      )}>
        {completed
          ? <CheckCircle2 className="w-5 h-5" />
          : <span>{String(index + 1).padStart(2, '0')}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm tracking-tight truncate">{lesson.title}</h4>
        {lesson.description && (
          <p className="text-xs text-muted-foreground truncate font-light">{lesson.description}</p>
        )}
      </div>
      {lesson.duration_seconds && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-light">
          <Clock className="w-3 h-3" />
          {formatDuration(lesson.duration_seconds)}
        </div>
      )}
      <PlayCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}
