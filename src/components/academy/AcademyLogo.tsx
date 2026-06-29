import leverLogo from '@/assets/lever-logo.png';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AcademyLogo({ className, size = 'md' }: Props) {
  const sizes = {
    sm: { img: 'w-7 h-7', text: 'text-base' },
    md: { img: 'w-9 h-9', text: 'text-xl' },
    lg: { img: 'w-12 h-12', text: 'text-2xl' },
  };
  const s = sizes[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={leverLogo} alt="Beacon" className={cn(s.img, 'object-contain')} />
      <span className={cn('font-extrabold tracking-tight', s.text)}>
        Beacon <span className="font-light tracking-wide uppercase text-muted-foreground">Academy</span>
      </span>
    </div>
  );
}
