import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Image as ImageIcon, Film, Plus, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface MetaAsset {
    id: string;
    hash?: string;
    name?: string;
    url: string;
    thumbnail?: string;
    type: 'IMAGE' | 'VIDEO';
    duration?: number; // Video duration in seconds
}

interface CreativePickerWidgetProps {
    accountId: string;
    selectedCreatives: MetaAsset[];
    onSelect: (creatives: MetaAsset[]) => void;
    maxSelection?: number; // Limite de criativos (default: 1)
}

export const CreativePickerWidget = ({ accountId, selectedCreatives, onSelect, maxSelection = 1 }: CreativePickerWidgetProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const { data: assets = [], isLoading } = useQuery({
        queryKey: ['meta-assets-picker', accountId],
        queryFn: async () => {
            if (!accountId) return [];

            // Get token
            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', accountId)
                .single();

            if (!accountData?.access_token) throw new Error("Access token not found.");

            const { data, error } = await supabase.functions.invoke('manage-meta-assets', {
                body: { accountId: accountId, action: 'LIST', accessToken: accountData.access_token }
            });

            if (error || data.error) throw new Error(error?.message || data.error);

            return data.data as MetaAsset[];
        },
        enabled: !!accountId && isOpen
    });

    const toggleSelection = (asset: MetaAsset) => {
        const isSelected = selectedCreatives.some(c => c.id === asset.id);
        if (isSelected) {
            onSelect(selectedCreatives.filter(c => c.id !== asset.id));
        } else {
            // Se maxSelection = 1, substituir o criativo atual
            if (maxSelection === 1) {
                onSelect([asset]);
            } else if (selectedCreatives.length < maxSelection) {
                onSelect([...selectedCreatives, asset]);
            }
            // Se já atingiu o limite, não adiciona mais
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {selectedCreatives.length > 0 ? (
                maxSelection === 1 ? (
                    // Single creative display
                    <div className="relative rounded-lg overflow-hidden border bg-muted group max-w-xs">
                        <div className="aspect-square">
                            <img
                                src={selectedCreatives[0].thumbnail || selectedCreatives[0].url}
                                alt={selectedCreatives[0].name}
                                className="w-full h-full object-cover"
                            />
                            {selectedCreatives[0].type === 'VIDEO' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-black/40 rounded-full p-2">
                                        <Play className="h-6 w-6 text-white fill-white" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => onSelect([])}
                            className="absolute top-2 right-2 bg-black/50 hover:bg-destructive text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="Remover criativo"
                        >
                            <Plus className="h-4 w-4 rotate-45" />
                        </button>
                        {selectedCreatives[0].name && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                <p className="text-xs text-white truncate">{selectedCreatives[0].name}</p>
                            </div>
                        )}
                        <DialogTrigger asChild>
                            <button
                                className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
                                title="Trocar criativo"
                            >
                                <span className="bg-black/70 text-white text-xs px-2 py-1 rounded">Trocar</span>
                            </button>
                        </DialogTrigger>
                    </div>
                ) : (
                    // Multiple creatives grid
                    <div className="space-y-2">
                        <div className="grid grid-cols-4 gap-2">
                            {selectedCreatives.map((creative) => (
                                <div key={creative.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted group">
                                    <img
                                        src={creative.thumbnail || creative.url}
                                        alt={creative.name}
                                        className="w-full h-full object-cover"
                                    />
                                    {creative.type === 'VIDEO' && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-black/40 rounded-full p-1">
                                                <Play className="h-3 w-3 text-white fill-white" />
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => toggleSelection(creative)}
                                        className="absolute top-1 right-1 bg-black/50 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    >
                                        <Plus className="h-3 w-3 rotate-45" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {selectedCreatives.length < maxSelection && (
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Adicionar mais criativos
                                </Button>
                            </DialogTrigger>
                        )}
                    </div>
                )
            ) : (
                <DialogTrigger asChild>
                    <div
                        className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Nenhum criativo selecionado</p>
                        <Button variant="outline" size="sm" className="mt-3">
                            <Plus className="h-3 w-3 mr-1" />
                            Selecionar da Biblioteca
                        </Button>
                    </div>
                </DialogTrigger>
            )}

            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Biblioteca de Criativos</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden min-h-0 mt-4">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <ScrollArea className="h-full pr-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                                {assets.map((asset) => {
                                    const isSelected = selectedCreatives.some(c => c.id === asset.id);
                                    return (
                                        <div
                                            key={asset.id}
                                            className={cn(
                                                "group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                                                isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-primary/50"
                                            )}
                                            onClick={() => toggleSelection(asset)}
                                        >
                                            <img
                                                src={asset.thumbnail || asset.url}
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Video play button overlay */}
                                            {asset.type === 'VIDEO' && !isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <div className="bg-black/60 rounded-full p-3 group-hover:scale-110 transition-transform">
                                                        <Play className="h-6 w-6 text-white fill-white" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className={cn(
                                                "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center",
                                                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )}>
                                                {isSelected && (
                                                    <CheckCircle2 className="h-8 w-8 text-white fill-primary" />
                                                )}
                                            </div>
                                            {/* Type badge with duration for videos */}
                                            <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-white font-medium flex items-center gap-1">
                                                {asset.type === 'VIDEO' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                                                {asset.type === 'VIDEO' && asset.duration
                                                    ? `${Math.floor(asset.duration / 60)}:${String(Math.floor(asset.duration % 60)).padStart(2, '0')}`
                                                    : asset.type
                                                }
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                        {selectedCreatives.length} selecionados
                    </p>
                    <Button onClick={() => setIsOpen(false)}>
                        Confirmar Seleção
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
