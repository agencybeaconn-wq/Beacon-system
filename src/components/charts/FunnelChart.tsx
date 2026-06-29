import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface FunnelData {
    name: string;
    value: number;
    fill: string;
}

interface FunnelChartProps {
    data: FunnelData[];
}

export function FunnelChart({ data }: FunnelChartProps) {
    const { t } = useTranslation();

    // Normalize data for visualization
    // The first item is 100% width, the last item depends on its value relative to first,
    // but for a "perfect funnel shape" we might want to force a visual taper regardless of exact values,
    // or strictly follow the data. 
    // "Cool" usually means visual taper + data labels.
    // Let's do a visual taper (100% -> 20%) and map data to it, OR
    // Map width directly to value relative to max.
    // Better for a "Funnel": Width = Value / MaxValue. 
    // But if the drop is huge (1000 -> 5), the tip is invisible.
    // Best approach for "Visual Funnel": Logarithmic-ish or Min-width flooring.
    // Let's strictly follow the "Inverted Pyramid" shape for the *container* 
    // and map the *height* or just stack them.
    // Actually, the reference image shows stacked trapezoids where width is purely stylistic (tapering down)
    // and the data is just the label. This is often preferred for "Sales Funnels" visual.
    // HOWEVER, a true chart should represent data.
    // Let's try a hybrid: 
    // Fixed Tapering Shape (looks like a funnel)
    // Height of each section = constant
    // Width = Tapers linearly from Top to Bottom

    const width = 85; // Increased horizontal fill (was 70)
    const height = 100;
    const gap = 2.5; // Slightly reduced gap for tighter look
    const totalSteps = data.length;
    const sectionHeight = (height - (gap * (totalSteps - 1))) / totalSteps;

    // Generate trapezoid paths
    const shapes = useMemo(() => {
        return data.map((item, index) => {
            const topY = index * (sectionHeight + gap);
            const bottomY = topY + sectionHeight;

            // Linear taper: Start wide, end narrower but still substantial
            const topWidthPercent = width - (index * ((width * 0.55) / totalSteps));
            const bottomWidthPercent = width - ((index + 1) * ((width * 0.55) / totalSteps));

            const topLeftX = (100 - topWidthPercent) / 2;
            const topRightX = 100 - topLeftX;

            const bottomLeftX = (100 - bottomWidthPercent) / 2;
            const bottomRightX = 100 - bottomLeftX;

            return {
                ...item,
                path: `M ${topLeftX} ${topY} L ${topRightX} ${topY} L ${bottomRightX} ${bottomY} L ${bottomLeftX} ${bottomY} Z`,
                center: { x: 50, y: topY + (sectionHeight / 2) },
                // Edge points for connecting lines
                edgeLeft: { x: topLeftX, y: topY + (sectionHeight / 2) }, // Approximate mid-left edge
                edgeRight: { x: topRightX, y: topY + (sectionHeight / 2) },

                dropOff: index > 0 ? ((1 - (item.value / data[index - 1].value)) * 100).toFixed(1) + '%' : null,
                conversionRate: index > 0 ? ((item.value / data[0].value) * 100).toFixed(1) + '%' : '100%'
            };
        });
    }, [data, totalSteps, sectionHeight]);

    // Animation variants
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemAnim = {
        hidden: { opacity: 0, scale: 0.95 },
        show: { opacity: 1, scale: 1 } // Removed x slide to avoid layout shift perception
    };

    // Calculate vertical fill improvement:
    // We remove the magic negative margin and handle spacing properly with flex/padding
    return (
        <div className="w-full h-full flex items-center justify-center p-4 relative overflow-hidden rounded-lg bg-muted/5 border border-dashed border-border/40">
            {/* Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                    backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)'
                }}
            />

            {/* Main SVG Container - Increased max-width for "More Filled" look */}
            <div className="w-full max-w-[500px] relative h-full flex items-center justify-center">
                {/* 
                    ViewBox fixed to 0 0 100 100 to match logical height of 100.
                    preserveAspectRatio="none" used carefully or xMidYMid to ensure full use of container 
                */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-[90%] drop-shadow-xl filter overflow-visible">
                    <defs>
                        <linearGradient id="funnelGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.9" />
                        </linearGradient>
                        {data.map((entry, i) => (
                            <filter key={`glow-${i}`} id={`glow-${i}`}>
                                <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        ))}
                    </defs>

                    <motion.g
                        variants={container}
                        initial="hidden"
                        animate="show"
                    >
                        {shapes.map((shape, i) => (
                            <motion.g key={i} variants={itemAnim}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <motion.path
                                                d={shape.path}
                                                fill={shape.fill}
                                                // stroke="white"
                                                // strokeWidth="0.5"
                                                className="cursor-pointer hover:opacity-90 transition-opacity"
                                                whileHover={{ scale: 1.01 }}
                                                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="bg-popover/95 backdrop-blur border-border">
                                            <div className="text-xs">
                                                <p className="font-bold mb-1">{t(`analytics.funnel.${shape.name}`, shape.name)}</p>
                                                <p>{t('analytics.metrics.results', 'Results')}: <span className="font-mono">{shape.value.toLocaleString()}</span></p>
                                                {i > 0 && <p className="text-destructive">Drop-off: {shape.dropOff}</p>}
                                                <p className="text-primary">Conv. Rate: {shape.conversionRate}</p>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {/* Center Value Label */}
                                <text
                                    x="50"
                                    y={shape.center.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="white"
                                    fontSize="4"
                                    fontWeight="bold"
                                    className="pointer-events-none drop-shadow-md select-none"
                                >
                                    {shape.value.toLocaleString()}
                                </text>

                                {/* Connector Lines drawn INSIDE SVG for perfect scaling */}
                                {/* Left Line */}
                                <line
                                    x1="2"
                                    y1={shape.center.y}
                                    x2={shape.edgeLeft.x}
                                    y2={shape.center.y}
                                    stroke="currentColor"
                                    strokeOpacity="0.15"
                                    strokeWidth="0.3"
                                    className="text-foreground"
                                />
                                {/* Right Line */}
                                <line
                                    x1={shape.edgeRight.x}
                                    y1={shape.center.y}
                                    x2="98"
                                    y2={shape.center.y}
                                    stroke="currentColor"
                                    strokeOpacity="0.15"
                                    strokeWidth="0.3"
                                    className="text-foreground"
                                />
                            </motion.g>
                        ))}
                    </motion.g>
                </svg>

                {/* External Labels - Positioned via % covering the SVG container */}
                <div className="absolute inset-0 pointer-events-none h-[90%] my-auto">
                    {shapes.map((shape, i) => (
                        <motion.div
                            key={`label-${i}`}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 + 0.3 }}
                            className="absolute left-0 w-full flex items-center justify-between px-0"
                            // CRITICAL FIX: Use shape.center.y directly for 100% precise alignment with the trapezoid center
                            style={{ top: `${shape.center.y}%`, transform: 'translateY(-50%)' }}
                        >
                            {/* Left Label: Stage Name */}
                            {/* We use width relative to SVG width 85% funnel means 7.5% gap on each side. 
                                Actually, coordinate 0-100. Funnel is centered. Top width 85. 
                                Space on left is (100-85)/2 = 7.5 units. 
                                We place label in that left zone.
                            */}
                            <div className="flex items-center justify-end w-[15%] pr-3">
                                <span className="text-[10px] sm:text-[11px] font-semibold text-foreground text-right leading-none whitespace-nowrap pb-[3px]">
                                    {t(`analytics.funnel.${shape.name}`, shape.name)}
                                </span>
                            </div>

                            {/* Right Label: Stats */}
                            <div className="flex items-center w-[15%] pl-3 justify-start">
                                <div className="flex flex-col min-w-0 pb-[3px]">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-foreground leading-none">
                                        {i === 0 ? '100%' : shape.conversionRate}
                                    </span>
                                    {i > 0 && (
                                        <span className="text-[9px] text-muted-foreground/80 font-medium leading-tight mt-0.5">
                                            Drop: {shape.dropOff}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
