import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, User } from "lucide-react";
import metaIcon from "@/assets/meta.svg";

interface FBConnection {
    id: string;
    workspace_id: string;
    profile_name: string;
    fb_user_id: string;
    is_patriarch: boolean;
    connected_at: string;
    expires_at?: string;
}

interface ProfileSelectorProps {
    onProfileChange?: (connectionId: string) => void;
}

export function ProfileSelector({ onProfileChange }: ProfileSelectorProps) {
    const { selectedProfileId, setSelectedProfileId } = useDashboard();
    const [profiles, setProfiles] = useState<FBConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Use any to bypass type checking for new tables not yet in generated types
            const supabaseAny = supabase as any;

            // Get workspace for this user
            const { data: workspace } = await supabaseAny
                .from('workspaces')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            let workspaceId = workspace?.id;

            if (!workspaceId) {
                // Check if user is a team member
                const { data: membership } = await supabaseAny
                    .from('team_members')
                    .select('workspace_id')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .single();

                workspaceId = membership?.workspace_id;
            }

            if (!workspaceId) {
                setIsLoading(false);
                return;
            }

            // Load profiles for workspace
            const { data: connections } = await supabaseAny
                .from('fb_connections')
                .select('id, workspace_id, profile_name, fb_user_id, is_patriarch, connected_at, expires_at')
                .eq('workspace_id', workspaceId);

            const loadedProfiles = (connections || []) as FBConnection[];
            setProfiles(loadedProfiles);

            // Auto-select patriarch if no profile selected
            if (!selectedProfileId && loadedProfiles.length > 0) {
                const patriarch = loadedProfiles.find(p => p.is_patriarch) || loadedProfiles[0];
                setSelectedProfileId(patriarch.id);
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleProfileChange = (connectionId: string) => {
        setSelectedProfileId(connectionId);
        onProfileChange?.(connectionId);
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando...</span>
            </div>
        );
    }

    if (profiles.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <img src={metaIcon} className="w-4 h-4 opacity-50" alt="Meta" />
                <span>Nenhum perfil conectado</span>
            </div>
        );
    }

    const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

    return (
        <Select value={selectedProfileId || selectedProfile?.id} onValueChange={handleProfileChange}>
            <SelectTrigger className="w-[200px] h-9">
                <div className="flex items-center gap-2">
                    <img src={metaIcon} className="w-4 h-4" alt="Meta" />
                    <SelectValue placeholder="Selecionar perfil" />
                </div>
            </SelectTrigger>
            <SelectContent>
                {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                            <User className="w-3 h-3" />
                            <span>{profile.profile_name}</span>
                            {profile.is_patriarch && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1">
                                    Principal
                                </Badge>
                            )}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
