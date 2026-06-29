import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, Plus, Loader2 } from 'lucide-react';
import { ALL_AVAILABLE_COLUMNS, type ColumnPreset } from '@/hooks/useColumnPresets';

interface ColumnCustomizerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activePreset: ColumnPreset;
    customPresets: ColumnPreset[];
    onCreatePreset: (name: string, columns: string[]) => Promise<boolean>;
    onUpdatePreset: (id: string, name: string, columns: string[]) => Promise<boolean>;
    onDeletePreset: (id: string) => Promise<boolean>;
}

const CATEGORY_LABELS: Record<string, string> = {
    basic: 'Básico',
    performance: 'Performance',
    sales: 'Vendas',
    leads: 'Leads & Mensagens',
    video: 'Vídeo',
    delivery: 'Entrega',
};

export function ColumnCustomizerDialog({
    open,
    onOpenChange,
    activePreset,
    customPresets,
    onCreatePreset,
    onUpdatePreset,
    onDeletePreset,
}: ColumnCustomizerDialogProps) {
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [presetName, setPresetName] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Inicializar com as colunas do preset ativo
    useEffect(() => {
        if (open) {
            setSelectedColumns([...activePreset.columns]);
            setPresetName(activePreset.isSystem ? '' : activePreset.name);
            setIsEditing(!activePreset.isSystem);
        }
    }, [open, activePreset]);

    const toggleColumn = (columnId: string) => {
        setSelectedColumns(prev =>
            prev.includes(columnId)
                ? prev.filter(id => id !== columnId)
                : [...prev, columnId]
        );
    };

    const handleSave = async () => {
        if (selectedColumns.length === 0) return;

        setIsSaving(true);

        try {
            if (isEditing && !activePreset.isSystem) {
                // Atualizar preset existente
                await onUpdatePreset(activePreset.id, presetName || activePreset.name, selectedColumns);
            } else {
                // Criar novo preset
                if (!presetName.trim()) {
                    setIsSaving(false);
                    return;
                }
                await onCreatePreset(presetName.trim(), selectedColumns);
            }
            onOpenChange(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (activePreset.isSystem) return;

        const confirmed = window.confirm(`Tem certeza que deseja excluir o preset "${activePreset.name}"?`);
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            await onDeletePreset(activePreset.id);
            onOpenChange(false);
        } finally {
            setIsDeleting(false);
        }
    };

    // Agrupar colunas por categoria
    const columnsByCategory = ALL_AVAILABLE_COLUMNS.reduce((acc, col) => {
        if (!acc[col.category]) acc[col.category] = [];
        acc[col.category].push(col);
        return acc;
    }, {} as Record<string, typeof ALL_AVAILABLE_COLUMNS[number][]>);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Personalizar Colunas
                        {activePreset.isSystem && (
                            <Badge variant="secondary" className="text-xs">Preset do Sistema</Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {activePreset.isSystem
                            ? 'Selecione as colunas desejadas e salve como um novo preset personalizado.'
                            : 'Edite as colunas do seu preset ou crie um novo.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    {/* Campo de nome apenas se for novo ou editável */}
                    <div className="space-y-2">
                        <Label htmlFor="preset-name">Nome do Preset</Label>
                        <Input
                            id="preset-name"
                            placeholder={activePreset.isSystem ? "Digite um nome para salvar como novo..." : "Nome do preset"}
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            disabled={isSaving}
                        />
                        {activePreset.isSystem && (
                            <p className="text-xs text-muted-foreground">
                                Presets do sistema não podem ser editados. Digite um nome para salvar como novo.
                            </p>
                        )}
                    </div>

                    {/* Lista de colunas por categoria */}
                    <ScrollArea className="flex-1 border rounded-lg p-4">
                        <div className="space-y-6">
                            {Object.entries(columnsByCategory).map(([category, columns]) => (
                                <div key={category} className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                                        {CATEGORY_LABELS[category] || category}
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {columns.map((col) => (
                                            <label
                                                key={col.id}
                                                className={`
                          flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all
                          ${selectedColumns.includes(col.id)
                                                        ? 'bg-primary/10 border-primary/50 shadow-sm'
                                                        : 'bg-muted/30 border-transparent hover:border-muted-foreground/30'}
                        `}
                                            >
                                                <Checkbox
                                                    checked={selectedColumns.includes(col.id)}
                                                    onCheckedChange={() => toggleColumn(col.id)}
                                                    disabled={isSaving}
                                                />
                                                <span className="text-sm">{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Contador de colunas selecionadas */}
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>{selectedColumns.length} coluna{selectedColumns.length !== 1 && 's'} selecionada{selectedColumns.length !== 1 && 's'}</span>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedColumns(ALL_AVAILABLE_COLUMNS.map(c => c.id))}
                                disabled={isSaving}
                            >
                                Selecionar Todas
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedColumns(['status'])}
                                disabled={isSaving}
                            >
                                Limpar
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex justify-between gap-2 sm:justify-between">
                    {/* Botão de excluir (apenas para presets custom) */}
                    {!activePreset.isSystem && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDelete}
                            disabled={isSaving || isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">Excluir</span>
                        </Button>
                    )}

                    <div className="flex gap-2 ml-auto">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={selectedColumns.length === 0 || isSaving || (activePreset.isSystem && !presetName.trim())}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Salvando...
                                </>
                            ) : activePreset.isSystem ? (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Salvar como Novo
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Atualizar
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
