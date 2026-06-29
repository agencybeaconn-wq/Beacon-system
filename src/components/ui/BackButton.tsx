import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
    const navigate = useNavigate();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 hover:bg-primary/10 transition-colors shrink-0"
        >
            <ChevronLeft className="h-5 w-5" />
        </Button>
    );
}
