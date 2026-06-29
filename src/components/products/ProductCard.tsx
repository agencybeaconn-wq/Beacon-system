import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { ProductItem, getPricingLabel, getPricingColor } from "@/config/products.config";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
    product: ProductItem;
    isSelected?: boolean;
    onSelect?: () => void;
    selectable?: boolean;
}

export function ProductCard({ product, isSelected, onSelect, selectable = false }: ProductCardProps) {
    const Icon = product.icon;

    return (
        <div
            onClick={selectable ? onSelect : undefined}
            className={cn(
                "group relative p-6 bg-card border rounded-xl text-left transition-all duration-300",
                selectable && "cursor-pointer hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5",
                isSelected && "border-primary ring-2 ring-primary/20 bg-primary/5",
                product.isFlagship && "md:col-span-2 lg:col-span-3 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
            )}
        >
            {/* Color Accent */}
            <div
                className="absolute top-0 left-0 w-full h-1.5 rounded-t-xl"
                style={{ backgroundColor: product.color }}
            />

            {/* Pricing Type Badge */}
            <div className="absolute top-4 right-4">
                <Badge
                    variant="outline"
                    className={cn("text-xs font-medium border", getPricingColor(product.pricingType))}
                >
                    {getPricingLabel(product.pricingType)}
                </Badge>
            </div>

            {/* Selected Indicator */}
            {isSelected && (
                <div className="absolute top-4 left-4">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                </div>
            )}

            {/* Icon */}
            <div
                className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform",
                    product.isFlagship ? "w-16 h-16" : "",
                    isSelected && "scale-95"
                )}
                style={{ backgroundColor: `${product.color}20` }}
            >
                <div style={{ color: product.color }}>
                    <Icon className="w-7 h-7" />
                </div>
            </div>

            {/* Content */}
            <h3 className={cn(
                "font-bold mb-2 text-foreground",
                product.isFlagship ? "text-2xl" : "text-lg"
            )}>
                {product.name}
                {product.isFlagship && (
                    <Badge className="ml-2 bg-primary text-primary-foreground text-[10px]">
                        Flagship
                    </Badge>
                )}
            </h3>

            <p className="text-sm text-muted-foreground mb-4">
                {product.description}
            </p>

            {/* All Features - Always visible */}
            <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Executáveis ({product.features.length})
                </span>
                <ul className="space-y-2">
                    {product.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Detailed Description */}
            {product.detailedDescription && (
                <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {product.detailedDescription}
                    </p>
                </div>
            )}
        </div>
    );
}
