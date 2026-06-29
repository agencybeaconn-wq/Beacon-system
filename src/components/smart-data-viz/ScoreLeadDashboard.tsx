import { useMemo, useState } from 'react';
import { DataConfig, parseBrazilianNumber } from '@/hooks/useSmartData';
import { TrendingUp, Activity, Plus, Trash2, CloudDownload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ScoreLeadDashboardProps {
    data: any[];
    config: DataConfig;
    onDataChange?: (newData: any[]) => void;
    onImportClients?: () => void;
}

export function ScoreLeadDashboard({ data, config, onDataChange, onImportClients }: ScoreLeadDashboardProps) {
    const [selectedMonth, setSelectedMonth] = useState('1');
    const [selectedYear, setSelectedYear] = useState('2026');

    // --- DATA MANIPULATION HELPERS ---
    const handleUpdateRow = (index: number, field: string, value: any) => {
        if (!onDataChange) return;
        const newData = [...data];
        // If row doesn't exist, fill predecessors with empty rows (shouldn't happen with 25-row grid but good safety)
        if (index >= newData.length) {
            for (let i = newData.length; i <= index; i++) {
                newData[i] = newData[i] || {};
            }
        }
        newData[index] = { ...newData[index], [field]: value };
        onDataChange(newData);
    };

    const handleAddRow = () => {
        if (!onDataChange) return;
        const newRow = { cliente: 'Novo Cliente', plano: 'STD', score: 0, faturamento: 0, anterior: 0 };
        onDataChange([...data, newRow]);
    };

    const handleDeleteRow = (index: number) => {
        if (!onDataChange) return;
        const newData = data.filter((_, i) => i !== index);
        onDataChange(newData);
    }

    // --- METRICS CALCULATION ---
    const stats = useMemo(() => {
        const totalClients = data.filter(d => d && Object.keys(d).length > 0 && (d.cliente || d.Cliente)).length;
        const totalRevenue = data.reduce((acc, curr) => acc + parseBrazilianNumber(curr?.faturamento || curr?.Faturamento), 0);
        const activeRows = data.filter(d => d && Object.keys(d).length > 0 && (d.cliente || d.Cliente));
        const avgScore = activeRows.length > 0 ? activeRows.reduce((acc, curr) => acc + parseBrazilianNumber(curr?.score || curr?.Score), 0) / activeRows.length : 0;

        const feedback = {
            bom: activeRows.filter(d => parseBrazilianNumber(d?.score || d?.Score) >= 7).length,
            medio: activeRows.filter(d => {
                const s = parseBrazilianNumber(d?.score || d?.Score);
                return s >= 5 && s < 7;
            }).length,
            ruim: activeRows.filter(d => parseBrazilianNumber(d?.score || d?.Score) < 5).length
        };

        return { totalClients, totalRevenue, avgScore, feedback };
    }, [data]);

    // Color Helpers
    const getScoreColorBg = (score: number) => {
        if (score >= 7) return 'bg-[#B7E4C7]'; // Light Green
        if (score >= 5) return 'bg-[#FEFAE0]'; // Light Yellow/Beige
        return 'bg-[#F4E1E1]'; // Light Red
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto p-2 sm:p-4 space-y-4 font-sans text-slate-900 dark:text-slate-100 bg-white dark:bg-[#020617] min-h-screen shadow-2xl transition-colors duration-300">

            {/* --- HEADER: DASHBOARD SCORE LEAD --- */}
            <div className="w-full bg-[#1B4332] text-white p-2 flex items-center justify-center gap-3 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg">
                <TrendingUp className="h-5 w-5 text-[#B7E4C7]" />
                <h1 className="text-lg font-black uppercase tracking-[0.2em] italic">DASHBOARD SCORE LEAD</h1>
            </div>

            {/* --- TOP SECTION GRID --- */}
            <div className="grid grid-cols-12 gap-0 border-2 border-slate-900 bg-slate-100 dark:bg-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg overflow-hidden">

                {/* ROW 1: FILTERS */}
                <div className="col-span-12 grid grid-cols-12 border-b-2 border-slate-900">
                    {/* MÊS */}
                    <div className="col-span-1 border-r-2 border-slate-900 flex items-center justify-center bg-white dark:bg-slate-900 p-1">
                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">📆 MÊS:</span>
                    </div>
                    <div className="col-span-3 border-r-2 border-slate-900 p-0">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full h-full border-none outline-none bg-[#FEFAE0] dark:bg-slate-800 dark:text-amber-100 text-center text-sm font-bold p-1 cursor-pointer hover:brightness-95 transition-all text-slate-900"
                        >
                            {Array.from({ length: 12 }).map((_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                            ))}
                        </select>
                    </div>

                    {/* ANO */}
                    <div className="col-span-1 border-r-2 border-slate-900 flex items-center justify-center bg-white dark:bg-slate-900 p-1">
                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">ANO:</span>
                    </div>
                    <div className="col-span-3 border-r-2 border-slate-900 p-0">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full h-full border-none outline-none bg-[#FEFAE0] dark:bg-slate-800 dark:text-amber-100 text-center text-sm font-bold p-1 cursor-pointer hover:brightness-95 transition-all text-slate-900"
                        >
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                        </select>
                    </div>

                    {/* COMPARAÇÃO */}
                    <div className="col-span-2 border-r-2 border-slate-900 flex items-center justify-center bg-[#E8F5E9] dark:bg-emerald-950/30 p-1">
                        <span className="text-[10px] font-black text-slate-900 dark:text-emerald-400">COMPARAÇÃO</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-center bg-[#B7E4C7] dark:bg-emerald-900 p-1 font-black text-slate-900 dark:text-emerald-100">
                        12
                    </div>
                </div>

                {/* ROW 2: RESUMO HEADER */}
                <div className="col-span-4 bg-white dark:bg-slate-900 border-b-2 border-r-2 border-slate-900 p-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-slate-900 dark:text-slate-100" />
                    <span className="text-[10px] font-black italic uppercase text-slate-900 dark:text-slate-100">RESUMO DO PERÍODO</span>
                </div>
                <div className="col-span-8 bg-white dark:bg-slate-900 border-b-2 border-slate-900"></div>

                {/* ROW 3: METRICS */}
                <div className="col-span-12 grid grid-cols-12 border-b-2 border-slate-900">
                    {/* MEDIA SCORE */}
                    <div className="col-span-2 bg-[#1B4332] text-white text-[10px] uppercase font-bold flex items-center px-2 border-r-2 border-slate-900">MÉDIA SCORE</div>
                    <div className="col-span-2 bg-white dark:bg-slate-900 text-center font-bold text-sm flex items-center justify-center border-r-2 border-slate-900 text-slate-900 dark:text-slate-100">
                        {stats.avgScore.toFixed(2)}
                    </div>

                    {/* CLIENTES */}
                    <div className="col-span-2 bg-[#1B4332] text-white text-[10px] uppercase font-bold flex items-center px-2 border-r-2 border-slate-900">CLIENTES</div>
                    <div className="col-span-2 bg-white dark:bg-slate-900 text-center font-bold text-sm flex items-center justify-center border-r-2 border-slate-900 text-slate-900 dark:text-slate-100">
                        {stats.totalClients}
                    </div>

                    {/* FATURAMENTO */}
                    <div className="col-span-2 bg-[#1B4332] text-white text-[10px] uppercase font-bold flex items-center px-2 border-r-2 border-slate-900">FATURAMENTO</div>
                    <div className="col-span-2 bg-white dark:bg-slate-900 text-center font-bold text-sm flex items-center justify-center text-slate-900 dark:text-slate-100">
                        {stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                </div>

                {/* ROW 4: STATUS COUNTS */}
                <div className="col-span-12 grid grid-cols-12">
                    {/* BOM */}
                    <div className="col-span-2 bg-[#B7E4C7] dark:bg-emerald-900 text-[#1B4332] dark:text-emerald-100 text-[10px] uppercase font-bold flex items-center px-2 border-r-2 border-slate-900">BOM (&gt;7)</div>
                    <div className="col-span-2 bg-white dark:bg-slate-900 text-center font-bold text-sm flex items-center justify-center border-r-2 border-slate-900 text-slate-900 dark:text-slate-100">
                        {stats.feedback.bom}
                    </div>

                    {/* MEDIO */}
                    <div className="col-span-2 bg-[#FEFAE0] dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] uppercase font-bold flex items-center px-2 border-r-2 border-slate-900">MÉDIO (5-7)</div>
                    <div className="col-span-2 bg-white dark:bg-slate-900 text-center font-bold text-sm flex items-center justify-center border-r-2 border-slate-900 text-slate-900 dark:text-slate-100">
                        {stats.feedback.medio}
                    </div>

                    {/* RUIM */}
                    <div className="col-span-2 bg-[#F4E1E1] dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 text-[10px] uppercase font-bold flex items-center px-2 border-r-2 border-slate-900">RUIM (&lt;5)</div>
                    <div className="col-span-2 bg-white dark:bg-slate-900 text-center font-bold text-sm flex items-center justify-center text-slate-900 dark:text-slate-100">
                        {stats.feedback.ruim}
                    </div>
                </div>
            </div>

            {/* --- ACTION BAR --- */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2 border-2 border-slate-900 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-[#1B4332] dark:text-emerald-400">MODO EDIÇÃO:</span> Clique nas células para editar. As alterações são salvas automaticamente.
                </span>
                <div className="flex gap-2">
                    <Button
                        onClick={() => onImportClients?.()}
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold gap-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                    >
                        <CloudDownload className="h-4 w-4" />
                        Importar Clientes do Sistema
                    </Button>
                    <Button
                        onClick={handleAddRow}
                        size="sm"
                        className="bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold gap-2 border-2 border-[#1B4332] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                    >
                        <Plus className="h-4 w-4" />
                        Adicionar Cliente Manual
                    </Button>
                </div>
            </div>

            {/* --- TABLES SECTION --- */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">

                {/* LEFT: RANKING DE CLIENTES */}
                <div className="border border-slate-900 bg-white dark:bg-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg overflow-hidden">
                    {/* Table Header Wrapper */}
                    <div className="bg-[#1B4332] text-white p-2 flex items-center gap-2 border-b border-slate-900">
                        <TrendingUp className="h-4 w-4 text-[#FFD700]" />
                        <span className="text-xs font-black uppercase tracking-widest">RANKING DE CLIENTES</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1B4332] text-white">
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold w-10 text-center">#</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold">CLIENTE</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold w-20 text-center">PLANO</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold w-16 text-center">SCORE</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold w-24 text-center">STATUS</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold text-right w-28 pr-2">FATURAMENTO</th>
                                    <th className="p-1 border border-slate-900 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 25 }).map((_, idx) => {
                                    const row = data[idx] || {};
                                    const score = parseBrazilianNumber(row?.score || row?.Score);
                                    const isEmpty = !row || Object.keys(row).length === 0;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs transition-colors h-10">
                                            <td className="p-1 border border-slate-900 text-center font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 w-10">{idx + 1}</td>

                                            {/* EDITABLE: CLIENTE */}
                                            <td className="p-0 border border-slate-900 relative group">
                                                <input
                                                    type="text"
                                                    value={row?.cliente || row?.Cliente || ''}
                                                    onChange={e => handleUpdateRow(idx, 'cliente', e.target.value)}
                                                    className="w-full h-full p-2 bg-transparent outline-none font-bold text-slate-900 dark:text-slate-100 focus:bg-[#FEFAE0] dark:focus:bg-slate-700 transition-colors uppercase"
                                                    placeholder={isEmpty ? "" : "NOME DO CLIENTE"}
                                                />
                                            </td>

                                            {/* EDITABLE: PLANO */}
                                            <td className="p-0 border border-slate-900 relative group w-20">
                                                <input
                                                    type="text"
                                                    value={row?.plano || row?.Plano || ''}
                                                    onChange={e => handleUpdateRow(idx, 'plano', e.target.value)}
                                                    className="w-full h-full p-1 bg-transparent outline-none text-center text-[10px] uppercase text-slate-600 dark:text-slate-400 focus:bg-[#FEFAE0] dark:focus:bg-slate-700 transition-colors font-bold"
                                                    placeholder={isEmpty ? "" : "STD"}
                                                />
                                            </td>

                                            {/* EDITABLE: SCORE */}
                                            <td className="p-0 border border-slate-900 relative group w-16">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={isEmpty ? '' : score}
                                                    onChange={e => handleUpdateRow(idx, 'score', parseFloat(e.target.value))}
                                                    className="w-full h-full p-1 bg-transparent outline-none text-center font-black text-slate-900 dark:text-slate-100 focus:bg-[#FEFAE0] dark:focus:bg-slate-700 transition-colors text-sm"
                                                    placeholder={isEmpty ? "" : "0.0"}
                                                />
                                            </td>

                                            {/* CALCULATED: STATUS */}
                                            <td className={cn("p-1 border border-slate-900 text-center font-black text-[10px] uppercase tracking-wide w-24", isEmpty ? "bg-white dark:bg-slate-900" : getScoreColorBg(score), "text-slate-900")}>
                                                {!isEmpty && (score >= 7 ? 'BOM' : score >= 5 ? 'MÉDIO' : 'RUIM')}
                                            </td>

                                            {/* EDITABLE: FATURAMENTO */}
                                            <td className="p-0 border border-slate-900 relative group w-28 pr-2">
                                                <input
                                                    type="text"
                                                    value={row?.faturamento || row?.Faturamento || ''}
                                                    onChange={e => handleUpdateRow(idx, 'faturamento', e.target.value)}
                                                    className="w-full h-full p-1 pr-2 bg-transparent outline-none text-right tabular-nums font-bold text-slate-700 dark:text-slate-200 focus:bg-[#FEFAE0] dark:focus:bg-slate-700 transition-colors"
                                                    placeholder={isEmpty ? "" : "R$ 0,00"}
                                                />
                                            </td>

                                            {/* DELETE ROW */}
                                            <td className="p-1 border border-slate-900 text-center bg-white dark:bg-slate-900 w-8">
                                                {!isEmpty && (
                                                    <button onClick={() => handleDeleteRow(idx)} className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors p-1">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT: EVOLUÇÃO EM 2026 */}
                <div className="border border-slate-900 bg-white dark:bg-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg overflow-hidden">
                    <div className="bg-[#B7E4C7] dark:bg-emerald-900 p-2 text-[#1B4332] dark:text-emerald-100 flex items-center justify-between border-b border-slate-900">
                        <span className="text-xs font-black uppercase tracking-widest">Evolução em 2026</span>
                        <TrendingUp className="h-4 w-4 opacity-50" />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1B4332] text-white">
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold">CLIENTE</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold text-center w-20">ANTERIOR</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold text-center w-20">ATUAL</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold text-center w-20">VAR</th>
                                    <th className="p-1 border border-slate-900 text-[9px] uppercase font-bold text-center w-20">TENDÊNCIA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 25 }).map((_, idx) => {
                                    const row = data[idx] || {};
                                    const isEmpty = !row || Object.keys(row).length === 0;
                                    const anterior = parseBrazilianNumber(row?.Anterior || row?.anterior || 0);
                                    const atual = parseBrazilianNumber(row?.score || row?.Score);
                                    const variacao = atual - anterior;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs transition-colors h-10">
                                            <td className="p-1 border border-slate-900 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px] uppercase">
                                                {row?.cliente || row?.Cliente || ''}
                                            </td>

                                            {/* EDITABLE: ANTERIOR */}
                                            <td className="p-0 border border-slate-900 relative group w-20">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={isEmpty ? '' : anterior}
                                                    onChange={e => handleUpdateRow(idx, 'anterior', parseFloat(e.target.value))}
                                                    className="w-full h-full p-1 bg-transparent outline-none text-center text-slate-500 dark:text-slate-400 focus:bg-[#FEFAE0] dark:focus:bg-slate-700 transition-colors font-bold"
                                                    placeholder={isEmpty ? "" : "0.0"}
                                                />
                                            </td>

                                            <td className="p-1 border border-slate-900 text-center font-black text-slate-900 dark:text-slate-100 w-20">
                                                {!isEmpty ? atual.toFixed(1) : ''}
                                            </td>
                                            <td className={cn("p-1 border border-slate-900 text-center font-black w-20", !isEmpty && (variacao >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"))}>
                                                {!isEmpty ? variacao.toFixed(1) : ''}
                                            </td>
                                            <td className="p-1 border border-slate-900 text-center w-20">
                                                {!isEmpty && (
                                                    <Activity className={cn("h-4 w-4 mx-auto", variacao >= 0 ? "text-emerald-500" : "text-rose-500")} />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
