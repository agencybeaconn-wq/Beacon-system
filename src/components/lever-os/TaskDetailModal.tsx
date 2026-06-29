import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
    Check,
    Plus,
    Trash2,
    Calendar,
    User,
    Flag,
    Clock,
    Play,
    Pause,
    Timer,
    Sparkles,
    CheckCircle2,
    Circle,
    X,
    ExternalLink,
    FileText,
    Pencil,
    Save,
    ChevronLeft,
    ChevronRight,
    Download,
    ImagePlus,
    Trash,
    RefreshCw,
    Loader2,
    Link as LinkIcon,
    Paperclip,
    Layout,
    AlignLeft,
    MessageCircle,
    Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task } from '@/types/lever-os';
import { useTasks } from '@/contexts/TasksContext';
import { useAgencyTeam } from '@/hooks/useAgencyTeam';
import { usePermissions } from '@/contexts/PermissionsContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedClient } from "@/contexts/DashboardContext";
import { useAgencyProducts } from "@/hooks/useAgencyProducts";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useTaskTimer, formatSeconds } from "@/hooks/useTaskTimer";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// --- Lightbox Component (External for stability) ---
interface LightboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
    title?: string;
}

const LightboxModal = ({ isOpen, onClose, images, currentIndex, onIndexChange, title }: LightboxModalProps) => {
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') {
                const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
                onIndexChange(newIndex);
            }
            if (e.key === 'ArrowRight') {
                const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
                onIndexChange(newIndex);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, images.length, onClose, onIndexChange]);

    if (!isOpen || images.length === 0) return null;

    const currentImg = images[currentIndex];
    const hasMultiple = images.length > 1;

    const handlePrev = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
        onIndexChange(newIndex);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
        onIndexChange(newIndex);
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            const response = await fetch(currentImg, { mode: 'cors' });
            if (!response.ok) throw new Error('CORS fail');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `imagem-${currentIndex + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[Lightbox] Download failed, opening in new tab:', error);
            const win = window.open(currentImg, '_blank');
            if (win) {
                win.focus();
            } else {
                toast.error("Não foi possível abrir a imagem para download.");
            }
        }
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/98 backdrop-blur-xl transition-all duration-300 pointer-events-auto"
            onClick={handleContainerClick}
        >
            {/* Header Controls */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[100000] bg-gradient-to-b from-black/80 to-transparent">
                <div className="text-white/90 font-medium truncate max-w-[50%] drop-shadow-lg">
                    {title} {hasMultiple && <span className="text-white/40 ml-2 font-light">({currentIndex + 1} de {images.length})</span>}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownload}
                        className="p-3 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-all group active:scale-90"
                        title="Baixar imagem"
                    >
                        <Download className="w-6 h-6" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-3 rounded-full hover:bg-red-500/30 text-white/70 hover:text-red-400 transition-all active:scale-90"
                        title="Fechar (Esc)"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Navigation Arrows */}
            {hasMultiple && (
                <>
                    <button
                        onClick={handlePrev}
                        className="absolute left-6 p-6 rounded-full bg-white/5 hover:bg-white/20 text-white/30 hover:text-white transition-all z-[100000] border border-white/10 active:scale-75 backdrop-blur-md"
                        title="Anterior (Seta Esquerda)"
                    >
                        <ChevronLeft className="w-10 h-10" />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute right-6 p-6 rounded-full bg-white/5 hover:bg-white/20 text-white/30 hover:text-white transition-all z-[100000] border border-white/10 active:scale-75 backdrop-blur-md"
                        title="Próxima (Seta Direita)"
                    >
                        <ChevronRight className="w-10 h-10" />
                    </button>
                </>
            )}

            {/* Image container */}
            <div
                className="relative w-[95vw] h-[92vh] flex items-center justify-center select-none animate-in zoom-in-95 duration-500"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={currentImg}
                    alt={title}
                    className="max-w-full max-h-full object-contain cursor-default drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-md"
                />
            </div>
        </div>,
        document.body
    );
};

interface TaskDetailModalProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
}

export function TaskDetailModal({ task: initialTask, isOpen, onClose }: TaskDetailModalProps) {
    const {
        toggleChecklistItem,
        addChecklistItem,
        removeChecklistItem,
        getTaskById,
        updateTask,
        archiveTask,
    } = useTasks();
    const { members: rawMembers } = useAgencyTeam();
    const { canEdit } = usePermissions();
    const { products } = useAgencyProducts();
    const [isSyncing, setIsSyncing] = useState(false);

    // Verificar se o usuário pode editar demandas
    const canEditTasks = canEdit('demands');

    // Normalizar membros para o formato esperado pelo componente, usando user_id pq a tabela de tasks requer uuid da conta
    const members = rawMembers.map(m => ({
        id: m.user_id,
        name: m.profile?.full_name || 'Membro',
        avatarUrl: m.profile?.avatar_url || undefined
    })).filter(m => m.id && !m.id.startsWith('invited_'));

    const [newItemTitle, setNewItemTitle] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);
    const { uploadImage, deleteImage, isUploading } = useImageUpload();

    // Inline Editing States
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Moved these hooks up to comply with Rules of Hooks
    const [imageToDelete, setImageToDelete] = useState<string | null>(null);
    const [coverIndex, setCoverIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [newDriveLink, setNewDriveLink] = useState('');
    const [newLinkTitle, setNewLinkTitle] = useState('');
    const [editingLinkUrl, setEditingLinkUrl] = useState<string | null>(null);
    const [tempLinkTitle, setTempLinkTitle] = useState('');
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

    // Comments
    const { user: authUser } = useAuth();
    const { clients } = useSelectedClient();
    const [comments, setComments] = useState<{ id: string; user_name: string; user_avatar: string | null; content: string; created_at: string; user_id: string }[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isSendingComment, setIsSendingComment] = useState(false);

    // Buscar task atualizada do context para ter dados em tempo real
    const task = initialTask ? getTaskById(initialTask.id) : null;

    // Dados completos do cliente vinculado à demanda (avatar, tipo, cor)
    const taskClient = useMemo(() => {
        if (!task?.clientId) return null;
        return (clients || []).find((c: any) => c.id === task.clientId) || null;
    }, [clients, task?.clientId]);
    const clientInitials = (taskClient?.name || task?.clientName || '?')
        .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
    const clientType: 'fixo' | 'avulso' = (taskClient as any)?.client_type === 'fixo' ? 'fixo' : 'avulso';


    // Sincronizar dados quando a task mudar
    useEffect(() => {
        if (task) {
            setEditTitle(task.title);
            setEditDescription(task.description || '');
        }
    }, [task]);

    // Load comments when task opens
    const loadComments = useCallback(async (taskId: string) => {
        setIsLoadingComments(true);
        try {
            const { data, error } = await (supabase as any)
                .from('task_comments')
                .select('*')
                .eq('task_id', taskId)
                .order('created_at', { ascending: true });
            if (!error && data) setComments(data);
        } catch { /* ignore */ }
        finally { setIsLoadingComments(false); }
    }, []);

    useEffect(() => {
        if (isOpen && initialTask?.id) {
            loadComments(initialTask.id);
        }
        if (!isOpen) {
            setComments([]);
            setNewComment('');
        }
    }, [isOpen, initialTask?.id, loadComments]);

    const handleSendComment = async () => {
        if (!newComment.trim() || !task || !authUser) return;
        setIsSendingComment(true);
        try {
            const userName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário';
            const userAvatar = authUser.user_metadata?.avatar_url || null;
            const { data, error } = await (supabase as any)
                .from('task_comments')
                .insert({
                    task_id: task.id,
                    user_id: authUser.id,
                    user_name: userName,
                    user_avatar: userAvatar,
                    content: newComment.trim()
                })
                .select()
                .single();
            if (error) throw error;
            if (data) setComments(prev => [...prev, data]);
            setNewComment('');
        } catch (err: any) {
            toast.error('Erro ao enviar comentário');
        } finally {
            setIsSendingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await (supabase as any).from('task_comments').delete().eq('id', commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch { toast.error('Erro ao excluir comentário'); }
    };

    if (!task) return null;

    const completedCount = task.checklist?.filter(item => item.isCompleted).length || 0;
    const totalCount = task.checklist?.length || 0;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const assignee = members.find(m => m.id === task.assigneeId) || {
        id: '',
        name: 'Sem responsável',
        avatarUrl: undefined
    };

    const getStatusConfig = (status: Task['status']) => {
        const configs = {
            backlog: { label: 'Backlog', color: 'bg-slate-500', textColor: 'text-slate-500' },
            todo: { label: 'A Fazer', color: 'bg-slate-500', textColor: 'text-slate-500' },
            in_progress: { label: 'Em Andamento', color: 'bg-blue-500', textColor: 'text-blue-500' },
            validation: { label: 'Validação', color: 'bg-purple-500', textColor: 'text-purple-500' },
            done: { label: 'Concluído', color: 'bg-green-500', textColor: 'text-green-500' },
        } as any;
        return configs[status] || configs.todo;
    };

    const getPriorityConfig = (priority: Task['priority']) => {
        const configs = {
            low: { label: 'Baixa', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
            medium: { label: 'Média', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
            high: { label: 'Alta', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
            critical: { label: 'Crítica', color: 'bg-red-600/10 text-red-600 border-red-600/20' },
        };
        return configs[priority] || configs.medium;
    };

    const statusConfig = getStatusConfig(task.status);
    const priorityConfig = getPriorityConfig(task.priority);

    // Análise por IA (Claude via edge function)
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);
    const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

    const runAiAnalysis = async () => {
        if (aiAnalysisLoading) return;
        setAiAnalysisLoading(true);
        setAiAnalysisError(null);
        try {
            const context = {
                titulo: task.title || '',
                descricao: task.description || '',
                cliente: taskClient?.name || task.clientName || '',
                tipo_projeto: clientType,
                area: task.area || 'não definida',
                prioridade: task.priority || 'medium',
                status: task.status || '',
                prazo: task.dueDate || 'sem prazo',
                sub_tarefas: (task.checklist || []).map((c: any) => ({
                    titulo: c.title || c.text,
                    feito: !!c.completed,
                })),
                comentarios: comments.map((c: any) => ({
                    autor: c.user_name || 'Membro',
                    texto: c.content || '',
                    data: c.created_at,
                })),
            };

            const prompt = `Você é gestor de projetos da agência Lever.
