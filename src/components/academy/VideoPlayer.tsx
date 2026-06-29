import { useEffect, useRef } from 'react';

interface Props {
  src: string;
  poster?: string | null;
  autoPlay?: boolean;
  initialTime?: number;
  onTimeUpdate?: (currentSec: number, durationSec: number) => void;
  onEnded?: (durationSec: number) => void;
  onLoadedDuration?: (durationSec: number) => void;
}

type Provider = 'native' | 'loom' | 'youtube' | 'vimeo';

function detectProvider(src: string): { type: Provider; embedUrl: string } {
  if (!src) return { type: 'native', embedUrl: src };
  const loomShare = src.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomShare) return { type: 'loom', embedUrl: `https://www.loom.com/embed/${loomShare[1]}` };
  if (/loom\.com\/embed\//.test(src)) return { type: 'loom', embedUrl: src };
  const yt = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  if (yt) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { type: 'native', embedUrl: src };
}

export function VideoPlayer({
  src, poster, autoPlay = false,
  initialTime, onTimeUpdate, onEnded, onLoadedDuration,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const initialApplied = useRef(false);
  const { type, embedUrl } = detectProvider(src);

  useEffect(() => { initialApplied.current = false; }, [src]);

  if (type !== 'native') {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl shadow-primary/10">
        <iframe
          key={embedUrl}
          src={embedUrl}
          className="w-full h-full"
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const handleLoaded = () => {
    const v = ref.current;
    if (!v) return;
    onLoadedDuration?.(v.duration || 0);
    if (initialTime && initialTime > 1 && !initialApplied.current && v.duration > 0) {
      if (initialTime < v.duration - 5) {
        v.currentTime = initialTime;
      }
      initialApplied.current = true;
    }
  };

  const handleTimeUpdate = () => {
    const v = ref.current;
    if (!v || !onTimeUpdate) return;
    onTimeUpdate(v.currentTime, v.duration || 0);
  };

  const handleEnded = () => {
    const v = ref.current;
    if (!v) return;
    onEnded?.(v.duration || 0);
  };

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl shadow-primary/10">
      <video
        ref={ref}
        key={src}
        src={src}
        poster={poster || undefined}
        controls
        autoPlay={autoPlay}
        playsInline
        controlsList="nodownload"
        className="w-full h-full"
        onLoadedMetadata={handleLoaded}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
    </div>
  );
}
