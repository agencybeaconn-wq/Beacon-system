
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Sparkles, Play, Pause, Copy, X, CheckCircle2, FileText, MessageSquare, Rocket, Bot, Pencil, Trash2, Wand2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface SmartDockProps {
    selectedCount: number;
    onClearSelection: () => void;
    onActivate: () => void;
    onDeactivate: () => void;
    onDuplicate: () => void;
    onDelete?: () => void;
    onAnalyze: () => void;
    onEdit?: () => void;
    onManualCreate?: () => void; // NEW: Opens editor with empty draft
}

export const SmartDock = ({
    selectedCount,
    onClearSelection,
    onActivate,
    onDeactivate,
    onDuplicate,
    onDelete,
    onAnalyze,
    onEdit,
    onManualCreate,
}: SmartDockProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const hasSelection = selectedCount > 0;

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center justify-center">
            <TooltipProvider>
                <motion.div
                    layout
                    layoutId="smart-dock"
                    initial={false}
                    animate={{
                        width: "auto",
                        height: hasSelection ? "3.5rem" : "4rem",
                        borderRadius: "1rem",
                    }}
                    transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6
                    }}
                    className={cn(
                        "overflow-hidden flex items-center backdrop-blur-xl border relative transition-all duration-500",
                        hasSelection
                            ? "bg-background/95 border-primary/30 shadow-lg shadow-primary/10"
                            : "bg-gradient-to-r from-background/95 via-background/90 to-background/95 border-primary/20 shadow-xl shadow-primary/20"
                    )}
                    style={{
                        boxShadow: hasSelection
                            ? '0 4px 20px rgba(225, 29, 72, 0.15)'
                            : '0 8px 32px rgba(225, 29, 72, 0.25), 0 0 60px rgba(225, 29, 72, 0.1)'
                    }}
                >
                    {/* Glow effect for idle state */}
                    {!hasSelection && (
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pointer-events-none" />
                    )}

                    {/* Content Layer */}
                    <div className="relative z-10 flex items-center justify-center h-full w-full px-3">
                        <AnimatePresence mode="wait">
                            {hasSelection ? (
                                <motion.div
                                    key="selection-dock"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                    transition={{ duration: 0.3, delay: 0.1 }}
                                    className="flex items-center gap-4 px-4 min-w-[320px] md:min-w-[400px] justify-between h-full"
                                >
                                    {/* Left: Counter */}
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 text-primary rounded-md p-1.5">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col leading-none">
                                            <span className="font-semibold text-sm">
                                                {selectedCount} {selectedCount === 1 ? t('common.item') : t('common.items')}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {t('common.selected')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-6 w-[1px] bg-border/50" />

                                    {/* Center: Actions */}
                                    <div className="flex items-center gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="ghost" onClick={onActivate} className="h-8 w-8 rounded-md hover:bg-green-500/10 hover:text-green-600">
                                                    <Play className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('common.activate')}</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="ghost" onClick={onDeactivate} className="h-8 w-8 rounded-md hover:bg-yellow-500/10 hover:text-yellow-600">
                                                    <Pause className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('common.pause')}</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="ghost" onClick={onDuplicate} className="h-8 w-8 rounded-md hover:bg-blue-500/10 hover:text-blue-600">
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('common.duplicate')}</TooltipContent>
                                        </Tooltip>

                                        {onDelete && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('common.delete')}</TooltipContent>
                                            </Tooltip>
                                        )}

                                        {onEdit && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={onEdit}
                                                        className="h-8 w-8 rounded-md hover:bg-purple-500/10 hover:text-purple-600"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {selectedCount === 1 ? t('common.edit') : `${t('common.edit')} ${selectedCount} ${t('common.items')}`}
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>

                                    <div className="h-6 w-[1px] bg-border/50" />

                                    {/* Right: AI & Close */}
                                    <div className="flex items-center gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={onAnalyze}
                                                    className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary relative group"
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                    </span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('common.analyze')}</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="ghost" onClick={onClearSelection} className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('common.clear')}</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle-dock"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-center gap-3 px-3"
                                >
                                    {/* NEW CAMPAIGN DROPDOWN - Enhanced */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                className="h-11 px-5 rounded-lg bg-gradient-to-r from-primary to-rose-600 text-white font-semibold hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 gap-2"
                                            >
                                                <Plus className="h-5 w-5" />
                                                <span className="hidden sm:inline">{t('campaigns.actions.new_campaign', 'Nova Campanha')}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="center" side="top" className="mb-4 w-64 p-2">
                                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 pb-2">
                                                {t('campaigns.actions.choose_method', 'Escolha como criar')}
                                            </DropdownMenuLabel>

                                            {/* AI Option */}
                                            <DropdownMenuItem
                                                onClick={() => navigate('/chat', {
                                                    state: { autoSend: "Quero criar uma nova campanha. Me ajude a definir a estrutura." }
                                                })}
                                                className="cursor-pointer gap-3 py-3 px-3 rounded-lg hover:bg-indigo-500/10 group"
                                            >
                                                <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500/20 transition-colors">
                                                    <Wand2 className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{t('campaigns.actions.with_ai', 'Com IA')}</span>
                                                    <span className="text-[10px] text-muted-foreground">{t('campaigns.actions.ai_description', 'Beacon Brain cria para você')}</span>
                                                </div>
                                            </DropdownMenuItem>

                                            {/* Manual Option */}
                                            <DropdownMenuItem
                                                onClick={() => onManualCreate?.()}
                                                className="cursor-pointer gap-3 py-3 px-3 rounded-lg hover:bg-primary/10 group"
                                            >
                                                <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                                    <SlidersHorizontal className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{t('campaigns.actions.manual', 'Manual')}</span>
                                                    <span className="text-[10px] text-muted-foreground">{t('campaigns.actions.manual_description', 'Configure você mesmo')}</span>
                                                </div>
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator className="my-2" />

                                            {/* Report Option */}
                                            <DropdownMenuItem
                                                onClick={() => navigate('/chat', {
                                                    state: { autoSend: "Gere um relatório de performance dos últimos 7 dias com os principais insights." }
                                                })}
                                                className="cursor-pointer gap-3 py-2 px-3 rounded-lg"
                                            >
                                                <FileText className="h-4 w-4 text-blue-500" />
                                                <span className="text-sm">{t('common.report', 'Gerar Relatório')}</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <div className="h-8 w-[1px] bg-border/30" />

                                    {/* Quick AI Analysis */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => navigate('/chat', {
                                                    state: { autoSend: "Analise a performance geral da conta hoje e me diga se há alguma anomalia ou oportunidade." }
                                                })}
                                                className="h-11 w-11 rounded-lg hover:bg-indigo-500/10 text-muted-foreground hover:text-indigo-500 transition-all relative"
                                            >
                                                <Bot className="h-5 w-5" />
                                                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                                                </span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('common.quick_analysis', 'Análise Rápida com IA')}</TooltipContent>
                                    </Tooltip>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </TooltipProvider>
        </div>
    );
};
