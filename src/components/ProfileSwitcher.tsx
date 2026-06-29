import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Check,
    ChevronDown,
    Plus,
    Loader2,
    Sparkles,
    User
} from "lucide-react";
import metaIcon from "@/assets/meta.svg";

interface FBConnection {
    id: string;
    workspace_id: string;
    profile_name: string;
    fb_user_id: string;
    is_patriarch: boolean;
}

interface ProfileSwitcherProps {
    isCollapsed?: boolean;
    userRole?: 'owner' | 'admin' | 'operator' | 'restricted';
}

const CachedAvatar = ({ fbUserId, initials, size = "h-9 w-9", photoMap, cacheFn }: {
    fbUserId?: string;
    initials: string;
    size?: string;
    photoMap: Record<string, string>;
    cacheFn: (id: string, url: string) => void;
}) => {
    const photoUrl = fbUserId ? `https://graph.facebook.com/${fbUserId}/picture?type=normal` : null;
    const cachedUrl = fbUserId ? photoMap[fbUserId] : null;

    useEffect(() => {
        if (photoUrl && !cachedUrl) {
            // Pre-fetch and cache
            const img = new Image();
            img.onload = () => cacheFn(fbUserId!, photoUrl);
            img.src = photoUrl;
        }
    }, [fbUserId, photoUrl, cachedUrl]);

    return (
        <Avatar className={size}>
            <AvatarImage src={cachedUrl || photoUrl || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[10px]">
                {initials}
            </AvatarFallback>
        </Avatar>
    );
};

const MAX_PROFILES = 2; // Profile limit for current plan

export function ProfileSwitcher({ isCollapsed = false, userRole = 'owner' }: ProfileSwitcherProps) {
    const {
        selectedProfileId,
        setSelectedProfileId,
        profiles,
        isLoading: isDashboardLoading,
        profilePhotoMap,
        cacheProfilePhoto
    } = useDashboard();

    // Only owners and admins can switch profiles
    const canSwitchProfiles = userRole === 'owner' || userRole === 'admin';

    const handleProfileChange = (connectionId: string) => {
        if (!canSwitchProfiles) return;
        setSelectedProfileId(connectionId);
    };

    const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles.find(p => p.is_patriarch) || profiles[0];

    if (isDashboardLoading && profiles.length === 0) {
        return (
            <div className="flex items-center gap-2 px-5 py-4 text-muted-foreground italic">
                <Loader2 className="w-5 h-5 animate-spin" />
                {!isCollapsed && <span className="text-sm">Carregando...</span>}
            </div>
        );
    }

    if (profiles.length === 0) {
        return (
            <div
                className={`flex items-center gap-3 px-5 py-4 hover:bg-sidebar-accent transition-colors cursor-pointer text-primary border-t border-sidebar-border ${isCollapsed ? 'justify-center' : ''}`}
                onClick={() => window.location.href = '/connections?action=connect'}
            >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                    <Plus className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-base font-bold truncate">Conectar Perfil</p>
                        <p className="text-xs text-muted-foreground">Meta Ads</p>
                    </div>
                )}
            </div>
        );
    }

    const getInitials = (name: string) => {
        if (!name) return 'FB';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    // If restricted role, just show the active profile without dropdown
    if (!canSwitchProfiles) {
        return (
            <div className="flex items-center gap-3 p-2">
                <CachedAvatar
                    fbUserId={selectedProfile?.fb_user_id}
                    initials={selectedProfile ? getInitials(selectedProfile.profile_name) : 'FB'}
                    size="h-8 w-8"
                    photoMap={profilePhotoMap}
                    cacheFn={cacheProfilePhoto}
                />
                {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedProfile?.profile_name}</p>
                        <p className="text-xs text-muted-foreground">Perfil Ativo</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="w-full focus:outline-none rounded-none border-none">
                <div className={`flex items-center gap-3 px-5 py-4 hover:bg-sidebar-accent transition-colors cursor-pointer ${isCollapsed ? 'justify-center' : ''}`}>
                    <CachedAvatar
                        fbUserId={selectedProfile?.fb_user_id}
                        initials={selectedProfile ? getInitials(selectedProfile.profile_name) : 'FB'}
                        size="h-9 w-9"
                        photoMap={profilePhotoMap}
                        cacheFn={cacheProfilePhoto}
                    />
                    {!isCollapsed && (
                        <>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-base font-medium truncate">{selectedProfile?.profile_name || 'Selecionar'}</p>
                                <div className="flex items-center gap-1">
                                    <img src={metaIcon} className="w-3 h-3" alt="Meta" />
                                    <span className="text-sm text-muted-foreground">Meta Ads</span>
                                </div>
                            </div>
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        </>
                    )}
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                    <img src={metaIcon} className="w-4 h-4" alt="Meta" />
                    Perfis Conectados
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profiles.map((profile) => (
                    <DropdownMenuItem
                        key={profile.id}
                        onClick={() => handleProfileChange(profile.id)}
                        className="cursor-pointer"
                    >
                        <div className="flex items-center gap-3 w-full">
                            <CachedAvatar
                                fbUserId={profile.fb_user_id}
                                initials={getInitials(profile.profile_name)}
                                size="h-7 w-7"
                                photoMap={profilePhotoMap}
                                cacheFn={cacheProfilePhoto}
                            />
                            <span className="flex-1 truncate">{profile.profile_name}</span>
                            {profile.id === selectedProfileId && (
                                <Check className="h-5 w-5 text-green-500" />
                            )}
                        </div>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {profiles.length < MAX_PROFILES && (
                    <DropdownMenuItem
                        onClick={() => window.location.href = '/connections?action=connect'}
                        className="cursor-pointer text-primary py-2.5 font-bold"
                    >
                        <Plus className="h-5 w-5 mr-3" />
                        Adicionar Perfil
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    onClick={() => window.location.href = '/connections'}
                    className="cursor-pointer text-muted-foreground py-2.5"
                >
                    <User className="h-5 w-5 mr-3" />
                    Gerenciar Perfis
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
