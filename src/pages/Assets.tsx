import { useState, useEffect } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Image as ImageIcon, Film, Loader2, CheckCircle2, Check, X, Sparkles, FolderPlus, Folder, ChevronRight, Move, Trash2, LogOut, Home, Play, ArrowLeft, ArrowRight, MoreHorizontal, FileEdit, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

interface MetaAsset {
    id: string; // Required ID
    hash?: string;
    name?: string;
    url: string;
    url_128?: string;
    thumbnail?: string;
    status?: string;
    type: 'IMAGE' | 'VIDEO';
    created_time?: string;
    duration?: number; // Video duration in seconds
    // New UX props
    usageStatus?: 'active' | 'inactive' | 'new';
    uploadDate?: string;
}

interface AssetFolder {
    id: string;
    name: string;
    parent_id: string | null;
}

const Assets = () => {
    const { t, i18n } = useTranslation();
    const { selectedAccountId } = useDashboard();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // URL State for Persistence
    const currentFolderId = searchParams.get("folder");

    const [selectedTab, setSelectedTab] = useState("all");
    const [usageFilter, setUsageFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [selectedAssets, setSelectedAssets] = useState<MetaAsset[]>([]);
    const [selectedFolders, setSelectedFolders] = useState<AssetFolder[]>([]);

    // Dialogs
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [newName, setNewName] = useState("");
    const [folderToRename, setFolderToRename] = useState<AssetFolder | null>(null);
    const [targetFolderId, setTargetFolderId] = useState<string>("");

    // Video Preview State
    const [videoPreviewAsset, setVideoPreviewAsset] = useState<MetaAsset | null>(null);

    // Pagination State
    const [cursors, setCursors] = useState<{ images?: string, videos?: string } | undefined>(undefined);
    const [paginationHistory, setPaginationHistory] = useState<Array<{ images?: string, videos?: string } | undefined>>([]);
    const [nextCursors, setNextCursors] = useState<{ images?: string, videos?: string } | null>(null);

    // Limits
    const [limit, setLimit] = useState<string>("15");

    // 1. Fetch Folders (Strictly for current level)
    const { data: folders = [], isLoading: isLoadingFolders } = useQuery({
        queryKey: ['asset-folders', selectedAccountId, currentFolderId],
        queryFn: async () => {
            if (!selectedAccountId) return [];

            // Cast to any to bypass missing type definitions for new tables
            let query = supabase
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

    // 2. Fetch All Folders (For Move Dialog - Flat List)
    const { data: allFolders = [] } = useQuery({
        queryKey: ['all-asset-folders', selectedAccountId],
        queryFn: async () => {
            if (!selectedAccountId) return [];
            const { data, error } = await supabase
                .from('asset_folders')
                .select('*')
                .eq('account_id', selectedAccountId);
            if (error) throw error;
            return data as AssetFolder[];
        },
        enabled: !!selectedAccountId && isMoveDialogOpen
    });

    // 3. Fetch Folder Items (Mapping)
    const { data: folderItems = [], isLoading: isLoadingItems } = useQuery({
        queryKey: ['asset-folder-items', selectedAccountId],
        queryFn: async () => {
            if (!selectedAccountId) return [];

            const { data, error } = await supabase
                .from('asset_folder_items')
                .select('*');

            if (error) throw error;
            return data as { folder_id: string, asset_id: string }[];
        },
        enabled: !!selectedAccountId
    });

    // 4. Fetch Meta Assets (Source of Truth)
    const { data: metaAssets = [], isLoading: isLoadingAssets, error: assetsError, refetch: refetchAssets, isFetching } = useQuery({
        queryKey: ['meta-assets', selectedAccountId, limit, selectedTab, cursors], // Added specific dependencies
        queryFn: async () => {
            if (!selectedAccountId) return [];
            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', selectedAccountId)
                .single();

            if (!accountData?.access_token) throw new Error("Access token not found.");

            // Map frontend tab to backend type
            let type = 'ALL';
            if (selectedTab === 'images') type = 'IMAGE';
            if (selectedTab === 'videos') type = 'VIDEO';

            const { data, error } = await supabase.functions.invoke('manage-meta-assets', {
                body: {
                    accountId: selectedAccountId,
                    action: 'LIST',
                    accessToken: accountData.access_token,
                    limit: parseInt(limit),
                    type,
                    cursors
                }
            });

            if (error || data.error) throw new Error(error?.message || data.error);

            // Debug: Log the full response structure
            console.log('📄 [ASSETS] Full data response:', JSON.stringify(data, null, 2));
            console.log('📄 [ASSETS] Paging response:', data?.paging);

            // Update Next Cursors from Response
            // Check if there's a next page AND we have valid cursors
            if (data.paging && data.paging.next) {
                const cursorsToSet = {
                    images: data.paging.cursors?.images || null,
                    videos: data.paging.cursors?.videos || null
                };
                console.log('📄 [ASSETS] Setting next cursors:', cursorsToSet);
                setNextCursors(cursorsToSet);
            } else {
                console.log('📄 [ASSETS] No next page available');
                setNextCursors(null);
            }

            // Mock Usage Data for UX Demo
            const enhancedData = (data.data as MetaAsset[]).map(asset => ({
                ...asset,
                usageStatus: 'active', // Default to active for stability until real status is implemented
                uploadDate: asset.created_time || new Date().toISOString()
            }));

            return enhancedData as MetaAsset[];
        },
        enabled: !!selectedAccountId,
        retry: 1,
        // 🔧 FIX: Keep previous data while loading new data to prevent flash/reload effect
        placeholderData: (previousData: MetaAsset[] | undefined) => previousData
    });

    // Refetch when limit or tab changes (Reset Pagination)
    useEffect(() => {
        setCursors(undefined);
        setPaginationHistory([]);
        setNextCursors(null);
    }, [limit, selectedTab, selectedAccountId]);

    // Handlers for Pagination
    const handleNextPage = () => {
        if (nextCursors) {
            setPaginationHistory(prev => [...prev, cursors]);
            setCursors(nextCursors);
        }
    };

    const handlePrevPage = () => {
        if (paginationHistory.length > 0) {
            const prevCursor = paginationHistory[paginationHistory.length - 1];
            setCursors(prevCursor);
            setPaginationHistory(prev => prev.slice(0, -1));
        }
    };

    // Auto-create default folders if none exist (first time setup)
    useEffect(() => {
        const createDefaultFolders = async () => {
            if (!selectedAccountId || currentFolderId || isLoadingFolders) return;
            if (folders.length > 0) return; // Already has folders

            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return;

            const defaultFolders = [
                { name: `✅ ${t('assets.folders.validated', 'Validated Creatives')}`, account_id: selectedAccountId, parent_id: null, user_id: user.id },
                { name: `🧪 ${t('assets.folders.testing', 'In Testing')}`, account_id: selectedAccountId, parent_id: null, user_id: user.id },
                { name: `🔄 ${t('assets.folders.in_use', 'In Use')}`, account_id: selectedAccountId, parent_id: null, user_id: user.id },
                { name: `📦 ${t('assets.folders.unused', 'Unused')}`, account_id: selectedAccountId, parent_id: null, user_id: user.id },
            ];

            const { error } = await supabase.from('asset_folders').insert(defaultFolders);
            if (!error) {
                queryClient.invalidateQueries({ queryKey: ['asset-folders'] });
            }
        };

        createDefaultFolders();
    }, [selectedAccountId, currentFolderId, folders.length, isLoadingFolders, queryClient]);

    // 5. Fetch Breadcrumbs
    const { data: breadcrumbs = [] } = useQuery({
        queryKey: ['breadcrumbs', currentFolderId],
        queryFn: async () => {
            if (!currentFolderId) return [];

            const { data } = await supabase.from('asset_folders').select('id, name, parent_id').eq('account_id', selectedAccountId!);

            const path: AssetFolder[] = [];
            let current = data?.find((f: any) => f.id === currentFolderId);
            while (current) {
                path.unshift(current);
                current = data?.find((f: any) => f.id === current.parent_id);
            }
            return path;
        },
        enabled: !!selectedAccountId && !!currentFolderId
    });

    // Mutations
    const createFolderMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase.from('asset_folders').insert({
                name,
                account_id: selectedAccountId,
                parent_id: currentFolderId,
                user_id: (await supabase.auth.getUser()).data.user?.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-folders'] });
            setIsCreateFolderOpen(false);
            setNewFolderName("");
            toast({ title: t('assets.toasts.folder_created', "Folder created successfully") });
        }
    });

    const renameFolderMutation = useMutation({
        mutationFn: async ({ id, name }: { id: string, name: string }) => {
            const { error } = await supabase.from('asset_folders').update({ name }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-folders'] });
            setIsRenameDialogOpen(false);
            setNewName("");
            setFolderToRename(null);
            toast({ title: t('assets.toasts.folder_renamed', "Folder renamed") });
        }
    });

    const deleteFolderMutation = useMutation({
        mutationFn: async (folderIds: string[]) => {
            const { error } = await supabase.from('asset_folders').delete().in('id', folderIds);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-folders'] });
            setSelectedFolders([]);
            setIsDeleteDialogOpen(false);
            toast({ title: t('assets.toasts.folders_deleted', "Folders deleted") });
        }
    });

    const moveAssetsMutation = useMutation({
        mutationFn: async ({ assets, targetFolderId }: { assets: MetaAsset[], targetFolderId: string }) => {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("User not found");

            // First, delete existing mappings for these assets
            await supabase.from('asset_folder_items').delete().in('asset_id', assets.map(a => a.id));

            // Then insert new mappings
            if (targetFolderId !== 'root') {
                const items = assets.map(a => ({
                    folder_id: targetFolderId,
                    asset_id: a.id,
                    asset_type: a.type,
                    user_id: user.id
                }));
                const { error } = await supabase.from('asset_folder_items').insert(items);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-folder-items'] });
            setSelectedAssets([]);
            setIsMoveDialogOpen(false);
            toast({ title: t('assets.toasts.assets_moved', "Assets moved successfully") });
        }
    });

    const removeFromFolderMutation = useMutation({
        mutationFn: async (assets: MetaAsset[]) => {
            if (!currentFolderId) return;
            const { error } = await supabase
                .from('asset_folder_items')
                .delete()
                .eq('folder_id', currentFolderId)
                .in('asset_id', assets.map(a => a.id));
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-folder-items'] });
            setSelectedAssets([]);
            toast({ title: t('assets.toasts.removed_from_folder', "Removed from folder") });
        }
    });

    // Upload Mutation (Meta)
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!selectedAccountId) throw new Error("No account selected");
            const { data: accountData } = await supabase.from('ad_accounts').select('access_token').eq('id', selectedAccountId).single();
            if (!accountData?.access_token) throw new Error("Access token not found");

            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
            const base64 = btoa(binary);

            const { data, error } = await supabase.functions.invoke('manage-meta-assets', {
                body: {
                    accountId: selectedAccountId,
                    action: 'UPLOAD',
                    accessToken: accountData.access_token,
                    fileData: base64,
                    fileName: file.name
                }
            });

            if (error || data.error) throw new Error(error?.message || data.error);
            return data;
        },
        onSuccess: () => {
            toast({ title: t('common.success', "Success"), description: t('assets.toasts.meta_upload_desc', "Image sent to Meta Ads!") });
            queryClient.invalidateQueries({ queryKey: ['meta-assets'] });
        },
        onError: (error: Error) => {
            toast({ title: t('common.error', "Error"), description: error.message, variant: "destructive" });
        }
    });

    // Handlers
    const handleCreateFolder = () => createFolderMutation.mutate(newFolderName);
    const handleRenameFolder = () => {
        if (folderToRename && newName.trim()) {
            renameFolderMutation.mutate({ id: folderToRename.id, name: newName });
        }
    };
    const handleDeleteItems = () => deleteFolderMutation.mutate(selectedFolders.map(f => f.id));
    const handleMoveAssets = () => moveAssetsMutation.mutate({ assets: selectedAssets, targetFolderId });
    const handleRemoveFromFolder = () => removeFromFolderMutation.mutate(selectedAssets);

    const handleDropAsset = (draggedAsset: MetaAsset, targetFolderId: string) => {
        const isDraggedSelected = selectedAssets.some(a => a.id === draggedAsset.id);
        const assetsToMove = isDraggedSelected ? selectedAssets : [draggedAsset];
        moveAssetsMutation.mutate({ assets: assetsToMove, targetFolderId });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast({ title: t('assets.errors.invalid_format', "Invalid format"), description: t('assets.errors.images_only', "Images only."), variant: "destructive" });
                return;
            }
            uploadMutation.mutate(file);
        }
    };

    // Selection Logic (Standardized)
    const toggleAssetSelection = (asset: MetaAsset) => {
        setSelectedFolders([]); // Clear folder selection
        setSelectedAssets(prev => {
            const isSelected = prev.some(a => a.id === asset.id);
            if (isSelected) {
                return prev.filter(a => a.id !== asset.id);
            } else {
                return [...prev, asset];
            }
        });
    };

    const toggleFolderSelection = (folder: AssetFolder) => {
        setSelectedAssets([]); // Clear asset selection
        setSelectedFolders(prev => {
            const isSelected = prev.some(f => f.id === folder.id);
            if (isSelected) {
                return prev.filter(f => f.id !== folder.id);
            } else {
                return [...prev, folder];
            }
        });
    };

    const clearSelection = () => {
        setSelectedAssets([]);
        setSelectedFolders([]);
    };

    const handleCreateCampaign = () => {
        if (selectedAssets.length === 0) return;
        navigate('/chat', { state: { selectedCreatives: selectedAssets } });
    };

    // Strict Filtering Logic
    const filteredAssets = metaAssets.filter(asset => {
        // 1. Check if asset is in ANY folder
        const itemRecord = folderItems.find(item => item.asset_id === asset.id);
        const assetFolderId = itemRecord?.folder_id || null;

        // 2. Strict Match: Asset's folder must match currentFolderId (which is null for root)
        if (assetFolderId !== currentFolderId) return false;

        // 3. Tab Filter - REMOVED (Handled by Backend)
        // Only keep local consistency check if needed, but backend should return correct type now.

        // 4. Usage Filter
        if (usageFilter === 'active' && asset.usageStatus !== 'active') return false;
        if (usageFilter === 'inactive' && asset.usageStatus === 'active') return false; // Show inactive and new

        return true;
    });

    const isLoading = isLoadingAssets || isLoadingFolders || isLoadingItems;

    return (
        <div className="pt-8 px-2 sm:px-4 pb-24 space-y-6 relative min-h-screen" onClick={(e) => {
            if (e.target === e.currentTarget) clearSelection();
        }}>
            {/* Header & Breadcrumbs */}
            <div className="space-y-4">
                {currentFolderId && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 hover:bg-transparent hover:text-primary"
                            onClick={() => setSearchParams({})}
                        >
                            <Home className="h-4 w-4" />
                        </Button>
                        {breadcrumbs.map((folder, index) => (
                            <div key={folder.id} className="flex items-center gap-2">
                                <ChevronRight className="h-4 w-4" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-auto p-1 hover:bg-transparent ${index === breadcrumbs.length - 1 ? 'font-bold text-foreground' : 'hover:text-primary'}`}
                                    onClick={() => setSearchParams({ folder: folder.id })}
                                >
                                    {folder.name}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="space-y-1 w-full lg:w-auto">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            {currentFolderId ? breadcrumbs[breadcrumbs.length - 1]?.name : t('assets.title', "Media Library")}
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground line-clamp-2 md:line-clamp-none">
                            {currentFolderId
                                ? t('assets.subtitle_folder', "Manage files in this folder")
                                : t('assets.subtitle_default', "Manage your images and videos directly from Meta Business Manager")}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2 w-full lg:w-auto">
                        <Button variant="outline" onClick={() => setIsCreateFolderOpen(true)} className="h-10 text-xs sm:text-sm rounded-none">
                            <FolderPlus className="mr-2 h-4 w-4" />
                            {t('assets.new_folder', "New Folder")}
                        </Button>
                        <div className="flex gap-2 relative col-span-2 lg:col-span-1">
                            <div className="relative flex-1">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                    disabled={uploadMutation.isPending || !selectedAccountId}
                                />
                                <Button disabled={uploadMutation.isPending || !selectedAccountId} className="w-full h-10 bg-primary hover:opacity-90 text-white text-xs sm:text-sm shadow-none rounded-none">
                                    {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    {t('assets.upload_image', "Upload Image")}
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={async () => {
                                    await queryClient.invalidateQueries({ queryKey: ['meta-assets', selectedAccountId] });
                                    await refetchAssets();
                                    toast({ title: t('assets.toasts.library_updated', "Library updated successfully"), duration: 2000 });
                                }}
                                disabled={isLoading}
                                className="h-10 w-10 shrink-0 rounded-none border-border/50 hover:bg-accent"
                                title={t('common.refresh', "Refresh")}
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t('assets.create_folder_title', "Create New Folder")}</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Label>{t('assets.folder_name', "Folder Name")}</Label>
                        <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: Black Friday" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>{t('common.cancel', "Cancel")}</Button>
                        <Button onClick={handleCreateFolder}>{t('common.save', "Create")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t('assets.rename_folder_title', "Rename Folder")}</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Label>{t('assets.folder_name', "New Name")}</Label>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('assets.folder_name', "New folder name")} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>{t('common.cancel', "Cancel")}</Button>
                        <Button onClick={handleRenameFolder} disabled={!newName.trim() || renameFolderMutation.isPending}>
                            {renameFolderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('common.save', "Save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t('common.move_to_folder', "Move to Folder")}</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Label>{t('common.select_destination', "Select destination")}</Label>
                        <Select onValueChange={setTargetFolderId}>
                            <SelectTrigger><SelectValue placeholder={t('common.select', "Select...")} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="root">{t('assets.tabs.all', "Root (Main Library)")}</SelectItem>
                                {allFolders.filter(f => f.id !== currentFolderId).map(f => (
                                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>{t('common.cancel', "Cancel")}</Button>
                        <Button onClick={handleMoveAssets} disabled={!targetFolderId}>{t('common.move', "Move")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('assets.delete_folders.title', "Delete folders?")}</AlertDialogTitle>
                        <AlertDialogDescription>{t('assets.delete_folders.description', "Folders will be permanently deleted.")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', "Cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteItems} className="bg-destructive">{t('common.delete', "Delete")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Video Preview Dialog */}
            <Dialog open={!!videoPreviewAsset} onOpenChange={(open) => !open && setVideoPreviewAsset(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
                    <DialogHeader className="absolute top-0 left-0 right-0 z-10 p-4 bg-black/80">
                        <DialogTitle className="text-white truncate pr-10">
                            {videoPreviewAsset?.name || t('common.preview_video', 'Preview Video')}
                        </DialogTitle>
                    </DialogHeader>
                    {videoPreviewAsset?.url && (
                        <video
                            src={videoPreviewAsset.url}
                            controls
                            autoPlay
                            className="w-full max-h-[80vh] object-contain"
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Main Content */}
            {!selectedAccountId ? (
                <Card className="border-dashed"><CardContent className="py-10 text-center text-muted-foreground">{t('assets.empty.select_account', 'Select an account.')}</CardContent></Card>
            ) : (
                <div className="w-full">
                    {/* Unified Filter Bar */}
                    <div className="flex flex-col gap-4 mb-6 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Type Filters */}
                            <div className="flex items-center justify-between sm:justify-start gap-2">
                                <span className="text-xs font-medium text-muted-foreground mr-1">{t('common.type', 'Type')}:</span>
                                <div className="flex-1 sm:flex-none flex items-center gap-1 bg-muted/50 p-1 rounded-md border border-border/50 overflow-x-auto no-scrollbar">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedTab('all')}
                                        className={`rounded-none text-xs h-7 px-3 flex-1 sm:flex-none ${selectedTab === 'all'
                                            ? "bg-primary text-white font-medium"
                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
                                    >
                                        {t('assets.tabs.all', 'All')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedTab('images')}
                                        className={`rounded-none text-xs h-7 px-3 flex-1 sm:flex-none ${selectedTab === 'images'
                                            ? "bg-primary text-white font-medium"
                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
                                    >
                                        {t('assets.tabs.images', 'Images')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedTab('videos')}
                                        className={`rounded-none text-xs h-7 px-3 flex-1 sm:flex-none ${selectedTab === 'videos'
                                            ? "bg-primary text-white font-medium"
                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
                                    >
                                        {t('assets.tabs.videos', 'Videos')}
                                    </Button>
                                </div>
                            </div>

                            <div className="h-6 w-[1px] bg-border hidden sm:block" />

                            {/* Status Filters */}
                            <div className="flex items-center justify-between sm:justify-start gap-2">
                                <span className="text-xs font-medium text-muted-foreground mr-1">{t('assets.tabs.status', 'Status')}:</span>
                                <div className="flex-1 sm:flex-none flex items-center gap-1 bg-muted/50 p-1 rounded-md border border-border/50 overflow-x-auto no-scrollbar">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setUsageFilter('all')}
                                        className={`rounded-none text-xs h-7 px-3 flex-1 sm:flex-none ${usageFilter === 'all'
                                            ? "bg-primary text-white font-medium"
                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
                                    >
                                        {t('assets.tabs.all', 'All')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setUsageFilter('active')}
                                        className={`rounded-none text-xs h-7 px-3 flex-1 sm:flex-none ${usageFilter === 'active'
                                            ? "bg-primary text-white font-medium"
                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
                                    >
                                        {t('assets.folders.in_use', 'In Use')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setUsageFilter('inactive')}
                                        className={`rounded-none text-xs h-7 px-3 flex-1 sm:flex-none ${usageFilter === 'inactive'
                                            ? "bg-primary text-white font-medium"
                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}
                                    >
                                        {t('assets.folders.unused', 'Unused')}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1" />

                            {/* Limit Selector */}
                            <div className="flex items-center justify-end sm:justify-start gap-2 border-t sm:border-t-0 pt-3 sm:pt-0">
                                <span className="text-xs font-medium text-muted-foreground">{t('common.limit', 'Limit')}:</span>
                                <Select value={limit} onValueChange={setLimit}>
                                    <SelectTrigger className="h-8 w-20 sm:w-[70px] text-xs bg-background rounded-none border-border/50">
                                        <SelectValue placeholder="15" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="15">15</SelectItem>
                                        <SelectItem value="30">30</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <AssetGrid
                            assets={filteredAssets}
                            folders={folders}
                            isLoading={isLoading || isFetching}
                            selectedAssets={selectedAssets}
                            selectedFolders={selectedFolders}
                            onAssetClick={toggleAssetSelection}
                            onFolderClick={toggleFolderSelection}
                            onOpenFolder={(id) => setSearchParams({ folder: id })}
                            onDropAsset={handleDropAsset}
                            onRenameFolder={(folder) => {
                                setFolderToRename(folder);
                                setNewName(folder.name);
                                setIsRenameDialogOpen(true);
                            }}
                            onDeleteFolder={(folder) => {
                                setSelectedFolders([folder]);
                                setIsDeleteDialogOpen(true);
                            }}
                            onVideoPreview={setVideoPreviewAsset}
                        />

                        {/* Pagination Controls */}
                        {!currentFolderId && (metaAssets.length > 0 || paginationHistory.length > 0) && (
                            <div className="flex items-center justify-between mt-8 border-t pt-4">
                                <Button
                                    variant="outline"
                                    onClick={handlePrevPage}
                                    disabled={paginationHistory.length === 0 || isLoading || isFetching}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('common.previous', 'Previous')}
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    {isLoading || isFetching ? t('common.loading', 'Loading...') : (
                                        paginationHistory.length === 0 ? t('assets.pagination.first', 'First Page') : t('assets.pagination.page', { page: paginationHistory.length + 1, defaultValue: `Page ${paginationHistory.length + 1}` })
                                    )}
                                </span>
                                <Button
                                    variant="outline"
                                    onClick={handleNextPage}
                                    disabled={!nextCursors || isLoading || isFetching}
                                >
                                    {t('common.next', 'Next')} <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {/* Floating Dock */}
            {
                (selectedAssets.length > 0 || selectedFolders.length > 0) && (
                    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-md md:max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <Card className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-primary/20 shadow-none rounded-lg px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="bg-primary/10 text-primary rounded-md p-2 flex-shrink-0"><CheckCircle2 className="h-5 w-5" /></div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-sm truncate">{selectedAssets.length + selectedFolders.length} {selectedAssets.length + selectedFolders.length === 1 ? t('common.item', 'item') : t('common.items', 'itens')}</span>
                                    <span className="text-xs text-muted-foreground">{t('common.selected', 'Selecionado')}</span>
                                </div>
                            </div>
                            <div className="h-8 w-[1px] bg-border flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {selectedAssets.length > 0 && (
                                    <Button size="sm" className="rounded-md h-10 px-4 bg-primary flex items-center justify-center" onClick={handleCreateCampaign}>
                                        <Sparkles className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t('campaigns.actions.create', 'Criar Campanha')}</span>
                                    </Button>
                                )}
                                {selectedAssets.length > 0 && (
                                    <Button variant="ghost" size="sm" className="rounded-md hover:bg-primary/10" onClick={() => setIsMoveDialogOpen(true)}>
                                        <Move className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t('common.move', 'Move')}</span>
                                    </Button>
                                )}
                                {selectedAssets.length > 0 && currentFolderId && (
                                    <Button variant="ghost" size="sm" className="rounded-md hover:bg-primary/10" onClick={handleRemoveFromFolder}>
                                        <LogOut className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t('common.remove', 'Remove')}</span>
                                    </Button>
                                )}
                                {/* Rename Button - Only for exactly 1 folder */}
                                {selectedFolders.length === 1 && (
                                    <Button variant="ghost" size="sm" className="rounded-md hover:bg-primary/10" onClick={() => {
                                        setFolderToRename(selectedFolders[0]);
                                        setNewName(selectedFolders[0].name);
                                        setIsRenameDialogOpen(true);
                                    }}>
                                        <FileEdit className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t('common.rename', 'Rename')}</span>
                                    </Button>
                                )}
                                {selectedFolders.length > 0 && (
                                    <Button variant="ghost" size="sm" className="rounded-md hover:bg-destructive/10 hover:text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                                        <Trash2 className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t('common.delete', 'Delete')}</span>
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" className="rounded-md hover:bg-destructive/10 hover:text-destructive ml-2" onClick={clearSelection}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    </div>
                )
            }
        </div >
    );
};

const AssetGrid = ({
    assets,
    folders,
    isLoading,
    selectedAssets,
    selectedFolders,
    onAssetClick,
    onFolderClick,
    onOpenFolder,
    onDropAsset,
    onRenameFolder,
    onDeleteFolder,
    onVideoPreview
}: {
    assets: MetaAsset[],
    folders: AssetFolder[],
    isLoading: boolean,
    selectedAssets: MetaAsset[],
    selectedFolders: AssetFolder[],
    onAssetClick: (asset: MetaAsset) => void,
    onFolderClick: (folder: AssetFolder) => void,
    onOpenFolder: (folderId: string) => void,
    onDropAsset: (asset: MetaAsset, folderId: string) => void,
    onRenameFolder?: (folder: AssetFolder) => void,
    onDeleteFolder?: (folder: AssetFolder) => void,
    onVideoPreview?: (asset: MetaAsset) => void
}) => {
    const { t, i18n } = useTranslation();
    const [draggedAsset, setDraggedAsset] = useState<MetaAsset | null>(null);
    const isMobile = useIsMobile();

    if (isLoading) {
        return <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{[...Array(12)].map((_, i) => <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />)}</div>;
    }

    if (assets.length === 0 && folders.length === 0) {
        return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><ImageIcon className="h-12 w-12 mb-4 opacity-20" /><p>{t('common.no_data', 'Empty folder.')}</p></div>;
    }

    return (
        <div className="space-y-8">
            {folders.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><Folder className="h-5 w-5 text-primary" /> {t('common.folders', 'Folders')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {folders.map(folder => {
                            const isSelected = selectedFolders.some(f => f.id === folder.id);
                            return (
                                <div key={folder.id} className="relative group">
                                    <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-background/80 hover:bg-background">
                                                    <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRenameFolder?.(folder); }}>
                                                    <FileEdit className="mr-2 h-4 w-4" /> {t('common.rename', 'Rename')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteFolder?.(folder); }} className="text-destructive focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete', 'Delete')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <Card
                                        className={`cursor-pointer transition-all duration-200 group relative border-2 ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isMobile) {
                                                onOpenFolder(folder.id);
                                            } else {
                                                onFolderClick(folder);
                                            }
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (!isMobile) onOpenFolder(folder.id);
                                        }}
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary'); }}
                                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ring-2', 'ring-primary'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('ring-2', 'ring-primary');
                                            if (draggedAsset) {
                                                onDropAsset(draggedAsset, folder.id);
                                                setDraggedAsset(null);
                                            }
                                        }}
                                    >
                                        <CardContent className="flex flex-col items-center justify-center p-3 sm:py-8 min-h-[100px] sm:min-h-0">
                                            {/* Folder Icon with dynamic color based on type (optional) */}
                                            <Folder className={`h-8 w-8 sm:h-12 sm:w-12 mb-2 transition-transform group-hover:scale-110 ${folder.name.includes('Validados') ? 'text-emerald-500 fill-emerald-500/20' :
                                                folder.name.includes('Em Teste') ? 'text-amber-500 fill-amber-500/20' :
                                                    folder.name.includes('Não Usados') ? 'text-slate-500 fill-slate-500/20' :
                                                        'text-primary fill-primary/20'
                                                }`} />
                                            <span className="font-semibold text-center truncate w-full px-1 text-[11px] sm:text-sm">{folder.name}</span>
                                            <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 font-medium">
                                                {t('common.folder', 'Folder')}
                                            </span>
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {assets.length > 0 && (
                <div className="space-y-4">
                    {folders.length > 0 && <h3 className="text-lg font-semibold text-muted-foreground">{t('assets.tabs.all', 'Files')}</h3>}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {assets.map((asset) => {
                            const isSelected = selectedAssets.some(a => a.id === asset.id);
                            return (
                                <Card
                                    key={asset.id}
                                    className={`overflow-hidden group cursor-pointer transition-all duration-200 relative ${isSelected ? 'border-4 border-primary' : 'border-2 border-transparent hover:border-primary/50'}`}
                                    onClick={(e) => { e.stopPropagation(); onAssetClick(asset); }}
                                    draggable
                                    onDragStart={() => setDraggedAsset(asset)}
                                    onDragEnd={() => setDraggedAsset(null)}
                                >
                                    <div className="aspect-square relative bg-muted">
                                        {asset.type === 'IMAGE' ? (
                                            <img src={asset.url_128 || asset.url} alt={asset.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-black/10 relative group-hover:bg-black/20 transition-all">
                                                {asset.thumbnail ? (
                                                    <img src={asset.thumbnail} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                                        <Film className="h-12 w-12 text-slate-700" />
                                                    </div>
                                                )}
                                                {/* Always visible Play Button Overlay for Videos */}
                                                <div
                                                    className="absolute inset-0 flex items-center justify-center z-30 cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onVideoPreview && asset.url) {
                                                            onVideoPreview(asset);
                                                        }
                                                    }}
                                                >
                                                    <div className="bg-black/60 rounded-md p-3 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-300">
                                                        <Play className="h-6 w-6 text-white fill-white ml-1" />
                                                    </div>
                                                </div>
                                                {/* Duration Badge */}
                                                {asset.duration && (
                                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-md font-mono z-10">
                                                        {Math.floor(asset.duration / 60)}:{String(asset.duration % 60).padStart(2, '0')}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Selection Overlay & Check */}
                                        <div className={`absolute inset-0 transition-all duration-200 flex items-center justify-center z-20 ${isSelected ? 'bg-primary/20 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}>
                                            {isSelected && (
                                                <div className="absolute top-3 right-3 bg-primary rounded-full h-8 w-8 flex items-center justify-center animate-in zoom-in duration-200 z-30">
                                                    <Check className="h-4 w-4 text-white" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Usage Badges */}
                                        {!isSelected && (
                                            <div className="absolute top-2 right-2 flex flex-col gap-1">
                                                {asset.usageStatus === 'active' && (
                                                    <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1">
                                                        <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                                                        {t('assets.folders.in_use', 'In use')}
                                                    </div>
                                                )}
                                                {asset.usageStatus === 'new' && (
                                                    <div className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        {t('common.new', 'New')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <CardContent className="p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium truncate" title={asset.name}>{asset.name || t('common.no_name', 'No name')}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[10px] text-muted-foreground uppercase">{asset.type}</p>
                                                    {asset.uploadDate && (
                                                        <>
                                                            <span className="text-[10px] text-muted-foreground">•</span>
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {new Intl.DateTimeFormat(i18n.language.startsWith('pt') ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short' }).format(new Date(asset.created_time || asset.uploadDate || Date.now()))}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assets;
