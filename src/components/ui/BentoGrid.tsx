import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BentoGridProps {
    children: ReactNode;
    className?: string;
}

interface BentoCardProps {
    children: ReactNode;
    className?: string;
    title?: string;
    subtitle?: string;
    icon?: ReactNode;
    headerAction?: ReactNode;
}

export const BentoGrid = ({ children, className }: BentoGridProps) => {
    return (
        <div
            className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]",
                className
            )}
        >
            {children}
        </div>
    );
};

export const BentoCard = ({
    children,
    className,
    title,
    subtitle,
    icon,
    headerAction,
}: BentoCardProps) => {
    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-xl bg-white/5 dark:bg-black/40 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col",
                className
            )}
        >
            {(title || subtitle || icon || headerAction) && (
                <div className="p-5 pb-2 flex items-start justify-between z-10">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                {icon}
                            </div>
                        )}
                        <div>
                            {title && (
                                <h3 className="font-semibold text-foreground tracking-tight text-lg">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="text-xs text-muted-foreground font-medium">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}
            <div className="flex-1 min-h-0 p-5 pt-2 relative z-10">{children}</div>

            {/* Background Gradient Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </div>
    );
};
