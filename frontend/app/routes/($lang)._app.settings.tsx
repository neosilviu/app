import { type Route } from "../../.react-router/types/app/routes/+types/($lang)._app.settings";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { socket, api, socketRequest, debounce, renderString, getRegistry } from '~/lib/core';
import { getErrorMessage } from '~/lib/utils';
import { useAuth } from '~/hooks/useAuth';
import { useConfig } from '~/hooks/useConfig'; 
import { useTheme } from '~/hooks/useTheme'; 
import { toast } from 'sonner';
import { Building, Sparkles, Users, Save, Settings, ChevronLeft, ChevronRight, Cloud } from 'lucide-react';
import { ThemeEditor } from '~/components/ThemeSystem';
import { useTranslation } from 'react-i18next';
import { verifyAuth } from '~/lib/auth-core.server';
import { getDb } from '~/lib/d1.server';
import { useSmartBack } from '~/hooks/useSmartBack';

// --- SUB-COMPONENTS (OPTIMIZED) ---
import { GeneralTab } from '~/components/settings/GeneralTab';
import { AITab } from '~/components/settings/AITab';
import { UserTab } from '~/components/settings/UserTab';
import { CloudTab } from '~/components/monitoring/CloudTab';
import { AIInsights } from '~/components/monitoring/AIInsights';

