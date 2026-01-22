import React, { useState, useEffect } from 'react';
import { 
  Bell, Check, Printer, Trash2, X, FileText, 
  Archive, MessageSquare, 
  User, Calendar, Clock,
  Loader2,
  ChevronRight,
  Settings
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogPortal,
  DialogOverlay
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { socket, socketRequest } from '~/lib/core';
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { toast } from "sonner";
import { cn } from '~/lib/core';
import { useAuth } from '~/hooks/useAuth';
import { useConfig } from '~/hooks/useConfig';

function formatTimeAgo(dateInput: string | Date | undefined | null) {
    if (!dateInput) return '---';
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '---';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'acum';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
}

export function InboxDrawer() {
    const { user } = useAuth();
    const { constants } = useConfig();
    const [isOpen, setIsOpen] = useState(false);
    const [notification, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [view, setView] = useState<'new' | 'history'>('new');

    const fetchNotifications = async () => {
        setLoading(true);
        const filter: any = view === 'new' ? { status: 'new' } : {};
        if (user?.workspaceId) filter.workspaceId = user.workspaceId;

        try {
            const res = await socketRequest('inbox:list', filter);
            if (res.success && res.data) {
                setNotifications(res.data);
                if (view === 'new') {
                    setUnreadCount(res.data.length);
                }
            }
        } catch (e) {
            console.error("[INBOX] Fetch failed:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, view, user?.workspaceId]);

    useEffect(() => {
        if (!socket) return;
        
        const handleNewNotif = (data: any) => {
            // Filter by workspace if applicable
            if (user?.workspaceId && data.notification.workspaceId && data.notification.workspaceId !== user.workspaceId && data.notification.workspaceId !== 'system') {
                return;
            }

            // Check if notification already exists in current list to avoid duplicates
            setNotifications(prev => {
                const exists = prev.some(n => n.id === data.notification.id);
                if (exists) return prev;
                return [data.notification, ...prev];
            });
            setUnreadCount(c => c + 1);

            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
                const title = data.notification.senderName || data.notification.senderId || 'Notificare noua';
                const fileCount = data.file?.length || 0;
                const body = fileCount > 0 
                    ? `${fileCount} fisier${fileCount !== 1 ? 'e' : ''}: ${data.file.map((f: any) => f.name).join(', ').substring(0, 100)}`
                    : data.notification.message || 'Ai o notificare noua';
                
                try {
                    new Notification(title, {
                        body,
                        tag: `notification-${data.notification.source}`,
                        icon: '/icon-192x192.png',
                        badge: '/icon-32x32.png'
                    });
                } catch (e) {
                    console.error('Notification error:', e);
                }
            }
        };

        const onConnect = () => {
            // Re-fetch counts on reconnect using socketRequest to ensure logic
            const filter: any = { status: 'new' };
            if (user?.workspaceId) filter.workspaceId = user.workspaceId;

            socketRequest('inbox:list', filter).then((res: any) => {
                if (res.success && res.data) {
                    setUnreadCount(res.data.length);
                }
            }).catch(() => {});
        };

        const handleUpdateNotif = (data: any) => {
            setNotifications(prev => prev.map(n => n.id === data.id ? { ...n, status: data.status } : n));
            if (data.status === 'read' || data.status === 'archived') {
                setUnreadCount(c => Math.max(0, c - 1));
                if (view === 'new') {
                    setNotifications(prev => prev.filter(n => n.id !== data.id));
                }
            }
        };

        socket.on('inbox:new-notification', handleNewNotif);
        socket.on('inbox:notification-updated', handleUpdateNotif);
        socket.on('connect', onConnect);
        
        // Initial fetch for count
        if (socket.connected) {
            onConnect();
        } else {
            onConnect(); // socketRequest inside onConnect will trigger connection
        }

        return () => {
            socket.off('inbox:new-notification', handleNewNotif);
            socket.off('inbox:notification-updated', handleUpdateNotif);
            socket.off('connect', onConnect);
        };
    }, [socket, user?.workspaceId]);

    const markAsRead = (id: string) => {
        if (!socket) return;
        socket.emit('inbox:update-status', { id, status: 'read' }, (res: any) => {
            if (res.success) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
                if (view === 'new') {
                    setNotifications(prev => prev.filter(n => n.id !== id));
                }
                setUnreadCount(c => Math.max(0, c - 1));
            }
        });
    };

    const deleteNotification = (id: string) => {
        if (!socket) return;
        socket.emit('inbox:delete', { id }, (res: any) => {
            if (res.success) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                setUnreadCount(prev => {
                    const wasUnread = notification.find(n => n.id === id)?.status === 'new';
                    return wasUnread ? Math.max(0, prev - 1) : prev;
                });
                toast.success("Notificare ștearsă");
            }
        });
    };

    const addToPrintQueue = (notif: any) => {
        if (!socket) return;
        socket.emit('inbox:get-file', { notificationId: notif.id }, (res: any) => {
            if (res.success && res.data) {
                // Get existing queue
                const storedQueue = localStorage.getItem('print_queue');
                const currentQueue = storedQueue ? JSON.parse(storedQueue) : [];
                
                const newJobs = res.data.map((file: any) => {
                    const baseUrl = '/api/file/view?path=';
                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        file: { 
                            name: file.filename, 
                            size: file.file_size,
                            type: file.mimetype || 'application/octet-stream' // Use actual mimetype
                        },
                        fileUrl: `${baseUrl}${encodeURIComponent(file.path)}`,
                        previewUrl: file.previewPath ? `${baseUrl}${encodeURIComponent(file.previewPath)}` : undefined,
                        remotePath: file.path,
                        copies: 1,
                        pagesBW: 1,
                        pagesColor: 0,
                        numPages: 1,
                        senderInfo: {
                            name: notif.senderName,
                            phone: notif.senderId,
                            source: notif.source
                        },
                        addedAt: new Date().toISOString()
                    };
                });

                localStorage.setItem('print_queue', JSON.stringify([...currentQueue, ...newJobs]));
                
                window.dispatchEvent(new CustomEvent('print-queue-updated'));
                
                toast.success(`Adăugat ${res.data.length} fișiere în lista de printare`);
                markAsRead(notif.id);
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative group hover:bg-primary/10 transition-colors h-8 w-8">
                        <Bell className={cn("h-4 w-4 transition-transform group-hover:scale-110", unreadCount > 0 ? "text-amber-500" : "text-slate-400")} />
                        {unreadCount > 0 && (
                            <div className="absolute -top-2 -right-2 min-w-[20px] h-5 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center text-xs font-bold shadow-sm bg-amber-500 text-white animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent 
                className={cn(
                    "sm:max-w-[420px] h-screen fixed top-0 right-0 left-auto translate-x-0 translate-y-0 rounded-none border-y-0 border-r-0 border-l flex flex-col p-0 gap-0 pointer-events-auto shadow-2xl z-[100]")}
                showCloseButton={false}
            >
                <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-muted/30">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Archive size={20} className="text-primary" />
                        Inbox Notificări
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Gestionați fișierele primite prin WhatsApp și Gmail pentru printare.
                    </DialogDescription>
                    <div className="flex items-center gap-1">
                        <Button 
                            variant={view === 'new' ? "secondary" : "ghost"} 
                            size="sm" 
                            className="h-8 px-2 text-xs font-bold"
                            onClick={() => setView('new')}
                        >
                            Noi
                        </Button>
                        <Button 
                            variant={view === 'history' ? "secondary" : "ghost"} 
                            size="sm" 
                            className="h-8 px-2 text-xs font-bold"
                            onClick={() => setView('history')}
                        >
                            Istoric
                        </Button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Setări Inbox">
                            <Settings size={16} className="text-muted-foreground" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading && notification.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary/40" />
                            <p className="text-sm font-medium">Se încarcă notificările...</p>
                        </div>
                    ) : notification.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center p-8">
                            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                <Bell className="h-8 w-8 opacity-20" />
                            </div>
                            <h3 className="font-semibold text-foreground mb-1">Nicio notificare momentan</h3>
                            <p className="text-xs max-w-[200px]">
                                Fișierele primite prin WhatsApp sau Gmail vor apărea automat aici.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {notification.map((n) => (
                                <div 
                                    key={n.id} 
                                    className={cn(
                                        "p-4 hover:bg-muted/40 transition-all cursor-pointer group relative border-l-2 border-transparent",
                                        n.status === 'new' && "bg-primary/5 border-l-primary"
                                    )}
                                    onClick={() => markAsRead(n.id)}
                                >
                                    <div className="flex gap-4">
                                        <div className={cn(
                                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                            n.source === 'whatsapp' ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"
                                        )}>
                                            {n.source === 'whatsapp' ? (
                                                <MessageSquare size={24} />
                                            ) : (
                                                <FileText size={24} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold truncate text-sm">
                                                    {n.senderName || n.senderId}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-muted px-1.5 py-0.5 rounded">
                                                    {formatTimeAgo(n.timestamp || n.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-1 mb-2 font-medium">
                                                {n.body || (n.source === 'whatsapp' ? 'Mesaj WhatsApp' : 'Email recepționat')}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                                                    {n.attachmentCount || 0} {n.attachmentCount === 1 ? 'fișier' : 'fișiere'}
                                                </Badge>
                                                {n.source === 'whatsapp' && (
                                                    <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">WhatsApp</span>
                                                )}
                                                {n.source === 'gmail' && (
                                                    <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Gmail</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2 px-1">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteNotification(n.id);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                        <div className="flex-1" />
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="h-8 text-xs border-dashed"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(n.id);
                                            }}
                                        >
                                            {n.status === 'new' ? 'Ascunde' : 'Marchează citit'}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            className="h-8 text-xs gap-1.5 shadow-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToPrintQueue(n);
                                            }}
                                        >
                                            <Printer size={14} />
                                            Print
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                        {constants.APP_NAME} Inbox
                    </span>
                    <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-primary text-xs font-bold"
                        onClick={() => {
                            if (window.confirm("Vrei să marchezi toate notificările noi ca citite?")) {
                                notification.forEach(n => {
                                    if (n.status === 'new') markAsRead(n.id);
                                });
                            }
                        }}
                    >
                        MARCHEAZĂ TOT CITIT
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

