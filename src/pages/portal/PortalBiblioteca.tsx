import { useState, useRef, useEffect } from 'react';
import { useLibrary, LibraryList, LibraryVideo } from '@/hooks/useLibrary';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, X, ChevronLeft, ChevronRight, Loader2, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import leverLogo from '@/assets/lever-logo.png';

// Netflix-style horizontal scroll row
function VideoRow({ list, onVideoClick }: { list: LibraryList; onVideoClick: (video: LibraryVideo) => void }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    };

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (el) el.addEventListener('scroll', checkScroll);
        return () => el?.removeEventListener('scroll', checkScroll);
    }, [list.videos]);

    const scroll = (dir: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const amount = el.clientWidth * 0.75;
        el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    if (!list.videos || list.videos.length === 0) return null;

    return (
        <div className="space-y-3 group/row">
            <h3 className="text-xl md:text-2xl font-bold text-white px-4 md:px-8 tracking-tight">
                {list.title}
            </h3>
            <div className="relative">
                {canScrollLeft && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-0 bottom-0 w-12 md:w-16 z-10 bg-gradient-to-r from-[#0a0a0a] to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
                    >
                        <ChevronLeft className="w-8 h-8 text-white" />
                    </button>
                )}
                <div
                    ref={scrollRef}
                    className="flex gap-2 md:gap-3 overflow-x-auto px-4 md:px-8 scroll-smooth"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {list.videos!.map((video) => (
                        <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} />
                    ))}
                </div>
                {canScrollRight && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-0 bottom-0 w-12 md:w-16 z-10 bg-gradient-to-l from-[#0a0a0a] to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
                    >
                        <ChevronRight className="w-8 h-8 text-white" />
                    </button>
                )}
            </div>
        </div>
    );
}

// Individual Video Card
function VideoCard({ video, onClick }: { video: LibraryVideo; onClick: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={cn(
                "relative shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group/card",
                "w-[200px] md:w-[280px] lg:w-[320px]",
                isHovered ? "scale-105 z-20 shadow-2xl shadow-black/50 ring-1 ring-white/20" : "scale-100"
            )}
            onMouseEnter={() => {
                setIsHovered(true);
                videoRef.current?.play().catch(() => { });
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                if (videoRef.current) {
                    videoRef.current.pause();
                    videoRef.current.currentTime = 0;
                }
            }}
            onClick={onClick}
        >
            <div className="aspect-video bg-neutral-900">
                <video
                    ref={videoRef}
                    src={video.video_url}
                    muted
                    loop
                    preload="metadata"
                    className="w-full h-full object-cover"
                />
            </div>
            <div className={cn(
                "absolute inset-0 transition-opacity duration-200",
                isHovered ? "opacity-0" : "opacity-100"
            )}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                    <p className="text-white text-sm font-semibold truncate">{video.title}</p>
                </div>
            </div>
            {isHovered && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-3">
                    <p className="text-white text-sm font-bold mb-1">{video.title}</p>
                    {video.description && (
                        <p className="text-white/60 text-[11px] line-clamp-2 leading-tight">{video.description}</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PortalBiblioteca() {
    const { lists, isLoading } = useLibrary();
    const [selectedVideo, setSelectedVideo] = useState<LibraryVideo | null>(null);

    const nonEmptyLists = lists.filter(l => l.videos && l.videos.length > 0);
    const heroVideo = nonEmptyLists[0]?.videos?.[0] || null;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto" />
                    <p className="text-white/50 text-sm">Carregando biblioteca...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* 
              Since PortalLayout now omits padding and max-w for this route, 
              we can just use a standard block container. No absolute positioning needed.
            */}
            <div className="bg-[#0a0a0a] min-h-[100vh] w-full flex flex-col pb-16">
                {/* ===== HERO SECTION ===== */}
                <div className="relative w-full h-[50vh] md:h-[60vh] shrink-0 overflow-hidden">
                    {heroVideo ? (
                        <video
                            src={heroVideo.video_url}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-[#0a0a0a] to-[#0a0a0a]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-transparent to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 space-y-4">
                        <img src={leverLogo} alt="Beacon" className="h-9 w-auto" />

                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[0.9]">
                            Biblioteca de Criativos
                        </h1>
                        <p className="text-white/60 text-sm md:text-base max-w-xl leading-relaxed">
                            Explore os melhores formatos para aumentar a conversão dos seus anúncios.
                        </p>

                        {heroVideo && (
                            <Button
                                onClick={() => setSelectedVideo(heroVideo)}
                                className="h-11 px-7 bg-white text-black hover:bg-white/90 font-bold text-sm rounded-lg gap-2 group"
                            >
                                <Play className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                                Assistir
                            </Button>
                        )}
                    </div>
                </div>

                {/* ===== VIDEO ROWS ===== */}
                {nonEmptyLists.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <Film className="w-16 h-16 mx-auto mb-4 text-white/10" />
                        <h3 className="text-xl font-bold text-white/50">Biblioteca vazia</h3>
                        <p className="text-white/30 text-sm mt-2">Ainda não há vídeos disponíveis.</p>
                    </div>
                ) : (
                    <div className="space-y-10 md:space-y-12 py-8 pb-16">
                        {nonEmptyLists.map((list) => (
                            <VideoRow key={list.id} list={list} onVideoClick={setSelectedVideo} />
                        ))}
                    </div>
                )}
            </div>

            {/* ===== VIDEO MODAL — Video Left (compact), Text Right (scrollable) ===== */}
            <Dialog open={selectedVideo !== null} onOpenChange={(open) => { if (!open) setSelectedVideo(null); }}>
                <DialogContent className="max-w-[1000px] w-[95vw] p-0 overflow-hidden bg-[#111] border border-white/10 rounded-2xl gap-0">
                    {selectedVideo && (
                        <div className="flex flex-col md:flex-row h-auto max-h-[85vh]">
                            {/* Close */}
                            <button
                                onClick={() => setSelectedVideo(null)}
                                className="absolute top-4 right-4 z-50 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>

                            {/* LEFT: Video Player — compact, centered, with padding so it's not glued to edges */}
                            <div className="md:flex-1 bg-black flex items-center justify-center p-4 md:p-8 lg:p-12 min-h-[30vh]">
                                <video
                                    key={selectedVideo.id}
                                    src={selectedVideo.video_url}
                                    controls
                                    autoPlay
                                    playsInline
                                    className="w-full h-auto max-h-[40vh] md:max-h-[65vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                                />
                            </div>

                            {/* RIGHT: Info Panel — always scrollable */}
                            <div className="w-full md:w-[340px] lg:w-[400px] shrink-0 border-t md:border-t-0 md:border-l border-white/5 bg-[#111] overflow-y-auto flex flex-col max-h-[50vh] md:max-h-[85vh]">
                                <div className="p-6 md:p-8 space-y-5">
                                    <img src={leverLogo} alt="Beacon" className="h-6 w-auto opacity-50" />

                                    <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
                                        {selectedVideo.title}
                                    </h2>

                                    <span className="text-xs text-white/40 block font-medium">
                                        {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </span>

                                    <div className="h-px w-full bg-gradient-to-r from-red-500/40 via-white/10 to-transparent" />

                                    {selectedVideo.description && (
                                        <p className="text-white/70 text-[15px] leading-relaxed whitespace-pre-wrap pb-8">
                                            {selectedVideo.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
