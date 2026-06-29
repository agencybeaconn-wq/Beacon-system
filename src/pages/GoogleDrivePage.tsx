/**
 * Google Drive — File Manager UI
 * Folder navigation, file thumbnails, context menus, CRUD.
 * No sidebar — clean single-panel layout.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GoogleIntegrationService } from "@/services/googleIntegrationService";
import { useDashboard } from "@/contexts/DashboardContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    HardDrive, FileUp, FolderPlus, ExternalLink, Loader2, AlertCircle,
    RefreshCw, Search, File, FolderClosed, Image, FileText, Film, Music,
    ChevronRight, Home, ArrowLeft, LayoutGrid, List, FileSpreadsheet,
    Presentation, MoreVertical, Pencil, Trash2, FolderInput, Plus,
    X, ChevronDown, SortAsc,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    size?: string;
    webViewLink?: string;
    iconLink?: string;
    thumbnailLink?: string;
    parents?: string[];
}

interface BreadcrumbItem {
    id: string | null;
    name: string;
}

type SortField = "name" | "modifiedTime";
type SortDir = "asc" | "desc";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getFileIcon(mimeType: string, size: "sm" | "lg" = "sm") {
    const cls = size === "lg" ? "w-10 h-10" : "w-5 h-5";
    if (mimeType.includes("folder")) return <FolderClosed className={`${cls} text-muted-foreground`} />;
    if (mimeType.includes("image")) return <Image className={`${cls} text-red-400`} />;
    if (mimeType.includes("video")) return <Film className={`${cls} text-purple-400`} />;
    if (mimeType.includes("audio")) return <Music className={`${cls} text-pink-400`} />;
    if (mimeType.includes("spreadsheet")) return <FileSpreadsheet className={`${cls} text-green-500`} />;
    if (mimeType.includes("presentation")) return <Presentation className={`${cls} text-orange-400`} />;
    if (mimeType.includes("pdf")) return <FileText className={`${cls} text-red-400`} />;
    if (mimeType.includes("document") || mimeType.includes("text")) return <FileText className={`${cls} text-blue-400`} />;
    return <File className={`${cls} text-muted-foreground`} />;
}

function formatFileSize(bytes: string | undefined) {
    if (!bytes) return "";
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(0)} KB`;
    if (size < 1073741824) return `${(size / 1048576).toFixed(1)} MB`;
    return `${(size / 1073741824).toFixed(1)} GB`;
}

function formatDate(dt: string | undefined) {
    if (!dt) return "";
    const d = new Date(dt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function getMimeLabel(mimeType: string) {
    if (mimeType.includes("folder")) return "Pasta";
    if (mimeType.includes("image")) return "Imagem";
    if (mimeType.includes("video")) return "Vídeo";
    if (mimeType.includes("audio")) return "Áudio";
    if (mimeType.includes("spreadsheet")) return "Planilha";
    if (mimeType.includes("presentation")) return "Apresentação";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("document")) return "Documento";
    return "Arquivo";
}

function getThumbnailUrl(file: DriveFile): string | null {
    if (file.mimeType.includes("folder")) return null;
    if (file.thumbnailLink) return file.thumbnailLink;
    if (file.mimeType.includes("image") || file.mimeType.includes("video") || file.mimeType.includes("pdf")) {
        return `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;
    }
    return null;
}

// ─── Filter options ─────────────────────────────────────────────────────────────

const FILE_TYPE_FILTERS = [
    { label: "Todos", value: "all" },
    { label: "Pastas", value: "folder" },
    { label: "Imagens", value: "image" },
    { label: "PDFs", value: "pdf" },
    { label: "Documentos", value: "document" },
    { label: "Planilhas", value: "spreadsheet" },
    { label: "Vídeos", value: "video" },
];

const MODIFIED_FILTERS = [
    { label: "Qualquer data", value: "all" },
    { label: "Hoje", value: "today" },
    { label: "Esta semana", value: "week" },
    { label: "Este mês", value: "month" },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function GoogleDrivePage() {
    const { toast } = useToast();
    const { workspaceId } = useDashboard();
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: "Meu Drive" }]);

    // Filters
    const [typeFilter, setTypeFilter] = useState("all");
    const [modifiedFilter, setModifiedFilter] = useState("all");
    const [sortField, setSortField] = useState<SortField>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [openFilter, setOpenFilter] = useState<string | null>(null);

    // Context menu
    const [contextMenu, setContextMenu] = useState<{ file: DriveFile; x: number; y: number } | null>(null);
    const contextRef = useRef<HTMLDivElement>(null);

    // Dialogs
    const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [moveTarget, setMoveTarget] = useState<DriveFile | null>(null);
    const [moveFolders, setMoveFolders] = useState<DriveFile[]>([]);
    const [moveSelectedFolder, setMoveSelectedFolder] = useState<string | null>(null);
    const [loadingMoveFolders, setLoadingMoveFolders] = useState(false);

    // Preview
    const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

    // New menu
    const [showNewMenu, setShowNewMenu] = useState(false);

    useEffect(() => {
        if (workspaceId) {
            loadConnectionStatus();
        }
    }, [workspaceId]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (contextRef.current && !contextRef.current.contains(e.target as Node)) setContextMenu(null);
            if (!(e.target as HTMLElement).closest('[data-filter-dropdown]')) setOpenFilter(null);
            if (!(e.target as HTMLElement).closest('[data-new-menu]')) setShowNewMenu(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [contextMenu]);

    async function loadConnectionStatus() {
        if (!workspaceId) return;
        try {
            setIsLoading(true);
            const { data: conn } = await (supabase as any).from("google_connections").select("id, status").eq("workspace_id", workspaceId).eq("status", "connected").maybeSingle();
            setIsConnected(!!conn);
            if (conn) loadFiles(workspaceId, null);
        } catch (err) {
            console.error("Error loading connection:", err);
        } finally {
            setIsLoading(false);
        }
    }

    const loadFiles = useCallback(async (wsId?: string, folderId?: string | null) => {
        const id = wsId || workspaceId;
        if (!id) return;
        setLoadingFiles(true);
        try {
            const result = await GoogleIntegrationService.listClientFiles(
                id,
                folderId === undefined ? currentFolderId || undefined : folderId || undefined,
                undefined,
                200
            );
            setFiles(result.files || []);
        } catch (err: any) {
            toast({ title: "Erro ao carregar arquivos", description: err.message, variant: "destructive" });
        } finally {
            setLoadingFiles(false);
        }
    }, [workspaceId, currentFolderId, toast]);

    function navigateToFolder(folder: DriveFile) {
        setCurrentFolderId(folder.id);
        setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        setSearchTerm("");
        setPreviewFile(null);
        loadFiles(undefined, folder.id);
    }

    function navigateToBreadcrumb(index: number) {
        const target = breadcrumbs[index];
        setCurrentFolderId(target.id);
        setBreadcrumbs(prev => prev.slice(0, index + 1));
        setPreviewFile(null);
        loadFiles(undefined, target.id);
    }

    function goBack() {
        if (breadcrumbs.length <= 1) return;
        navigateToBreadcrumb(breadcrumbs.length - 2);
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!workspaceId || !e.target.files?.length) return;
        setUploadingFile(true);
        try {
            const file = e.target.files[0];
            await GoogleIntegrationService.uploadFile(workspaceId, file, currentFolderId || undefined);
            toast({ title: "✅ Arquivo enviado!", description: `${file.name} salvo.` });
            loadFiles(undefined, currentFolderId);
        } catch (err: any) {
            toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
        } finally {
            setUploadingFile(false);
            e.target.value = "";
        }
    }

    async function handleCreateFolder() {
        if (!workspaceId || !newFolderName.trim()) return;
        setCreatingFolder(true);
        try {
            await GoogleIntegrationService.createFolder(workspaceId, newFolderName.trim(), currentFolderId || undefined);
            toast({ title: "✅ Pasta criada!" });
            setNewFolderName("");
            setShowNewFolderInput(false);
            loadFiles(undefined, currentFolderId);
        } catch (err: any) {
            toast({ title: "Erro ao criar pasta", description: err.message, variant: "destructive" });
        } finally {
            setCreatingFolder(false);
        }
    }

    async function handleRename() {
        if (!workspaceId || !renameTarget || !renameValue.trim()) return;
        try {
            await GoogleIntegrationService.renameDriveFile(workspaceId, renameTarget.id, renameValue.trim());
            toast({ title: "✅ Renomeado!" });
            setRenameTarget(null);
            loadFiles(undefined, currentFolderId);
        } catch (err: any) {
            toast({ title: "Erro ao renomear", description: err.message, variant: "destructive" });
        }
    }

    async function handleDelete(file: DriveFile) {
        if (!workspaceId) return;
        if (!confirm(`Excluir "${file.name}"? Será movido para a lixeira.`)) return;
        try {
            await GoogleIntegrationService.deleteDriveFile(workspaceId, file.id);
            toast({ title: "🗑️ Movido para a lixeira!" });
            if (previewFile?.id === file.id) setPreviewFile(null);
            loadFiles(undefined, currentFolderId);
        } catch (err: any) {
            toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
        }
    }

    async function openMoveDialog(file: DriveFile) {
        setMoveTarget(file);
        setMoveSelectedFolder(null);
        setLoadingMoveFolders(true);
        try {
            if (!workspaceId) return;
            // Load root folders for move target selection
            const result = await GoogleIntegrationService.listClientFiles(workspaceId, undefined, undefined, 200);
            setMoveFolders((result.files || []).filter((f: DriveFile) => f.mimeType.includes("folder") && f.id !== file.id));
        } catch { setMoveFolders([]); } finally { setLoadingMoveFolders(false); }
    }

    async function handleMove() {
        if (!workspaceId || !moveTarget || !moveSelectedFolder) return;
        try {
            await GoogleIntegrationService.moveDriveFile(workspaceId, moveTarget.id, moveSelectedFolder);
            toast({ title: "✅ Arquivo movido!" });
            setMoveTarget(null);
            loadFiles(undefined, currentFolderId);
        } catch (err: any) {
            toast({ title: "Erro ao mover", description: err.message, variant: "destructive" });
        }
    }

    function openContextMenu(e: React.MouseEvent, file: DriveFile) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ file, x: e.clientX, y: e.clientY });
    }

    function handleFileClick(file: DriveFile) {
        if (file.mimeType.includes("folder")) {
            navigateToFolder(file);
        } else {
            setPreviewFile(prev => prev?.id === file.id ? null : file);
        }
    }

    // ─── Filtering + Sorting ────────────────────────────────────────────────────

    const processedFiles = (() => {
        let result = [...files];
        if (searchTerm) result = result.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (typeFilter !== "all") result = result.filter(f => f.mimeType.includes(typeFilter));
        if (modifiedFilter !== "all") {
            const now = new Date();
            result = result.filter(f => {
                if (!f.modifiedTime) return false;
                const diffDays = Math.floor((now.getTime() - new Date(f.modifiedTime).getTime()) / 86400000);
                if (modifiedFilter === "today") return diffDays === 0;
                if (modifiedFilter === "week") return diffDays < 7;
                if (modifiedFilter === "month") return diffDays < 30;
                return true;
            });
        }
        result.sort((a, b) => {
            const aF = a.mimeType.includes("folder") ? 0 : 1;
            const bF = b.mimeType.includes("folder") ? 0 : 1;
            if (aF !== bF) return aF - bF;
            let cmp = 0;
            if (sortField === "name") cmp = a.name.localeCompare(b.name);
            else if (sortField === "modifiedTime") cmp = (a.modifiedTime || "").localeCompare(b.modifiedTime || "");
            return sortDir === "asc" ? cmp : -cmp;
        });
        return result;
    })();

    const isAtRoot = !currentFolderId;
    const folders = processedFiles.filter(f => f.mimeType.includes("folder"));
    const regularFiles = processedFiles.filter(f => !f.mimeType.includes("folder"));

    // ─── Loading / Not connected ────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="p-8 max-w-lg mx-auto mt-20">
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent p-10 text-center space-y-5">
                    <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                    <h3 className="text-xl font-bold">Google não conectado</h3>
                    <p className="text-muted-foreground text-sm">Conecte em <strong>Conexões</strong> para acessar o Drive.</p>
                    <Button onClick={() => window.location.href = "/settings?tab=Conexões"} className="bg-amber-600 hover:bg-amber-700 text-white">
                        Ir para Conexões
                    </Button>
                </div>
            </div>
        );
    }

    // ─── Filter Dropdown ────────────────────────────────────────────────────────

    function FilterDropdown({ id, label, options, value, onChange }: {
        id: string; label: string;
        options: { label: string; value: string }[];
        value: string; onChange: (v: string) => void;
    }) {
        const isOpen = openFilter === id;
        const selected = options.find(o => o.value === value);
        return (
            <div className="relative" data-filter-dropdown>
                <button
                    onClick={(e) => { e.stopPropagation(); setOpenFilter(isOpen ? null : id); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${value !== options[0]?.value
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/40 bg-card hover:bg-muted/40 text-foreground/70"
                        }`}
                >
                    {value !== options[0]?.value ? selected?.label : label}
                    <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {isOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border/40 rounded-xl shadow-xl py-1 min-w-[160px] animate-in fade-in-0 zoom-in-95" data-filter-dropdown>
                        {options.map(opt => (
                            <button key={opt.value}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors ${opt.value === value ? "text-primary font-medium" : ""}`}
                                onClick={() => { onChange(opt.value); setOpenFilter(null); }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ─── Main UI ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">

            {/* ─── Header ─────────────────────────────────────────────── */}
            <div className="shrink-0 px-6 pt-5 pb-3 space-y-3">
                {/* Title row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        {breadcrumbs.length > 1 && (
                            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        {/* Breadcrumb path */}
                        <div className="flex items-center gap-0.5 min-w-0">
                            {breadcrumbs.map((crumb, i) => (
                                <div key={i} className="flex items-center gap-0.5 shrink-0">
                                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />}
                                    <button
                                        onClick={() => navigateToBreadcrumb(i)}
                                        className={`px-1.5 py-0.5 rounded-md transition-colors ${i === breadcrumbs.length - 1
                                            ? "text-lg font-bold text-foreground"
                                            : "text-sm text-muted-foreground/50 hover:text-foreground hover:bg-muted/40"
                                            }`}
                                    >
                                        {crumb.name}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* + Novo */}
                        <div className="relative" data-new-menu>
                            <Button size="sm" variant="outline"
                                className="h-9 rounded-xl gap-1.5 border-border/40 bg-card hover:bg-muted/50"
                                onClick={() => setShowNewMenu(!showNewMenu)}>
                                <Plus className="w-4 h-4" /> Novo
                            </Button>
                            {showNewMenu && (
                                <div className="absolute right-0 top-11 z-50 bg-card border border-border/40 rounded-xl shadow-xl py-1.5 w-48 animate-in fade-in-0 zoom-in-95" data-new-menu>
                                    <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                                        onClick={() => { setShowNewFolderInput(true); setShowNewMenu(false); }}>
                                        <FolderPlus className="w-4 h-4 text-muted-foreground" /> Nova pasta
                                    </button>
                                    <div className="h-px bg-border/20 my-1" />
                                    <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                                        onClick={() => { document.getElementById("drive-upload")?.click(); setShowNewMenu(false); }}>
                                        <FileUp className="w-4 h-4 text-muted-foreground" /> Upload de arquivo
                                    </button>
                                </div>
                            )}
                            <input type="file" id="drive-upload" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                        </div>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                            <Input placeholder="Pesquisar no Drive" value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-52 h-9 text-sm rounded-xl bg-muted/30 border-border/30" />
                        </div>
                        <div className="flex items-center border border-border/30 rounded-lg overflow-hidden h-8">
                            <button onClick={() => setViewMode("grid")} className={`px-2.5 h-full transition-colors ${viewMode === "grid" ? "bg-muted/60 text-foreground" : "text-muted-foreground/50"}`}>
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setViewMode("list")} className={`px-2.5 h-full transition-colors ${viewMode === "list" ? "bg-muted/60 text-foreground" : "text-muted-foreground/50"}`}>
                                <List className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => loadFiles(undefined, currentFolderId)} disabled={loadingFiles} className="h-8 w-8 p-0">
                            {loadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex items-center gap-2 flex-wrap">
                    <FilterDropdown id="type" label="Tipo" options={FILE_TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
                    <FilterDropdown id="modified" label="Modificado" options={MODIFIED_FILTERS} value={modifiedFilter} onChange={setModifiedFilter} />
                    <button
                        onClick={() => {
                            if (sortField === "name") setSortDir(d => d === "asc" ? "desc" : "asc");
                            else { setSortField("name"); setSortDir("asc"); }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-border/40 bg-card hover:bg-muted/40 text-foreground/70 transition-colors"
                    >
                        Nome
                        <SortAsc className={`w-3.5 h-3.5 transition-transform ${sortField === "name" && sortDir === "desc" ? "rotate-180" : ""}`} />
                    </button>
                </div>

                {/* New folder input */}
                {showNewFolderInput && (
                    <div className="flex items-center gap-2">
                        <FolderClosed className="w-5 h-5 text-muted-foreground shrink-0" />
                        <Input autoFocus placeholder="Nome da nova pasta..." value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)} className="flex-1 h-8 text-sm"
                            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") { setShowNewFolderInput(false); setNewFolderName(""); } }} />
                        <Button size="sm" className="h-8 text-xs" onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                            {creatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Criar"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setShowNewFolderInput(false); setNewFolderName(""); }}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* ─── Content + Preview ──────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden border-t border-border/20">

                {/* Main content area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5" onClick={() => setPreviewFile(null)}>

                    {uploadingFile && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary">
                            <Loader2 className="w-4 h-4 animate-spin" /> Enviando arquivo...
                        </div>
                    )}

                    {loadingFiles && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!loadingFiles && processedFiles.length === 0 && (
                        <div className="text-center py-20 space-y-3">
                            <HardDrive className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                            <p className="text-muted-foreground text-sm">{searchTerm ? "Nenhum resultado" : "Pasta vazia"}</p>
                        </div>
                    )}

                    {/* ─── Folders ──────────────────────────────────────── */}
                    {!loadingFiles && folders.length > 0 && (
                        <div>
                            {regularFiles.length > 0 && (
                                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-0.5">Pastas</h3>
                            )}
                            <div className={viewMode === "grid"
                                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2"
                                : "space-y-px rounded-xl border border-border/20 overflow-hidden"
                            }>
                                {folders.map(folder => (
                                    viewMode === "grid" ? (
                                        <button key={folder.id} onClick={() => navigateToFolder(folder)}
                                            onContextMenu={(e) => openContextMenu(e, folder)}
                                            className="group text-left rounded-xl border border-border/30 bg-card hover:bg-muted/30 hover:border-border/50 transition-all p-3 flex items-center gap-2.5 relative">
                                            <FolderClosed className="w-5 h-5 text-muted-foreground shrink-0" />
                                            <span className="text-sm font-medium truncate text-foreground/90">{folder.name}</span>
                                            <button onClick={(e) => openContextMenu(e, folder)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        </button>
                                    ) : (
                                        <button key={folder.id} onClick={() => navigateToFolder(folder)}
                                            onContextMenu={(e) => openContextMenu(e, folder)}
                                            className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors w-full text-left relative">
                                            <FolderClosed className="w-5 h-5 text-muted-foreground shrink-0" />
                                            <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
                                            <span className="text-xs text-muted-foreground/40 shrink-0">{formatDate(folder.modifiedTime)}</span>
                                            <button onClick={(e) => openContextMenu(e, folder)} className="p-1 rounded-md hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        </button>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ─── Files (only inside folders, not at root) ──── */}
                    {!loadingFiles && !isAtRoot && regularFiles.length > 0 && (
                        <div>
                            {folders.length > 0 && (
                                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-0.5">Arquivos</h3>
                            )}
                            {viewMode === "grid" ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {regularFiles.map(file => {
                                        const thumbUrl = getThumbnailUrl(file);
                                        return (
                                            <div key={file.id}
                                                onClick={(e) => { e.stopPropagation(); handleFileClick(file); }}
                                                onContextMenu={(e) => openContextMenu(e, file)}
                                                className={`group rounded-xl border transition-all cursor-pointer overflow-hidden relative
                                                    ${previewFile?.id === file.id
                                                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                                        : "border-border/20 bg-card hover:bg-muted/20 hover:border-border/40"
                                                    }`}>
                                                {/* Header: icon + name + menu */}
                                                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/10">
                                                    {getFileIcon(file.mimeType, "sm")}
                                                    <span className="text-xs font-medium truncate flex-1 text-foreground/80">{file.name}</span>
                                                    <button onClick={(e) => openContextMenu(e, file)}
                                                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50">
                                                        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </button>
                                                </div>
                                                {/* Image preview */}
                                                <div className="aspect-[4/3] flex items-center justify-center bg-muted/5 overflow-hidden">
                                                    {thumbUrl ? (
                                                        <img src={thumbUrl} alt={file.name} className="w-full h-full object-contain" loading="lazy"
                                                            referrerPolicy="no-referrer"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    ) : (
                                                        getFileIcon(file.mimeType, "lg")
                                                    )}
                                                </div>
                                                <div className="px-3 py-1.5 text-[10px] text-muted-foreground/40">
                                                    {formatDate(file.modifiedTime)}{file.size ? ` · ${formatFileSize(file.size)}` : ""}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-border/20 overflow-hidden divide-y divide-border/10">
                                    {regularFiles.map(file => (
                                        <div key={file.id} onClick={(e) => { e.stopPropagation(); handleFileClick(file); }}
                                            onContextMenu={(e) => openContextMenu(e, file)}
                                            className={`group flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer
                                                ${previewFile?.id === file.id ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                                            {getFileIcon(file.mimeType)}
                                            <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                                            {file.size && <span className="text-[11px] text-muted-foreground/40 w-16 text-right">{formatFileSize(file.size)}</span>}
                                            <span className="text-[11px] text-muted-foreground/40 w-24 text-right">{formatDate(file.modifiedTime)}</span>
                                            <button onClick={(e) => openContextMenu(e, file)} className="p-1 rounded-md hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── Preview Panel ────────────────────────────────────── */}
                {previewFile && (
                    <div className="w-72 shrink-0 border-l border-border/20 bg-card overflow-y-auto">
                        <div className="p-4 space-y-4">
                            <div className="flex items-start justify-between">
                                <h4 className="text-sm font-semibold truncate flex-1 pr-2">{previewFile.name}</h4>
                                <button onClick={() => setPreviewFile(null)} className="p-1 rounded-md hover:bg-muted/40">
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                            <div className="rounded-xl border border-border/20 bg-muted/10 overflow-hidden aspect-square flex items-center justify-center">
                                {(() => {
                                    const url = getThumbnailUrl(previewFile);
                                    return url ? (
                                        <img src={url} alt={previewFile.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                    ) : getFileIcon(previewFile.mimeType, "lg");
                                })()}
                            </div>
                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-medium">{getMimeLabel(previewFile.mimeType)}</span></div>
                                {previewFile.size && <div className="flex justify-between"><span className="text-muted-foreground">Tamanho</span><span className="font-medium">{formatFileSize(previewFile.size)}</span></div>}
                                {previewFile.modifiedTime && <div className="flex justify-between"><span className="text-muted-foreground">Modificado</span><span className="font-medium">{formatDate(previewFile.modifiedTime)}</span></div>}
                            </div>
                            <div className="space-y-1.5 pt-2">
                                {previewFile.webViewLink && (
                                    <a href={previewFile.webViewLink} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted/40 transition-colors">
                                        <ExternalLink className="w-4 h-4 text-muted-foreground" /> Abrir no Drive
                                    </a>
                                )}
                                <button onClick={() => { setRenameTarget(previewFile); setRenameValue(previewFile.name); }}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted/40 transition-colors">
                                    <Pencil className="w-4 h-4 text-muted-foreground" /> Renomear
                                </button>
                                <button onClick={() => openMoveDialog(previewFile)}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-muted/40 transition-colors">
                                    <FolderInput className="w-4 h-4 text-muted-foreground" /> Mover para...
                                </button>
                                <button onClick={() => handleDelete(previewFile)}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-red-500/10 text-red-400 transition-colors">
                                    <Trash2 className="w-4 h-4" /> Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Context Menu ──────────────────────────────────────────── */}
            {contextMenu && (
                <div ref={contextRef} className="fixed z-[100] bg-card border border-border/40 rounded-xl shadow-xl py-1.5 min-w-[180px] animate-in fade-in-0 zoom-in-95"
                    style={{ left: contextMenu.x, top: contextMenu.y }}>
                    {contextMenu.file.mimeType.includes("folder") ? (
                        <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                            onClick={() => { navigateToFolder(contextMenu.file); setContextMenu(null); }}>
                            <FolderClosed className="w-4 h-4 text-muted-foreground" /> Abrir pasta
                        </button>
                    ) : contextMenu.file.webViewLink ? (
                        <a href={contextMenu.file.webViewLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                            onClick={() => setContextMenu(null)}>
                            <ExternalLink className="w-4 h-4 text-muted-foreground" /> Abrir
                        </a>
                    ) : null}
                    <div className="h-px bg-border/20 my-1" />
                    <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => { setRenameTarget(contextMenu.file); setRenameValue(contextMenu.file.name); setContextMenu(null); }}>
                        <Pencil className="w-4 h-4 text-muted-foreground" /> Renomear
                    </button>
                    <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => { openMoveDialog(contextMenu.file); setContextMenu(null); }}>
                        <FolderInput className="w-4 h-4 text-muted-foreground" /> Mover para...
                    </button>
                    <div className="h-px bg-border/20 my-1" />
                    <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-red-500/10 text-red-400 transition-colors"
                        onClick={() => { handleDelete(contextMenu.file); setContextMenu(null); }}>
                        <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                </div>
            )}

            {/* ─── Rename Dialog ────────────────────────────────────────── */}
            <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
                <DialogContent className="sm:max-w-md border-none bg-card rounded-2xl">
                    <DialogHeader><DialogTitle>Renomear</DialogTitle></DialogHeader>
                    <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename()} className="mt-2" />
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancelar</Button>
                        <Button onClick={handleRename} disabled={!renameValue.trim()}>Renomear</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Move Dialog ──────────────────────────────────────────── */}
            <Dialog open={!!moveTarget} onOpenChange={() => setMoveTarget(null)}>
                <DialogContent className="sm:max-w-md border-none bg-card rounded-2xl">
                    <DialogHeader><DialogTitle>Mover "{moveTarget?.name}"</DialogTitle></DialogHeader>
                    {loadingMoveFolders ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <div className="space-y-1 max-h-64 overflow-y-auto py-2">
                            <button onClick={() => setMoveSelectedFolder("root")}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${moveSelectedFolder === "root" ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}>
                                <Home className="w-4 h-4" /> Meu Drive (raiz)
                            </button>
                            {moveFolders.map(f => (
                                <button key={f.id} onClick={() => setMoveSelectedFolder(f.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${moveSelectedFolder === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}>
                                    <FolderClosed className="w-4 h-4 text-muted-foreground" /> {f.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setMoveTarget(null)}>Cancelar</Button>
                        <Button onClick={handleMove} disabled={!moveSelectedFolder}>Mover</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
