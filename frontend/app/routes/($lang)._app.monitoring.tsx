import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Activity,  Database, Terminal as TerminalIcon, History, RefreshCcw, ChevronRight, Server } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { 
    api,
    socket,
    socketRequest,
    cn 
} from "~/lib/core";
import { useAuth } from "~/hooks/useAuth";
import { useSettings } from "~/hooks/useSettings";
import { useConfig } from "~/hooks/useConfig";
import { useNavigate, useParams } from "react-router";
import type { Route } from "./+types/($lang)._app.monitoring";

// Modular Components
import { MetricsGrid } from "~/components/monitoring/MetricsGrid";
import { WorkerGrid } from "~/components/monitoring/WorkerGrid";
import { LiveLogs } from "~/components/monitoring/LiveLogs";
import { DatabaseTab } from "~/components/monitoring/DatabaseTab";
import { HistoryLogs } from "~/components/monitoring/HistoryLogs";
import { DatabaseBrowserDialog } from "~/components/monitoring/DatabaseBrowserDialog";
import { useSmartBack } from '~/hooks/useSmartBack';

export async function loader({ params }: Route.LoaderArgs) {
    return {
        lang: params.lang
    };
}

export default function MonitoringPage() {
    const { t } = useTranslation(['common', 'monitoring']);
    const { user, hasPageAccess, hasPermission } = useAuth();
    const { settings } = useSettings();
    const config = useConfig();
    const navigate = useNavigate();
    const { lang } = useParams();

    const systemSettings = config?.constants?.SYSTEM_SETTING || {};
    const useLocalAgent = systemSettings.use_local_agent === true || systemSettings.use_local_agent === 1 || String(systemSettings.use_local_agent) === 'true';

    // Security check: Role-based page access & Local Agent dependency
    useEffect(() => {
        if (!config?.isInitialized) return;

        if (user && !hasPageAccess('monitoring')) {
            toast.error("Acces neautorizat la pagina de monitorizare");
            navigate(-1);
            return;
        }

        if (!useLocalAgent) {
            toast.error("Pagina de monitorizare necesită Agentul Local activ");
            navigate(`/${lang}/settings`);
        }
    }, [user, hasPageAccess, navigate, useLocalAgent, config?.isInitialized, lang]);
    
    // Monitoring Settings
    const syncHeavyData = settings?.sync_heavy_data;
    const maxBackups = settings?.max_backups;
    
    // Core System State
    const [localStats, setLocalStats] = useState<any>(null);
    const [dbStats, setDbStats] = useState<any>(null);
    const [workerStats, setWorkerStats] = useState<any>(null);
    const [storageStats, setStorageStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Logs State
    const [liveLogs, setLiveLogs] = useState<any[]>([]);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // Database Browser State
    const [browsingTable, setBrowsingTable] = useState<string | null>(null);
    const [browsingSource, setBrowsingSource] = useState<'local' | 'remote'>('local');

    // Database Actions State
    const [syncHeavyDataUI, setSyncHeavyDataUI] = useState(syncHeavyData);
    const [togglingSync, setTogglingSync] = useState(false);
    const [integrityResult, setIntegrityResult] = useState<any>(null);
    const [checkingIntegrity, setCheckingIntegrity] = useState(false);
    const [backups, setBackups] = useState<any[]>([]);
    const [creatingBackup, setCreatingBackup] = useState(false);
    const [maxBackupsUI, setMaxBackupsUI] = useState(maxBackups);
    const [isUpdatingMaxBackups, setIsUpdatingMaxBackups] = useState(false);

    // Update local UI state when Registry changes
    useEffect(() => {
        setSyncHeavyDataUI(syncHeavyData);
        setMaxBackupsUI(maxBackups);
    }, [syncHeavyData, maxBackups]);

    // Fetch Orchestrator
    const fetchData = async () => {
        if (refreshing) return;
        setRefreshing(true);
        
        // Fetch each piece independently to populate UI faster
        const jobs = [
            { req: "monitoring:local", setter: setLocalStats },
            { req: "monitoring:db", setter: setDbStats },
            { req: "monitoring:workers", setter: setWorkerStats },
            { req: "monitoring:storage", setter: setStorageStats },
            { req: "monitoring:settings:get", callback: (res: any) => {
                if (res.success) {
                    setSyncHeavyDataUI(res.data.syncHeavyData || syncHeavyData);
                }
            }}
        ];

        // Start all requests in parallel but process them as they arrive
        const localPromises = jobs.map(job => 
            socketRequest(job.req)
                .then(res => {
                    if (job.setter) job.setter(res.data || res);
                    if (job.callback) job.callback(res);
                })
                .catch(err => console.error(`[MONITOR] Error fetching ${job.req}:`, err))
        );

        await Promise.allSettled(localPromises);
        
        setRefreshing(false);
        setLoading(false);
    };

    const fetchBackups = async () => {
        try {
            const res = await socketRequest("monitoring:backups:list");
            if (res.success) setBackups(res.data || []);
        } catch (e) {}
    };

    // Database Handlers
    const handleToggleSync = async (enabled: boolean) => {
        setTogglingSync(true);
        try {
            // Update Registry directly instead of local state
            await socketRequest("monitoring:settings:update", { sync_heavy_data: enabled });
            toast.success(enabled ? "Cloud synchronization enabled" : "Cloud synchronization disabled");
        } catch (e) {
            toast.error("Failed to update sync setting");
        } finally {
            setTogglingSync(false);
        }
    };

    const handleSyncToD1 = async () => {
        toast.promise(socketRequest("monitoring:db:sync"), {
            loading: "Synchronizing local data to Cloud D1...",
            success: "Data synchronized successfully",
            error: "Synchronization failed"
        });
    };

    const handleCheckIntegrity = async () => {
        setCheckingIntegrity(true);
        try {
            const res = await socketRequest("monitoring:db:integrity");
            if (res.success) {
                setIntegrityResult(res.data);
                toast.success("Database integrity check complete");
            }
        } catch (e) {
            toast.error("Integrity check failed");
        } finally {
            setCheckingIntegrity(false);
        }
    };

    const handleRepairIntegrity = async () => {
        toast.promise(socketRequest("monitoring:db:repair"), {
            loading: "Repairing database links...",
            success: (res: any) => `Repaired ${res.data?.repaired || 0} issues`,
            error: "Repair failed"
        });
    };

    const handleCreateBackup = async () => {
        setCreatingBackup(true);
        try {
            const res = await socketRequest("monitoring:backups:create");
            if (res.success) {
                toast.success("Snapshot created successfully");
                fetchBackups();
            }
        } catch (e) {
            toast.error("Failed to create snapshot");
        } finally {
            setCreatingBackup(false);
        }
    };

    const handleUpdateMaxBackups = async () => {
        setIsUpdatingMaxBackups(true);
        try {
            const res = await socketRequest("monitoring:settings:update", { maxBackups });
            if (res.success) toast.success("Retention policy updated");
        } catch (e) {
            toast.error("Failed to update retention policy");
        } finally {
            setIsUpdatingMaxBackups(false);
        }
    };

    const handleRestoreBackup = async (filename: string) => {
        if (!confirm(`Are you sure you want to restore ${filename}? Current data will be overwritten.`)) return;
        
        toast.promise(socketRequest("monitoring:backups:restore", { filename }), {
            loading: "Restoring snapshot...",
            success: "System restored. Please refresh.",
            error: "Restore failed"
        });
    };

    const fetchHistoryLogs = async (filters: any = {}) => {
        setHistoryLoading(true);
        try {
            const res = await socketRequest("monitoring:audits", filters);
            setHistoryLogs(res.data || []);
        } catch (e) {
            toast.error(t("monitoring:local.fetch_logs_failed"));
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleDownloadAudits = () => {
        if (!historyLogs.length) {
            toast.error("No data to export");
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(historyLogs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `audit_trail_${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Audit trail exported");
    };

    const handleClearAudits = async () => {
        if (!confirm("Are you sure you want to PERMANENTLY clear all audit logs?")) return;
        try {
            const res = await socketRequest("monitoring:audits:clear");
            if (res.success) {
                toast.success("Audit logs cleared");
                setHistoryLogs([]);
            }
        } catch (e) {
            toast.error("Failed to clear logs");
        }
    };

    const handleRestartWorker = async (name: string) => {
        toast.promise(socketRequest("monitoring:worker:control", { name, action: 'restart' }), {
            loading: `Restarting ${name}...`,
            success: "Worker restarted",
            error: "Restart failed"
        });
    };

    const handleStopWorker = async (name: string) => {
        toast.promise(socketRequest("monitoring:worker:control", { name, action: 'stop' }), {
            loading: `Stopping ${name}...`,
            success: "Worker stopped",
            error: "Stop failed"
        });
    };

    const handleStartWorker = async (name: string) => {
        toast.promise(socketRequest("monitoring:worker:control", { name, action: 'start' }), {
            loading: `Starting ${name}...`,
            success: "Worker started",
            error: "Start failed"
        });
    };

    const handleRestartServer = async () => {
        if (!confirm("Restart Studio Local Agent? Connectivity will be lost for a few seconds.")) return;
        toast.promise(socketRequest("monitoring:server:restart"), {
            loading: "Restarting server...",
            success: "Restarting...",
            error: "Restart failed"
        });
    };

    const handleRestartWindows = async () => {
        if (!confirm("ATTENTION: This will restart the PHYSICAL SERVER. Are you sure?")) return;
        toast.promise(socketRequest("monitoring:os:restart"), {
            loading: "Initiating reboot...",
            success: "Server reboot initiated...",
            error: "Reboot failed"
        });
    };

    // Real-time Listeners
    useEffect(() => {
        // Initial fetch - Always run on mount to at least show Brain data
        fetchData();
        fetchBackups();

        // Also fetch when socket connects to get local agent data
        const onConnect = () => {
            console.log("[MONITOR] Socket connected, refreshing data...");
            fetchData();
        };

        socket.on("connect", onConnect);

        const handleLog = (log: any) => {
            setLiveLogs(prev => [log, ...prev].slice(0, 500));
        };

        const handleWorkerStatus = (msg: any) => {
            if (!msg?.workerName) return;
            setWorkerStats((prev: any) => {
                if (!prev?.workerStatus) return prev;
                return {
                    ...prev,
                    workerStatus: {
                        ...prev.workerStatus,
                        [msg.workerName]: { ...prev.workerStatus[msg.workerName], status: msg.status || 'unknown' }
                    }
                };
            });
        };

        socket.on("system:log", handleLog);
        socket.on('gmail:status', handleWorkerStatus);
        socket.on('whatsapp:status', handleWorkerStatus);
        
        return () => {
            socket.off("connect", onConnect);
            socket.off("system:log", handleLog);
            socket.off('gmail:status');
            socket.off('whatsapp:status');
        };
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-muted-foreground font-medium animate-pulse">{t("monitoring:loading_dashboard")}</p>
            </div>
        );
    }

    if (!user || !hasPageAccess('monitoring')) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] p-4">
                <Card className="w-full max-w-md border-destructive/20 bg-destructive/5 backdrop-blur-sm shadow-xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl font-bold text-destructive">{t("monitoring:access_denied")}</CardTitle>
                        <CardDescription>{t("monitoring:admin_required")}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center pb-6">
                        <Button variant="outline" onClick={() => window.history.back()}>
                            <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                            {t("common:back")}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight uppercase italic">{t("monitoring:title")}</h1>
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                            localStats?.env === 'production' 
                                ? "bg-orange-500/10 text-orange-600 border-orange-200" 
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                        )}>
                            <div className={cn("h-1 w-1 rounded-full animate-pulse", localStats?.env === 'production' ? "bg-orange-600" : "bg-emerald-600")} />
                            {localStats?.env || 'DEV'}
                        </div>
                    </div>
                    <p className="text-muted-foreground">{t("monitoring:subtitle")}</p>
                </div>
                
                <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing} className="h-9">
                    <RefreshCcw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                    {t("monitoring:refresh_all")}
                </Button>
            </div>

            <Tabs defaultValue="system" className="space-y-6" onValueChange={(val) => {
                if (val === 'logs-history') fetchHistoryLogs();
            }}>
                <div className="sticky top-0 z-20 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/50 p-2 backdrop-blur-xl dark:bg-slate-900/50">
                    <TabsList className="grid h-12 w-full grid-cols-2 gap-2 bg-transparent lg:grid-cols-4">
                        <TabsTrigger value="system" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-medium">
                            <Server className="mr-2 h-4 w-4" />
                            <span className="hidden lg:inline">{t("monitoring:tabs.system")}</span>
                        </TabsTrigger>
                        <TabsTrigger value="database" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-medium">
                            <Database className="mr-2 h-4 w-4" />
                            <span className="hidden lg:inline">{t("monitoring:tabs.database")}</span>
                        </TabsTrigger>
                        <TabsTrigger value="logs-history" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-medium">
                            <History className="mr-2 h-4 w-4" />
                            <span className="hidden lg:inline">{t("monitoring:tabs.history")}</span>
                        </TabsTrigger>
                        <TabsTrigger value="logs-live" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-medium text-red-500">
                            <TerminalIcon className="mr-2 h-4 w-4" />
                            <span className="hidden lg:inline">{t("monitoring:tabs.live_logs")}</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="system" className="space-y-6">
                    <MetricsGrid 
                        localStats={localStats} 
                        workerStats={workerStats} 
                        user={user} 
                        isSuper={hasPermission('*')}
                        handleRestartWindows={handleRestartWindows}
                        handleRestartServer={handleRestartServer}
                    />
                    <WorkerGrid 
                        workerStats={workerStats} 
                        handleRestartWorker={handleRestartWorker}
                        handleStopWorker={handleStopWorker}
                        handleStartWorker={handleStartWorker}
                    />
                </TabsContent>

                <TabsContent value="database">
                    <DatabaseTab 
                        dbStats={dbStats} 
                        localStats={localStats} 
                        syncHeavyData={syncHeavyDataUI}
                        togglingSync={togglingSync}
                        handleToggleSync={handleToggleSync}
                        handleSyncToD1={handleSyncToD1}
                        handleBrowseTable={(table, source) => {
                            setBrowsingTable(table);
                            setBrowsingSource(source);
                        }}
                        integrityResult={integrityResult}
                        checkingIntegrity={checkingIntegrity}
                        handleCheckIntegrity={handleCheckIntegrity}
                        handleRepairIntegrity={handleRepairIntegrity}
                        backups={backups}
                        creatingBackup={creatingBackup}
                        handleCreateBackup={handleCreateBackup}
                        maxBackups={maxBackupsUI}
                        setMaxBackups={setMaxBackupsUI}
                        handleUpdateMaxBackups={() => {
                            setIsUpdatingMaxBackups(true);
                            // Update Registry when saving
                            socketRequest("monitoring:settings:update", { max_backups: maxBackupsUI })
                                .then(res => {
                                    if (res.success) toast.success("Retention policy updated");
                                })
                                .catch(() => toast.error("Failed to update retention policy"))
                                .finally(() => setIsUpdatingMaxBackups(false));
                        }}
                        isUpdatingMaxBackups={isUpdatingMaxBackups}
                        handleRestoreBackup={handleRestoreBackup}
                    />
                </TabsContent>

                <TabsContent value="logs-history">
                    <HistoryLogs 
                        logs={historyLogs} 
                        loading={historyLoading} 
                        onFetch={fetchHistoryLogs}
                        onDownload={handleDownloadAudits}
                        onClear={handleClearAudits}
                    />
                </TabsContent>

                <TabsContent value="logs-live">
                    <LiveLogs logs={liveLogs} onClear={() => setLiveLogs([])} />
                </TabsContent>
            </Tabs>

            <DatabaseBrowserDialog 
                open={!!browsingTable} 
                onOpenChange={(open) => !open && setBrowsingTable(null)}
                tableData={dbStats?.tables || []}
                initialTable={browsingTable}
            />
        </div>
    );
}

