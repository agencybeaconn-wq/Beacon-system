import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataDropzoneProps {
    onFileSelect: (file: File) => void;
    isProcessing: boolean;
}

export function DataDropzone({ onFileSelect, isProcessing }: DataDropzoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileSelect(acceptedFiles[0]);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1,
        multiple: false,
        disabled: isProcessing
    });

    return (
        <div className="w-full max-w-xl mx-auto">
            <div
                {...getRootProps()}
                className={cn(
                    "relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300",
                    "flex flex-col items-center justify-center p-12 text-center",
                    isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/50 hover:bg-muted/30",
                    isProcessing && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
            >
                <input {...getInputProps()} />

                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
                    <div className="relative bg-background border border-border/50 p-5 rounded-2xl shadow-xl">
                        <Upload className={cn("h-8 w-8 text-primary transition-transform duration-300", isDragActive && "scale-110")} />
                    </div>
                </div>

                <h3 className="text-xl font-bold tracking-tight mb-2">
                    {isProcessing ? "Processando dados..." : "Importar Planilha Inteligente"}
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                    Arraste e solte seu arquivo <span className="text-foreground font-semibold">XLSX</span> ou <span className="text-foreground font-semibold">CSV</span> aqui.
                </p>

                <div className="mt-8 flex items-center gap-3 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Máximo 10MB • Suporta CSV e Excel</span>
                </div>

                {fileRejections.length > 0 && (
                    <div className="mt-4 flex items-center gap-2 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>Formato de arquivo não suportado</span>
                    </div>
                )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
                <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
                            {String.fromCharCode(64 + i)}
                        </div>
                    ))}
                </div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                    Usado por +50 managers para análise rápida
                </p>
            </div>
        </div>
    );
}
