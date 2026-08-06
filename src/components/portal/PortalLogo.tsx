import nodeLogo from '@/assets/node-logo.png';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PortalLogo({ className, size = 'md' }: Props) {
  const sizes = {
    sm: { img: 'h-4', text: 'text-base' },
    md: { img: 'h-5', text: 'text-xl' },
    lg: { img: 'h-7', text: 'text-2xl' },
  };
  const s = sizes[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={nodeLogo} alt="NODE" className={cn(s.img, 'w-auto object-contain')} />
      <span className={cn('font-light tracking-wide uppercase text-muted-foreground', s.text)}>Portal</span>
    </div>
  );
}
