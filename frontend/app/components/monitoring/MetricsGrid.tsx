import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Cpu, Activity, RotateCcw, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";

interface MetricsGridProps {
    localStats: any;
    workerStats: any;
    user: any;
    isSuper?: boolean;
    handleRestartWindows: () => void;
    handleRestartServer: () => void;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ 
    localStats, 
    workerStats, 
    user, 
    isSuper,
    handleRestartWindows, 
    handleRestartServer 
}) => {
    const { t } = useTranslation(['monitoring', 'common']);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* CPU Card */}
            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md rounded-3xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-400">{t("monitoring:local.cpu_load")}</CardTitle>
                    <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-500">
                        <Cpu className="h-5 w-5" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black italic">{localStats?.cpu?.load || '0%'}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400 truncate max-w-[120px]">{localStats?.cpu?.brand}</span>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100/50">
                            <div 
                                className="h-full bg-orange-500 transition-all duration-1000" 
                                style={{ width: localStats?.cpu?.load || '0%' }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <span>0%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Memory Card */}
            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md rounded-3xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-400">{t("monitoring:local.memory")}</CardTitle>
                    <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-500">
                        <Activity className="h-5 w-5" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black italic">{localStats?.memory?.percentage || '0%'}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400">{localStats?.memory?.used} / {localStats?.memory?.total}</span>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100/50">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-1000" 
                                style={{ width: localStats?.memory?.percentage || '0%' }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <span>0%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* OS Info Card */}
            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md rounded-3xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-400">{t("monitoring:local.os_uptime")}</CardTitle>
                    <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-500">
                        <RotateCcw className="h-5 w-5" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col">
                        <span className="text-2xl font-black italic tracking-tight">{localStats?.os?.uptime || 'N/A'}</span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400">{localStats?.os?.distro}</span>
                            <div className={cn(
                                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border",
                                localStats?.env === 'production' ? "border-orange-200 bg-orange-50 text-orange-600" : "border-emerald-200 bg-emerald-50 text-emerald-600"
                            )}>
                                {localStats?.env || 'DEV'}
                            </div>
                        </div>
                    </div>
                    {isSuper && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 w-full rounded-2xl border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 font-black uppercase italic tracking-widest text-[9px]"
                            onClick={handleRestartWindows}
                        >
                            <RotateCcw className="h-3 w-3 mr-2" />
                            {t("monitoring:local.restart_windows")}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Workers/Server Control Card */}
            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-md rounded-3xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-400">{t("monitoring:local.worker_status")}</CardTitle>
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Zap className="h-5 w-5" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col">
                        <span className="text-2xl font-black italic tracking-tight text-primary uppercase">{workerStats?.health || t('monitoring:common.unknown')}</span>
                        <span className="text-[9px] font-bold uppercase text-slate-400">
                            {Object.keys(workerStats?.workerStatus || {}).length} Services Tracked
                        </span>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 w-full rounded-2xl border-primary/20 hover:bg-primary/5 font-black uppercase italic tracking-widest text-[9px]"
                        onClick={handleRestartServer}
                    >
                        <RotateCcw className="h-3 w-3 mr-2" />
                        {t("monitoring:local.restart_server")}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};
