import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { useAccountType } from "@/contexts/AccountTypeContext";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
// Icons
import { Users, Plus, Trash2, Crown, Shield, UserCog, Loader2, AlertCircle, CheckCircle, Mail, Pencil, MessageSquare } from "lucide-react";
import { useAgencyRoles } from "@/hooks/useAgencyRoles";
import { useAccessLevels } from "@/hooks/useAccessLevels";
import { CreateRoleModal } from "@/components/team/CreateRoleModal";
import { CreateAccessLevelModal } from "@/components/team/CreateAccessLevelModal";
import { EditMemberModal } from "@/components/team/EditMemberModal";
import { usePermissions } from "@/contexts/PermissionsContext";

// Types
interface Workspace {
    id: string;
    name: string;
    owner_id: string;
    plan_type: 'owner' | 'agency';
    max_fb_profiles: number;
    max_members: number;
}

interface TeamMember {
    id: string;
    workspace_id: string;
    user_id: string;
    email: string;
    name?: string;
    phone?: string;
    role: 'admin' | 'operator' | 'restricted';
    status: 'invited' | 'active';
    invited_at: string;
    joined_at?: string;
    member_roles?: { role_id: string; agency_roles: { name: string } }[];
    member_access_levels?: { access_level_id: string; agency_access_levels: { name: string } }[];
    whatsapp_notifications?: boolean;
}

interface FBConnection {
    id: string;
    workspace_id: string;
    profile_name: string;
    fb_user_id: string;
    is_patriarch: boolean;
    connected_at: string;
    expires_at?: string;
}

interface TeamConnectionsProps {
    embedded?: boolean;
}

// Standard Sectors
const SECTORS = ['Gestão', 'Tráfego', 'Design', 'Operacional', 'Comercial', 'Dev'];

