import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Facebook, Instagram, Play, ThumbsUp, MessageCircle, Share2, Bookmark, MoreHorizontal, Heart, Send, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface CatalogProduct {
    id: string;
    name: string;
    description?: string;
    price: string;
    sale_price?: string;
    currency: string;
    image_url: string;
    url: string;
    brand?: string;
}

interface AdPreviewProps {
    pageName?: string;
    pageImageUrl?: string;
    primaryText?: string;
    headline?: string;
    description?: string;
    destinationUrl?: string;
    imageUrl?: string;
    videoUrl?: string;
    videoThumbnail?: string; // NEW: Thumbnail for video when URL unavailable
    isVideo?: boolean;
    callToAction?: string;
    // Catalog props
    isCatalogAd?: boolean;
    catalogProducts?: CatalogProduct[];
    carouselCards?: any[];
    format?: 'SINGLE_IMAGE_OR_VIDEO' | 'CAROUSEL' | 'COLLECTION' | 'FLEXIBLE';
}

export function AdPreview({
    pageName = "Sua Página",
    pageImageUrl,
    primaryText = "Texto principal do anúncio aparece aqui...",
    headline = "Título do Anúncio",
    description = "Descrição do anúncio",
    destinationUrl = "seusite.com.br",
    imageUrl,
    videoUrl,
    videoThumbnail,
    isVideo = false,
    callToAction = "Saiba mais",
    isCatalogAd = false,
    catalogProducts = [],
    carouselCards = [],
    format = 'SINGLE_IMAGE_OR_VIDEO'
}: AdPreviewProps) {
    const { t } = useTranslation();
    const [carouselIndex, setCarouselIndex] = useState(0);

    // 🔍 DEBUG: Log catalog products received
    console.log('🛍️ [AdPreview] Props:', {
        isCatalogAd,
        catalogProductsCount: catalogProducts?.length || 0,
        format,
        hasImageUrl: !!imageUrl,
        hasVideoUrl: !!videoUrl
    });

    const replaceMacros = (text: string, product: CatalogProduct | null) => {
        if (!text) return text;

        // Define common fallbacks or real values
        const values: Record<string, string> = {
            '{{product.name}}': product?.name || 'Nome do Produto',
            '{{product.brand}}': product?.brand || 'Marca do Produto',
            '{{product.retailer_id}}': product?.id || 'ID Varejista',
            '{{product.description}}': product?.description || 'Descrição do produto será exibida aqui.',
            '{{product.short_description}}': product?.description?.substring(0, 50) || 'Breve descrição do produto.',
            '{{product.price}}': product?.price || 'R$ 0,00',
            '{{product.current_price}}': product?.sale_price || product?.price || 'R$ 0,00',
            '{{product.unit_price}}': product?.price || 'R$ 0,00',
        };

        let result = text;
        Object.entries(values).forEach(([macro, val]) => {
            const regex = new RegExp(macro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            result = result.replace(regex, val);
        });

        return result;
    };

    const currentProduct = catalogProducts.length > 0 ? (isCatalogAd && format === 'CAROUSEL' ? catalogProducts[carouselIndex] : catalogProducts[0]) : null;
    const displayPrimaryText = isCatalogAd ? replaceMacros(primaryText, currentProduct) : primaryText;
    const displayHeadline = isCatalogAd ? replaceMacros(headline, currentProduct) : headline;
    const displayDescription = isCatalogAd ? replaceMacros(description, currentProduct) : description;

    const getCtaLabel = (cta?: string) => {
        if (!cta) return t('campaigns.ctas.LEARN_MORE', 'Learn More');

        // Simple mapping to translation keys
        // If the CTA matches one of our keys, translate it
        // Otherwise fallback to the raw string if not found, or a default
        const key = `campaigns.ctas.${cta}` as const;
        return t(key, cta);
    };

    // Truncate text with ellipsis
    const truncate = (text: string, maxLength: number) => {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // Extract domain from URL
    const getDomain = (url?: string) => {
        if (!url) return 'seusite.com.br';
        try {
            const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
            return domain.replace('www.', '');
        } catch {
            return url.substring(0, 30);
        }
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-muted-foreground">{t('campaigns.editor.ad_preview.title', 'Ad Preview')}</span>
            </div>

            <Tabs defaultValue="facebook" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="facebook" className="gap-1.5 text-xs">
                        <Facebook className="h-3.5 w-3.5" />
                        Facebook
                    </TabsTrigger>
                    <TabsTrigger value="instagram" className="gap-1.5 text-xs">
                        <Instagram className="h-3.5 w-3.5" />
                        Instagram
                    </TabsTrigger>
                    <TabsTrigger value="stories" className="gap-1.5 text-xs">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-current" />
                        Stories
                    </TabsTrigger>
                </TabsList>

                {/* Facebook Preview */}
                <TabsContent value="facebook" className="mt-0 flex justify-center">
                    <Card className="overflow-hidden bg-white dark:bg-zinc-900 border shadow-lg w-full max-w-[380px] mx-auto transition-all duration-300 ring-1 ring-border/60">
                        {/* Header */}
                        <div className="p-3 flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                                {pageImageUrl ? (
                                    <img src={pageImageUrl} alt={pageName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white font-bold text-sm">{pageName?.charAt(0)?.toUpperCase()}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{pageName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('campaigns.editor.ad_preview.sponsored', 'Sponsored')}</p>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                                <MoreHorizontal className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Primary Text */}
                        <div className="px-3 pb-2 pt-2">
                            <p className="text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap">
                                {truncate(displayPrimaryText, 300)}
                                {displayPrimaryText?.length > 300 && (
                                    <span className="text-blue-500 cursor-pointer ml-1">{t('campaigns.editor.ad_preview.see_more', 'See more')}</span>
                                )}
                            </p>
                        </div>

                        {/* Media */}
                        <div className="relative bg-gray-100 dark:bg-zinc-800 border-y dark:border-zinc-700">
                            {isCatalogAd && format === 'CAROUSEL' && catalogProducts.length > 0 ? (
                                // Catalog Product Carousel
                                <div className="relative">
                                    <div className="flex overflow-hidden w-full">
                                        <div
                                            className="flex transition-transform duration-300 ease-in-out w-full"
                                            style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                                        >
                                            {catalogProducts.map((product) => (
                                                <div key={product.id} className="w-full flex-shrink-0">
                                                    <div className="aspect-square relative bg-white dark:bg-zinc-950 flex items-center justify-center">
                                                        <img
                                                            src={product.image_url}
                                                            alt={product.name}
                                                            className="max-w-full max-h-full object-contain"
                                                        />
                                                    </div>
                                                    <div className="p-3 bg-white dark:bg-zinc-900 border-t dark:border-zinc-700 flex flex-col gap-1">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-tight">{getDomain(product.url || destinationUrl)}</p>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug">{product.name}</p>
                                                        <div className="flex items-center gap-2 mt-auto pt-1">
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white shrink-0">
                                                                {product.sale_price || product.price}
                                                            </p>
                                                            {product.sale_price && (
                                                                <p className="text-xs text-gray-500 line-through shrink-0">{product.price}</p>
                                                            )}
                                                            <button className="ml-auto px-3 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white text-[10px] font-bold rounded border dark:border-zinc-700 shrink-0">
                                                                {getCtaLabel(callToAction)}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Carousel Navigation */}
                                    {catalogProducts.length > 1 && (
                                        <>
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCarouselIndex(Math.max(0, carouselIndex - 1)); }}
                                                className={cn(
                                                    "absolute left-2 top-[calc(50%-48px)] -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 shadow-md flex items-center justify-center z-10 hover:bg-white transition-colors",
                                                    carouselIndex === 0 && "opacity-0 pointer-events-none"
                                                )}
                                            >
                                                <ChevronLeft className="h-5 w-5 text-gray-800" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCarouselIndex(Math.min(catalogProducts.length - 1, carouselIndex + 1)); }}
                                                className={cn(
                                                    "absolute right-2 top-[calc(50%-48px)] -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 shadow-md flex items-center justify-center z-10 hover:bg-white transition-colors",
                                                    carouselIndex === catalogProducts.length - 1 && "opacity-0 pointer-events-none"
                                                )}
                                            >
                                                <ChevronRight className="h-5 w-5 text-gray-800" />
                                            </button>
                                            {/* Dots */}
                                            <div className="absolute top-[calc(100%-120px)] left-0 right-0 flex justify-center gap-1.5 z-10">
                                                {catalogProducts.map((_, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={cn(
                                                            "h-1.5 w-1.5 rounded-full transition-all duration-300",
                                                            idx === carouselIndex ? "bg-primary w-3" : "bg-gray-300"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="aspect-square relative flex items-center justify-center overflow-hidden">
                                        {/* 🎥 FIX: Priorizar videoUrl quando isVideo for true */}
                                        {isVideo && videoUrl ? (
                                            <video
                                                src={videoUrl}
                                                poster={imageUrl || videoThumbnail}
                                                className="w-full aspect-square object-cover"
                                                controls
                                                loop
                                                playsInline
                                                muted
                                            />
                                        ) : isVideo && (videoThumbnail || imageUrl) ? (
                                            // 🔧 NEW: Show video thumbnail with play overlay when video URL unavailable
                                            <div className="relative w-full aspect-square">
                                                <img
                                                    src={videoThumbnail || imageUrl}
                                                    alt="Video thumbnail"
                                                    className="w-full aspect-square object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                    <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                                        <Play className="h-8 w-8 text-gray-800 ml-1" fill="currentColor" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                                                    {t('campaigns.editor.ad_preview.video', 'Video')}
                                                </div>
                                            </div>
                                        ) : imageUrl ? (
                                            <img
                                                src={imageUrl}
                                                alt="Ad creative"
                                                className="w-full aspect-square object-cover"
                                            />
                                        ) : isCatalogAd && catalogProducts.length > 0 ? (
                                            <div className="aspect-square relative bg-white dark:bg-zinc-950 flex items-center justify-center">
                                                <img
                                                    src={catalogProducts[0].image_url}
                                                    alt={catalogProducts[0].name}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-zinc-700 mx-auto mb-2 flex items-center justify-center">
                                                    {isCatalogAd ? <ShoppingBag className="h-8 w-8 text-purple-600" /> : (isVideo ? <Play className="h-8 w-8" /> : <Facebook className="h-8 w-8" />)}
                                                </div>
                                                <p className="text-xs">{isCatalogAd ? t('campaigns.editor.ad_preview.loading_catalog', 'Loading catalog...') : (isVideo ? t('campaigns.editor.ad_preview.video_unavailable', 'Video unavailable') : t('campaigns.editor.ad_preview.no_image', 'No image'))}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Link Preview (only for non-carousel or single product) */}
                                    <div className="bg-white dark:bg-zinc-900 px-3 py-3 flex items-center justify-between border-t dark:border-zinc-700">
                                        <div className="flex-1 min-w-0 pr-3">
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-tight mb-0.5">
                                                {getDomain(currentProduct?.url || destinationUrl)}
                                            </p>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
                                                {displayHeadline}
                                            </p>
                                            {displayDescription && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                                    {displayDescription}
                                                </p>
                                            )}
                                        </div>
                                        <button className="px-4 py-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded flex-shrink-0">
                                            {getCtaLabel(callToAction)}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Reactions */}
                        <div className="px-3 py-2 border-t dark:border-zinc-700 flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="flex -space-x-1">
                                    <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                        <ThumbsUp className="h-2.5 w-2.5 text-white fill-white" />
                                    </div>
                                    <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                                        <Heart className="h-2.5 w-2.5 text-white fill-white" />
                                    </div>
                                </div>
                                <span>128</span>
                            </div>
                            <span>24 comentários · 12 compartilhamentos</span>
                        </div>

                        {/* Actions */}
                        <div className="px-3 py-2 border-t dark:border-zinc-700 flex justify-around text-gray-500 dark:text-gray-400">
                            <button className="flex items-center gap-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded">
                                <ThumbsUp className="h-4 w-4" />
                                {t('campaigns.editor.ad_preview.like', 'Like')}
                            </button>
                            <button className="flex items-center gap-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded">
                                <MessageCircle className="h-4 w-4" />
                                {t('campaigns.editor.ad_preview.comment', 'Comment')}
                            </button>
                            <button className="flex items-center gap-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded">
                                <Share2 className="h-4 w-4" />
                                {t('campaigns.editor.ad_preview.share', 'Share')}
                            </button>
                        </div>
                    </Card>
                </TabsContent>

                {/* Instagram Preview */}
                <TabsContent value="instagram" className="mt-0 flex justify-center">
                    <Card className="overflow-hidden bg-white dark:bg-black border shadow-lg w-full max-w-[380px] mx-auto transition-all duration-300 ring-1 ring-border/60">
                        {/* Header */}
                        <div className="p-3 flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-0.5">
                                <div className="h-full w-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                                    {pageImageUrl ? (
                                        <img src={pageImageUrl} alt={pageName} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <span className="text-gray-900 dark:text-white font-bold text-xs">{pageName?.charAt(0)?.toUpperCase()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{pageName?.toLowerCase().replace(/\s+/g, '')}</p>
                                <p className="text-xs text-gray-400">{t('campaigns.editor.ad_preview.sponsored', 'Sponsored')}</p>
                            </div>
                            <button className="text-gray-900 dark:text-white">
                                <MoreHorizontal className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Media */}
                        <div className="relative aspect-square bg-gray-100 dark:bg-zinc-800 border-y dark:border-zinc-800">
                            {isCatalogAd && format === 'CAROUSEL' && catalogProducts.length > 0 ? (
                                // Catalog Product Carousel - Instagram Style
                                <div className="relative h-full w-full">
                                    <div className="flex h-full overflow-hidden">
                                        <div
                                            className="flex h-full transition-transform duration-300 ease-in-out"
                                            style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                                        >
                                            {catalogProducts.map((product) => (
                                                <div key={product.id} className="w-full h-full flex-shrink-0 relative bg-white dark:bg-zinc-950 flex items-center justify-center">
                                                    <img
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Navigation Dots Overlay */}
                                    {catalogProducts.length > 1 && (
                                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                                            {catalogProducts.map((_, idx) => (
                                                <div
                                                    key={idx}
                                                    className={cn(
                                                        "h-1.5 w-1.5 rounded-full transition-all duration-300 shadow shadow-black/20",
                                                        idx === carouselIndex ? "bg-blue-500 w-3" : "bg-white/60"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : isVideo && videoUrl ? (
                                <video
                                    src={videoUrl}
                                    poster={imageUrl || videoThumbnail}
                                    className="w-full aspect-square object-cover"
                                    controls
                                    loop
                                    playsInline
                                    muted
                                />
                            ) : isVideo && (videoThumbnail || imageUrl) ? (
                                // 🔧 NEW: Show video thumbnail with play overlay when video URL unavailable
                                <div className="relative w-full aspect-square">
                                    <img
                                        src={videoThumbnail || imageUrl}
                                        alt="Video thumbnail"
                                        className="w-full aspect-square object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                            <Play className="h-7 w-7 text-gray-800 ml-0.5" fill="currentColor" />
                                        </div>
                                    </div>
                                </div>
                            ) : imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt="Ad creative"
                                    className="w-full aspect-square object-cover"
                                />
                            ) : isCatalogAd && catalogProducts.length > 0 ? (
                                <div className="aspect-square relative bg-white dark:bg-zinc-950 flex items-center justify-center w-full h-full">
                                    <img
                                        src={catalogProducts[0].image_url}
                                        alt={catalogProducts[0].name}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-zinc-800 mx-auto mb-2 flex items-center justify-center">
                                            {isCatalogAd ? <ShoppingBag className="h-8 w-8 text-purple-600" /> : (isVideo ? <Play className="h-8 w-8" /> : <Instagram className="h-8 w-8" />)}
                                        </div>
                                        <p className="text-xs">{isCatalogAd ? t('campaigns.editor.ad_preview.loading_catalog', 'Loading catalog...') : (isVideo ? t('campaigns.editor.ad_preview.video_unavailable', 'Video unavailable') : t('campaigns.editor.ad_preview.no_image', 'No image'))}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CTA Button */}
                        <div className="px-3 py-2.5 flex items-center justify-between bg-white dark:bg-zinc-900 border-t dark:border-zinc-800">
                            <span className="text-sm font-semibold text-primary">{getCtaLabel(callToAction)}</span>
                            <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>

                        {/* Actions */}
                        <div className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Heart className="h-6 w-6 text-gray-900 dark:text-white cursor-pointer hover:text-gray-500" />
                                <MessageCircle className="h-6 w-6 text-gray-900 dark:text-white cursor-pointer hover:text-gray-500" />
                                <Send className="h-6 w-6 text-gray-900 dark:text-white cursor-pointer hover:text-gray-500" />
                            </div>
                            <Bookmark className="h-6 w-6 text-gray-900 dark:text-white cursor-pointer hover:text-gray-500" />
                        </div>

                        {/* Likes */}
                        <div className="px-3 pb-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">1.234 {t('campaigns.editor.ad_preview.likes', 'likes')}</p>
                        </div>

                        {/* Caption */}
                        <div className="px-3 pb-3">
                            <p className="text-sm text-gray-900 dark:text-white">
                                <span className="font-semibold">{pageName?.toLowerCase().replace(/\s+/g, '')} </span>
                                {truncate(displayPrimaryText, 100)}
                                {displayPrimaryText?.length > 100 && (
                                    <span className="text-gray-400 cursor-pointer"> ...mais</span>
                                )}
                            </p>
                        </div>
                    </Card>
                </TabsContent>

                {/* Instagram Stories Preview */}
                <TabsContent value="stories" className="mt-0 flex justify-center">
                    <Card className="overflow-hidden bg-black border shadow-2xl w-full max-w-[381px] aspect-[9/16] relative mx-auto transition-all duration-300 ring-1 ring-white/20">
                        {/* Background Image/Video */}
                        <div className="absolute inset-0">
                            {isCatalogAd && catalogProducts.length > 0 ? (
                                <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-900 group">
                                    <div className="w-[90%] aspect-square shadow-2xl relative overflow-hidden rounded-lg">
                                        <img
                                            src={currentProduct?.image_url}
                                            alt={currentProduct?.name}
                                            className="w-full h-full object-contain bg-white"
                                        />
                                        {format === 'CAROUSEL' && catalogProducts.length > 1 && (
                                            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                                                {catalogProducts.slice(0, 5).map((_, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={cn(
                                                            "h-1 w-1 rounded-full",
                                                            idx === (carouselIndex % 5) ? "bg-white" : "bg-white/40"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-6 px-6 text-center">
                                        <h3 className="text-white font-bold text-lg line-clamp-2 leading-tight">
                                            {displayHeadline}
                                        </h3>
                                        <p className="text-white/80 text-sm mt-2 line-clamp-2">
                                            {displayPrimaryText}
                                        </p>
                                    </div>
                                </div>
                            ) : isVideo && videoUrl ? (
                                <video
                                    src={videoUrl}
                                    poster={imageUrl || videoThumbnail}
                                    className="w-full h-full object-cover"
                                    controls
                                    loop
                                    playsInline
                                    muted
                                />
                            ) : isVideo && (videoThumbnail || imageUrl) ? (
                                // 🔧 NEW: Show video thumbnail with play overlay when video URL unavailable
                                <div className="relative w-full h-full">
                                    <img
                                        src={videoThumbnail || imageUrl}
                                        alt="Video thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <div className="h-20 w-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                                            <Play className="h-10 w-10 text-gray-800 ml-1" fill="currentColor" />
                                        </div>
                                    </div>
                                </div>
                            ) : imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt="Story"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                    <div className="text-center text-zinc-500">
                                        <div className="mx-auto mb-2 w-12 h-12 border-2 border-zinc-700 rounded-lg flex items-center justify-center">
                                            {isCatalogAd ? <ShoppingBag className="h-6 w-6 text-purple-600" /> : (isVideo ? <Play className="h-6 w-6" /> : <Instagram className="h-6 w-6" />)}
                                        </div>
                                        <p className="text-xs">{isCatalogAd ? t('campaigns.editor.ad_preview.loading_catalog', 'Loading catalog...') : (isVideo ? t('campaigns.editor.ad_preview.video_unavailable', 'Video unavailable') : t('campaigns.editor.ad_preview.creative_9_16', '9:16 Creative'))}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Top Overlay */}
                        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent z-10">
                            {/* Progress Bar */}
                            <div className="flex gap-1 mb-3">
                                <div className="h-0.5 flex-1 bg-white/40 rounded-full overflow-hidden">
                                    <div className="h-full w-1/3 bg-white"></div>
                                </div>
                                <div className="h-0.5 flex-1 bg-white/40 rounded-full"></div>
                                <div className="h-0.5 flex-1 bg-white/40 rounded-full"></div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[1.5px]">
                                        <div className="h-full w-full rounded-full border-2 border-black bg-white overflow-hidden">
                                            {pageImageUrl ? (
                                                <img src={pageImageUrl} alt={pageName} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full bg-gray-200" />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white leading-none">{pageName}</p>
                                        <p className="text-[10px] text-white/80 mt-0.5">{t('campaigns.editor.ad_preview.sponsored', 'Sponsored')}</p>
                                    </div>
                                </div>
                                <MoreHorizontal className="h-5 w-5 text-white" />
                            </div>
                        </div>

                        {/* Bottom CTA Overlay */}
                        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 z-10">
                            <div className="h-10 w-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white animate-bounce">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            </div>
                            <span className="text-white text-xs font-bold uppercase tracking-widest bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-sm">
                                {getCtaLabel(callToAction)}
                            </span>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
