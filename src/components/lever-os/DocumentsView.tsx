import { useState, useRef } from "react";
import {
    FileText,
    Link as LinkIcon,
    Folder,
    ExternalLink,
    Plus,
    MoreVertical,
    Trash2,
    Download,
    FileCode,
    Upload,
    X,
    Loader2,
    FileUp,
    Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useClientDocuments, ClientDocument } from "@/hooks/useClientDocuments";

interface DocumentsViewProps {
    clientId: string;
}

const CATEGORY_OPTIONS = [
    { value: 'legal', label: 'Jurídico', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    { value: 'strategy', label: 'Estratégia', className: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    { value: 'creatives', label: 'Criativos', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    { value: 'other', label: 'Outros', className: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
];

const DOC_TYPE_OPTIONS = [
    { value: 'file', label: 'Arquivo' },
    { value: 'contract', label: 'Contrato' },
    { value: 'folder', label: 'Pasta' },
];

export function DocumentsView({ clientId }: DocumentsViewProps) {
    const { documents, isLoading, uploadDocument, addExternalLink, deleteDocument } = useClientDocuments(clientId);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'upload' | 'link'>('upload');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<ClientDocument['category']>('other');
    const [docType, setDocType] = useState<ClientDocument['doc_type']>('file');
    const [externalUrl, setExternalUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setCategory('other');
        setDocType('file');
        setExternalUrl('');
        setSelectedFile(null);
    };

    const openModal = (mode: 'upload' | 'link') => {
        resetForm();
        setModalMode(mode);
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setIsSubmitting(true);

        try {
            if (modalMode === 'upload') {
                if (!selectedFile) return;
                await uploadDocument(selectedFile, title, category, docType, description);
            } else {
                if (!externalUrl.trim()) return;
                await addExternalLink(title, externalUrl, category, description);
            }
            setIsModalOpen(false);
            resetForm();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (doc: ClientDocument) => {
        if (!confirm(`Excluir "${doc.title}"?`)) return;
        await deleteDocument(doc);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            setSelectedFile(file);
            if (!title) setTitle(file.name.split('.').slice(0, -1).join('.'));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (!title) setTitle(file.name.split('.').slice(0, -1).join('.'));
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'contract': return <FileText className="w-4 h-4" />;
            case 'folder': return <Folder className="w-4 h-4" />;
            case 'external_link': return <LinkIcon className="w-4 h-4" />;
            default: return <FileCode className="w-4 h-4" />;
        }
    };

    const getCategoryBadge = (cat: string) => {
        const config = CATEGORY_OPTIONS.find(c => c.value === cat) || CATEGORY_OPTIONS[3];
        return <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-widest", config.className)}>{config.label}</Badge>;
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header Actions */}
            <div className="flex justify-end items-center">
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => openModal('link')}>
                        <Globe className="w-4 h-4" />
                        Link Externo
                    </Button>
                    <Button className="gap-2" onClick={() => openModal('upload')}>
                        <Plus className="w-4 h-4" />
                        Novo Documento
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-primary/[0.02] border-primary/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary/60">Total de Documentos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{documents.length}</span>
                            <span className="text-xs text-muted-foreground">itens organizados</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-blue-500/[0.02] border-blue-500/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-600/60">Contratos Ativos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{documents.filter(d => d.doc_type === 'contract').length}</span>
                            <span className="text-xs text-muted-foreground text-blue-500">documentos legais</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-amber-500/[0.02] border-amber-500/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-600/60">Links Externos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{documents.filter(d => d.doc_type === 'external_link').length}</span>
                            <span className="text-xs text-muted-foreground text-amber-500">Google Drive / Drive</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Documents Table */}
            {documents.length === 0 ? (
                <Card className="border-dashed shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                        <FileUp className="w-12 h-12 text-muted-foreground/40" />
                        <div className="text-center">
                            <p className="text-lg font-semibold text-muted-foreground">Nenhum documento</p>
                            <p className="text-sm text-muted-foreground/60">Envie arquivos ou adicione links externos para organizar os materiais do cliente.</p>
                        </div>
                        <Button className="gap-2" onClick={() => openModal('upload')}>
                            <Plus className="w-4 h-4" />
                            Enviar Primeiro Documento
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Nome do Documento</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Categoria</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Tamanho</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Atualizado em</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {documents.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                                                    doc.doc_type === 'contract' ? "bg-blue-500/10 text-blue-500" :
                                                        doc.doc_type === 'external_link' ? "bg-amber-500/10 text-amber-500" :
                                                            doc.doc_type === 'folder' ? "bg-purple-500/10 text-purple-500" :
                                                                "bg-slate-500/10 text-slate-500"
                                                )}>
                                                    {getIcon(doc.doc_type)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold tracking-tight">{doc.title}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                                        {doc.doc_type === 'external_link' ? 'Link Externo' :
                                                            doc.doc_type === 'contract' ? 'Contrato' :
                                                                doc.doc_type === 'folder' ? 'Pasta' : doc.file_name || 'Arquivo'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getCategoryBadge(doc.category)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {doc.file_size ? formatFileSize(doc.file_size) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-muted-foreground font-medium">{formatDate(doc.created_at)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {(doc.file_url || doc.external_url) && (
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" asChild>
                                                        <a href={doc.file_url || doc.external_url || '#'} target="_blank" rel="noopener noreferrer">
                                                            {doc.doc_type === 'external_link' ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                                                        </a>
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        {doc.file_url && (
                                                            <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                                                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download>
                                                                    <Download className="w-4 h-4" /> Baixar
                                                                </a>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {doc.external_url && (
                                                            <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                                                                <a href={doc.external_url} target="_blank" rel="noopener noreferrer">
                                                                    <ExternalLink className="w-4 h-4" /> Abrir Link
                                                                </a>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                                            onClick={() => handleDelete(doc)}
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Excluir
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Upload / Link Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{modalMode === 'upload' ? 'Enviar Documento' : 'Adicionar Link Externo'}</DialogTitle>
                        <DialogDescription>
                            {modalMode === 'upload' ? 'Selecione um arquivo para enviar ao storage do cliente.' : 'Adicione um link externo (Google Drive, Figma, etc.)'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Mode Tabs */}
                    <div className="flex gap-2 mb-4">
                        <Button
                            variant={modalMode === 'upload' ? 'default' : 'outline'}
                            size="sm"
                            className="gap-2"
                            onClick={() => setModalMode('upload')}
                        >
                            <Upload className="w-4 h-4" /> Arquivo
                        </Button>
                        <Button
                            variant={modalMode === 'link' ? 'default' : 'outline'}
                            size="sm"
                            className="gap-2"
                            onClick={() => setModalMode('link')}
                        >
                            <Globe className="w-4 h-4" /> Link Externo
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {/* File Upload Area (only for upload mode) */}
                        {modalMode === 'upload' && (
                            <div
                                className={cn(
                                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                                    isDragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
                                    selectedFile && "border-green-500/50 bg-green-500/5"
                                )}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                {selectedFile ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <FileText className="w-8 h-8 text-green-500" />
                                        <div className="text-left">
                                            <p className="text-sm font-semibold">{selectedFile.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedFile(null);
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="w-10 h-10 mx-auto text-muted-foreground/40" />
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Arraste e solte ou <span className="text-primary underline">clique para selecionar</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground/60">PDF, DOC, XLS, IMG, até 500MB</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* External URL (only for link mode) */}
                        {modalMode === 'link' && (
                            <div className="space-y-2">
                                <Label>URL do Link</Label>
                                <Input
                                    placeholder="https://drive.google.com/..."
                                    value={externalUrl}
                                    onChange={(e) => setExternalUrl(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Title */}
                        <div className="space-y-2">
                            <Label>Título</Label>
                            <Input
                                placeholder="Ex: Contrato de Prestação de Serviços"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label>Descrição (opcional)</Label>
                            <Textarea
                                placeholder="Breve descrição do documento..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_OPTIONS.map(opt => (
                                    <Button
                                        key={opt.value}
                                        variant={category === opt.value ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setCategory(opt.value as ClientDocument['category'])}
                                    >
                                        {opt.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Doc Type (only for upload mode) */}
                        {modalMode === 'upload' && (
                            <div className="space-y-2">
                                <Label>Tipo de Documento</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DOC_TYPE_OPTIONS.map(opt => (
                                        <Button
                                            key={opt.value}
                                            variant={docType === opt.value ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setDocType(opt.value as ClientDocument['doc_type'])}
                                        >
                                            {opt.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <Button
                            className="w-full gap-2"
                            disabled={isSubmitting || !title.trim() || (modalMode === 'upload' && !selectedFile) || (modalMode === 'link' && !externalUrl.trim())}
                            onClick={handleSubmit}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {modalMode === 'upload' ? 'Enviando...' : 'Salvando...'}
                                </>
                            ) : (
                                <>
                                    {modalMode === 'upload' ? <Upload className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    {modalMode === 'upload' ? 'Enviar Documento' : 'Adicionar Link'}
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