export default function TeamConnections({ embedded = false }: TeamConnectionsProps) {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
    const { isAgency } = useAccountType();
    const { canEdit } = usePermissions();
    // Toggle for legacy permissions UI (Enabled for RBAC implementation)
    const SHOW_LEGACY_PERMISSIONS = true;

    const currentLocale = i18n.language.startsWith('pt') ? ptBR : enUS;

    // Data state
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [connections, setConnections] = useState<FBConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog state
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [inviteName, setInviteName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [invitePhone, setInvitePhone] = useState("");
    const [inviteRole, setInviteRole] = useState<'admin' | 'operator' | 'restricted'>('operator');
    const [inviteSector, setInviteSector] = useState<string>(''); // New Sector State
    const [inviteAgencyRoles, setInviteAgencyRoles] = useState<string[]>([]);
    const [isInviting, setIsInviting] = useState(false);


    // Edit Modal State
    // Edit Modal State
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Custom Roles Hook
    const { roles, deleteRole, createRole } = useAgencyRoles();
    const { levels, deleteLevel } = useAccessLevels();

    // Access Level and Role UI State
    const [levelToEdit, setLevelToEdit] = useState<any>(null);
    const [showCreateLevelModal, setShowCreateLevelModal] = useState(false);
    const [showManageLevelsModal, setShowManageLevelsModal] = useState(false);
    const [inviteAccessLevels, setInviteAccessLevels] = useState<string[]>([]);

    const [roleToEdit, setRoleToEdit] = useState<any>(null);
    const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);

    // Plan limits - Use isAgency to override plan_type check for UI testing
    const effectivePlanType = isAgency ? 'agency' : (workspace?.plan_type || 'owner');
    const effectiveMaxMembers = isAgency ? 1000 : (workspace?.max_members || 0);

    const canInviteMembers = effectivePlanType === 'agency';

    useEffect(() => {
        loadWorkspaceData();
    }, []);

    const loadWorkspaceData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get workspace
            const { data: wsData, error: wsError } = await supabase
                .from('workspaces')
                .select('*')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (wsError) {
                console.error('Error loading workspace:', wsError);
            }

            if (wsData) {
                setWorkspace(wsData as Workspace);

                // Step 1: Get members first (Simple and robust)
                console.log(">>> Fetching members for workspace:", wsData.id);
                const { data: membersData, error: memError } = await (supabase as any)
                    .from('team_members')
                    .select('*')
                    .eq('workspace_id', wsData.id);

                if (memError) {
                    console.error('>>> Error fetching members:', memError);
                    return;
                }

                if (!membersData || membersData.length === 0) {
                    console.log(">>> No members found for workspace:", wsData.id);
                    setMembers([]);
                } else {
                    // Step 2: Enrich with relations (More robust than nested joins)
                    const memberIds = membersData.map((m: any) => m.id);

                    // Fetch Roles
                    const { data: rolesData } = await (supabase as any)
                        .from('member_roles')
                        .select('member_id, role_id, agency_roles(name)')
                        .in('member_id', memberIds);

                    // Fetch Access Levels
                    const { data: levelsData } = await (supabase as any)
                        .from('member_access_levels')
                        .select('member_id, access_level_id, agency_access_levels(name)')
                        .in('member_id', memberIds);

                    // Step 2.5: Fetch agency_clients emails to cross-check
                    let clientEmails = new Set<string>();
                    try {
                        const { data: clientsData } = await (supabase as any)
                            .from('agency_clients')
                            .select('portal_email')
                            .eq('workspace_id', wsData.id);
                        clientEmails = new Set(
                            (clientsData || [])
                                .map((c: any) => (c.portal_email || '').toLowerCase().trim())
                                .filter((e: string) => e.length > 0)
                        );
                    } catch {
                        // RLS may block access — proceed without client email filtering
                    }

                    // INLINE STATUS SYNC:
                    // If a member has a user_id (meaning they verified/logged in via Supabase Auth)
                    // but their status in team_members is still 'invited', sync it to 'active' immediately.
                    const membersToSync = membersData.filter((m: any) => m.user_id && m.status !== 'active');
                    if (membersToSync.length > 0) {
                        console.log(`>>> [TeamConnections] Syncing ${membersToSync.length} member(s) to 'active' status...`);
                        for (const member of membersToSync) {
                            await (supabase as any)
                                .from('team_members')
                                .update({ status: 'active', joined_at: new Date().toISOString() })
                                .eq('id', member.id);
                        }
                    }

                    // Map them back, applying the synced status locally for immediate UI update
                    const rawMembers = membersData.map((m: any) => ({
                        ...m,
                        status: (m.user_id && m.status !== 'active') ? 'active' : m.status,
                        member_roles: rolesData?.filter((r: any) => r.member_id === m.id) || [],
                        member_access_levels: levelsData?.filter((l: any) => l.member_id === m.id) || []
                    })).filter((m: any) => {
                        // Exclude if explicitly marked as client
                        if (m.linked_client_id || m.user_type === 'client') return false;
                        // Exclude orphan rows where role was left as 'client' after unlink
                        if (m.role === 'client' || m.role === 'cliente') return false;
                        // Exclude if email matches a known agency client contact email
                        if (m.email && clientEmails.has(m.email.toLowerCase().trim())) return false;
                        // Hide members without a valid email (garbage data from task assignments)
                        if (!m.email || !m.email.includes('@')) return false;

                        return true;
                    });

                    // --- DEDUPLICATION: Keep only one record per email ---
                    const seenEmails = new Map<string, any>();
                    for (const m of rawMembers) {
                        const key = m.email.toLowerCase().trim();
                        const existing = seenEmails.get(key);
                        if (!existing) {
                            seenEmails.set(key, m);
                        } else {
                            // Keep the one that is active, or has user_id, or has more data
                            const existingScore = (existing.status === 'active' ? 10 : 0) + (existing.user_id ? 5 : 0) + (existing.name ? 1 : 0);
                            const newScore = (m.status === 'active' ? 10 : 0) + (m.user_id ? 5 : 0) + (m.name ? 1 : 0);
                            if (newScore > existingScore) {
                                // Merge data from old to new
                                if (!m.name && existing.name) m.name = existing.name;
                                if (!m.phone && existing.phone) m.phone = existing.phone;
                                seenEmails.set(key, m);
                            } else {
                                // Merge data from new to old
                                if (!existing.name && m.name) existing.name = m.name;
                                if (!existing.phone && m.phone) existing.phone = m.phone;
                            }
                        }
                    }
                    const finalMembers = Array.from(seenEmails.values());

                    console.log(">>> Final members (deduplicated):", finalMembers.length, "from raw:", rawMembers.length);
                    setMembers(finalMembers as TeamMember[]);
                }

                // Get FB connections (without encrypted token)
                try {
                    const { data: connectionsData } = await (supabase as any)
                        .from('fb_connections')
                        .select('id, workspace_id, profile_name, fb_user_id, is_patriarch, connected_at, expires_at')
                        .eq('workspace_id', wsData.id);
                    setConnections((connectionsData || []) as FBConnection[]);
                } catch {
                    // Table/columns may not exist yet — proceed without connections
                    setConnections([]);
                }
            }
        } catch (error) {
            console.error('Error loading workspace data:', error);
            toast({ title: t('common.error', 'Error'), description: t('team.error.load', 'Could not load data.'), variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInviteMember = async () => {
        if (!workspace || !inviteEmail) return;

        setIsInviting(true);
        try {
            // Check plan limits (Frontend check only - Backend will verify actual DB plan)
            if (!isAgency && workspace.plan_type === 'owner') {
                toast({
                    title: t('team.error.plan_limit', 'Plan does not support members'),
                    description: t('team.error.upgrade_required', 'Upgrade to Agency plan to invite members.'),
                    variant: "destructive"
                });
                return;
            }

            if (members.length >= effectiveMaxMembers) {
                toast({
                    title: t('team.error.limit_reached', 'Limit reached'),
                    description: t('team.error.limit_reached_desc', { count: effectiveMaxMembers, defaultValue: `Your plan allows up to ${effectiveMaxMembers} members.` }),
                    variant: "destructive"
                });
                return;
            }

            let inviteError = null;
            try {
                // Determine Final Roles (Include Sector Role)
                let finalAgencyRoles = [...inviteAgencyRoles];

                if (inviteRole === 'operator' && inviteSector) {
                    const existingRole = roles.find(r => r.name === inviteSector);
                    if (existingRole) {
                        finalAgencyRoles.push(existingRole.id);
                    } else {
                        // Auto-create sector role if missing
                        console.log(`Creating new sector role: ${inviteSector}`);
                        try {
                            const newRole = await createRole.mutateAsync({
                                name: inviteSector,
                                permissions: []
                            });
                            if (newRole) finalAgencyRoles.push((newRole as any).id);
                        } catch (e) {
                            console.error("Failed to create sector role:", e);
                            // Proceed without it, but warn
                            toast({ variant: "destructive", title: "Aviso", description: `Não foi possível criar o setor ${inviteSector}.` });
                        }
                    }
                }

                // Invoke Edge Function (SDK sends Auth headers automatically)
                const { data, error } = await supabase.functions.invoke('invite-team-member', {
                    body: {
                        workspace_id: workspace.id,
                        email: inviteEmail,
                        name: inviteName,
                        phone: invitePhone,
                        role: inviteRole,
                        agency_roles: finalAgencyRoles,
                        access_levels: inviteAccessLevels,
                        site_url: window.location.origin
                    }
                });

                console.log(">>> Edge Function Response:", { data, error });
                if (error || data?.error) {
                    inviteError = error || new Error(data?.error);
                }
            } catch (err) {
                console.error(">>> Edge Function Exception:", err);
                inviteError = err;
            }

            if (inviteError) {
                console.warn("Edge Function failed, proceeding with manual fallback UI notification...");
                throw inviteError;
            } else {
                toast({
                    title: t('team.invite_sent', 'Invite sent!'),
                    description: t('team.invite_sent_desc', { email: inviteEmail, defaultValue: `An email was sent to ${inviteEmail} and the member was registered.` })
                });
            }

            setShowInviteDialog(false);
            setInviteName("");
            setInviteEmail("");
            setInvitePhone("");
            setInviteAgencyRoles([]);
            setInviteAccessLevels([]);
            loadWorkspaceData();

        } catch (error: any) {
            console.error('Error inviting member:', error);

            let errorMessage = t('common.unknown_error', "Unknown error");

            // Try to extract detailed error from Edge Function response
            if (error.context) {
                try {
                    const body = await error.context.json();
                    if (body && body.error) errorMessage = body.error;
                    else if (body && body.message) errorMessage = body.message;
                } catch (e) {
                    console.error("Could not parse error context:", e);
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            if (errorMessage.includes("FunctionsFetchError")) {
                errorMessage = t('team.error.function_unresponsive', "Invite function is not responding.");
            }

            toast({
                title: t('team.error.invite_failed', "Error inviting"),
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsInviting(false);
        }
    };

    const handleResendInvite = async (member: TeamMember) => {
        setIsInviting(true);
        try {
            toast({ title: t('team.resending', 'Resending invite...'), description: t('team.resending_desc', `Sending email to ${member.email}`) });

            const { data, error } = await supabase.functions.invoke('invite-team-member', {
                body: {
                    workspace_id: workspace?.id,
                    email: member.email,
                    role: member.role,
                    agency_roles: member.member_roles?.map(mr => mr.role_id) || [],
                    access_levels: member.member_access_levels?.map(mal => mal.access_level_id) || []
                }
            });

            if (error || data?.error) throw error || new Error(data?.error);

            toast({
                title: t('team.invite_resent', 'Invite resent!'),
                description: t('team.invite_resent_desc', { email: member.email, defaultValue: `A new email was sent to ${member.email}.` })
            });

        } catch (error: any) {
            console.error('Error resending invite:', error);
            toast({
                title: t('team.error.invite_failed', "Error sending invite"),
                description: error.message || t('common.unknown_error', "Unknown error"),
                variant: "destructive"
            });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        try {
            // Try Edge Function first (handles Auth + DB cleanup)
            const { error } = await supabase.functions.invoke('delete-team-member', {
                body: { member_id: memberId }
            });

            if (error) {
                console.warn("Edge Function failed, trying direct DB delete as fallback...", error);
                // Fallback: delete directly from team_members
                const { error: dbError } = await (supabase as any)
                    .from('team_members')
                    .delete()
                    .eq('id', memberId);

                if (dbError) throw dbError;
            }

            toast({ title: t('team.member_removed', "Member removed") });
            loadWorkspaceData();
        } catch (error: any) {
            console.error('Error removing member:', error);

            let message = error.message || "Unknown error";
            if (message.includes("FunctionsFetchError")) {
                message = t('team.error.delete_failed', "Failed to connect to delete service.");
            }

            toast({ title: t('common.error', "Error"), description: message, variant: "destructive" });
        }
    };

    const handleToggleWhatsAppNotification = async (member: TeamMember) => {
        const newValue = !member.whatsapp_notifications;
        if (newValue && !member.phone) {
            toast({ title: "Sem telefone", description: "Adicione um telefone ao membro antes de ativar notificações.", variant: "destructive" });
            return;
        }
        try {
            const { error } = await (supabase as any)
                .from('team_members')
                .update({ whatsapp_notifications: newValue })
                .eq('id', member.id);
            if (error) throw error;
            setMembers(prev => prev.map(m => m.id === member.id ? { ...m, whatsapp_notifications: newValue } : m));
            toast({ title: newValue ? "Notificações ativadas" : "Notificações desativadas" });
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleConnectMeta = async () => {
        if (!workspace) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({ title: t('common.error', "Error"), description: t('common.auth_error', "User not authenticated."), variant: "destructive" });
                return;
            }

            // Meta OAuth configuration
            const FB_APP_ID = import.meta.env.VITE_FB_APP_ID || '860109229817662';
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
            const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/fb-oauth-callback`;
            const STATE = `${user.id}:${workspace.id}`; // user_id:workspace_id

            // Scopes for ads management
            const SCOPES = [
                'ads_management',
                'ads_read',
                'business_management',
                'pages_read_engagement',
                'pages_show_list',
                'catalog_management'
            ].join(',');

            const oauthUrl = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(STATE)}&scope=${encodeURIComponent(SCOPES)}`;

            // Redirect to Meta OAuth
            window.location.href = oauthUrl;

        } catch (error: any) {
            console.error('Error initiating OAuth:', error);
            toast({ title: t('common.error', "Error"), description: error.message, variant: "destructive" });
        }
    };

    const handleSetPatriarch = async (connectionId: string) => {
        try {
            // Remove patriarch from all, then set new one
            await (supabase as any)
                .from('fb_connections')
                .update({ is_patriarch: false })
                .eq('workspace_id', workspace?.id);

            await (supabase as any)
                .from('fb_connections')
                .update({ is_patriarch: true })
                .eq('id', connectionId);

            toast({ title: t('team.patriarch_updated', "Primary profile updated") });
            loadWorkspaceData();
        } catch (error: any) {
            toast({ title: t('common.error', "Error"), description: error.message, variant: "destructive" });
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge variant="default" className="bg-purple-600"><Shield className="w-3 h-3 mr-1" /> {t('team.roles.admin', 'Admin')}</Badge>;
            case 'operator':
                return <Badge variant="secondary"><UserCog className="w-3 h-3 mr-1" /> {t('team.roles.operator', 'Operator')}</Badge>;
            case 'restricted':
                return <Badge variant="outline">{t('team.roles.restricted', 'Restricted')}</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'active') {
            return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Ativo</Badge>;
        }
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><AlertCircle className="w-3 h-3 mr-1" /> Pendente</Badge>;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!workspace) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('team.title_full', 'Team & Connections')}</h1>
                    <p className="text-muted-foreground mt-2">{t('team.desc', 'Manage your team and connected profiles.')}</p>
                </div>
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">{t('team.no_workspace', 'No workspace found')}</h3>
                        <p className="text-muted-foreground mt-2">{t('team.no_workspace_desc', 'Please contact support.')}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header - Only show if not embedded */}
            {!embedded && (
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('team.title', 'Team')}</h1>
                        <p className="text-muted-foreground mt-2">
                            {t('team.members_desc', 'Manage your workspace members.')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm py-1 px-3">
                            <Crown className="w-3 h-3 mr-1" />
                            {t('team.plan', 'Plan')} {effectivePlanType === 'owner' ? 'Owner' : 'Agency'}
                        </Badge>
                    </div>
                </div>
            )}

            {/* Members Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Membros da Equipe</CardTitle>
                        <CardDescription>
                            {effectivePlanType === 'owner'
                                ? 'Seu plano não inclui membros de equipe. Faça upgrade para o plano Agency.'
                                : isAgency
                                    ? 'Convide membros ilimitados com seu plano Agency.'
                                    : `Você pode convidar até ${effectiveMaxMembers} membros.`
                            }
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {/* Buttons Hidden for Simplified Mode */}
                        {false && (
                            <>
                                <Button variant="outline" className="gap-2" onClick={() => { setRoleToEdit(null); setShowCreateRoleModal(true); }}>
                                    <Plus className="w-4 h-4" />
                                    Criar Função
                                </Button>

                                {canEdit('team') && (
                                    <Button
                                        variant="outline"
                                        className="gap-2 border-primary/50 text-primary hover:bg-primary/5"
                                        onClick={() => setShowManageLevelsModal(true)}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Níveis de Acesso
                                    </Button>
                                )}
                            </>
                        )}

                        {/* Modal de Gestão de Níveis de Acesso */}
                        <Dialog open={showManageLevelsModal} onOpenChange={setShowManageLevelsModal}>
                            <DialogContent className="sm:max-w-[700px]">
                                <DialogHeader>
                                    <DialogTitle>Níveis de Acesso (Roles)</DialogTitle>
                                    <DialogDescription>
                                        Defina o que os membros desta role podem acessar no sistema.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4 max-h-[60vh] overflow-y-auto">
                                    {levels.map(level => (
                                        <div key={level.id} className="flex flex-col p-2 bg-muted/30 rounded-lg border text-[10px] relative group hover:border-primary/40 transition-all">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-sm">{level.name}</span>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 hover:text-primary hover:bg-primary/10"
                                                        onClick={() => {
                                                            setLevelToEdit(level);
                                                            setShowCreateLevelModal(true);
                                                        }}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            if (confirm(`Excluir o nível ${level.name}?`)) deleteLevel.mutate(level.id);
                                                        }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(level.permissions_config).map(([feat, lvl]) => (
                                                    lvl !== 'none' && (
                                                        <span key={feat} className="bg-background px-1 py-0.5 rounded border border-border/50 text-[9px] capitalize">
                                                            {feat.substring(0, 3)}: {lvl === 'edit' ? 'FULL' : 'READ'}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {levels.length === 0 && (
                                        <div className="col-span-full text-center py-8 text-muted-foreground italic">
                                            Nenhum nível de acesso criado.
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button className="w-full gap-2" onClick={() => { setLevelToEdit(null); setShowCreateLevelModal(true); }}>
                                        <Plus className="w-4 h-4" />
                                        Criar Novo Nível de Acesso
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <CreateAccessLevelModal
                            open={showCreateLevelModal}
                            onOpenChange={setShowCreateLevelModal}
                            levelToEdit={levelToEdit}
                        />

                        <CreateRoleModal
                            open={showCreateRoleModal}
                            onOpenChange={setShowCreateRoleModal}
                            roleToEdit={roleToEdit}
                        />

                        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                            <DialogTrigger asChild>
                                {canEdit('team') ? (
                                    <Button disabled={!canInviteMembers}>
                                        <Plus className="w-4 h-4 mr-2" /> Convidar Membro
                                    </Button>
                                ) : <span />}
                            </DialogTrigger>
                            <DialogContent
                                onPointerDownOutside={(e) => e.preventDefault()}
                                onInteractOutside={(e) => e.preventDefault()}
                            >
                                <DialogHeader>
                                    <DialogTitle>{t('team.invite_member')}</DialogTitle>
                                    <DialogDescription>
                                        {t('team.invite_desc')}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">{t('profile.edit_sheet.full_name', 'Nome Completo')}</Label>
                                            <Input
                                                id="name"
                                                type="text"
                                                placeholder="Ex: João Silva"
                                                value={inviteName}
                                                onChange={(e) => setInviteName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">E-mail</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="membro@empresa.com"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Telefone / WhatsApp</Label>
                                            <Input
                                                id="phone"
                                                type="text"
                                                placeholder="(11) 99999-9999"
                                                value={invitePhone}
                                                onChange={(e) => setInvitePhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <Label>Tipo de Acesso</Label>
                                            <Select
                                                value={inviteRole}
                                                onValueChange={(val: any) => setInviteRole(val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent position="popper" className="z-[9999]">
                                                    <SelectItem value="admin">Administrador (Acesso Total)</SelectItem>
                                                    <SelectItem value="operator">Funcionário (Acesso Padrão)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {inviteRole === 'admin'
                                                    ? "Pode gerenciar tudo no sistema, inclusive configurações e financeiro."
                                                    : "Pode gerenciar demandas, clientes e produtos. Sem acesso a financeiro ou configurações."}
                                            </p>
                                        </div>

                                        {inviteRole === 'operator' && (
                                            <div className="space-y-2">
                                                <Label>Setor / Departamento</Label>
                                                <Select
                                                    value={inviteSector}
                                                    onValueChange={setInviteSector}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione o setor..." />
                                                    </SelectTrigger>
                                                    <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                                                        {SECTORS.map(s => (
                                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                                        {t('common.cancel', 'Cancel')}
                                    </Button>
                                    <Button onClick={handleInviteMember} disabled={isInviting || !inviteEmail}>
                                        {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                        {t('team.send_invite')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent className="px-0 pt-0 pb-0">
                    {/* Job Functions List (Hidden for Simplified Mode) */}
                    {false && roles.length > 0 && (
                        <div id="roles-section" className="mb-4 p-1.5 bg-muted/20 rounded-lg border border-border/50">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2 px-1">
                                <Users className="w-3 h-3 text-primary" />
                                Funções & Cargos (Competências)
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {roles.map(role => (
                                    <div key={role.id} className="flex flex-col p-2 bg-background rounded-lg border text-[10px] relative group hover:border-primary/40 transition-all">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold truncate max-w-[80px]">{role.name}</span>
                                            {canEdit('team') && (
                                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 hover:text-primary hover:bg-primary/10"
                                                        onClick={() => {
                                                            setRoleToEdit(role);
                                                            setShowCreateRoleModal(true);
                                                        }}
                                                    >
                                                        <Pencil className="w-2.5 h-2.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            if (confirm(`Excluir a função "${role.name}"?`)) deleteRole.mutate(role.id);
                                                        }}
                                                    >
                                                        <Trash2 className="w-2.5 h-2.5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {role.permissions && role.permissions.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {role.permissions.slice(0, 3).map((p: string) => (
                                                        <span key={p} className="text-[8px] bg-primary/5 text-primary px-1 py-0.5 rounded-full border border-primary/10">{p}</span>
                                                    ))}
                                                    {role.permissions.length > 3 && <span className="text-[8px] text-muted-foreground">+{role.permissions.length - 3}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Access Levels List (Hidden for Simplified Mode) */}
                    {false && levels.length > 0 && (
                        <div id="levels-section" className="mb-4 p-1.5 bg-muted/20 rounded-lg border border-border/10">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2 px-1">
                                <Shield className="w-3 h-3 text-orange-500" />
                                Perfis de Acesso Disponíveis
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {levels.map(level => (
                                    <div key={level.id} className="flex flex-col p-2 bg-background/50 rounded-lg border border-dashed text-[10px]">
                                        <span className="font-bold truncate mb-1">{level.name}</span>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(level.permissions_config).slice(0, 3).map(([feat, lvl]) => (
                                                lvl !== 'none' && (
                                                    <span key={feat} className="text-[8px] text-muted-foreground">{feat.substring(0, 2)}:{lvl === 'edit' ? 'E' : 'V'}</span>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {members.length === 0 ? (
                        <div className="text-center py-12 border rounded-md border-dashed">
                            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">Nenhum membro na equipe</h3>
                            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                                {effectivePlanType === 'owner'
                                    ? 'Faça upgrade para o plano Agency para convidar membros.'
                                    : 'Clique em "Convidar Membro" para adicionar pessoas ao seu workspace.'
                                }
                            </p>
                        </div>
                    ) : (
                        <Table className="table-fixed">
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[25%] pl-6 border-r border-border/50">Membro</TableHead>
                                    {SHOW_LEGACY_PERMISSIONS && <TableHead className="w-[25%] border-r border-border/50">Permissões & Cargos</TableHead>}
                                    <TableHead className="w-[15%] border-r border-border/50">Status</TableHead>
                                    <TableHead className="w-[15%] border-r border-border/50">Convidado em</TableHead>
                                    <TableHead className="w-[10%] border-r border-border/50 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                                            Notif.
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[15%] text-left pr-6">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium pl-6 border-r border-border/50">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{member.name || member.email}</span>
                                                {member.name && <span className="text-xs text-muted-foreground">{member.email}</span>}
                                                {member.phone && <span className="text-xs text-muted-foreground font-mono mt-0.5">{member.phone}</span>}
                                            </div>
                                        </TableCell>
                                        {SHOW_LEGACY_PERMISSIONS && (
                                            <TableCell className="border-r border-border/50">
                                                <div className="flex flex-col gap-1">
                                                    {/* Access Levels (Permissions) */}
                                                    <div className="flex flex-wrap gap-1">
                                                        {member.member_access_levels?.map(al => (
                                                            <Badge key={al.access_level_id} variant="default" className="bg-primary/80 text-xs h-5">
                                                                <Shield className="w-2.5 h-2.5 mr-1" /> {al.agency_access_levels.name}
                                                            </Badge>
                                                        ))}
                                                        {(!member.member_access_levels || member.member_access_levels.length === 0) && member.role === 'admin' && (
                                                            <Badge variant="default" className="bg-purple-600 text-xs h-5">
                                                                <Crown className="w-2.5 h-2.5 mr-1" /> Admin
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {/* Job Functions (Roles) */}
                                                    <div className="flex flex-wrap gap-1">
                                                        {member.member_roles?.map(mr => (
                                                            <Badge key={mr.role_id} variant="outline" className="text-xs h-5 border-blue-500/50 text-blue-600">
                                                                <Users className="w-2.5 h-2.5 mr-1" /> {mr.agency_roles.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        )}
                                        <TableCell className="border-r border-border/50">{getStatusBadge(member.status)}</TableCell>
                                        <TableCell className="text-muted-foreground text-[10px] border-r border-border/50">
                                            {format(new Date(member.invited_at), i18n.language.startsWith('pt') ? "dd/MM/yyyy" : "MM/dd/yyyy", { locale: currentLocale })}
                                        </TableCell>
                                        <TableCell className="text-center border-r border-border/50">
                                            <Switch
                                                checked={!!member.whatsapp_notifications}
                                                onCheckedChange={() => handleToggleWhatsAppNotification(member)}
                                                disabled={!canEdit('team')}
                                                className="data-[state=checked]:bg-green-500"
                                            />
                                        </TableCell>
                                        <TableCell className="text-left pr-6">
                                            <div className="flex justify-start gap-1">
                                                {canEdit('team') && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleResendInvite(member)}
                                                            disabled={isInviting}
                                                            title={t('team.resend_invite', "Resend Invite")}
                                                            className="hover:text-blue-500 hover:bg-blue-500/10"
                                                        >
                                                            <Mail className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setEditingMember(member);
                                                                setShowEditModal(true);
                                                            }}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="hover:text-destructive"
                                                            onClick={() => handleRemoveMember(member.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <EditMemberModal
                member={editingMember}
                open={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingMember(null);
                    loadWorkspaceData(); // Refresh list after edit
                }}
            />
        </div >
    );
}
