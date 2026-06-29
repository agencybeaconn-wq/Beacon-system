import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Loader2, RefreshCw, Plus, Trash2, ExternalLink, FolderOpen, FileText,
    Palette, Store, ChevronDown, ChevronRight, Eye, EyeOff, Search, FileSpreadsheet, ShoppingCart,
    Sparkles, ShieldCheck, Activity, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboard } from '@/contexts/DashboardContext';
import { toast } from 'sonner';
import * as shopifyAdmin from '@/services/shopifyAdminService';
import { lazy, Suspense } from 'react';

const BulkProductEditor = lazy(() => import('@/components/BulkProductEditor'));
import { OrdersTab } from '@/components/lever-os/OrdersTab';
import { SkillReference } from '@/components/lever-os/shopify-manager/SkillReference';
import { ProtocolView } from '@/components/lever-os/shopify-manager/ProtocolView';
import { QualityDashboard } from '@/components/lever-os/shopify-manager/QualityDashboard';
import { RecentExecutions } from '@/components/lever-os/shopify-manager/RecentExecutions';

export function ShopifyManager() {
    const { selectedClientId, clientData, selectedClientName } = useDashboard();
    const isConnected = (clientData as any)?.shopify_status === 'connected';
    const shopName = (clientData as any)?.shopify_shop_name || null;
    const [activeTab, setActiveTab] = useState('skills');

    const showDemo = !selectedClientId || !isConnected;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Gerenciador Shopify</h1>
                    <div className="flex items-center gap-2 mt-1">
                        {showDemo ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {!selectedClientId ? 'Modo Demonstracao' : `${selectedClientName} - Nao conectado`}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {shopName}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-10 flex-wrap">
                    <TabsTrigger value="skills" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Skills</TabsTrigger>
                    <TabsTrigger value="protocol" className="gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Protocolo</TabsTrigger>
                    <TabsTrigger value="quality" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Quality</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
                    <TabsTrigger value="themes" className="gap-1.5"><Palette className="w-3.5 h-3.5" /> Temas</TabsTrigger>
                    <TabsTrigger value="products" className="gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> Produtos</TabsTrigger>
                    <TabsTrigger value="collections" className="gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Coleções</TabsTrigger>
                    <TabsTrigger value="pages" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Páginas</TabsTrigger>
                    <TabsTrigger value="menus" className="gap-1.5"><Store className="w-3.5 h-3.5" /> Menus</TabsTrigger>
                    <TabsTrigger value="orders" className="gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> Pedidos</TabsTrigger>
                </TabsList>

                {/* Novas tabs — independem de cliente selecionado */}
                <TabsContent value="skills" className="mt-4"><SkillReference /></TabsContent>
                <TabsContent value="protocol" className="mt-4"><ProtocolView /></TabsContent>
                <TabsContent value="quality" className="mt-4"><QualityDashboard /></TabsContent>
                <TabsContent value="history" className="mt-4"><RecentExecutions /></TabsContent>

                {showDemo ? (
                    <>
                        <TabsContent value="themes"><DemoTab section="temas" /></TabsContent>
                        <TabsContent value="products"><DemoTab section="produtos" /></TabsContent>
                        <TabsContent value="collections"><DemoTab section="colecoes" /></TabsContent>
                        <TabsContent value="pages"><DemoTab section="paginas" /></TabsContent>
                        <TabsContent value="menus"><DemoTab section="menus" /></TabsContent>
                        <TabsContent value="orders"><DemoTab section="pedidos" /></TabsContent>
                    </>
                ) : (
                    <>
                        <TabsContent value="products" className="mt-0">
                            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                                <BulkProductEditor />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="collections"><CollectionsTab clientId={selectedClientId!} /></TabsContent>
                        <TabsContent value="pages"><PagesTab clientId={selectedClientId!} /></TabsContent>
                        <TabsContent value="menus"><MenusTab clientId={selectedClientId!} /></TabsContent>
                        <TabsContent value="themes"><ThemesTab clientId={selectedClientId!} /></TabsContent>
                        <TabsContent value="orders"><OrdersTab clientId={selectedClientId!} /></TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}

// ─── Demo Tab ─────────────────────────────────────────────────────────────

const DEMO_DATA: Record<string, { columns: string[]; rows: string[][] }> = {
    temas: {
        columns: ['Nome', 'Status', 'Ultima Atualizacao'],
        rows: [
            ['Beacon Theme v3.2', 'Publicado', '27/03/2026'],
            ['Dawn (backup)', 'Nao publicado', '15/02/2026'],
        ],
    },
    produtos: {
        columns: ['Produto', 'Preco', 'Variantes', 'Status'],
        rows: [
            ['Camisa Flamengo I 2025/26 Torcedor', 'R$ 149,90', '7 variantes', 'Ativo'],
            ['Camisa Corinthians II 2025/26 Jogador', 'R$ 199,90', '6 variantes', 'Ativo'],
            ['Camisa Palmeiras III 2025/26 Feminina', 'R$ 139,90', '5 variantes', 'Ativo'],
            ['Camisa Sao Paulo Retro 1992', 'R$ 179,90', '4 variantes', 'Ativo'],
            ['Camisa Vasco I 2025/26 Torcedor', 'R$ 149,90', '7 variantes', 'Rascunho'],
        ],
    },
    colecoes: {
        columns: ['Colecao', 'Tipo', 'Produtos'],
        rows: [
            ['Lancamentos 2025/26', 'Smart', '42'],
            ['Camisas Torcedor', 'Smart', '38'],
            ['Camisas Jogador', 'Smart', '24'],
            ['Femininas', 'Smart', '18'],
            ['Retro', 'Smart', '12'],
        ],
    },
    paginas: {
        columns: ['Titulo', 'Handle', 'Atualizada'],
        rows: [
            ['Politica de Troca e Devolucao', 'politica-de-troca', '20/03/2026'],
            ['Politica de Privacidade', 'politica-de-privacidade', '20/03/2026'],
            ['Termos de Servico', 'termos-de-servico', '20/03/2026'],
            ['Sobre Nos', 'sobre-nos', '15/03/2026'],
        ],
    },
    menus: {
        columns: ['Menu', 'Itens', 'Handle'],
        rows: [
            ['Menu Principal', '12 itens', 'main-menu'],
            ['Menu Rodape', '8 itens', 'footer'],
        ],
    },
    pedidos: {
        columns: ['Pedido', 'Cliente', 'Total', 'Pagamento', 'Status'],
        rows: [
            ['#1042', 'Lucas Silva', 'R$ 459,70', 'Pix', 'Pago'],
            ['#1041', 'Ana Costa', 'R$ 209,90', 'Cartao', 'Pago'],
            ['#1040', 'Pedro Santos', 'R$ 629,70', 'Cartao', 'Pago'],
            ['#1039', 'Maria Oliveira', 'R$ 149,90', 'Pix', 'Pendente'],
        ],
    },
};

function DemoTab({ section }: { section: string }) {
    const data = DEMO_DATA[section];
    if (!data) return null;

    return (
        <Card className="mt-4">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium capitalize">{section}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">Demo</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                {data.columns.map(col => (
                                    <th key={col} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((row, i) => (
                                <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                                    {row.map((cell, j) => (
                                        <td key={j} className="px-4 py-3 text-sm">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Selecione um cliente com Shopify conectada para ver dados reais.</p>
            </CardContent>
        </Card>
    );
}

// ─── Collections Tab ─────────────────────────────────────────────────────

function CollectionsTab({ clientId }: { clientId: string }) {
    const [collections, setCollections] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setCollections(await shopifyAdmin.listCollections(clientId)); }
        catch (err: any) { toast.error(err.message); }
        finally { setLoading(false); }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            if (editing.id) {
                await shopifyAdmin.updateCollection(clientId, editing.id, { title: editing.title, body_html: editing.body_html });
                toast.success('Coleção atualizada!');
            } else {
                await shopifyAdmin.createCollection(clientId, { title: editing.title, body_html: editing.body_html });
                toast.success('Coleção criada!');
            }
            setEditing(null); load();
        } catch (err: any) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir esta coleção?')) return;
        try { await shopifyAdmin.deleteCollection(clientId, id); toast.success('Excluída'); load(); }
        catch (err: any) { toast.error(err.message); }
    };

    const filtered = collections.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar coleções..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" size="icon" onClick={load} disabled={loading}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></Button>
                <Button size="sm" className="gap-1.5" onClick={() => setEditing({ title: '', body_html: '' })}><Plus className="w-3.5 h-3.5" /> Nova Coleção</Button>
                <span className="text-sm text-muted-foreground font-medium">{collections.length} coleções</span>
            </div>

            {editing && (
                <Card className="p-4 bg-muted/5 border-primary/20 space-y-3">
                    <Input placeholder="Nome da coleção" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
                    <Textarea placeholder="Descrição (HTML)..." value={editing.body_html || ''} onChange={e => setEditing({ ...editing, body_html: e.target.value })} className="min-h-[100px] font-mono text-xs" />
                    <div className="flex gap-2">
                        <Button onClick={handleSave} disabled={saving || !editing.title} className="gap-1.5">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            {editing.id ? 'Salvar' : 'Criar'}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                </Card>
            )}

            {loading && !collections.length ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(col => (
                        <Card key={col.id} className="bg-muted/5 border-border/20 overflow-hidden group">
                            {col.image?.src && (
                                <div className="h-32 overflow-hidden">
                                    <img src={col.image.src} alt={col.title} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm">{col.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{col.body_html?.replace(/<[^>]*>/g, '') || 'Sem descrição'}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] shrink-0">{col._type === 'smart' ? 'Automática' : 'Manual'}</Badge>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {col.products_count !== undefined && <span>{col.products_count} produtos</span>}
                                        {col.published_at ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3" />}
                                    </div>
                                    {col._type === 'custom' && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(col)}><FileText className="w-3 h-3" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(col.id)}><Trash2 className="w-3 h-3" /></Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Pages Tab ───────────────────────────────────────────────────────────

function PagesTab({ clientId }: { clientId: string }) {
    const [pages, setPages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [editingPage, setEditingPage] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await shopifyAdmin.listPages(clientId);
            setPages(data);
        } catch (err: any) { toast.error(err.message); }
        finally { setLoading(false); }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    const handleSavePage = async () => {
        if (!editingPage) return;
        setSaving(true);
        try {
            if (editingPage.id) {
                await shopifyAdmin.updatePage(clientId, editingPage.id, { title: editingPage.title, body_html: editingPage.body_html });
                toast.success('Página atualizada!');
            } else {
                await shopifyAdmin.createPage(clientId, { title: editingPage.title, body_html: editingPage.body_html });
                toast.success('Página criada!');
            }
            setEditingPage(null);
            load();
        } catch (err: any) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const handleDeletePage = async (id: string) => {
        if (!confirm('Excluir esta página?')) return;
        try {
            await shopifyAdmin.deletePage(clientId, id);
            toast.success('Página excluída');
            load();
        } catch (err: any) { toast.error(err.message); }
    };

    const filtered = pages.filter(p => p.title?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar páginas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" size="icon" onClick={load} disabled={loading}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></Button>
                <Button size="sm" className="gap-1.5" onClick={() => setEditingPage({ title: '', body_html: '' })}><Plus className="w-3.5 h-3.5" /> Nova Página</Button>
                <span className="text-sm text-muted-foreground font-medium">{pages.length} páginas</span>
            </div>

            {/* Edit modal inline */}
            {editingPage && (
                <Card className="p-4 bg-muted/5 border-primary/20 space-y-3">
                    <Input placeholder="Título da página" value={editingPage.title} onChange={e => setEditingPage({ ...editingPage, title: e.target.value })} />
                    <Textarea placeholder="Conteúdo HTML da página..." value={editingPage.body_html} onChange={e => setEditingPage({ ...editingPage, body_html: e.target.value })} className="min-h-[150px] font-mono text-xs" />
                    <div className="flex gap-2">
                        <Button onClick={handleSavePage} disabled={saving || !editingPage.title} className="gap-1.5">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            {editingPage.id ? 'Salvar' : 'Criar'}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingPage(null)}>Cancelar</Button>
                    </div>
                </Card>
            )}

            {loading && !pages.length ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(page => (
                        <Card key={page.id} className="p-4 bg-muted/5 border-border/20 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm">{page.title}</h3>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{page.body_html?.replace(/<[^>]*>/g, '').slice(0, 100) || 'Sem conteúdo'}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                {page.published_at ? <Badge variant="outline" className="text-[9px] text-emerald-600">Publicada</Badge> : <Badge variant="outline" className="text-[9px]">Rascunho</Badge>}
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPage({ ...page })}><FileText className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePage(page.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Menus Tab (via GraphQL) ──────────────────────────────────────────────

function MenusTab({ clientId }: { clientId: string }) {
    const [menus, setMenus] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
    const [addingTo, setAddingTo] = useState<string | null>(null);
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemUrl, setNewItemUrl] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await shopifyAdmin.listMenus(clientId);
            setMenus(data);
        } catch (err: any) { toast.error(err.message); }
        finally { setLoading(false); }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    const handleAddItem = async (menuId: string) => {
        if (!newItemTitle.trim()) return;
        try {
            await shopifyAdmin.createMenuItem(clientId, menuId, { title: newItemTitle, url: newItemUrl || undefined });
            toast.success('Item adicionado!');
            setAddingTo(null); setNewItemTitle(''); setNewItemUrl('');
            load();
        } catch (err: any) { toast.error(err.message); }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('Excluir este item?')) return;
        try {
            await shopifyAdmin.deleteMenuItem(clientId, itemId);
            toast.success('Item excluído');
            load();
        } catch (err: any) { toast.error(err.message); }
    };

    const toggleMenu = (id: string) => {
        setExpandedMenus(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    return (
        <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={load} disabled={loading}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></Button>
                <span className="text-sm text-muted-foreground font-medium">{menus.length} menus</span>
            </div>

            {loading && !menus.length ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="space-y-3">
                    {menus.map(menu => (
                        <Card key={menu.id} className="bg-muted/5 border-border/20 overflow-hidden">
                            <button
                                onClick={() => toggleMenu(menu.id)}
                                className="w-full p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {expandedMenus.has(menu.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    <h3 className="font-bold text-sm">{menu.title}</h3>
                                    <Badge variant="outline" className="text-[9px]">{menu.handle}</Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">{menu.itemsCount} itens</span>
                            </button>
                            {expandedMenus.has(menu.id) && (
                                <div className="px-4 pb-4 space-y-1">
                                    {menu.items?.map((item: any) => (
                                        <div key={item.id}>
                                            <div className="flex items-center gap-2 py-1.5 px-3 rounded hover:bg-muted/10 text-sm group/item">
                                                <ChevronRight className="w-3 h-3 text-primary/50" />
                                                <span className="font-medium flex-1">{item.title}</span>
                                                {item.url && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item.url}</span>}
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-destructive" onClick={() => handleDeleteItem(item.id)}><Trash2 className="w-3 h-3" /></Button>
                                            </div>
                                            {item.children?.length > 0 && (
                                                <div className="pl-8 space-y-0.5">
                                                    {item.children.map((child: any) => (
                                                        <div key={child.id} className="flex items-center gap-2 py-1 px-3 rounded hover:bg-muted/10 text-xs text-muted-foreground group/child">
                                                            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                                            <span className="font-medium text-foreground/80 flex-1">{child.title}</span>
                                                            {child.url && <span className="truncate max-w-[200px]">{child.url}</span>}
                                                            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/child:opacity-100 text-destructive" onClick={() => handleDeleteItem(child.id)}><Trash2 className="w-2.5 h-2.5" /></Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {/* Add item */}
                                    {addingTo === menu.id ? (
                                        <div className="flex items-center gap-2 pt-2 border-t border-border/20 mt-2">
                                            <Input placeholder="Título" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} className="h-8 text-xs flex-1" />
                                            <Input placeholder="URL (opcional)" value={newItemUrl} onChange={e => setNewItemUrl(e.target.value)} className="h-8 text-xs flex-1" />
                                            <Button size="sm" className="h-8 text-xs" onClick={() => handleAddItem(menu.id)} disabled={!newItemTitle.trim()}>Adicionar</Button>
                                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingTo(null)}>Cancelar</Button>
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground mt-1" onClick={() => setAddingTo(menu.id)}>
                                            <Plus className="w-3 h-3 mr-1" /> Adicionar item
                                        </Button>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Themes Tab ──────────────────────────────────────────────────────────

function ThemesTab({ clientId }: { clientId: string }) {
    const [themes, setThemes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState<any>(null);
    const [assets, setAssets] = useState<any[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const loadThemes = useCallback(async () => {
        setLoading(true);
        try {
            const data = await shopifyAdmin.listThemes(clientId);
            setThemes(data);
        } catch (err: any) { toast.error(err.message); }
        finally { setLoading(false); }
    }, [clientId]);

    useEffect(() => { loadThemes(); }, [loadThemes]);

    const loadAssets = async (theme: any) => {
        setSelectedTheme(theme);
        setAssetsLoading(true);
        try {
            const data = await shopifyAdmin.listThemeAssets(clientId, theme.id);
            setAssets(data);
        } catch (err: any) { toast.error(err.message); }
        finally { setAssetsLoading(false); }
    };

    // Group assets by folder
    const groupedAssets = assets.reduce((acc: Record<string, any[]>, asset) => {
        const parts = asset.key.split('/');
        const folder = parts.length > 1 ? parts[0] : 'root';
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push(asset);
        return acc;
    }, {});

    const filteredFolders = Object.entries(groupedAssets).filter(([folder, files]) =>
        !search || folder.toLowerCase().includes(search.toLowerCase()) || files.some((f: any) => f.key.toLowerCase().includes(search.toLowerCase()))
    );

    const toggleFolder = (folder: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            next.has(folder) ? next.delete(folder) : next.add(folder);
            return next;
        });
    };

    return (
        <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={loadThemes} disabled={loading}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></Button>
                <span className="text-sm text-muted-foreground font-medium">{themes.length} temas</span>
            </div>

            {loading && !themes.length ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {themes.map(theme => (
                        <Card key={theme.id} className={cn("p-4 bg-muted/5 border-border/20 cursor-pointer hover:border-primary/30 transition-colors", selectedTheme?.id === theme.id && "border-primary/50")}>
                            <div className="flex items-center justify-between" onClick={() => loadAssets(theme)}>
                                <div>
                                    <h3 className="font-bold text-sm">{theme.name}</h3>
                                    <p className="text-xs text-muted-foreground">{theme.role === 'main' ? 'Tema ativo' : theme.role}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {theme.role === 'main' && <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[9px]">Ativo</Badge>}
                                    <Palette className="w-4 h-4 text-muted-foreground" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Assets explorer */}
            {selectedTheme && (
                <Card className="p-4 bg-muted/5 border-border/20">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm">Arquivos — {selectedTheme.name}</h3>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input placeholder="Buscar arquivo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs w-[200px]" />
                            </div>
                            <span className="text-xs text-muted-foreground">{assets.length} arquivos</span>
                        </div>
                    </div>

                    {assetsLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <div className="space-y-1 max-h-[500px] overflow-y-auto">
                            {filteredFolders.sort(([a], [b]) => a.localeCompare(b)).map(([folder, files]) => (
                                <div key={folder}>
                                    <button onClick={() => toggleFolder(folder)} className="flex items-center gap-2 w-full py-1.5 px-2 rounded hover:bg-muted/20 text-sm font-semibold">
                                        {expandedFolders.has(folder) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        <FolderOpen className="w-3.5 h-3.5 text-primary/60" />
                                        {folder}
                                        <span className="text-xs text-muted-foreground ml-auto">{files.length}</span>
                                    </button>
                                    {expandedFolders.has(folder) && (
                                        <div className="pl-8 space-y-0.5">
                                            {files.sort((a: any, b: any) => a.key.localeCompare(b.key)).map((file: any) => (
                                                <div key={file.key} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/10 text-xs text-muted-foreground">
                                                    <FileText className="w-3 h-3 shrink-0" />
                                                    <span className="truncate flex-1">{file.key.split('/').pop()}</span>
                                                    {file.size && <span className="text-[10px] shrink-0">{(file.size / 1024).toFixed(1)}kb</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
