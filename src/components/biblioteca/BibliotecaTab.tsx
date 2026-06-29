import { useState, useRef } from 'react';
import { useLibrary, LibraryList, LibraryVideo } from '@/hooks/useLibrary';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Film, Plus, Trash2, Edit3, Upload, Loader2, ChevronDown, ChevronRight,
    Play, GripVertical, MoreVertical, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BibliotecaTab() {
    const { lists, isLoading, createList, updateList, deleteList, uploadVideo, updateVideo, deleteVideo } = useLibrary();

    // Create List state
    const [showNewList, setShowNewList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Expanded lists
    const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

    // Upload state
    const [uploadingListId, setUploadingListId] = useState<string | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit video modal
    const [editingVideo, setEditingVideo] = useState<LibraryVideo | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Video preview modal
    const [previewVideo, setPreviewVideo] = useState<LibraryVideo | null>(null);

    // Edit list modal
    const [editingList, setEditingList] = useState<LibraryList | null>(null);
    const [editListTitle, setEditListTitle] = useState('');

    const toggleList = (id: string) => {
        setExpandedLists(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCreateList = async () => {
        if (!newListTitle.trim()) return;
        setIsCreating(true);
        await createList(newListTitle.trim());
        setNewListTitle('');
        setShowNewList(false);
        setIsCreating(false);
    };

    const handleUpload = async () => {
        if (!uploadFile || !uploadTitle.trim() || !uploadingListId) return;
        setIsUploading(true);
        await uploadVideo(uploadingListId, uploadFile, uploadTitle.trim(), uploadDescription.trim());
        setUploadFile(null);
        setUploadTitle('');
        setUploadDescription('');
        setUploadingListId(null);
        setIsUploading(false);
    };

    const handleEditVideo = async () => {
        if (!editingVideo) return;
        await updateVideo(editingVideo.id, {
            title: editTitle.trim(),
            description: editDescription.trim()
        });
        setEditingVideo(null);
    };

    const handleDeleteList = async (id: string) => {
        if (!window.confirm('Excluir esta lista e todos os seus vídeos?')) return;
        await deleteList(id);
    };

    const handleDeleteVideo = async (video: LibraryVideo) => {
        if (!window.confirm(`Excluir o vídeo "${video.title}"?`)) return;
        await deleteVideo(video.id, video.video_url);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
                        <Film className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Biblioteca de Vídeos</h2>
                        <p className="text-xs text-muted-foreground">{lists.length} {lists.length === 1 ? 'lista' : 'listas'} • {lists.reduce((acc, l) => acc + (l.videos?.length || 0), 0)} vídeos</p>
                    </div>
                </div>
                <Button
                    onClick={() => setShowNewList(true)}
                    className="h-10 px-6 bg-red-600 hover:bg-red-700 font-bold gap-2"
                >
                    <Plus className="w-4 h-4" /> Nova Lista
                </Button>
            </div>

            {/* Create List Inline */}
            {showNewList && (
                <Card className="p-4 border-red-500/30 bg-red-500/5 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-3">
                        <Input
                            placeholder="Nome da lista (ex: UGC, Criativos, Referências...)"
                            value={newListTitle}
                            onChange={(e) => setNewListTitle(e.target.value)}
                            className="h-11 flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                        />
                        <Button
                            onClick={handleCreateList}
                            disabled={isCreating || !newListTitle.trim()}
                            className="h-11 px-6 bg-red-600 hover:bg-red-700 font-bold"
                        >
                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
                        </Button>
                        <Button variant="ghost" onClick={() => setShowNewList(false)} className="h-11">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </Card>
            )}

            {/* Lists */}
            {lists.length === 0 ? (
                <Card className="p-12 text-center bg-card border-border/50 border-dashed">
                    <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                    <h3 className="text-lg font-medium">Nenhuma lista criada</h3>
                    <p className="text-muted-foreground mt-2 text-sm">Crie sua primeira lista para começar a organizar vídeos.</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {lists.map((list) => {
                        const isExpanded = expandedLists.has(list.id);
                        const videoCount = list.videos?.length || 0;

                        return (
                            <Card key={list.id} className="overflow-hidden bg-card border-border/50 hover:border-border transition-colors">
                                {/* List Header */}
                                <div
                                    className="flex items-center gap-3 p-4 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                                    onClick={() => toggleList(list.id)}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                        {isExpanded ? (
                                            <ChevronDown className="w-4 h-4 text-red-500" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-red-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-bold truncate">{list.title}</h3>
                                        <p className="text-xs text-muted-foreground">{videoCount} {videoCount === 1 ? 'vídeo' : 'vídeos'}</p>
                                    </div>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                                            onClick={() => {
                                                setUploadingListId(list.id);
                                                setUploadFile(null);
                                                setUploadTitle('');
                                                setUploadDescription('');
                                            }}
                                        >
                                            <Upload className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => {
                                                setEditingList(list);
                                                setEditListTitle(list.title);
                                            }}
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                            onClick={() => handleDeleteList(list.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded Videos Grid */}
                                {isExpanded && (
                                    <div className="border-t border-border/50 p-4">
                                        {videoCount === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground text-sm">
                                                <Play className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                <p>Nenhum vídeo nesta lista.</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-3 gap-2"
                                                    onClick={() => {
                                                        setUploadingListId(list.id);
                                                        setUploadFile(null);
                                                        setUploadTitle('');
                                                        setUploadDescription('');
                                                    }}
                                                >
                                                    <Upload className="w-3 h-3" /> Adicionar Vídeo
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                                {list.videos!.map((video) => (
                                                    <div
                                                        key={video.id}
                                                        className="group relative rounded-xl overflow-hidden bg-black/20 border border-white/5 hover:border-white/15 transition-all cursor-pointer aspect-video"
                                                        onClick={() => setPreviewVideo(video)}
                                                    >
                                                        {/* Video Thumbnail / Preview */}
                                                        <video
                                                            src={video.video_url}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            preload="metadata"
                                                            onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => { })}
                                                            onMouseLeave={(e) => {
                                                                const v = e.target as HTMLVideoElement;
                                                                v.pause();
                                                                v.currentTime = 0;
                                                            }}
                                                        />
                                                        {/* Play overlay */}
                                                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                <Play className="w-5 h-5 text-white fill-white" />
                                                            </div>
                                                        </div>
                                                        {/* Title */}
                                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                                            <p className="text-white text-xs font-medium truncate">{video.title}</p>
                                                        </div>
                                                        {/* Actions */}
                                                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                className="w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-blue-600 transition-colors"
                                                                onClick={() => {
                                                                    setEditingVideo(video);
                                                                    setEditTitle(video.title);
                                                                    setEditDescription(video.description || '');
                                                                }}
                                                            >
                                                                <Edit3 className="w-3 h-3 text-white" />
                                                            </button>
                                                            <button
                                                                className="w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-red-600 transition-colors"
                                                                onClick={() => handleDeleteVideo(video)}
                                                            >
                                                                <Trash2 className="w-3 h-3 text-white" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {/* Add More Card */}
                                                <div
                                                    className="rounded-xl border-2 border-dashed border-white/10 hover:border-red-500/30 transition-colors aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-red-500/5"
                                                    onClick={() => {
                                                        setUploadingListId(list.id);
                                                        setUploadFile(null);
                                                        setUploadTitle('');
                                                        setUploadDescription('');
                                                    }}
                                                >
                                                    <Plus className="w-6 h-6 text-muted-foreground mb-1" />
                                                    <span className="text-[10px] text-muted-foreground font-medium">Adicionar</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* === UPLOAD MODAL === */}
            <Dialog open={uploadingListId !== null} onOpenChange={(open) => { if (!open) setUploadingListId(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5 text-red-500" />
                            Adicionar Vídeo
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* File Drop Zone */}
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                                uploadFile
                                    ? "border-green-500/50 bg-green-500/5"
                                    : "border-white/10 hover:border-red-500/30 hover:bg-red-500/5"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setUploadFile(file);
                                        if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
                                    }
                                }}
                            />
                            {uploadFile ? (
                                <div className="flex items-center gap-3">
                                    <Film className="w-8 h-8 text-green-500 shrink-0" />
                                    <div className="text-left min-w-0">
                                        <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                                        <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="shrink-0 ml-auto" onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Clique ou arraste um vídeo aqui</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">MP4, MOV, WEBM • Máx 500MB</p>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold">Título do Vídeo <span className="text-red-500">*</span></Label>
                            <Input
                                value={uploadTitle}
                                onChange={(e) => setUploadTitle(e.target.value)}
                                placeholder="Ex: UGC Unboxing Produto X"
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold">Descrição</Label>
                            <Textarea
                                value={uploadDescription}
                                onChange={(e) => setUploadDescription(e.target.value)}
                                placeholder="Contexto, referências, instruções para o criativo..."
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setUploadingListId(null)}>Cancelar</Button>
                        <Button
                            onClick={handleUpload}
                            disabled={isUploading || !uploadFile || !uploadTitle.trim()}
                            className="bg-red-600 hover:bg-red-700 font-bold gap-2"
                        >
                            {isUploading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                            ) : (
                                <><Upload className="w-4 h-4" /> Enviar Vídeo</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* === EDIT VIDEO MODAL === */}
            <Dialog open={editingVideo !== null} onOpenChange={(open) => { if (!open) setEditingVideo(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Vídeo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="font-bold">Título</Label>
                            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold">Descrição</Label>
                            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-[120px] resize-none" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingVideo(null)}>Cancelar</Button>
                        <Button onClick={handleEditVideo} className="bg-blue-600 hover:bg-blue-700 font-bold">Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* === EDIT LIST MODAL === */}
            <Dialog open={editingList !== null} onOpenChange={(open) => { if (!open) setEditingList(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Lista</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="font-bold">Nome da Lista</Label>
                            <Input value={editListTitle} onChange={(e) => setEditListTitle(e.target.value)} className="h-11" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingList(null)}>Cancelar</Button>
                        <Button
                            onClick={async () => {
                                if (editingList) {
                                    await updateList(editingList.id, { title: editListTitle.trim() });
                                    setEditingList(null);
                                }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 font-bold"
                        >
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* === VIDEO PREVIEW MODAL === */}
            <Dialog open={previewVideo !== null} onOpenChange={(open) => { if (!open) setPreviewVideo(null); }}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-white/10">
                    {previewVideo && (
                        <div>
                            <video
                                src={previewVideo.video_url}
                                controls
                                autoPlay
                                className="w-full aspect-video bg-black"
                            />
                            <div className="p-6 space-y-3">
                                <h3 className="text-xl font-bold text-white">{previewVideo.title}</h3>
                                {previewVideo.description && (
                                    <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{previewVideo.description}</p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
