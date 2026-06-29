import { Star, Calendar, Package, Loader2, RotateCcw, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, TrendingUp, Filter } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DetailedProductCard } from "@/components/products/DetailedProductCard";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgencyProducts, AgencyProduct } from "@/hooks/useAgencyProducts";
import { PRODUCTS } from "@/config/products.config";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { usePermissions } from "@/contexts/PermissionsContext";

const Products = () => {
    const { products, isLoading, error, createProduct } = useAgencyProducts();
    const { canEdit } = usePermissions();
    const { toast } = useToast();
    const [filterType, setFilterType] = useState<'all' | 'flagship' | 'fixed' | 'avulso'>('all');

    // Map for restoring defaults
    const ICON_MAP: Record<string, React.ComponentType<any>> = {
        Star, Package, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp
    };

    const getIconName = (IconComponent: any): string => {
        const found = Object.entries(ICON_MAP).find(([_, Icon]) => Icon === IconComponent);
        return found ? found[0] : 'Package';
    };

    const handleRestoreDefaults = async () => {
        try {
            toast({ title: "Iniciando restauração...", description: "Isso pode levar alguns segundos." });

            for (const p of PRODUCTS) {
                await createProduct.mutateAsync({
                    name: p.name,
                    description: p.description,
                    category: p.category,
                    pricing_type: p.pricingType,
                    price: p.price,
                    icon_name: getIconName(p.icon),
                    color: p.color,
                    is_flagship: p.isFlagship,
                    features: p.features
                });
            }
            toast({ title: "Produtos restaurados w/ sucesso!" });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Erro na restauração" });
        }
    };

    const flagship = products.find((p: AgencyProduct) => p.is_flagship);
    const fixedProducts = products.filter((p: AgencyProduct) => p.category === 'fixed' && !p.is_flagship);
    const avulsoProducts = products.filter((p: AgencyProduct) => p.category === 'avulso');

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-destructive">
                Erro ao carregar produtos: {(error as Error).message}
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-screen p-10 flex flex-col">
            {/* Page Header */}
            <div className="flex items-start justify-between mb-8 pb-4 border-b border-border/50">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">
                        Catálogo de Produtos
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        Gerencie os produtos e serviços oferecidos pela sua agência.
                        Cada produto contém executáveis que se tornam demandas ao serem atribuídos a um cliente.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Tabs value={filterType} onValueChange={(val: string) => setFilterType(val as any)} className="w-[380px]">
                        <TabsList className="grid w-full grid-cols-3 h-11">
                            <TabsTrigger value="all" className="h-full">Todos</TabsTrigger>
                            <TabsTrigger value="fixed" className="h-full">Fixo Mensal</TabsTrigger>
                            <TabsTrigger value="avulso" className="h-full">Avulso</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {canEdit('products') && <ProductFormModal />}
                </div>
            </div>

            {/* Empty State */}
            {products.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
                    <p className="text-muted-foreground mb-6">
                        Crie seu primeiro produto clicando no botão acima.
                    </p>
                    {canEdit('products') && (
                        <Button variant="outline" onClick={handleRestoreDefaults} className="gap-2">
                            <RotateCcw className="w-4 h-4" />
                            Restaurar Padrões
                        </Button>
                    )}
                </div>
            )}

            {/* ⭐ FLAGSHIP Section */}
            {flagship && (filterType === 'all' || filterType === 'flagship') && (
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Star className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">Solução Completa</h2>
                            <p className="text-sm text-muted-foreground">Produto flagship com todos os executáveis</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        <DetailedProductCard
                            product={flagship}
                            defaultExpanded={false}
                        />
                    </div>
                </section>
            )}

            {/* 📅 FIXED MONTHLY Section */}
            {fixedProducts.length > 0 && (filterType === 'all' || filterType === 'fixed') && (
                <section className="mt-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">Produtos Fixos Mensais</h2>
                            <p className="text-sm text-muted-foreground">Serviços recorrentes com acompanhamento contínuo</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {fixedProducts.map((product: AgencyProduct) => (
                            <DetailedProductCard
                                key={product.id}
                                product={product}
                                defaultExpanded={false}
                            />
                        ))}
                    </div>
                </section>
            )}

            {avulsoProducts.length > 0 && (filterType === 'all' || filterType === 'avulso') && (
                <section className="mt-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">Produtos Avulsos</h2>
                            <p className="text-sm text-muted-foreground">Soluções sob demanda para necessidades específicas</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {avulsoProducts.map((product: AgencyProduct) => (
                            <DetailedProductCard
                                key={product.id}
                                product={product}
                                defaultExpanded={false}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default Products;
