import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProfile, Profile, ProfileUpdate } from '@/hooks/useProfile';
import { Loader2, User, Building2, Instagram, Phone, AtSign, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadAvatar } from '@/lib/uploadAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface EditProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    profile: Profile | undefined | null;
    isAgency?: boolean;
}

export function EditProfileSheet({ open, onOpenChange, profile, isAgency = false }: EditProfileSheetProps) {
    const { updateProfile, isUpdating } = useProfile();
    const { t } = useTranslation();
    const { user } = useAuth();
    const { toast } = useToast();
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const { register, handleSubmit, reset } = useForm<ProfileUpdate>({
        values: {
            full_name: profile?.full_name || '',
            username: profile?.username || '',
            headline: profile?.headline || '',
            company_name: profile?.company_name || '',
            instagram_handle: profile?.instagram_handle || '',
            phone: profile?.phone || '',
        },
    });

    const onSubmit = (data: ProfileUpdate) => {
        // Clean username (remove @ if present)
        if (data.username && data.username.startsWith('@')) {
            data.username = data.username.slice(1);
        }

        // Clean Instagram handle (remove @ if present)
        if (data.instagram_handle && data.instagram_handle.startsWith('@')) {
            data.instagram_handle = data.instagram_handle.slice(1);
        }

        updateProfile(data);
        onOpenChange(false);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            // Preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            // Upload to Supabase bucket
            setIsUploadingAvatar(true);
            const result = await uploadAvatar(file, user.id);
            setIsUploadingAvatar(false);

            if (result.success && result.url) {
                // Update the profile hook with the new avatar immediately
                updateProfile({ avatar_url: result.url });
            } else {
                toast({
                    title: 'Erro no Upload',
                    description: result.error || 'Não foi possível enviar a foto.',
                    variant: 'destructive',
                });
            }
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md overflow-y-auto rounded-none border-l border-white/10 bg-background/95 backdrop-blur-xl p-0">
                <SheetHeader className="p-6 border-b border-white/5">
                    <SheetTitle className="text-2xl font-bold tracking-tight">{t('profile.edit_sheet.title')}</SheetTitle>
                    <SheetDescription className="text-muted-foreground pt-1">
                        {t('profile.edit_sheet.description')}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    {/* Avatar Preview Section */}
                    <div className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 rounded-none mb-6 group relative">
                        <div className="h-24 w-24 rounded-full border-4 border-background bg-muted flex items-center justify-center overflow-hidden shadow-xl ring-1 ring-white/10 mb-4 transition-transform group-hover:scale-105">
                            {avatarPreview || profile?.avatar_url ? (
                                <img
                                    src={avatarPreview || profile?.avatar_url || ''}
                                    alt="Avatar"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl font-bold text-muted-foreground uppercase">
                                    {profile?.full_name?.charAt(0) || 'U'}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <Label
                                htmlFor="avatar-upload"
                                className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary text-[10px] uppercase font-bold px-4 py-2 ring-1 ring-primary/20 transition-all"
                            >
                                {isUploadingAvatar ? 'Enviando...' : t('profile.edit_sheet.change_photo')}
                            </Label>
                            <Input
                                id="avatar-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                disabled={isUploadingAvatar}
                                className="hidden"
                            />
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-center opacity-60">
                                {t('profile.edit_sheet.photo_requirements')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* Full Name */}
                        <div className="space-y-2">
                            <Label htmlFor="full_name" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                                <User className="h-3 w-3" /> {isAgency ? t('profile.edit_sheet.agency_name') : t('profile.edit_sheet.full_name')}
                            </Label>
                            <Input
                                id="full_name"
                                {...register('full_name')}
                                placeholder="João Silva"
                                className="h-11 rounded-none border-border/50 focus-visible:ring-primary/20"
                            />
                        </div>

                        {/* Username */}
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                                <AtSign className="h-3 w-3" /> {t('profile.edit_sheet.username')}
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                                <Input
                                    id="username"
                                    {...register('username')}
                                    className="pl-8 h-11 rounded-none border-border/50 focus-visible:ring-primary/20"
                                    placeholder="joaotraffic"
                                />
                            </div>
                        </div>

                        {/* Headline */}
                        <div className="space-y-2">
                            <Label htmlFor="headline" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                                <Info className="h-3 w-3" /> {t('profile.edit_sheet.bio')}
                            </Label>
                            <Textarea
                                id="headline"
                                {...register('headline')}
                                placeholder="Especialista em E-commerce | Growth Hacker"
                                rows={3}
                                className="rounded-none border-border/50 focus-visible:ring-primary/20 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Company - Only show if NOT isAgency */}
                            {!isAgency && (
                                <div className="space-y-2">
                                    <Label htmlFor="company_name" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                                        <Building2 className="h-3 w-3" /> {t('profile.edit_sheet.company')}
                                    </Label>
                                    <Input
                                        id="company_name"
                                        {...register('company_name')}
                                        placeholder="Nome da Empresa"
                                        className="h-11 rounded-none border-border/50 focus-visible:ring-primary/20"
                                    />
                                </div>
                            )}

                            {/* Instagram */}
                            <div className="space-y-2">
                                <Label htmlFor="instagram_handle" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                                    <Instagram className="h-3 w-3" /> Instagram
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                                    <Input
                                        id="instagram_handle"
                                        {...register('instagram_handle')}
                                        className="pl-8 h-11 rounded-none border-border/50 focus-visible:ring-primary/20"
                                        placeholder="joaotraffic"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                                <Phone className="h-3 w-3" /> {t('profile.edit_sheet.phone')}
                            </Label>
                            <Input
                                id="phone"
                                {...register('phone')}
                                type="tel"
                                placeholder="(11) 99999-9999"
                                className="h-11 rounded-none border-border/50 focus-visible:ring-primary/20"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/5 mt-auto">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-12 rounded-none font-bold uppercase tracking-wider text-[10px] border-border/50"
                            disabled={isUpdating}
                        >
                            {t('common.cancel', 'Cancelar')}
                        </Button>
                        <Button type="submit" className="flex-1 h-12 rounded-none font-bold uppercase tracking-wider text-[10px]" disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('profile.edit_sheet.save')}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