export async function loader({ params, request, context }: Route.LoaderArgs) {
    const env = (context as any).cloudflare?.env || (process as any).env;
    const user = await verifyAuth(request, env);
    
    if (!user) return { lang: params.lang, permission: [] };

    const db = getDb(env);
    
    // Level 8: Always load registry for baseline defaults
    const registry = await getRegistry(db);
    
    // Fetch data in parallel to optimize load time (Enterprise Level 8)
    let workspace = null;
    
    // Enterprise Level 8: Initialize with Baseline values as defaults
    let systemSettings: Record<string, any> = { 
        ...registry.SYSTEM_SETTING,
        // Map common namespaces for UI components
        ai: registry.AI_CONFIG,
        theme: registry.THEME,
        auth: registry.AUTH_CONFIG,
        whatsapp: registry.whatsapp || registry.INTEGRATION?.whatsapp,
        gmail: registry.gmail || registry.INTEGRATION?.gmail,
        SYSTEM_SETTING: registry.SYSTEM_SETTING
    };

    const userRoleDef = (registry?.SYSTEM_ROLE || {})[user.role];
    const isGlobal = userRoleDef?.permission?.includes('*');

    try {
        // Use Promise.all for parallel fetches
        const promises: any[] = [
            db.get("workspace", user.workspaceId)
        ];

        if (isGlobal) {
            promises.push(db.query('SELECT namespace, key, value, dataType FROM SYSTEM_SETTING'));
        }

        const results = await Promise.allSettled(promises);

        workspace = results[0].status === 'fulfilled' ? (results[0].value as any) : null;

        if (isGlobal && results[1]?.status === 'fulfilled') {
            const sysRows = (results[1].value as any) || [];
            sysRows.forEach((row: any) => {
                const rawNs = row.namespace || 'SYSTEM_SETTING';
                const ns = rawNs.toLowerCase(); // Lowercase for UI consistency (gmail, whatsapp, etc.)
                if (!systemSettings[ns]) systemSettings[ns] = {};
                
                let value = row.value;
                try {
                    if (row.dataType === 'json' || (typeof row.value === 'string' && (row.value.startsWith('{') || row.value.startsWith('[')))) {
                        value = JSON.parse(row.value);
                    } else if (row.dataType === 'boolean' || value === 'true' || value === 'false') {
                        value = value === 'true' || value === '1' || value === 1;
                    } else if (row.dataType === 'number' || (!isNaN(Number(value)) && String(value).trim() !== '')) {
                        value = Number(value);
                    }
                } catch (e) {
                    value = row.value;
                }

                systemSettings[ns][row.key] = value;
                
                // For backward compatibility and UI simplicity, map core namespaces to root (Enterprise Level 8)
                if (ns === 'system_setting' || ns === 'general' || ns === 'system') {
                    systemSettings[row.key] = value;
                }
            });
        }
    } catch (e) {
        console.error("[SETTINGS-LOADER] Error fetching data:", e);
    }

    const setting = workspace?.setting ? (typeof workspace.setting === 'string' ? JSON.parse(workspace.setting) : workspace.setting) : {};

    return {
        lang: params.lang,
        timestamp: Date.now(),
        systemSettings,
        initialSettings: {
            id: workspace?.id,
            workspaceId: workspace?.id,
            workspaceName: workspace?.name,
            ...setting
        }
    };
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
    const navigate = useNavigate();
    const { lang } = useParams();
    const { initialSettings, systemSettings: initialSystemSettings = {} } = loaderData || {};
    const { user, hasPermission, hasPageAccess, switchWorkspace, userList, userLoading, fetchUserList } = useAuth();
    const { refreshConfig, constants: registry, entity: configEntities } = useConfig();
    const { t, i18n } = useTranslation(["common", "settings", "auth"]);
    
    // Security check: Role-based page access
    useEffect(() => {
        if (user && !hasPageAccess('settings')) {
            navigate(-1);
        }
    }, [user, hasPageAccess, navigate]);

    const [searchParams, setSearchParams] = useSearchParams();

    const workspaceId = useMemo(() => user?.workspaceId, [user?.workspaceId]);

    const [settings, setSettings] = useState<any>(initialSettings || {});
    const [systemSettings, setSystemSettings] = useState<any>(initialSystemSettings || {});
    const [whatsappState, setWhatsappState] = useState<{status: string, qr?: string}>({ status: 'INITIALIZING' });

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab ] = useState(searchParams.get("tab") || "local-agent");
    const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);

    // --- OPTIMISTIC AUTO-SAVE ENGINE ---
    const isFirstMount = useRef(true);
    const lastSavedSettings = useRef(JSON.stringify(settings));

    const debouncedSave = useMemo(() => 
        debounce(async (newSettings: any) => {
            const settingsStr = JSON.stringify(newSettings);
            if (settingsStr === lastSavedSettings.current) return;
            
            try {
                const response = await api.brain.post(`workspace/update-settings`, {
                    workspaceId: user?.workspaceId,
                    settings: newSettings
                });

                if (response.success) {
                    lastSavedSettings.current = settingsStr;
                    // Push to Local Agent
                    socketRequest('workspace:update-settings', { settings: newSettings }).catch(() => {
                        console.warn("Local sync pending...");
                    });
                }
            } catch (err) {
                console.error("Auto-save failed", err);
            }
        }, 2000),
    [user?.workspaceId]);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        debouncedSave(settings);
    }, [settings, debouncedSave]);

    useEffect(() => {
        // Request initial status when tab is local-agent
        if (activeTab === 'local-agent') {
            socket.emit('whatsapp:qr');
        }

        const handleStatus = (data: any) => {
            if (data.status) {
                setWhatsappState({ status: data.status, qr: data.qr });
            }
        };

        socket.on('whatsapp:status', handleStatus);
        socket.on('whatsapp:qr', (data: any) => {
            if (data.qr) {
                setWhatsappState(prev => ({ ...prev, status: 'QR_RECEIVED', qr: data.qr }));
            }
        });

        return () => {
            socket.off('whatsapp:status', handleStatus);
            socket.off('whatsapp:qr');
        };
    }, [activeTab]);

    const allTabs = useMemo(() => {
        const base = [
            'local-agent', 'ai', 'cloudflare'
        ];
        if (hasPermission('workspace:members:manage') || hasPermission('manage_user')) base.push('user');
        return base;
    }, [hasPermission]);

    const navigateTab = (direction: 'next' | 'prev') => {
        const currentIndex = allTabs.indexOf(activeTab);
        if (direction === 'next') {
            const nextIndex = (currentIndex + 1) % allTabs.length;
            setActiveTab(allTabs[nextIndex]);
        } else {
            const prevIndex = (currentIndex - 1 + allTabs.length) % allTabs.length;
            setActiveTab(allTabs[prevIndex]);
        }
    };

    const { theme: currentMode, setTheme: setMode, customTheme } = useTheme();

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Users Tab State
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");

    const [systemInfo, setSystemInfo] = useState<any>(null);
    const [cloudflareStats, setCloudflareStats] = useState<any>(null);
    const [aiStats, setAiStats] = useState<any>(null);
    const [isAIOperating, setIsAIOperating] = useState(false);
    const [aiTestOutput, setAiTestOutput] = useState<string | null>(null);

    // Guard maps to serialize concurrent registry.save calls per namespace+key
    const pendingSavePromises = useRef<Map<string, Promise<any>>>(new Map());
    const lastRequestedValues = useRef<Map<string, any>>(new Map());

    const updateSystemSetting = useCallback((key: string, value: any, namespace?: string) => {
        setSystemSettings((prev: any) => {
            const next = { ...prev };
            // Ensure namespace exists in state
            const ns = (namespace || 'SYSTEM_SETTING').toLowerCase();
            if (!next[ns]) next[ns] = {};
            next[ns][key] = value;

            // Root mirror for core settings (Enterprise Level 8 Consistency)
            if (ns === 'system_setting' || ns === 'general' || ns === 'system') {
                next[key] = value;
            }
            return next;
        });

        const ns = (namespace || 'SYSTEM_SETTING');
        const id = `${ns}::${key}`;
        lastRequestedValues.current.set(id, { value, namespace: ns });

        // If a save is already in-flight for this key, let it finish; it will re-check lastRequestedValues
        if (pendingSavePromises.current.has(id)) return;

        const sendSave = async () => {
            const latest = lastRequestedValues.current.get(id);
            // prepare payload from latest
            const payload = {
                namespace: latest?.namespace || ns,
                key,
                value: latest?.value,
                dataType: typeof (latest?.value) === 'boolean' ? 'boolean' : (typeof (latest?.value) === 'object' ? 'json' : 'string')
            };

            try {
                // Debug: log payload and target for diagnostics
                try { console.debug('[SETTINGS] registry/save ->', { id, payload, target: 'brain' }); } catch (e) {}
                const p = api.brain.post('registry/save', payload);
                pendingSavePromises.current.set(id, p);
                const res: any = await p;
                pendingSavePromises.current.delete(id);

                if (res && res.success) {
                    toast.success(t('common:saved'));
                    if (key === 'use_local_agent' || key === 'enable_worker') {
                        refreshConfig(true);
                    }
                } else {
                    toast.error(getErrorMessage(res?.error, t('common:error_saving')));
                }
            } catch (err) {
                pendingSavePromises.current.delete(id);
                console.error('[SETTINGS] Registry save failed:', err);
                toast.error(getErrorMessage(err, t('common:error_saving')));
            }

            // If during the save we got a newer requested value, send it now
            const nowLatest = lastRequestedValues.current.get(id);
            if (nowLatest && nowLatest.value !== payload.value) {
                // Schedule next send (loop)
                sendSave();
            }
        };

        // Kick off save
        sendSave();

    }, [t, refreshConfig]);

    useEffect(() => {
        if (activeTab === 'maintenance' || activeTab === 'local-agent') {
            // Prefer HTTP call to local agent first, fallback to socketRequest
            (async () => {
                try {
                    const res: any = await api.local.get('system/info');
                    if (res?.success) {
                        setSystemInfo(res.info || null);
                    } else {
                        const sock: any = await socketRequest('system:info').catch(() => null);
                        if (sock?.success) setSystemInfo(sock.info || null);
                    }
                } catch (e) {
                    const sock: any = await socketRequest('system:info').catch(() => null);
                    if (sock?.success) setSystemInfo(sock.info || null);
                }

                // system settings: try HTTP then socket
                try {
                    const sres: any = await api.local.get('system/get-settings');
                    if (sres?.success && sres.settings) {
                        setSystemSettings(sres.settings);
                    } else {
                        const ssock: any = await socketRequest('system:get-settings').catch(() => null);
                        if (ssock?.success && ssock.settings) setSystemSettings(ssock.settings);
                    }
                } catch (e) {
                    const ssock: any = await socketRequest('system:get-settings').catch(() => null);
                    if (ssock?.success && ssock.settings) setSystemSettings(ssock.settings);
                }
            })();
        }
        if (activeTab === 'cloudflare') {
            api.brain.get("monitoring/cloudflare").then(res => setCloudflareStats(res.data || res)).catch(() => {});
        }
        if (activeTab === 'ai') {
            api.brain.get("monitoring/ai").then(res => setAiStats(res.data || res)).catch(() => {});
        }
    }, [activeTab]);

    const handleSyncRAG = async () => {
        setIsAIOperating(true);
        try {
            const res = await api.brain.post("monitoring/ai/sync-rag", {});
            if (res.success) toast.success("Knowledge base re-indexed");
        } catch (e) {
            toast.error("RAG Sync failed");
        } finally {
            setIsAIOperating(false);
        }
    };

    const handleTestAIQuality = async () => {
        setAiTestOutput("");
        setIsAIOperating(true);
        try {
            const res = await socketRequest("ai:test-quality");
            if (!res.success) toast.error("AI Quality test failed");
        } catch (e) {
            toast.error("AI Quality test failed");
        } finally {
            setIsAIOperating(false);
        }
    };

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            const userToUpdate = userList.find(u => u.userId === userId || u.id === userId);
            const response = await api.brain.post(`workspace/add-user`, {
                workspaceId: user?.workspaceId,
                userId,
                role: newRole,
                email: userToUpdate?.email
            });
            if (response.success) {
                toast.success(t('settings:user.user_role_updated'));
                fetchUserList(true);
            }
        } catch (error) {
            toast.error(t('settings:user.failed_update_role'));
        }
    };

    const handleInvite = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inviteEmail) return;

        try {
            const response = await api.brain.post(`workspace/add-user`, {
                workspaceId: user?.workspaceId,
                email: inviteEmail,
                role: inviteRole
            });
            if (response.success) {
                toast.success(t('settings:user.user_added_success'));
                setInviteEmail("");
                fetchUserList(true);
            }
        } catch (error) {
            toast.error(t('settings:user.failed_add_user'));
        }
    };

    /**
     * CLEANUP: Removed handleSaveUserPermissions and translatedPermissions 
     * as UsersTab handles its own logic now.
     */

    // Track when we switch to user tab to avoid calling fetchUserList on every re-render
    const lastActiveTabRef = useRef(activeTab);
    const savingRef = useRef(false);

    useEffect(() => {
        if (!workspaceId) return;

        // Removed redundant fetchSettings, fetchRbac, fetchWorkspaces that were hitting the Brain API
        // which the loader already provides. This prevents a request storm on page load.
        
        // Only fetch user list when on the user tab
        if (activeTab === 'user') {
            fetchUserList();
        }
        lastActiveTabRef.current = activeTab;
        
        // Finalize loading state immediately if we have data or after a short delay
        if (initialSettings) {
             setLoading(false);
        } else {
            const timer = setTimeout(() => setLoading(false), 500);
            return () => clearTimeout(timer);
        }

    }, [workspaceId, user?.id, hasPermission, activeTab, initialSettings]);

    const handleSave = async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        try {
            const response = await api.brain.post(`workspace/update-settings`, {
                workspaceId: user?.workspaceId,
                settings
            });

            // ALSO save to Local Agent via Socket to ensure workers get the update immediately
            try {
                await socketRequest('workspace:update-settings', { settings });
            } catch (localErr) {
                console.warn("Failed to sync settings to Local Agent, but saved to Cloud.");
            }

            if (response.success) {
                toast.success(t('settings:settings_saved'));
            } else {
                toast.error(getErrorMessage(response.error, t('settings:failed_save')));
            }
        } catch (error) {
            toast.error(getErrorMessage(error, t('settings:failed_save')));
        } finally {
            savingRef.current = false;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Settings className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-muted-foreground font-medium animate-pulse">{renderString(t("common:loading"), lang)}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 pb-32">
            <div className="flex items-center justify-between mb-2">
                <div>
                   <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                       {renderString(t('settings:settings_title'), lang)}
                   </h1>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                       {renderString(t('settings:settings_desc'), lang)}
                   </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-slate-200 bg-white" onClick={() => navigateTab('prev')}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-slate-200 bg-white" onClick={() => navigateTab('next')}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="h-auto p-1 bg-slate-100/50 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-1 mb-8">
                    {[
                        { id: 'local-agent', label: renderString(t('settings:tabs.local_agent'), lang), icon: Building },
                        { id: 'ai', label: renderString(t('settings:tabs.ai'), lang), icon: Sparkles },
                        { id: 'cloudflare', label: renderString(t('settings:tabs.cloudflare'), lang), icon: Cloud },
                        { id: 'user', label: renderString(t('settings:tabs.user'), lang), icon: Users },
                    ].filter(tabItem => allTabs.includes(tabItem.id)).map((tab) => (
                        <TabsTrigger 
                            key={tab.id} 
                            value={tab.id}
                            className="rounded-xl py-3 font-black uppercase italic tracking-widest text-[10px] flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="local-agent" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <GeneralTab 
                        settings={settings}
                        setSettings={setSettings}
                        systemSettings={systemSettings}
                        setSystemSettings={setSystemSettings}
                        updateSystemSetting={updateSystemSetting}
                        systemInfo={systemInfo}
                        handleSave={handleSave}
                        whatsappState={whatsappState}
                    />
                </TabsContent>

                <TabsContent value="ai" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <AITab 
                        settings={settings}
                        setSettings={setSettings}
                        systemSettings={systemSettings}
                        setSystemSettings={setSystemSettings}
                        updateSystemSetting={updateSystemSetting}
                        aiStats={aiStats}
                        cloudflareStats={cloudflareStats}
                        isAIOperating={isAIOperating}
                        aiTestOutput={aiTestOutput}
                        handleSyncRAG={handleSyncRAG}
                        handleTestAIQuality={handleTestAIQuality}
                    />
                </TabsContent>

                <TabsContent value="cloudflare" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <CloudTab cloudflareStats={cloudflareStats} />
                </TabsContent>

                <TabsContent value="user" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <UserTab 
                        userList={userList}
                        loading={userLoading}
                        inviteEmail={inviteEmail}
                        setInviteEmail={setInviteEmail}
                        inviteRole={inviteRole}
                        setInviteRole={setInviteRole}
                        handleInvite={handleInvite}
                        handleUpdateRole={handleUpdateRole}
                        handleRemoveUser={async (uId) => {
                            if (confirm(t('settings:user.remove_confirm'))) {
                                try {
                                    const res = await api.brain.delete(`workspace/remove-user?userId=${uId}&workspaceId=${user?.workspaceId}`);
                                    if (res.success) {
                                        toast.success(t('settings:user.user_removed_success'));
                                        fetchUserList(true);
                                    }
                                } catch (e) { toast.error(t('settings:user.failed_remove_user')); }
                            }
                        }}
                        entity={configEntities || registry?.ENTITY_CONFIG || {}}
                        roles={registry?.SYSTEM_ROLE || registry?.AUTH_CONFIG?.role || {}}
                        workspaceId={user?.workspaceId || ""}
                        api={api}
                        toast={toast}
                    />
                </TabsContent>
            </Tabs>
            <ThemeEditor 
                isOpen={isThemeEditorOpen} 
                onClose={() => setIsThemeEditorOpen(false)} 
            />

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 px-6 md:px-12 z-50 flex items-center justify-end gap-4 animate-in slide-in-from-bottom duration-500">
                <Button 
                    variant="default" 
                    size="lg" 
                    onClick={handleSave} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 px-12 shadow-2xl shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-1 active:scale-95 font-black uppercase italic tracking-widest text-sm"
                >
                    <Save className="mr-2 h-5 w-5" />
                    {renderString(t("common:save"), lang)}
                </Button>
            </div>
        </div>
    );
}

