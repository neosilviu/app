import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { useParams } from 'react-router';
import { Users, UserPlus, Shield, X, Check, Settings2, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn, renderString } from '~/lib/core';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "~/components/ui/dialog";
import { Separator } from '~/components/ui/separator';

interface UserTabProps {
    userList: any[];
    loading: boolean;
    inviteEmail: string;
    setInviteEmail: (s: string) => void;
    inviteRole: string;
    setInviteRole: (s: string) => void;
    handleInvite: (e?: React.FormEvent) => void;
    handleUpdateRole: (userId: string, role: string) => void;
    handleRemoveUser: (userId: string) => void;
    entity: any;
    workspaceId: string;
    api: any;
    toast: any;
    roles: Record<string, any>;
}

export const UserTab: React.FC<UserTabProps> = ({
    userList,
    loading,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    handleInvite,
    handleUpdateRole,
    handleRemoveUser,
    entity,
    workspaceId,
    api,
    toast,
    roles
}) => {
    const { t } = useTranslation(['settings', 'common']);
    const { lang } = useParams();
    const [editingPermissions, setEditingPermissions] = useState<any>(null);
    const [userPermissions, setUserPermissions] = useState<any>({});
    const [saving, setSaving] = useState(false);

    const availableRoles = Object.entries(roles || {})
        .map(([id, cfg]: [string, any]) => ({
            id,
            label: renderString(cfg.label || id, lang),
            description: renderString(cfg.description, lang),
        }))
        .filter(r => r.id !== 'superadmin'); // Only hide superadmin from workspace views

    const entityList = Object.entries(entity || {}).map(([id, cfg]: [string, any]) => ({
        id,
        label: renderString(cfg.label || id, lang),
        icon: cfg.icon
    })).sort((a, b) => a.id.localeCompare(b.id)); // Alphabetical for better UX

    const openPermissions = async (user: any) => {
        setEditingPermissions(user);
        const targetId = user.userId || user.id;
        const targetRole = user.role || 'member';
        const roleDef = roles[targetRole] || roles.member || { permission: [] };
        
        try {
            const res = await api.brain.get(`workspace/user-permission?userId=${targetId}&workspaceId=${workspaceId}`);
            
            // Enterprise Level 10: Initialize with Role-Based Defaults
            const basePermissions: any = {};
            entityList.forEach(ent => {
                const entityId = ent.id;
                basePermissions[entityId] = {
                    read: roleDef.permission.includes(`${entityId}:read`) || roleDef.permission.includes('*'),
                    create: roleDef.permission.includes(`${entityId}:create`) || roleDef.permission.includes('write') || roleDef.permission.includes('*'),
                    update: roleDef.permission.includes(`${entityId}:update`) || roleDef.permission.includes('write') || roleDef.permission.includes('*'),
                    delete: roleDef.permission.includes(`${entityId}:delete`) || roleDef.permission.includes('*'),
                };
            });

            if (res.success) {
                // Merge Role Defaults with User Specific Overrides
                setUserPermissions({
                    ...basePermissions,
                    ...(res.permission || {})
                });
            } else {
                setUserPermissions(basePermissions);
            }
        } catch (e) {
            console.error("[USER-TAB] Failed to fetch user permission", e);
            setUserPermissions({});
        }
    };

    const handleTogglePermission = (entityId: string, action: string) => {
        const current = { ...(userPermissions[entityId] || { read: false, create: false, update: false, delete: false }) };
        current[action] = !current[action];
        
        setUserPermissions({
            ...userPermissions,
            [entityId]: current
        });
    };

    const savePermissions = async () => {
        if (!editingPermissions) return;
        setSaving(true);
        try {
            console.log("[USER-TAB] Saving permissions for:", editingPermissions.id, userPermissions);
            const res = await api.brain.post(`workspace/update-user-permission`, {
                workspaceId,
                userId: editingPermissions.userId || editingPermissions.id,
                permission: userPermissions
            });
            
            if (res.success) {
                toast.success(t('settings:user.permission_updated'));
                setEditingPermissions(null);
            } else {
                toast.error(res.error || t('common:error_saving'));
            }
        } catch (e: any) {
            console.error("[USER-TAB] Save error:", e);
            const errorMsg = e.response?.data?.error || e.message || t('common:error_saving');
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Invite Section */}
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                <CardHeader className="bg-slate-50/50">
                    <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t('settings:user.invite_title')}</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-medium mt-1">{t('settings:user.invite_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{t('common:email')}</Label>
                            <Input 
                                value={inviteEmail} 
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="h-12 rounded-2xl bg-slate-50 border-none"
                            />
                        </div>
                        <div className="md:w-48 space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{t('settings:user.role')}</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    {availableRoles.map(role => (
                                        <SelectItem key={role.id} value={role.id} className="rounded-xl">
                                            {renderString(role.label, lang)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" className="h-12 w-full md:w-auto px-8 rounded-2xl bg-slate-900 font-black uppercase italic tracking-widest text-[10px]">
                                <UserPlus className="mr-2 h-4 w-4" />
                                {t('settings:user.send_invite')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Users List */}
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t('settings:user.team_members')}</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-medium mt-1">{t('settings:user.members_desc')}</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-slate-200 font-black uppercase text-[9px]">{userList.length} {t('settings:user.active_users')}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400 font-bold uppercase italic text-xs animate-pulse">
                                Loading team members...
                            </div>
                        ) : userList.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-bold uppercase italic text-xs">
                                No members found.
                            </div>
                        ) : (
                            userList.map((member) => (
                                <div key={member.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-100 to-white border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden shadow-sm">
                                            {member.image ? (
                                                <img src={member.image} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <Users size={20} />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-black uppercase italic tracking-tight text-slate-900">{member.name || member.email?.split('@')[0]}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.email}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            value={member.role || 'member'} 
                                            onValueChange={(val) => handleUpdateRole(member.userId || member.id, val)}
                                        >
                                            <SelectTrigger className="h-10 w-32 rounded-xl bg-white border border-slate-100 shadow-sm text-[10px] font-black uppercase italic">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                                {availableRoles.map(role => (
                                                    <SelectItem key={role.id} value={role.id} className="rounded-lg">
                                                        {renderString(role.label, lang)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100"
                                            onClick={() => openPermissions(member)}
                                            title="Edit Permissions"
                                        >
                                            <ShieldCheck size={18} />
                                        </Button>

                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-100"
                                            onClick={() => handleRemoveUser(member.userId || member.id)}
                                            title={t('common:delete')}
                                        >
                                            <Trash2 size={18} />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Permissions Editing Dialog */}
            <Dialog open={!!editingPermissions} onOpenChange={(open) => !open && setEditingPermissions(null)}>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden w-[95vw] max-w-4xl h-[85vh] flex flex-col bg-white ring-0 focus:ring-0 outline-none">
                    <DialogHeader className="p-6 md:p-8 bg-slate-900 text-white flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-white/10">
                                    <Shield className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">
                                        {t('settings:user.permission_title')}
                                    </DialogTitle>
                                    <DialogDescription className="text-white/60 font-medium text-[10px] md:text-xs">
                                        {t('settings:user.permission_desc', { name: editingPermissions?.name || editingPermissions?.email })}
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 p-4 md:p-10">
                        <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
                            {entityList.map((entity) => {
                                const perms = userPermissions[entity.id] || { read: false, create: false, update: false, delete: false };
                                return (
                                    <div key={entity.id} className="p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 bg-white transition-all hover:shadow-xl hover:shadow-slate-100/50 group">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-slate-50 shadow-inner flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                                    <Settings2 size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black uppercase italic tracking-tight text-slate-900 text-sm md:text-base">{renderString(entity.label, lang)}</h4>
                                                    <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{entity.id}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:flex md:items-center gap-2 md:gap-3">
                                                {['read', 'create', 'update', 'delete'].map((action) => (
                                                    <div 
                                                        key={action}
                                                        className={cn(
                                                            "flex items-center justify-center md:justify-start gap-2 px-3 py-2 md:px-4 md:py-2 rounded-xl transition-all cursor-pointer border select-none",
                                                            perms[action] 
                                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                                        )}
                                                        onClick={() => handleTogglePermission(entity.id, action)}
                                                    >
                                                        {perms[action] ? <Check size={12} className="stroke-[3]" /> : <X size={12} />}
                                                        <span className="text-[9px] md:text-[10px] font-black uppercase italic tracking-widest">{t(`common:permission.${action}`)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator className="bg-slate-100" />
                    
                    <DialogFooter className="p-4 md:p-6 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4 flex-shrink-0">
                        <p className="hidden md:block text-[9px] font-bold text-slate-400 uppercase italic tracking-tight max-w-xs xl:max-w-md">
                            {t('settings:user.permission_disclaimer')}
                        </p>
                        <div className="flex gap-3 w-full md:w-auto justify-center md:justify-end">
                            <Button variant="ghost" onClick={() => setEditingPermissions(null)} className="rounded-xl font-black uppercase italic text-[10px] flex-1 md:flex-none">
                                {t('common:cancel')}
                            </Button>
                            <Button 
                                onClick={savePermissions} 
                                className="rounded-xl px-10 bg-indigo-600 hover:bg-black text-white font-black uppercase italic text-[10px] shadow-lg shadow-indigo-200 flex-1 md:flex-none h-12"
                                disabled={saving}
                            >
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                {t('common:save')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
