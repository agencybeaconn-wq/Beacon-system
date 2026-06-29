/**
 * Treinamentos — Biblioteca Interna (Netflix-style)
 *
 * Plataforma de estudos para funcionários da agência.
 * Exibe vídeos organizados por módulos com scroll horizontal.
 * Admins veem botão para gerenciar conteúdo.
 */

import { useState, useRef, useEffect } from 'react';
import { useTrainingLibrary, TrainingList, TrainingVideo } from '@/hooks/useTrainingLibrary';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, X, ChevronLeft, ChevronRight, Loader2, GraduationCap, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';
import leverLogo from '@/assets/lever-logo.png';

// ─── Horizontal Scroll Row ──────────────────────────────────────────────────────

function VideoRow({ list, onVideoClick }: { list: TrainingList; onVideoClick: (video: TrainingVideo) => void }) {
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
            {list.description && (
                <p className="text-white/40 text-sm px-4 md:px-8 -mt-1">{list.description}</p>
            )}
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

// ─── Video Card ─────────────────────────────────────────────────────────────────

function VideoCard({ video, onClick }: { video: TrainingVideo; onClick: () => void }) {
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

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function TrainingLibrary() {
    const { lists, isLoading } = useTrainingLibrary();
    const { isAdmin } = usePermissions();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/agency') ? '/agency/treinamentos' : '/treinamentos';
    const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);

    const nonEmptyLists = lists.filter(l => l.videos && l.videos.length > 0);
    const heroVideo = nonEmptyLists[0]?.videos?.[0] || null;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground text-sm">Carregando treinamentos...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-[#0a0a0a] min-h-[calc(100vh-64px)] w-full flex flex-col pb-16 -m-6 md:-m-8">
                {/* ===== HERO SECTION ===== */}
                <div className="relative w-full h-[40vh] md:h-[50vh] shrink-0 overflow-hidden">
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
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-[#0a0a0a] to-[#0a0a0a]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-transparent to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                            <img src={leverLogo} alt="Beacon" className="h-7 w-auto opacity-60" />
                        </div>

                        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[0.9]">
                            Base de Conhecimento
                        </h1>
                        <p className="text-white/60 text-sm md:text-base max-w-xl leading-relaxed">
                            Treinamentos internos da agência. Aprenda processos, ferramentas e boas práticas.
                        </p>

                        <div className="flex gap-3">
                            {heroVideo && (
                                <Button
                                    onClick={() => setSelectedVideo(heroVideo)}
                                    className="h-11 px-7 bg-white text-black hover:bg-white/90 font-bold text-sm rounded-lg gap-2 group"
                                >
                                    <Play className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                                    Assistir
                                </Button>
                            )}
                            {isAdmin && (
                                <Link to={`${basePath}/gerenciar`}>
                                    <Button
                                        variant="outline"
                                        className="h-11 px-6 border-white/20 text-white hover:bg-white/10 font-bold text-sm rounded-lg gap-2"
                                    >
                                        <Settings2 className="w-4 h-4" />
                                        Gerenciar
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== VIDEO ROWS ===== */}
                {nonEmptyLists.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <GraduationCap className="w-16 h-16 mx-auto mb-4 text-white/10" />
                        <h3 className="text-xl font-bold text-white/50">Nenhum treinamento disponível</h3>
                        <p className="text-white/30 text-sm mt-2">
                            {isAdmin
                                ? 'Clique em "Gerenciar" para adicionar treinamentos.'
                                : 'Aguarde novos conteúdos da sua equipe.'
                            }
                        </p>
                        {isAdmin && (
                            <Link to="/treinamentos/gerenciar">
                                <Button className="mt-6 bg-violet-600 hover:bg-violet-700 font-bold gap-2">
                                    <Settings2 className="w-4 h-4" /> Gerenciar Treinamentos
                                </Button>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-10 md:space-y-12 py-8 pb-16">
                        {nonEmptyLists.map((list) => (
                            <VideoRow key={list.id} list={list} onVideoClick={setSelectedVideo} />
                        ))}
                    </div>
                )}
            </div>

            {/* ===== VIDEO MODAL ===== */}
            <Dialog open={selectedVideo !== null} onOpenChange={(open) => { if (!open) setSelectedVideo(null); }}>
                <DialogContent className="max-w-[90vw] md:max-w-[80vw] lg:max-w-[1000px] w-full p-0 overflow-hidden bg-[#111] border border-white/10 rounded-2xl gap-0">
                    {selectedVideo && (
                        <div className="flex flex-col max-h-[90vh]">
                            <button
                                onClick={() => setSelectedVideo(null)}
                                className="absolute top-3 right-3 z-50 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>

                            <div className="bg-black flex items-center justify-center w-full">
                                <video
                                    key={selectedVideo.id}
                                    src={selectedVideo.video_url}
                                    controls
                                    autoPlay
                                    playsInline
                                    className="w-full max-h-[65vh] object-contain"
                                />
                            </div>

                            <div className="p-5 md:p-6 space-y-3 border-t border-white/5 overflow-y-auto max-h-[25vh]">
                                <div className="flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-violet-400 shrink-0" />
                                    <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Treinamento</span>
                                    <span className="text-[10px] text-white/30 ml-auto">
                                        {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight leading-tight">
                                    {selectedVideo.title}
                                </h2>
                                {selectedVideo.description && (
                                    <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedVideo.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
