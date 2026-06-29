import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTasks } from "@/contexts/TasksContext";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLUMN_COLORS = [
    { name: 'Slate', value: 'bg-slate-500' },
    { name: 'Blue', value: 'bg-blue-500' },
    { name: 'Purple', value: 'bg-purple-500' },
    { name: 'Green', value: 'bg-green-500' },
    { name: 'Red', value: 'bg-red-500' },
    { name: 'Orange', value: 'bg-orange-500' },
    { name: 'Pink', value: 'bg-pink-500' },
    { name: 'Yellow', value: 'bg-yellow-500' },
];

export function NewColumnModal() {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [selectedColor, setSelectedColor] = useState(COLUMN_COLORS[0].value);
    const [isLoading, setIsLoading] = useState(false);

    const { addColumn } = useTasks();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsLoading(true);
        try {
            await addColumn(title, selectedColor);
            toast.success("Coluna criada com sucesso!");
            setOpen(false);
            setTitle("");
            setSelectedColor(COLUMN_COLORS[0].value);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao criar coluna");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nova Coluna
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nova Coluna</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título da Coluna</Label>
                        <Input
                            id="title"
                            placeholder="Ex: Em Revisão, Arquivado..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Cor da Identificação</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {COLUMN_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setSelectedColor(color.value)}
                                    className={cn(
                                        "w-full h-8 rounded-md transition-all",
                                        color.value,
                                        selectedColor === color.value ? "ring-2 ring-primary ring-offset-2" : "opacity-70 hover:opacity-100"
                                    )}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Criando..." : "Criar Coluna"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
