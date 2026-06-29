import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTasks, TaskColumn } from "@/contexts/TasksContext";
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

interface EditColumnModalProps {
    column: TaskColumn;
    isOpen: boolean;
    onClose: () => void;
}

export function EditColumnModal({ column, isOpen, onClose }: EditColumnModalProps) {
    const [title, setTitle] = useState(column.title);
    const [selectedColor, setSelectedColor] = useState(column.color);
    const [isLoading, setIsLoading] = useState(false);

    const { updateColumn } = useTasks();

    useEffect(() => {
        if (isOpen) {
            setTitle(column.title);
            setSelectedColor(column.color);
        }
    }, [isOpen, column]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsLoading(true);
        try {
            await updateColumn(column.id, { title, color: selectedColor });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Coluna</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-title">Título da Coluna</Label>
                        <Input
                            id="edit-title"
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
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
