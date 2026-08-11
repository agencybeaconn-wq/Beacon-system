"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    dateRange: DateRange | undefined
    onDateRangeChange: (range: DateRange | undefined) => void
    align?: "start" | "center" | "end"
    showPresets?: boolean
}

/**
 * Seletor de período no comportamento nativo do react-day-picker:
 * 1º clique marca o início, 2º clique fecha o intervalo (em qualquer ordem —
 * clicar pra tras funciona), 3º clique começa intervalo novo. O popover NAO
 * fecha sozinho: o usuário ajusta a vontade e commita no "Aplicar".
 *
 * A versão anterior tinha uma máquina de estados própria por cima do rdp que
 * quebrava a seleção retroativa (colapsava pra dia único) e fechava o popover
 * no segundo clique — impossível refinar o período.
 */
export function DateRangePicker({
    className,
    dateRange,
    onDateRangeChange,
    align = "start",
    showPresets = true,
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    // Rascunho local: o pai (que geralmente refaz fetch a cada mudança) só
    // recebe o range no Aplicar/preset — nunca um intervalo meio-aberto.
    const [draft, setDraft] = React.useState<DateRange | undefined>(dateRange)

    // Reabriu → rascunho parte do valor commitado atual
    React.useEffect(() => {
        if (isOpen) setDraft(dateRange)
    }, [isOpen, dateRange])

    const today = new Date()
    const prevMonth = subMonths(today, 1)

    const presets: Array<{ label: string; value: DateRange }> = [
        { label: "Hoje", value: { from: today, to: today } },
        { label: "Últimos 7 dias", value: { from: subDays(today, 6), to: today } },
        { label: "Últimos 30 dias", value: { from: subDays(today, 29), to: today } },
        { label: "Este mês", value: { from: startOfMonth(today), to: today } },
        // Mês anterior COMPLETO — do dia 1 ao último dia
        { label: "Mês anterior", value: { from: startOfMonth(prevMonth), to: endOfMonth(prevMonth) } },
    ]

    const commit = (range: DateRange | undefined) => {
        onDateRangeChange(range)
        setIsOpen(false)
    }

    const applyDisabled = !draft?.from

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, "dd MMM", { locale: ptBR })} -{" "}
                                    {format(dateRange.to, "dd MMM, yyyy", { locale: ptBR })}
                                </>
                            ) : (
                                format(dateRange.from, "dd MMM, yyyy", { locale: ptBR })
                            )
                        ) : (
                            <span>Selecione o período</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align={align}>
                    <div className="flex">
                        {showPresets && (
                            <div className="flex flex-col gap-1 p-3 border-r border-border/40">
                                <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Atalhos</p>
                                {presets.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start text-xs h-8"
                                        onClick={() => commit(preset.value)}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>
                        )}
                        <div className="p-3">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={draft?.from || dateRange?.from || today}
                                selected={draft}
                                onSelect={setDraft}
                                numberOfMonths={2}
                                locale={ptBR}
                            />
                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40">
                                <p className="text-xs text-muted-foreground px-1">
                                    {draft?.from && !draft?.to && "Clique na data final"}
                                    {draft?.from && draft?.to &&
                                        `${format(draft.from, "dd MMM", { locale: ptBR })} – ${format(draft.to, "dd MMM", { locale: ptBR })}`}
                                    {!draft?.from && "Clique na data inicial"}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => setDraft(undefined)}
                                    >
                                        Limpar
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-8 text-xs px-4"
                                        disabled={applyDisabled}
                                        onClick={() => {
                                            // Range meio-aberto (1 clique só) = dia único
                                            if (draft?.from) {
                                                commit({ from: draft.from, to: draft.to ?? draft.from })
                                            }
                                        }}
                                    >
                                        Aplicar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
