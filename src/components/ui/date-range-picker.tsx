"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { addDays, format, subDays } from "date-fns"
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

export function DateRangePicker({
    className,
    dateRange,
    onDateRangeChange,
    align = "start",
    showPresets = true,
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    // Track if we're in the process of selecting (first click made, waiting for second)
    const [isSelecting, setIsSelecting] = React.useState(false)
    // Temporary range for visual feedback during selection
    const [tempRange, setTempRange] = React.useState<DateRange | undefined>(undefined)

    const presets = [
        {
            label: "Hoje",
            value: { from: new Date(), to: new Date() },
        },
        {
            label: "Últimos 7 dias",
            value: { from: subDays(new Date(), 6), to: new Date() },
        },
        {
            label: "Últimos 30 dias",
            value: { from: subDays(new Date(), 29), to: new Date() },
        },
        {
            label: "Este mês",
            value: {
                from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                to: new Date()
            },
        },
    ]

    const handlePresetClick = (preset: { from: Date; to: Date }) => {
        onDateRangeChange(preset)
        setTempRange(undefined)
        setIsSelecting(false)
        setIsOpen(false)
    }

    // Handle the range selection with proper reset behavior
    const handleSelect = (range: DateRange | undefined) => {
        if (!range) {
            setTempRange(undefined)
            setIsSelecting(false)
            return
        }

        // If we already have a complete range OR we're not in selecting mode,
        // clicking a new date should start a fresh selection
        if ((dateRange?.from && dateRange?.to && !isSelecting) || (!isSelecting && !tempRange)) {
            // Start fresh with the clicked date as 'from'
            setTempRange({ from: range.from, to: undefined })
            setIsSelecting(true)
            return
        }

        // If we're in selecting mode (have a 'from', waiting for 'to')
        if (isSelecting && tempRange?.from) {
            if (range.to) {
                // Range is complete (from and to selected)
                onDateRangeChange({ from: tempRange.from, to: range.to })
                setTempRange(undefined)
                setIsSelecting(false)
                setIsOpen(false)
            } else if (range.from && !range.to) {
                // User clicked the same date or re-clicked - check if it's the same as tempRange.from
                if (range.from.getTime() === tempRange.from.getTime()) {
                    // Same date clicked twice = single day selection
                    onDateRangeChange({ from: range.from, to: range.from })
                    setTempRange(undefined)
                    setIsSelecting(false)
                    setIsOpen(false)
                } else {
                    // User moved to a different date, calculate range
                    const isRangeForward = range.from >= tempRange.from
                    onDateRangeChange({
                        from: isRangeForward ? tempRange.from : range.from,
                        to: isRangeForward ? range.from : tempRange.from
                    })
                    setTempRange(undefined)
                    setIsSelecting(false)
                    setIsOpen(false)
                }
            }
        }
    }

    // Displayed range: during selection show temp, otherwise show final
    const displayedRange = isSelecting && tempRange ? tempRange : dateRange

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={isOpen} onOpenChange={(open) => {
                setIsOpen(open)
                // Reset temp state when closing
                if (!open) {
                    setTempRange(undefined)
                    setIsSelecting(false)
                }
            }}>
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
                            <div className="flex flex-col gap-1 p-3 border-r border-border">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Atalhos</p>
                                {presets.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start text-xs h-8"
                                        onClick={() => handlePresetClick(preset.value)}
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
                                defaultMonth={displayedRange?.from || new Date()}
                                selected={displayedRange}
                                onSelect={handleSelect}
                                numberOfMonths={2}
                                locale={ptBR}
                                className="rounded-md"
                            />
                            {isSelecting && tempRange?.from && (
                                <p className="text-xs text-muted-foreground text-center mt-2">
                                    Selecionado: {format(tempRange.from, "dd MMM", { locale: ptBR })} - Clique na data final
                                </p>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
