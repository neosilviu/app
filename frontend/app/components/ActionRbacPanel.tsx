import React, { useState, useMemo, useEffect } from 'react';
import { Shield, Lock, Unlock, Database, RefreshCw, Save, Check, X, Search, Zap, Layers, Bug, Info } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { Badge } from '~/components/ui/badge';
import { GlassCard } from '~/components/ui/GlassCard';
import { Input } from '~/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '~/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { api, cn, renderString } from '~/lib/core';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function ActionRbacPanel() {
    const { lang } = useConfig();
    const { t } = useTranslation(['common', 'superadmin']);
    const { constants, refreshConfig } = useConfig();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    // Roles and Entities from the Context (Baseline)
    const systemRoles = constants?.SYSTEM_ROLE || {};
    const entities = constants?.ENTITY_CONFIG || {};
    
    // Convert registry to a local editable state
    const [permissionsState, setPermissionsState] = useState<Record<string, string[]>>({});

    useEffect(() => {
        const initialState: Record<string, string[]> = {};
        Object.keys(systemRoles).forEach(roleId => {
            initialState[roleId] = systemRoles[roleId].permission || [];
        });
        setPermissionsState(initialState);
    }, [systemRoles]);

    const roleIds = Object.keys(systemRoles);
    
    // Extract all modular actions
    const allActions = useMemo(() => {
        const actions: Array<{ 
            entityId: string, 
            actionId: string, 
            label: any, 
            description: any, 
            icon: string,
            isGlobal: boolean,
            permission: string 
        }> = [];

        Object.keys(entities).forEach(entityId => {
            const config = entities[entityId];
            if (config?.actions && Array.isArray(config.actions)) {
                config.actions.forEach((a: any) => {
                    actions.push({
                        entityId,
                        actionId: a.id,
                        label: a.label || a.id,
                        description: a.description,
                        icon: a.icon || 'Zap',
                        isGlobal: a.isGlobal || a.id.endsWith('-all'),
                        permission: `${entityId}:action:${a.id}`
                    });
                });
            }
        });

        return actions.filter(a => 
            !search || 
            a.entityId.toLowerCase().includes(search.toLowerCase()) || 
            a.actionId.toLowerCase().includes(search.toLowerCase()) ||
            renderString(a.label, lang).toLowerCase().includes(search.toLowerCase())
        );
    }, [entities, search, lang]);

    const togglePermission = (roleId: string, permission: string) => {
        setPermissionsState(prev => {
            const current = prev[roleId] || [];
            if (current.includes(permission)) {
                return { ...prev, [roleId]: current.filter(p => p !== permission) };
            } else {
                return { ...prev, [roleId]: [...current, permission] };
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save each role's permissions back to the registry
            for (const roleId of roleIds) {
                const updatedRole = {
                    ...systemRoles[roleId],
                    permission: permissionsState[roleId]
                };
                
                await api.brain.post('registry/save', {
                    namespace: 'SYSTEM_ROLE',
                    key: roleId,
                    value: updatedRole
                });
            }
            
            toast.success("Action Permissions updated successfully!");
            await refreshConfig(true);
        } catch (e: any) {
            toast.error("Failed to save permissions: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <Lock className="text-indigo-600" />
                        Action RBAC Editor
                        <Badge variant="outline" className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-200 uppercase text-[9px] font-black">Level 10</Badge>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Gestionare granulară a permisiunilor pentru acțiuni modulare v3.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                         <Input 
                            placeholder="Search actions or entities..." 
                            className="pl-9 h-11 rounded-xl bg-white border-slate-200 text-xs font-bold italic uppercase"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                         />
                    </div>
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 dark:shadow-none"
                    >
                        {saving ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <GlassCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100">
                                <TableHead className="w-[300px] px-6 py-4 font-black uppercase text-[10px] tracking-widest text-slate-400">Action / Entity</TableHead>
                                {roleIds.map(roleId => (
                                    <TableHead key={roleId} className="px-4 py-4 text-center font-black uppercase text-[10px] tracking-widest text-slate-400">
                                        <div className="flex flex-col items-center gap-1">
                                            <Shield size={14} style={{ color: systemRoles[roleId].color }} />
                                            {renderString(systemRoles[roleId].label, lang)}
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allActions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={roleIds.length + 1} className="h-32 text-center text-slate-400 font-bold italic">
                                        No modular actions found or matching your search.
                                    </TableCell>
                                </TableRow>
                            ) : allActions.map((a, idx) => (
                                <TableRow key={`${a.entityId}:${a.actionId}`} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors",
                                                a.isGlobal && "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                                            )}>
                                                {a.isGlobal ? <Layers size={16} /> : <Zap size={16} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black uppercase italic tracking-tighter text-slate-900">
                                                        {renderString(a.label, lang)}
                                                    </span>
                                                    <Badge variant="outline" className="text-[8px] h-4 px-1 leading-none font-bold bg-slate-100 border-none uppercase opacity-60">
                                                        {a.entityId}
                                                    </Badge>
                                                </div>
                                                <span className="text-[9px] font-medium text-slate-400 truncate max-w-[200px]">
                                                    {a.permission}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    {roleIds.map(roleId => {
                                        const rolePerms = permissionsState[roleId] || [];
                                        
                                        const checkAccessDetail = (perms: string[], entityId: string, permission: string) => {
                                            if (perms.includes('*')) return { allowed: true, inherited: true, source: '*' };
                                            if (perms.includes('workspace:manage')) return { allowed: true, inherited: true, source: 'workspace:manage' };
                                            if (perms.includes(`${entityId}:*`)) return { allowed: true, inherited: true, source: `${entityId}:*` };
                                            if (perms.includes(`${entityId}:action`)) return { allowed: true, inherited: true, source: `${entityId}:action` };
                                            if (perms.includes(permission)) return { allowed: true, inherited: false, source: permission };
                                            return { allowed: false, inherited: false, source: null };
                                        };

                                        const access = checkAccessDetail(rolePerms, a.entityId, a.permission);
                                        const isAllowed = access.allowed;
                                        const isInherited = access.inherited;
                                        
                                        return (
                                            <TableCell key={roleId} className="px-4 py-4 text-center">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex justify-center">
                                                                <Checkbox 
                                                                    disabled={isInherited}
                                                                    checked={isAllowed}
                                                                    onCheckedChange={() => togglePermission(roleId, a.permission)}
                                                                    className={cn(
                                                                        "h-5 w-5 rounded-md border-2 border-slate-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600",
                                                                        isInherited && "opacity-40 cursor-not-allowed border-indigo-200 bg-indigo-50"
                                                                    )}
                                                                />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-slate-900 text-white border-none rounded-lg p-2 text-[10px] font-bold uppercase tracking-widest">
                                                            {isInherited ? `Inherited from ${access.source}` : isAllowed ? "Granted (Exact)" : "Denied"}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </GlassCard>
            
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-amber-800">
                <Info size={20} className="shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                    <p className="font-black uppercase italic tracking-tight">Notă despre Securitate</p>
                    <p className="font-medium">Modificările aduse permisiunilor sunt salvate în Registry. Unele modificări pot necesita un restart al sesiunii utilizatorului pentru a se reflecta în UI. Permisiunile marcate cu <strong>*</strong> au prioritate și oferă acces la toate acțiunile.</p>
                </div>
            </div>
        </div>
    );
}
