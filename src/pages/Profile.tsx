import { useState, useRef } from 'react';
import { Camera, Edit, TrendingUp, DollarSign, Calendar, Flame, Trophy, Loader2, ExternalLink, Building2, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useProfile } from '@/hooks/useProfile';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useUserAuthority } from '@/hooks/useUserAuthority';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { formatCurrency } from '@/lib/authorityUtils';
import { uploadAvatar } from '@/lib/uploadAvatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Leaderboard } from '@/components/Leaderboard';
import { cn } from '@/lib/utils';
import { useAccountType } from '@/contexts/AccountTypeContext';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';

export default function Profile() {
    const { profile, isLoading, error } = useProfile();
    const { stats, isLoading: statsLoading } = useProfileStats();
    const { authority, isLoading: authorityLoading } = useUserAuthority(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // DEV ONLY: Account Type Toggle for testing
    const { accountType, setAccountType, isAgency } = useAccountType();
    const { t } = useTranslation();

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast({
                title: t('common.error', 'Erro'),
                description: t('profile.error_user_not_auth'),
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);

        const result = await uploadAvatar(file, user.id);

        if (result.success) {
            toast({
                title: t('profile.avatar_updated'),
                description: t('profile.avatar_updated_desc'),
            });
            window.location.reload();
        } else {
            toast({
                title: t('profile.error_upload'),
                description: result.error || t('common.try_again', 'Tente novamente.'),
                variant: 'destructive',
            });
        }

        setIsUploading(false);
    };

    if (isLoading) {
        return (
            <div className="container max-w-7xl mx-auto p-6 space-y-6">
                <Skeleton className="h-64 w-full rounded-none" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-40 rounded-none" />
                    <Skeleton className="h-40 rounded-none" />
                    <Skeleton className="h-40 rounded-none" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container max-w-7xl mx-auto p-6">
                <Card className="p-6 border-destructive/20 bg-destructive/5 rounded-none">
                    <h2 className="text-lg font-semibold text-destructive mb-2">{t('profile.error_loading')}</h2>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                </Card>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="container max-w-7xl mx-auto p-6">
                <Card className="p-12 text-center border-dashed rounded-none">
                    <h2 className="text-2xl font-semibold mb-2">{t('profile.welcome')}</h2>
                    <p className="text-muted-foreground mb-8">
                        {t('profile.first_access')}
                    </p>
                    <Button onClick={() => setIsEditOpen(true)} size="lg">
                        {t('profile.create_profile')}
                    </Button>
                </Card>
                <EditProfileSheet
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    profile={null}
                    isAgency={isAgency}
                />
            </div>
        );
    }

    // Bento Grid Card Style - Matte & Subtle
    const bentoCardClass = "border-white/5 bg-secondary/20 backdrop-blur-xl shadow-none hover:bg-secondary/30 transition-all duration-300 rounded-lg";

    return (
        <div className="pt-8 px-2 sm:px-4 pb-6 space-y-6">

            {/* DEV ONLY: Account Type Toggle */}
            <Card className={cn("p-4 border-dashed border-amber-500/30 bg-amber-500/5", bentoCardClass)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            {isAgency ? <Building2 className="h-5 w-5 text-amber-500" /> : <User className="h-5 w-5 text-amber-500" />}
                        </div>
                        <div>
                            <p className="text-sm font-medium">{t('profile.account_type_dev')}</p>
                            <p className="text-xs text-muted-foreground">
                                {isAgency ? t('profile.agency_mode_active') : t('profile.owner_mode_active')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={cn("text-sm font-medium", !isAgency ? "text-foreground" : "text-muted-foreground")}>{t('profile.owner')}</span>
                        <Switch
                            checked={isAgency}
                            onCheckedChange={(checked) => setAccountType(checked ? 'agency' : 'owner')}
                        />
                        <span className={cn("text-sm font-medium", isAgency ? "text-foreground" : "text-muted-foreground")}>{t('profile.agency')}</span>
                    </div>
                </div>
            </Card>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* 1. Hero Profile (Spans 8 cols) */}
                <Card className={cn("md:col-span-8 p-8 relative overflow-hidden border-none flex flex-col justify-between", bentoCardClass)}>
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <User className="w-64 h-64 text-primary" />
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
                        {/* Avatar */}
                        <div className="relative group shrink-0">
                            <div className="h-32 w-32 rounded-full border-4 border-background/50 bg-muted flex items-center justify-center overflow-hidden shadow-none ring-1 ring-white/10">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.full_name || 'Avatar'} className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-muted-foreground">
                                        {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || 'U'}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-none hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 ring-4 ring-background"
                            >
                                {isUploading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Camera className="h-5 w-5" />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleAvatarUpload}
                                className="hidden"
                            />
                        </div>

                        {/* Info */}
                        <div className="text-center space-y-2 flex-1">
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="w-full text-center">
                                    <div className="flex items-center justify-center gap-4">
                                        <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
                                            {profile?.full_name || t('profile.unnamed')}
                                        </h1>
                                        <Button
                                            onClick={() => setIsEditOpen(true)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-muted-foreground hover:text-white hover:bg-white/10 rounded-none shrink-0"
                                            title={t('profile.edit_profile')}
                                        >
                                            <Edit className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <p className="text-lg text-muted-foreground font-medium mt-1">@{profile.username || 'username'}</p>
                                </div>
                            </div>

                            {profile?.headline && (
                                <p className="text-muted-foreground/80 max-w-xl leading-relaxed pt-2">
                                    {profile.headline}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-3 pt-4 justify-center">
                                {authority && (
                                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 gap-1.5 px-3 py-1.5 text-sm rounded-none">
                                        <Trophy className="h-4 w-4" />
                                        {authority.tier.displayName}
                                    </Badge>
                                )}
                                {!isAgency && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-white/5 border border-white/5 text-sm text-muted-foreground">
                                        <Building2 className="h-4 w-4" />
                                        {profile?.company_name || t('profile.no_company')}
                                    </div>
                                )}
                                {profile?.instagram_handle && (
                                    <a
                                        href={`https://instagram.com/${profile.instagram_handle}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-white/5 border border-white/5 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        @{profile.instagram_handle}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 2. Authority Progress (Spans 4 cols) */}
                <Card className={cn("md:col-span-4 p-8 flex flex-col justify-center border-none relative overflow-hidden", bentoCardClass)}>
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

                    {authority && authority.nextTier ? (
                        <div className="space-y-6 relative z-10">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    {t('profile.next_level')}
                                </h3>
                                <span className="text-2xl font-bold text-primary">
                                    {Math.round(authority.progressToNext * 100)}%
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                                    <span>{authority.tier.displayName}</span>
                                    <span>{authority.nextTier.displayName}</span>
                                </div>
                                <Progress value={authority.progressToNext * 100} className="h-4 rounded-none bg-black/10" />
                                <p className="text-xs text-center text-muted-foreground pt-1">
                                    {t('profile.evolve_needed', { amount: formatCurrency(authority.nextTier.minSpend - authority.lifetime_spend) })}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Trophy className="h-12 w-12 mb-4 opacity-20" />
                            <p>{t('profile.max_level')}</p>
                        </div>
                    )}
                </Card>

                {/* 3. Stats Grid (Spans 12 cols - Subgrid) */}
                <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                        title={t('profile.total_investment')}
                        value={formatCurrency(authority?.lifetime_spend || 0)}
                        icon={DollarSign}
                        color="text-emerald-500"
                        bg="bg-emerald-500/10"
                        loading={authorityLoading}
                        className={bentoCardClass}
                    />
                    <StatsCard
                        title={t('profile.average_roas')}
                        value={`${(stats?.bestRoas || 0).toFixed(2)}x`}
                        icon={TrendingUp}
                        color="text-blue-500"
                        bg="bg-blue-500/10"
                        loading={statsLoading}
                        className={bentoCardClass}
                    />
                    <StatsCard
                        title={t('profile.current_streak')}
                        value={`${authority?.current_streak || 0} ${t('profile.days')}`}
                        icon={Flame}
                        color="text-orange-500"
                        bg="bg-orange-500/10"
                        loading={authorityLoading}
                        className={bentoCardClass}
                    />
                    <StatsCard
                        title={t('profile.best_roas')}
                        value={`${(authority?.highest_roas || 0).toFixed(2)}x`}
                        icon={Trophy}
                        color="text-amber-500"
                        bg="bg-amber-500/10"
                        loading={authorityLoading}
                        className={bentoCardClass}
                    />
                </div>


            </div>

            <EditProfileSheet
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                profile={profile}
                isAgency={isAgency}
            />
        </div>
    );
}

// Helper Component for Stats
function StatsCard({ title, value, icon: Icon, color, bg, loading, className }: any) {
    return (
        <Card className={cn("p-6 border-none flex flex-col justify-between h-32", className)}>
            <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <div className={cn("p-2.5 rounded-none", bg)}>
                    <Icon className={cn("h-5 w-5", color)} />
                </div>
            </div>
            {loading ? (
                <Skeleton className="h-8 w-32" />
            ) : (
                <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            )}
        </Card>
    );
}
