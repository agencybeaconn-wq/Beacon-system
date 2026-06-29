import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    is_read: boolean;
    created_at: string;
    metadata: Record<string, any>;
}

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await (supabase as any)
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('[useNotifications] Error:', error);
                return;
            }

            const items = data || [];
            setNotifications(items);
            setUnreadCount(items.filter((n: Notification) => !n.is_read).length);
        } catch (err) {
            console.error('[useNotifications] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const markAsRead = useCallback(async (id: string) => {
        await (supabase as any)
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(prev - 1, 0));
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!user) return;
        await (supabase as any)
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    }, [user]);

    // Realtime subscription
    useEffect(() => {
        if (!user) return;

        fetchNotifications();

        const channel = supabase
            .channel('notifications-' + user.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload: any) => {
                const newNotif = payload.new as Notification;
                setNotifications(prev => [newNotif, ...prev]);
                setUnreadCount(prev => prev + 1);
            })
            .subscribe();

        // Poll every 30s as backup
        const interval = setInterval(fetchNotifications, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [user, fetchNotifications]);

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refresh: fetchNotifications,
    };
}
