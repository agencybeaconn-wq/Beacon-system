import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';

interface StructuredDataDropdownProps {
    dataType: 'pixels' | 'identities' | 'creatives' | 'urls' | 'interests' | 'locations';
    data: Array<{ id: string; name: string;[key: string]: any }>;
    message: string;
    onSelect?: (selectedId: string, selectedName: string) => void;
}

export function StructuredDataDropdown({ dataType, data, message, onSelect }: StructuredDataDropdownProps) {
    const [selectedId, setSelectedId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { sendMessage } = useChat();

    const handleSelect = async (value: string) => {
        setSelectedId(value);
        const selected = data.find(item => item.id === value);
        if (!selected) return;

        setIsSubmitting(true);

        // Send message to AI with the selection - make it clear that AI should update draft
        let messageToSend = '';
        if (dataType === 'pixels') {
            messageToSend = `Use o pixel ${selected.name} (ID: ${selected.id}).`;
        } else if (dataType === 'identities') {
            messageToSend = `Use a página/identidade ${selected.name} (ID: ${selected.id}).`;
        } else if (dataType === 'creatives') {
            messageToSend = `Use o criativo ${selected.name} (Hash: ${selected.id}).`;
        } else if (dataType === 'interests') {
            messageToSend = `Use o interesse ${selected.name} (ID: ${selected.id}).`;
        } else if (dataType === 'locations') {
            // For locations, the id is actually the key
            const locationName = selected.country ? `${selected.name}, ${selected.country}` : selected.name;
            messageToSend = `Use a localização ${locationName} (Key: ${selected.id}).`;
        } else {
            messageToSend = `Use ${selected.name}.`;
        }

        // Call onSelect callback if provided
        if (onSelect) {
            onSelect(selected.id, selected.name);
        }

        // Send message to AI
        try {
            await sendMessage(messageToSend);
        } catch (error) {
            console.error("Erro ao enviar seleção:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getPlaceholder = () => {
        switch (dataType) {
            case 'pixels':
                return 'Selecione um Pixel';
            case 'identities':
                return 'Selecione uma Página/Instagram';
            case 'creatives':
                return 'Selecione um Criativo';
            case 'urls':
                return 'Selecione uma URL';
            case 'interests':
                return 'Selecione um Interesse';
            case 'locations':
                return 'Selecione uma Localização';
            default:
                return 'Selecione uma opção';
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex gap-2">
                <Select value={selectedId} onValueChange={(val) => { setSelectedId(val); setIsSubmitting(false); }} disabled={isSubmitting}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={getPlaceholder()} />
                    </SelectTrigger>
                    <SelectContent>
                        {data.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                                {item.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedId && (
                    <Button
                        size="icon"
                        variant={isSubmitting ? "ghost" : "default"}
                        onClick={() => handleSelect(selectedId)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}