Gere um resumo EXECUTIVO de no MÁXIMO 5 LINHAS em português para quem vai executar esta demanda.
Diga em prosa concisa (sem listas numeradas longas):
- O que precisa ser feito de forma clara
- O que é crítico ou pode travar
- A melhor forma prática de abordar
Analise TUDO: descrição, sub-tarefas e comentários. Seja direto e acionável.`;

            const { data, error } = await supabase.functions.invoke('gemini-ai', {
                body: {
                    action: 'analyzeWithContext',
                    prompt,
                    context,
                    temperature: 0.5,
                    maxTokens: 1200,
                },
            });

            if (error) {
                // Extrair mensagem real do body da resposta HTTP (supabase-js retorna
                // erro genérico; a mensagem útil está no response body)
                let realMsg = error.message || 'Erro desconhecido';
                try {
                    const ctx = (error as any).context as Response | undefined;
                    if (ctx && typeof ctx.json === 'function') {
                        const body = await ctx.json();
                        realMsg = body?.error || body?.message || realMsg;
                    }
                } catch { /* ignore */ }
                throw new Error(realMsg);
            }
            const text = (data as any)?.text || (data as any)?.data?.text;
            if (!text) throw new Error('Resposta vazia da IA');
            setAiAnalysisText(text);
        } catch (e: any) {
            console.error('[TaskAIAnalysis] error:', e);
            setAiAnalysisError(e?.message || 'Falha ao gerar análise');
            toast.error(`Falha na análise de IA: ${e?.message || 'tente novamente'}`);
        } finally {
            setAiAnalysisLoading(false);
        }
    };

    // Cronômetro de tempo gasto na demanda
    const timer = useTaskTimer(task.id);
    const [timerBusy, setTimerBusy] = useState(false);
    const handleTimerToggle = async () => {
        if (timerBusy) return;
        setTimerBusy(true);
        try {
            if (timer.isRunning) {
                await timer.pause();
                toast.success("Cronômetro pausado");
            } else {
                await timer.start();
                toast.success("Cronômetro iniciado");
            }
        } catch (err: any) {
            toast.error(`Erro no cronômetro: ${err?.message || 'tente novamente'}`);
        } finally {
            setTimerBusy(false);
        }
    };

    const handleAddItem = () => {
        if (newItemTitle.trim()) {
            addChecklistItem(task.id, newItemTitle.trim());
            setNewItemTitle('');
            setIsAddingItem(false);
        }
    };

    const handleKeyDownChecks = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddItem();
        } else if (e.key === 'Escape') {
            setIsAddingItem(false);
            setNewItemTitle('');
        }
    };

    const handleChecklistToggle = (itemId: string) => {
        toggleChecklistItem(task.id, itemId);
    };

    // Auto-Save Handlers
    const handleSaveTitle = async () => {
        if (editTitle !== task.title) {
            try {
                await updateTask(task.id, { title: editTitle });
                toast.success("Título atualizado");
            } catch (error) {
                toast.error("Erro ao salvar título");
                setEditTitle(task.title); // Revert on error
            }
        }
    };

    const handleSaveDescription = async () => {
        if (editDescription !== task.description) {
            try {
                await updateTask(task.id, { description: editDescription });
                setIsEditingDescription(false);
                toast.success("Descrição atualizada");
            } catch (error) {
                toast.error("Erro ao salvar descrição");
            }
        } else {
            setIsEditingDescription(false);
        }
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.currentTarget as HTMLInputElement).blur(); // Triggers save via onBlur
        } else if (e.key === 'Escape') {
            setEditTitle(task.title); // Revert
            (e.currentTarget as HTMLInputElement).blur();
        }
    };


    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !task) return;

        const currentImages = task.images || [];
        const newUrls: string[] = [];
        const taskId = task.id;

        try {
            for (let i = 0; i < files.length; i++) {
                const url = await uploadImage(files[i], taskId);
                if (url) newUrls.push(url);
            }

            if (newUrls.length > 0) {
                const updatedImages = [...currentImages, ...newUrls];
                await updateTask(taskId, {
                    images: updatedImages,
                    coverImageUrl: updatedImages[0]
                } as any);
                toast.success(`${newUrls.length} imagem(ns) adicionada(s)!`);
            }
        } catch (error) {
            console.error("[TaskDetailModal] Upload failed:", error);
            toast.error("Erro ao fazer upload das imagens.");
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const handleRemoveImage = async (imageUrl?: string) => {
        const currentImages = task.images || [];
        const urlToRemove = imageUrl || (currentImages.length > 0 ? currentImages[coverIndex] : task.coverImageUrl);

        if (!urlToRemove) return;
        setImageToDelete(urlToRemove);
    };

    const confirmRemoveImage = async () => {
        if (!imageToDelete || !task) return;
        const currentImages = task.images || [];
        const urlToRemove = imageToDelete;

        try {
            await deleteImage(urlToRemove);
            const updatedImages = currentImages.filter(img => img !== urlToRemove);

            await updateTask(task.id, {
                images: updatedImages,
                coverImageUrl: updatedImages.length > 0 ? updatedImages[0] : null
            } as any);

            // Adjust coverIndex if it's out of bounds
            if (updatedImages.length > 0) {
                setCoverIndex(prev => Math.min(prev, updatedImages.length - 1));
            } else {
                setCoverIndex(0);
            }

            toast.success("Imagem removida");
        } catch (err) {
            console.error("Error removing image:", err);
            toast.error("Erro ao remover imagem");
        } finally {
            setImageToDelete(null);
        }
    };

    const handleSyncWithProduct = async () => {
        if (!task.productId) return;
        setIsSyncing(true);
        try {
            // Find product and feature
            const product = products.find(p => p.id === task.productId);
            if (!product) throw new Error("Produto original não encontrado.");

            // Try to match feature by name
            let feature = product.features?.find(f => f.name === task.title);

            // Fallback: try to match by stepId 
            if (!feature && task.stepId) {
                const parts = task.stepId.split('-step-');
                if (parts.length === 2 && parts[0] === product.id) {
                    const index = parseInt(parts[1]);
                    if (!isNaN(index) && product.features && product.features[index]) {
                        feature = product.features[index];
                    }
                }
            }

            if (!feature) throw new Error("Funcionalidade/Feature original não encontrada no produto.");

            // Convert and save
            const newChecklist = (feature.subtasks || []).map(st => ({
                id: st.id,
                title: st.title,
                isCompleted: st.completed || false,
            }));

            if (newChecklist.length === 0) throw new Error("O produto não possui sub-processos cadastrados.");

            await updateTask(task.id, { checklist: newChecklist });
            toast.success("Sincronizado com sucesso! " + newChecklist.length + " itens adicionados.");

        } catch (error: any) {
            console.error("Sync error:", error);
            toast.error(error.message || "Erro ao sincronizar com produto");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAddDriveLink = async () => {
        if (!newDriveLink.trim()) return;

        try {
            // Validar se é url
            new URL(newDriveLink);

            const currentLinks = task.drive_links || [];
            const newLink = {
                title: newLinkTitle.trim() || (newDriveLink.includes('drive.google.com') ? 'Google Drive Link' : 'External Link'),
                url: newDriveLink
            };

            await updateTask(task.id, {
                drive_links: [...currentLinks, newLink]
            } as any);

            setNewDriveLink('');
            setNewLinkTitle('');
            toast.success("Link adicionado!");
        } catch (e) {
            toast.error("URL inválida");
        }
    };

    const handleRemoveDriveLink = async (urlToRemove: string) => {
        const currentLinks = task.drive_links || [];
        await updateTask(task.id, {
            drive_links: currentLinks.filter(l => l.url !== urlToRemove)
        } as any);
        toast.success("Link removido");
    };

    return (
        <>
            {/* Alerta de exclusão de imagem */}
            <AlertDialog open={!!imageToDelete} onOpenChange={() => setImageToDelete(null)}>
                <AlertDialogContent className="bg-card border-border shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover esta imagem?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A imagem será excluída permanentemente do sistema.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="hover:bg-muted font-medium">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemoveImage}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold"
                        >
                            Remover Imagem
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Alerta de arquivamento */}
            <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
                <AlertDialogContent className="bg-card border-border shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Concluir Demanda</AlertDialogTitle>
                        <AlertDialogDescription>
                            A demanda será marcada como concluída e ficará visível na coluna "Concluído" por 7 dias antes de ser arquivada automaticamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="hover:bg-muted font-medium">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (task) {
                                    await updateTask(task.id, { status: 'concluido' });
                                    onClose();
                                }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Confirmar Conclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Lightbox rendered outside Dialog */}
            {lightboxOpen && (
                <LightboxModal
                    isOpen={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                    images={(() => {
                        const base = task.images?.length ? task.images : (task.coverImageUrl ? [task.coverImageUrl] : []);
                        const attUrls = (task.attachments || []).map((a: any) => typeof a === 'string' ? a : a?.url).filter((u: string) => u && !base.includes(u));
                        return [...base, ...attUrls];
                    })()}
                    currentIndex={lightboxIndex}
                    onIndexChange={setLightboxIndex}
                    title={task.title}
                />
            )}

            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    className="max-w-[1800px] w-[97vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-background border-border rounded-3xl"
                    onPointerDownOutside={(e) => {
                        if (lightboxOpen) e.preventDefault();
                    }}
                    onInteractOutside={(e) => {
                        if (lightboxOpen) e.preventDefault();
                    }}
                >

                    {/* Main Content — No separate header, sidebar spans full height */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT COLUMN: Main Content */}
                        <ScrollArea className="flex-1 border-r border-border/40">
                            <div className="px-12 py-10 space-y-8 w-full max-w-[1300px] mx-auto">

                                {/* Client Banner — evidente no topo */}
                                {(taskClient || task.clientName) && (
                                    <div
                                        className={cn(
                                            "flex items-center gap-4 rounded-xl border p-4",
                                            clientType === 'fixo'
                                                ? "bg-emerald-500/5 border-emerald-500/20"
                                                : "bg-orange-500/5 border-orange-500/20"
                                        )}
                                    >
                                        <Avatar className="h-12 w-12 border-2 border-border shadow-sm">
                                            <AvatarImage src={(taskClient as any)?.logo_url || ''} />
                                            <AvatarFallback
                                                className="font-bold"
                                                style={{
                                                    backgroundColor: ((taskClient as any)?.primaryColor || '#666') + '20',
                                                    color: (taskClient as any)?.primaryColor || '#666',
                                                }}
                                            >
                                                {clientInitials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                Cliente
                                            </div>
                                            <div className="text-xl font-black truncate text-foreground leading-tight">
                                                {taskClient?.name || task.clientName}
                                            </div>
                                        </div>
                                        <Badge
                                            className={cn(
                                                "text-[10px] font-bold uppercase tracking-wider border-0 px-3 py-1",
                                                clientType === 'fixo'
                                                    ? "bg-emerald-500/15 text-emerald-500"
                                                    : "bg-orange-500/15 text-orange-500"
                                            )}
                                        >
                                            {clientType === 'fixo' ? 'Fixo (MRR)' : 'Avulso'}
                                        </Badge>
                                    </div>
                                )}

                                {/* Status + Title */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase font-bold tracking-wider">
                                        <span className={cn("w-2 h-2 rounded-full", statusConfig.color)} />
                                        <span>{statusConfig.label}</span>
                                    </div>

                                    {/* Title Editor (Inline) */}
                                    <div className="relative group">
                                        <Input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={handleSaveTitle}
                                            onKeyDown={handleTitleKeyDown}
                                            className={cn(
                                                "text-2xl font-bold h-auto py-1 px-2 -ml-2 bg-transparent border-transparent shadow-none transition-all",
                                                "hover:bg-muted/50 focus:bg-background focus:border-input focus:ring-1 focus:ring-primary"
                                            )}
                                            placeholder="Título da tarefa..."
                                        />
                                        <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity" />
                                    </div>
                                </div>

                                {/* Attachments & Drive Section — ABOVE Description */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Paperclip className="w-5 h-5 text-muted-foreground" />
                                            <h3 className="font-semibold text-lg">Anexos e Links</h3>
                                        </div>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-primary">
                                                    <Plus className="w-4 h-4" /> Adicionar Link
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-3" align="end">
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        placeholder="Título do Link (Opcional)"
                                                        value={newLinkTitle}
                                                        onChange={(e) => setNewLinkTitle(e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="https://..."
                                                            value={newDriveLink}
                                                            onChange={(e) => setNewDriveLink(e.target.value)}
                                                            className="h-8 text-xs flex-1"
                                                        />
                                                        <Button size="sm" className="h-8 w-8 p-0" onClick={handleAddDriveLink}>
                                                            <Plus className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Image Gallery Grid */}
                                    {(() => {
                                        // Merge images from both sources: images[] and attachments[] (portal uploads)
                                        const baseImages = task.images?.length ? task.images : (task.coverImageUrl ? [task.coverImageUrl] : []);
                                        const attachmentUrls = (task.attachments || [])
                                            .map((a: any) => typeof a === 'string' ? a : a?.url)
                                            .filter((url: string) => url && !baseImages.includes(url));
                                        const allImages = [...baseImages, ...attachmentUrls];

                                        if (allImages.length === 0 && !canEditTasks) return null;

                                        return allImages.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                {allImages.map((img, idx) => (
                                                    <div key={idx} className="relative aspect-square group rounded-xl overflow-hidden border border-border/50 bg-muted/30">
                                                        <img
                                                            src={img}
                                                            alt={` Attachment ${idx}`}
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                                                            onClick={() => {
                                                                setLightboxIndex(idx);
                                                                setLightboxOpen(true);
                                                            }}
                                                        />
                                                        {canEditTasks && (
                                                            <button
                                                                onClick={() => handleRemoveImage(img)}
                                                                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {/* Upload Button */}
                                                {canEditTasks && (
                                                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary gap-2">
                                                        {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                                                        <span className="text-xs font-medium">Adicionar Imagem</span>
                                                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                                    </label>
                                                )}
                                            </div>
                                        ) : null;
                                    })()}

                                    {/* Drive Links List */}
                                    {task.drive_links && task.drive_links.length > 0 && (
                                        <div className="grid gap-2">
                                            {task.drive_links.map((link, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg hover:bg-blue-500/10 transition-colors group">
                                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 overflow-hidden">
                                                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                                                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85L3.3 61.35 29.05 17.15H57.65L31.3 61.35H6.6Z" fill="#0066DA" /><path d="M43.65 25.15L29.05 0H57.65L72.25 25.15H43.65Z" fill="#00AC47" /><path d="M72.25 25.15L87.3 53.75 61.55 53.75 43.65 25.15H72.25Z" fill="#EA4335" /><path d="M43.65 25.15L61.55 53.75 31.3 61.35 6.6 66.85Z" fill="#00832D" /><path d="M57.65 17.15L72.25 25.15 43.65 25.15 29.05 17.15H57.65Z" fill="#2684FC" /><path d="M87.3 53.75L72.25 25.15 84 61.35 80.65 66.85Z" fill="#FFBA00" /></svg>
                                                        </div>
                                                        <div className="flex flex-col flex-1 overflow-hidden">
                                                            {editingLinkUrl === link.url ? (
                                                                <Input
                                                                    value={tempLinkTitle}
                                                                    onChange={(e) => setTempLinkTitle(e.target.value)}
                                                                    onBlur={async () => {
                                                                        if (tempLinkTitle.trim() !== link.title) {
                                                                            const newLinks = task.drive_links?.map(l =>
                                                                                l.url === link.url ? { ...l, title: tempLinkTitle } : l
                                                                            );
                                                                            await updateTask(task.id, { drive_links: newLinks } as any);
                                                                            toast.success("Link atualizado");
                                                                        }
                                                                        setEditingLinkUrl(null);
                                                                    }}
                                                                    onKeyDown={async (e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.currentTarget.blur();
                                                                        } else if (e.key === 'Escape') {
                                                                            setEditingLinkUrl(null);
                                                                        }
                                                                    }}
                                                                    onClick={(e) => e.preventDefault()}
                                                                    className="h-6 text-sm py-0 px-1"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">{link.title}</span>
                                                            )}
                                                            <span className="text-[10px] text-blue-600/60 dark:text-blue-400/60 truncate max-w-[300px]">{link.url}</span>
                                                        </div>
                                                    </a>
                                                    {canEditTasks && (
                                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-blue-500/50 hover:text-blue-600"
                                                                onClick={() => {
                                                                    setTempLinkTitle(link.title);
                                                                    setEditingLinkUrl(link.url);
                                                                }}
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-blue-500/50 hover:text-destructive"
                                                                onClick={() => handleRemoveDriveLink(link.url)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Empty State for Attachments */}
                                    {!task.drive_links?.length && !task.images?.length && !task.coverImageUrl && !task.attachments?.length && (
                                        canEditTasks ? (
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                                                    <ImagePlus className="w-4 h-4" />
                                                    <span>Adicionar Imagens</span>
                                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                                </label>
                                                <Button variant="outline" className="gap-2 border-dashed text-muted-foreground" onClick={() => (document.querySelector('[data-radix-popover-trigger]') as HTMLElement)?.click()}>
                                                    <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85L3.3 61.35 29.05 17.15H57.65L31.3 61.35H6.6Z" fill="#0066DA" /><path d="M43.65 25.15L29.05 0H57.65L72.25 25.15H43.65Z" fill="#00AC47" /><path d="M72.25 25.15L87.3 53.75 61.55 53.75 43.65 25.15H72.25Z" fill="#EA4335" /><path d="M43.65 25.15L61.55 53.75 31.3 61.35 6.6 66.85Z" fill="#00832D" /><path d="M57.65 17.15L72.25 25.15 43.65 25.15 29.05 17.15H57.65Z" fill="#2684FC" /><path d="M87.3 53.75L72.25 25.15 84 61.35 80.65 66.85Z" fill="#FFBA00" /></svg> Adicionar Link do Drive
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground italic">Nenhum anexo.</div>
                                        )
                                    )}
                                </div>

                                {/* Análise por IA (Claude) — ACIMA da descrição */}
                                <div className="space-y-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-primary" />
                                            <h3 className="font-semibold text-lg">Análise com IA</h3>
                                        </div>
                                        <Button
                                            onClick={runAiAnalysis}
                                            disabled={aiAnalysisLoading || !canEditTasks}
                                            size="sm"
                                            className="gap-2 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                                        >
                                            {aiAnalysisLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                            {aiAnalysisText ? 'Gerar novamente' : 'Analisar'}
                                        </Button>
                                    </div>
                                    {!aiAnalysisText && !aiAnalysisLoading && !aiAnalysisError && (
                                        <p className="text-xs text-muted-foreground">
                                            Gera um resumo executivo de até 5 linhas com a melhor forma de executar esta demanda — considera título, descrição, sub-tarefas e comentários.
                                        </p>
                                    )}
                                    {aiAnalysisLoading && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Analisando demanda...
                                        </div>
                                    )}
                                    {aiAnalysisError && (
                                        <div className="text-xs text-red-400">
                                            {aiAnalysisError}
                                        </div>
                                    )}
                                    {aiAnalysisText && (
                                        <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed p-3 rounded-md bg-background/60 border border-border/40">
                                            {aiAnalysisText}
                                        </div>
                                    )}
                                </div>

                                {/* Description Section — abaixo da Análise IA */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                                        <AlignLeft className="w-5 h-5 text-muted-foreground" />
                                        <h3 className="font-semibold text-lg">Descrição</h3>
                                    </div>

                                    {canEditTasks ? (
                                        isEditingDescription ? (
                                            <Textarea
                                                autoFocus
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                onBlur={handleSaveDescription}
                                                placeholder="Descreva a demanda detalhadamente..."
                                                className="min-h-[300px] text-sm leading-relaxed p-4 bg-background border-primary focus:ring-1 focus:ring-primary transition-all resize-y shadow-sm font-mono whitespace-pre-wrap"
                                                style={{ whiteSpace: 'pre-wrap' }}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => setIsEditingDescription(true)}
                                                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed min-h-[100px] p-4 rounded-lg hover:bg-muted/30 cursor-text transition-colors border border-border/30 hover:border-border/60 group relative bg-muted/5"
                                                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                            >
                                                {task.description || <span className="italic opacity-50">Clique para adicionar uma descrição...</span>}
                                                <Pencil className="w-4 h-4 text-muted-foreground absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        )
                                    ) : (
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed p-4 rounded-lg border border-border/20 bg-muted/5"
                                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                        >
                                            {task.description || <span className="italic opacity-50">Sem descrição definida.</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Checklist Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                                            <h3 className="font-semibold text-lg">Sub-tarefas</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground font-medium">
                                                {Math.round(progressPercent)}%
                                            </span>
                                            {task.productId && totalCount === 0 && canEditTasks && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleSyncWithProduct}
                                                    disabled={isSyncing}
                                                    className="h-7 text-xs"
                                                >
                                                    {isSyncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                                    Sincronizar
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Progress value={progressPercent} className="h-1.5" />

                                        <div className="space-y-1">
                                            {task.checklist?.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        "group flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors",
                                                        item.isCompleted && "opacity-60"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={item.isCompleted}
                                                        onCheckedChange={() => handleChecklistToggle(item.id)}
                                                        className="mt-1"
                                                    />
                                                    <div className="flex-1 space-y-1">
                                                        <span className={cn("text-sm block", item.isCompleted && "line-through")}>{item.title}</span>
                                                        {item.documentationUrl && (
                                                            <a
                                                                href={item.documentationUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 px-1.5 py-0.5 rounded"
                                                            >
                                                                <FileText className="w-3 h-3" /> Documentação
                                                            </a>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removeChecklistItem(task.id, item.id)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add New Item */}
                                        {isAddingItem ? (
                                            <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                                                <Circle className="w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    autoFocus
                                                    placeholder="O que precisa ser feito?"
                                                    value={newItemTitle}
                                                    onChange={(e) => setNewItemTitle(e.target.value)}
                                                    onKeyDown={handleKeyDownChecks}
                                                    className="h-8 flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-0"
                                                />
                                                <div className="flex items-center gap-1">
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleAddItem}>
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => {
                                                            setIsAddingItem(false);
                                                            setNewItemTitle('');
                                                        }}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start text-muted-foreground h-9 font-normal pl-2 hover:text-primary"
                                                onClick={() => setIsAddingItem(true)}
                                            >
                                                <Plus className="w-4 h-4 mr-2" /> Adicionar sub-tarefa
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>

                        {/* RIGHT COLUMN: Sidebar Metadata */}
                        <div className="w-[360px] bg-muted/10 px-7 py-6 space-y-7 shrink-0 border-l border-border/40 overflow-y-auto">

                            {/* Status Section */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Layout className="w-3.5 h-3.5" /> Status
                                </label>
                                <select
                                    value={task.status}
                                    onChange={(e: any) => updateTask(task.id, { status: e.target.value })}
                                    disabled={!canEditTasks}
                                    className="flex h-10 w-full items-center rounded-md border border-input/50 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                                >
                                    <option value="todo">A Fazer</option>
                                    <option value="in_progress">Em Andamento</option>
                                    <option value="validation">Validação</option>
                                    <option value="done">Concluído</option>
                                    <option value="backlog">Backlog</option>
                                </select>
                            </div>

                            {/* Assignee Section */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" /> Responsável
                                </label>
                                <select
                                    value={task.assigneeId || 'none'}
                                    onChange={(e) => updateTask(task.id, { assigneeId: e.target.value === 'none' ? null : e.target.value })}
                                    disabled={!canEditTasks}
                                    className="flex h-10 w-full items-center rounded-md border border-input/50 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                                >
                                    <option value="none">Sem responsável</option>
                                    {members.map(member => (
                                        <option key={member.id} value={member.id}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Priority Section */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Flag className="w-3.5 h-3.5" /> Prioridade
                                </label>
                                <select
                                    value={task.priority}
                                    onChange={(e: any) => updateTask(task.id, { priority: e.target.value })}
                                    disabled={!canEditTasks}
                                    className="flex h-10 w-full items-center rounded-md border border-input/50 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                                    style={{
                                        color: task.priority === 'critical' ? 'red' : task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'orange' : 'green',
                                    }}
                                >
                                    <option value="low">Baixa</option>
                                    <option value="medium">Média</option>
                                    <option value="high">Alta</option>
                                    <option value="critical">Crítica</option>
                                </select>
                            </div>

                            {/* Project Type Section */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Layout className="w-3.5 h-3.5" /> Tipo de Projeto
                                </label>
                                <select
                                    value={task.projectType ?? ''}
                                    onChange={(e: any) => updateTask(task.id, { projectType: e.target.value === '' ? null : e.target.value })}
                                    disabled={!canEditTasks}
                                    className="flex h-10 w-full items-center rounded-md border border-input/50 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                                    style={{
                                        color: task.projectType === 'fixo' ? '#10b981' : task.projectType === 'avulso' ? '#f97316' : undefined,
                                    }}
                                >
                                    <option value="">Herda do cliente</option>
                                    <option value="fixo">Fixo (MRR)</option>
                                    <option value="avulso">Avulso</option>
                                </select>
                            </div>

                            {/* Dates Section */}
                            <div className="space-y-4 pt-4 border-t border-border/40">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                        <Calendar className="w-3.5 h-3.5" /> Criada em
                                    </label>
                                    <span className="text-sm font-medium pl-5 block">
                                        {new Date(task.createdAt).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                        <Clock className="w-3.5 h-3.5" /> Prazo de Entrega
                                    </label>
                                    <div className="relative w-full">
                                        <input
                                            type="date"
                                            value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                                            onChange={(e) => updateTask(task.id, { dueDate: e.target.value || null })}
                                            disabled={!canEditTasks}
                                            className={cn(
                                                "flex h-10 w-full items-center rounded-md border border-input/50 bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                                "[&::-webkit-calendar-picker-indicator]:mr-2 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100",
                                                "[&::-webkit-datetime-edit]:pl-1",
                                                "flex-row-reverse justify-end",
                                                task.dueDate && new Date(task.dueDate) < new Date() ? "text-red-500 font-bold border-red-500/30" : "text-foreground font-medium",
                                                !task.dueDate && "text-muted-foreground"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Cronômetro de tempo gasto */}
                            <div className="pt-4 border-t border-border/40 space-y-3">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Timer className="w-3.5 h-3.5" /> Tempo Gasto
                                </label>
                                <div className={cn(
                                    "rounded-md border p-3 space-y-3",
                                    timer.isRunning
                                        ? "bg-emerald-500/5 border-emerald-500/30"
                                        : "bg-muted/30 border-border/60"
                                )}>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className={cn(
                                            "text-2xl font-black tabular-nums tracking-tight",
                                            timer.isRunning ? "text-emerald-400" : "text-foreground"
                                        )}>
                                            {formatSeconds(timer.totalSeconds)}
                                        </span>
                                        {timer.isRunning && (
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                rodando
                                            </span>
                                        )}
                                    </div>
                                    {timer.sessionsCount > 0 && (
                                        <div className="text-[11px] text-muted-foreground">
                                            {timer.sessionsCount} {timer.sessionsCount === 1 ? 'sessão registrada' : 'sessões registradas'}
                                        </div>
                                    )}
                                    <Button
                                        onClick={handleTimerToggle}
                                        disabled={!canEditTasks || timer.isLoading || timerBusy}
                                        className={cn(
                                            "w-full font-bold gap-2",
                                            timer.isRunning
                                                ? "bg-orange-500 hover:bg-orange-600 text-white"
                                                : "bg-emerald-500 hover:bg-emerald-600 text-white"
                                        )}
                                    >
                                        {timer.isRunning ? (
                                            <>
                                                <Pause className="w-4 h-4" />
                                                Pausar
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4" />
                                                {timer.totalSeconds > 0 ? "Retomar" : "Iniciar"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Archive Button */}
                            {canEditTasks && (
                                <div className="pt-4 border-t border-border/40">
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-500 font-semibold"
                                        onClick={() => setShowArchiveConfirm(true)}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Concluir
                                    </Button>
                                </div>
                            )}

                            {/* Comments Section */}
                            <div className="pt-4 border-t border-border/40 space-y-3">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5" /> Comentários
                                    {comments.length > 0 && (
                                        <span className="ml-auto text-[10px] bg-muted rounded-full px-1.5 py-0.5 font-medium">{comments.length}</span>
                                    )}
                                </label>

                                {/* Comments list */}
                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                    {isLoadingComments ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : comments.length === 0 ? (
                                        <p className="text-xs text-muted-foreground/60 text-center py-3 italic">
                                            Nenhum comentário ainda.
                                        </p>
                                    ) : (
                                        comments.map((comment) => (
                                            <div key={comment.id} className="group relative space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="w-5 h-5">
                                                        <AvatarImage src={comment.user_avatar || undefined} />
                                                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                                                            {comment.user_name?.slice(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-semibold text-foreground">{comment.user_name}</span>
                                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                                        {new Date(comment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        {' '}
                                                        {new Date(comment.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {authUser?.id === comment.user_id && (
                                                        <button
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-foreground/80 pl-7 leading-relaxed whitespace-pre-wrap">
                                                    {comment.content}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* New comment input */}
                                <div className="flex gap-2 items-end">
                                    <Textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Escreva um comentário..."
                                        className="min-h-[36px] max-h-[100px] text-xs resize-none rounded-lg border-border/50"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendComment();
                                            }
                                        }}
                                    />
                                    <Button
                                        size="icon"
                                        className="h-9 w-9 shrink-0 rounded-lg"
                                        disabled={!newComment.trim() || isSendingComment}
                                        onClick={handleSendComment}
                                    >
                                        {isSendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    </Button>
                                </div>
                            </div>

                        </div>
                    </div>
                </DialogContent >
            </Dialog >
        </>
    );
}
