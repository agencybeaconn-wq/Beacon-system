import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, CheckCircle2, Image as ImageIcon, Film, Play, X, Sparkles, Loader2, Folder, ArrowLeft, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

// Interfaces
interface MetaAsset {
    id: string;
    hash?: string;
    name?: string;
    url: string;
    url_128?: string;
    thumbnail?: string;
    status?: string;
    type: 'IMAGE' | 'VIDEO';
    created_time?: string;
    usageStatus?: 'active' | 'inactive' | 'new';
    uploadDate?: string;
}

interface AssetFolder {
    id: string;
    name: string;
    parent_id: string | null;
}

interface Creative {
    id: string;
    hash?: string;
    name: string;
    url: string;
    thumbnail?: string;
    type: 'image' | 'video';
}

interface AdInfo {
    id: string;
    name: string;
}

interface AdSetInfo {
    id: string;
    name: string;
    ads: AdInfo[];
}

interface CreativeAssignment {
    adId: string;
    adSetId: string;
    creative: Creative;
}

interface CreativeSelectionWizardProps {
    campaignName: string;
    adSets: AdSetInfo[];
    creatives?: Creative[];
    onComplete: (assignments: CreativeAssignment[]) => void;
    onCancel: () => void;
}

export function CreativeSelectionWizard({
    campaignName,
    adSets,
    creatives: initialCreatives,
    onComplete,
    onCancel
}: CreativeSelectionWizardProps) {
    const { selectedAccountId } = useDashboard();
    const [currentAdSetIndex, setCurrentAdSetIndex] = useState(0);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);
    const [assignments, setAssignments] = useState<Map<string, Creative>>(new Map());

    // Filter state
    const [selectedTab, setSelectedTab] = useState<'all' | 'images' | 'videos'>('all');
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

    // Multi-select State
    const [selectedAssets, setSelectedAssets] = useState<MetaAsset[]>([]);

    const currentAdSet = adSets[currentAdSetIndex];
    const currentAd = currentAdSet?.ads[currentAdIndex];
    const totalAds = adSets.reduce((sum, set) => sum + set.ads.length, 0);
    const completedAds = assignments.size;

    // 🎨 FETCH CREATIVES FROM manage-meta-assets
    const { data: metaAssets = [], isLoading: isLoadingAssets } = useQuery({
        queryKey: ['wizard-meta-assets', selectedAccountId],
        queryFn: async () => {
            if (!selectedAccountId) return [];

            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', selectedAccountId)
                .single();

            if (!accountData?.access_token) throw new Error("Access token not found.");

            const { data, error } = await supabase.functions.invoke('manage-meta-assets', {
                body: { accountId: selectedAccountId, action: 'LIST', accessToken: accountData.access_token }
            });

            if (error || data.error) throw new Error(error?.message || data.error);

            // Add mock usage data
            const enhancedData = (data.data as MetaAsset[]).map(asset => ({
                ...asset,
                usageStatus: Math.random() > 0.7 ? 'active' : Math.random() > 0.8 ? 'new' : 'inactive',
                uploadDate: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString()
            }));

            return enhancedData as MetaAsset[];
        },
        enabled: !!selectedAccountId,
        staleTime: 1000 * 60 * 5, // Cache 5 min
    });

    // 📁 FETCH FOLDERS
    const { data: folders = [], isLoading: isLoadingFolders } = useQuery({
        queryKey: ['wizard-asset-folders', selectedAccountId, currentFolderId],
        queryFn: async () => {
            if (!selectedAccountId) return [];

            let query = (supabase as any)
                .from('asset_folders')
                .select('*')
                .eq('account_id', selectedAccountId);

            if (currentFolderId) {
                query = query.eq('parent_id', currentFolderId);
            } else {
                query = query.is('parent_id', null);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as AssetFolder[];
        },
        enabled: !!selectedAccountId
    });

    // 📨 FETCH FOLDER ITEMS (Mapping)
    const { data: folderItems = [] } = useQuery({
        queryKey: ['wizard-asset-folder-items', selectedAccountId],
        queryFn: async () => {
            if (!selectedAccountId) return [];

            const { data, error } = await (supabase as any)
                .from('asset_folder_items')
                .select('*');

            if (error) throw error;
            return data as { folder_id: string, asset_id: string }[];
        },
        enabled: !!selectedAccountId
    });

    // Filter assets based on current folder and tab
    const filteredAssets = metaAssets.filter(asset => {
        // 1. Check folder
        const itemRecord = folderItems.find(item => item.asset_id === asset.id);
        const assetFolderId = itemRecord?.folder_id || null;
        if (assetFolderId !== currentFolderId) return false;

        // 2. Tab Filter
        if (selectedTab === 'images' && asset.type !== 'IMAGE') return false;
        if (selectedTab === 'videos' && asset.type !== 'VIDEO') return false;

        return true;
    });

    // Transform to Creative format for assignments
    const transformToCreative = (asset: MetaAsset): Creative => ({
        id: asset.id,
        hash: asset.hash || asset.id,
        name: asset.name || 'Criativo',
        url: asset.url,
        thumbnail: asset.url_128 || asset.thumbnail || asset.url,
        type: asset.type === 'VIDEO' ? 'video' : 'image'
    });

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
            document.body.style.pointerEvents = 'auto';
        };
    }, []);

    const handleAssetClick = (asset: MetaAsset) => {
        // Toggle selection logic retained for multi-select features
        const isSelected = selectedAssets.some(a => a.id === asset.id);
        let newSelected: MetaAsset[];

        if (isSelected) {
            newSelected = selectedAssets.filter(a => a.id !== asset.id);
        } else {
            // Single select behavior priority: Replace selection if mostly doing 1-by-1
            // But let's keep accumulation if they want to distribute later.
            // Actually, for the "Pick this creative for this ad" flow, we want immediate feedback.
            newSelected = [...selectedAssets, asset];
        }
        setSelectedAssets(newSelected);

        // ⚡ AUTO-ASSIGN: If we have a current ad focused, assign immediately!
        if (currentAd) {
            const creative = transformToCreative(asset);
            const newAssignments = new Map(assignments);
            newAssignments.set(currentAd.id, creative);
            setAssignments(newAssignments);

            // Optional: Auto-advance to next ad? 
            // Maybe not, might be confusing. But assigning immediately fixes the "not saving" feeling.
        }
    };

    const handleSidebarAdClick = (setIndex: number, adIndex: number) => {
        setCurrentAdSetIndex(setIndex);
        setCurrentAdIndex(adIndex);

        // PAINT MODE: If we have selected assets, assign them!
        const targetAd = adSets[setIndex].ads[adIndex];
        if (selectedAssets.length > 0) {
            // Assign the last selected asset (most recent) or first? 
            // Let's use the most recently clicked one usually, or first in list.
            const creative = transformToCreative(selectedAssets[selectedAssets.length - 1]);
            const newAssignments = new Map(assignments);
            newAssignments.set(targetAd.id, creative);
            setAssignments(newAssignments);
        }
    };

    // Distribute selected creatives to EMPTY slots
    const handleDistribute = () => {
        if (selectedAssets.length === 0) return;

        const newAssignments = new Map(assignments);
        let updatedCount = 0;
        let creativeIdx = 0;

        // Iterate all ads
        for (const adSet of adSets) {
            for (const ad of adSet.ads) {
                // If ad is empty
                if (!newAssignments.has(ad.id)) {
                    // Pick next creative (round-robin)
                    const asset = selectedAssets[creativeIdx % selectedAssets.length];
                    newAssignments.set(ad.id, transformToCreative(asset));

                    creativeIdx++;
                    updatedCount++;
                }
            }
        }

        setAssignments(newAssignments);
    };

    const handleNextAd = () => {
        const currentSet = adSets[currentAdSetIndex];

        // If there are more ads in the current set
        if (currentAdIndex < currentSet.ads.length - 1) {
            setCurrentAdIndex(prev => prev + 1);
        }
        // If we are at the last ad of the current set, but there are more sets
        else if (currentAdSetIndex < adSets.length - 1) {
            setCurrentAdSetIndex(prev => prev + 1);
            setCurrentAdIndex(0); // Reset to first ad of new set
        }

        // Clear selection for the new ad to avoid confusion
        setSelectedAssets([]);
    };

    const handleComplete = () => {
        // If not all ads are filled, just go to next
        if (completedAds < totalAds) {
            handleNextAd();
            return;
        }

        const result: CreativeAssignment[] = [];
        for (const adSet of adSets) {
            for (const ad of adSet.ads) {
                const creative = assignments.get(ad.id);
                if (creative) {
                    result.push({
                        adId: ad.id,
                        adSetId: adSet.id,
                        creative
                    });
                }
            }
        }
        onComplete(result);
    };

    const handleOpenFolder = (folderId: string) => {
        setCurrentFolderId(folderId);
    };

    const handleGoBack = () => {
        setCurrentFolderId(null);
    };

    const isLoading = isLoadingAssets || isLoadingFolders;
    const remainingCount = totalAds - completedAds;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 isolate">
            {/* Main Container */}
            <div className="w-full max-w-7xl h-[85vh] animate-in zoom-in-95 slide-in-from-bottom-6 duration-300 flex flex-col relative z-50">
                <Card className="flex-1 w-full h-full border-border/40 shadow-2xl bg-background/95 backdrop-blur overflow-hidden flex flex-row relative z-50">

                    {/* 🧊 SIDEBAR - Navigation Tree */}
                    <div className="w-[300px] border-r h-full flex flex-col bg-muted/20 flex-shrink-0">
                        <div className="p-4 border-b bg-background/50 backdrop-blur">
                            <h2 className="font-semibold flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-primary" />
                                Estrutura
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                {completedAds} de {totalAds} preenchidos
                            </p>
                        </div>

                        <ScrollArea className="flex-1 py-2">
                            <div className="px-3 space-y-4">
                                {adSets.map((adSet, setIndex) => (
                                    <div key={adSet.id} className="space-y-1">
                                        <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Folder className="h-3.5 w-3.5" />
                                            <span className="truncate">{adSet.name}</span>
                                        </div>
                                        <div className="space-y-0.5 ml-1">
                                            {adSet.ads.map((ad, adIndex) => {
                                                const isActive = currentAdSetIndex === setIndex && currentAdIndex === adIndex;
                                                const isFilled = assignments.has(ad.id);

                                                return (
                                                    <button
                                                        key={ad.id}
                                                        onClick={() => handleSidebarAdClick(setIndex, adIndex)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all text-left group border border-transparent",
                                                            isActive
                                                                ? "bg-primary/10 text-primary font-medium border-primary/20 shadow-sm ring-1 ring-primary/20"
                                                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "h-2 w-2 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                                                            isFilled ? "bg-green-500 ring-green-500/30" : "bg-muted-foreground/30 ring-transparent"
                                                        )} />
                                                        <span className="truncate flex-1">{ad.name}</span>
                                                        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t bg-background/50 backdrop-blur text-xs text-muted-foreground">
                            {selectedAssets.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-primary font-medium">
                                        <span>✨ {selectedAssets.length} selecionados</span>
                                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => setSelectedAssets([])}>Limpar</Button>
                                    </div>
                                    <p>Clique em um anúncio acima para aplicar o(s) criativo(s).</p>
                                </div>
                            ) : (
                                "Selecione criativos para preencher os anúncios."
                            )}
                        </div>
                    </div>

                    {/* 🎬 MAIN AREA - Media Library */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                        {/* Header & Filters */}
                        <div className="p-4 border-b flex items-center justify-between gap-4 bg-background/80 backdrop-blur sticky top-0 z-10">
                            <div className="flex items-center gap-2 overflow-hidden">
                                {currentFolderId ? (
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={handleGoBack} className="h-8 w-8">
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="font-medium truncate">
                                            {folders.find(f => f.id === currentFolderId)?.name || 'Pasta'}
                                        </span>
                                    </div>
                                ) : (
                                    <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)} className="w-auto">
                                        <TabsList>
                                            <TabsTrigger value="all">Todos</TabsTrigger>
                                            <TabsTrigger value="images">Imagens</TabsTrigger>
                                            <TabsTrigger value="videos">Vídeos</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                )}
                            </div>

                            {/* Action Buttons for Multi-select */}
                            {selectedAssets.length > 0 && (
                                <div className="flex items-center gap-2 animate-in slide-in-from-right-4 fade-in">
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 border-0"
                                        onClick={handleDistribute}
                                        disabled={remainingCount === 0}
                                    >
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Distribuir em {remainingCount} vazios
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Content Grid */}
                        <ScrollArea className="flex-1 bg-muted/5">
                            <div className="p-4 sm:p-6 pb-20">
                                {isLoading ? (
                                    <div className="h-[400px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
                                        <p>Carregando sua biblioteca...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {/* Folders (only on root) */}
                                        {!currentFolderId && folders.map(folder => (
                                            <button
                                                key={folder.id}
                                                onClick={() => handleOpenFolder(folder.id)}
                                                className="group aspect-square rounded-xl border bg-card hover:bg-accent/50 transition-all flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:shadow-md"
                                            >
                                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                    <Folder className="h-6 w-6 text-primary" />
                                                </div>
                                                <span className="text-sm font-medium px-2 text-center truncate w-full">
                                                    {folder.name}
                                                </span>
                                            </button>
                                        ))}

                                        {/* Assets */}
                                        {filteredAssets.map((asset) => {
                                            const isSelected = selectedAssets.some(a => a.id === asset.id);
                                            const isCurrentAssigned = assignments.get(currentAd?.id || '')?.id === asset.id;

                                            return (
                                                <button
                                                    key={asset.id}
                                                    onClick={() => handleAssetClick(asset)}
                                                    className={cn(
                                                        "group relative aspect-square rounded-xl overflow-hidden border transition-all cursor-pointer",
                                                        isSelected
                                                            ? "ring-2 ring-primary border-primary shadow-lg scale-[1.02] z-10"
                                                            : "hover:border-primary/50 hover:shadow-md",
                                                        isCurrentAssigned && "ring-2 ring-green-500 border-green-500"
                                                    )}
                                                >
                                                    {/* Media thumbnail */}
                                                    {asset.type === 'VIDEO' ? (
                                                        <div className="w-full h-full bg-black/5 relative">
                                                            {asset.thumbnail ? (
                                                                <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Film className="h-8 w-8 text-muted-foreground" />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                                <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                                    <Play className="h-4 w-4 text-white fill-white" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={asset.url_128 || asset.url}
                                                            alt={asset.name}
                                                            className="w-full h-full object-cover bg-muted opacity-90 group-hover:opacity-100 transition-opacity"
                                                            loading="lazy"
                                                        />
                                                    )}

                                                    {/* Selection Indicator */}
                                                    {isSelected && (
                                                        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm animate-in zoom-in">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </div>
                                                    )}

                                                    {/* Multi-select order badge */}
                                                    {isSelected && selectedAssets.length > 1 && (
                                                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white backdrop-blur">
                                                            {selectedAssets.findIndex(a => a.id === asset.id) + 1}
                                                        </div>
                                                    )}

                                                    {/* Usage Badge */}
                                                    {(() => {
                                                        const useCount = Array.from(assignments.values()).filter(a => a.id === asset.id).length;
                                                        if (useCount > 0) return (
                                                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white backdrop-blur flex items-center gap-1">
                                                                <LayoutGrid className="h-3 w-3" />
                                                                {useCount}
                                                            </div>
                                                        );
                                                    })()}
                                                </button>
                                            );
                                        })}

                                        {/* Empty State */}
                                        {!isLoading && filteredAssets.length === 0 && !currentFolderId && folders.length === 0 && (
                                            <div className="col-span-full h-40 flex flex-col items-center justify-center text-muted-foreground">
                                                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                                                <p>Nenhum criativo encontrado</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Footer */}
                        <div className="p-4 border-t bg-background/95 backdrop-blur flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div>
                                    <span className={cn("font-bold", completedAds === totalAds ? "text-green-600" : "text-primary")}>
                                        {completedAds}
                                    </span>
                                    <span className="mx-1">/</span>
                                    <span>{totalAds} preenchidos</span>
                                </div>
                                <div className="h-4 w-[1px] bg-border" />
                                {currentAd && assignments.has(currentAd.id) && (
                                    <div className="flex items-center gap-2 animate-in fade-in">
                                        <div className="h-8 w-8 rounded overflow-hidden border bg-muted">
                                            <img src={assignments.get(currentAd.id)?.thumbnail} alt={assignments.get(currentAd.id)?.name || 'Thumbnail do criativo'} className="h-full w-full object-cover" />
                                        </div>
                                        <span className="max-w-[150px] truncate">{assignments.get(currentAd.id)?.name}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <Button variant="outline" onClick={onCancel} className="gap-2">
                                    <X className="h-4 w-4" /> Cancelar
                                </Button>
                                {/* 🔧 FIX: Show "Próximo" when not all ads are filled, "Concluir e Criar" when complete */}
                                <Button
                                    onClick={handleComplete}
                                    className="gap-2 px-6 bg-meta-gradient text-white shadow-lg shadow-blue-500/20"
                                    disabled={completedAds === 0}
                                >
                                    {completedAds < totalAds ? (
                                        <>Próximo <ChevronRight className="h-4 w-4" /></>
                                    ) : (
                                        <>Concluir e Criar <ChevronRight className="h-4 w-4" /></>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                </Card>
            </div>
        </div>
    );
}
