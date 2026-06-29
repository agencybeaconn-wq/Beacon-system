import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
    task_assigned: { icon: "📋", color: "text-blue-400" },
    task_completed: { icon: "✅", color: "text-green-400" },
    info: { icon: "ℹ️", color: "text-slate-400" },
};

export function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const handleNotifClick = (notif: Notification) => {
        if (!notif.is_read) markAsRead(notif.id);
        if (notif.link) navigate(notif.link);
        setOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setOpen(prev => !prev)}
                className="relative p-2 rounded-lg hover:bg-white/5 transition-colors group"
                aria-label="Notificações"
            >
                <Bell className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 shadow-lg shadow-red-500/30 animate-in zoom-in-50">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/40 z-[100] overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold">Notificações</h3>
                            {unreadCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Bell className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-sm font-medium">Sem notificações</p>
                                <p className="text-xs opacity-60">Você será notificado quando algo acontecer</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                                return (
                                    <button
                                        key={notif.id}
                                        onClick={() => handleNotifClick(notif)}
                                        className={cn(
                                            "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-all border-b border-border/10 group",
                                            !notif.is_read && "bg-primary/5"
                                        )}
                                    >
                                        {/* Icon */}
                                        <span className="text-base mt-0.5 shrink-0">{config.icon}</span>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={cn(
                                                    "text-sm truncate",
                                                    !notif.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                                                )}>
                                                    {notif.title}
                                                </p>
                                                {!notif.is_read && (
                                                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                                )}
                                            </div>
                                            {notif.message && (
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {notif.message}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                                                {timeAgo(notif.created_at)}
                                            </p>
                                        </div>

                                        {/* Read indicator */}
                                        {!notif.is_read && (
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                                                <Check className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
