import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Cloud, Database, HardDrive, Brain, Zap, RotateCcw, CheckCircle2, Settings } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";

interface CloudTabProps {
    cloudflareStats: any;
}

export const CloudTab: React.FC<CloudTabProps> = ({ cloudflareStats }) => {
    const { t } = useTranslation(['monitoring', 'common']);

    const d1Usage = cloudflareStats?.usage?.d1Usage;
    const r2Usage = cloudflareStats?.usage?.r2Usage;
    const vectorizeUsage = cloudflareStats?.usage?.vectorizeUsage;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connection Status */}
                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto rounded-full bg-blue-500/10 p-5 w-20 h-20 flex items-center justify-center mb-4 transition-transform hover:scale-110">
                            <Cloud className={cn("h-10 w-10", cloudflareStats?.enabled ? "text-blue-500" : "text-slate-300")} />
                        </div>
                        <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t("monitoring:tabs.cloudflare")}</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400 mt-1">Cloud Sync Engine Status</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 px-8 pb-8">
                        {[
                            { label: t("monitoring:cloudflare.remote_env"), value: cloudflareStats?.env, variant: cloudflareStats?.env === 'production' ? 'destructive' : 'secondary' },
                            { label: t("monitoring:cloudflare.local_config"), value: cloudflareStats?.enabled ? t("monitoring:cloudflare.connected") : t("monitoring:cloudflare.disconnected"), active: cloudflareStats?.enabled },
                            { label: t("monitoring:cloudflare.brain_worker"), value: cloudflareStats?.brainEnabled ? t("monitoring:cloudflare.alive") : t("monitoring:cloudflare.down"), active: cloudflareStats?.brainEnabled }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-100/50">
                                <span className="text-[10px] font-black uppercase italic tracking-tight text-slate-500">{item.label}</span>
                                <Badge variant={item.variant as any || (item.active ? 'default' : 'outline')} className="uppercase text-[9px] font-black italic rounded-lg">
                                    {item.value || 'N/A'}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* D1 Runtime Usage */}
                <Card className="lg:col-span-2 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md border border-white">
                    <CardHeader className="bg-slate-50/50 pb-8 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black uppercase italic tracking-widest flex items-center gap-2">
                                <Database className="h-5 w-5 text-blue-500" /> {t("monitoring:cloudflare.d1_usage")}
                            </CardTitle>
                            <CardDescription className="text-[10px] uppercase font-medium mt-1">Real-time DB Operation Metrics</CardDescription>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-slate-400 italic tracking-widest">{t("monitoring:cloudflare.usage_period")}</p>
                            <p className="text-[11px] font-black text-blue-600 uppercase">{d1Usage?.period || "MONTHLY_CYCLE"}</p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        {d1Usage ? (
                            <div className="space-y-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {[
                                        { label: t("monitoring:cloudflare.requests_today"), val: d1Usage.requestsToday || 0, limit: '100k', color: 'text-slate-900' },
                                        { label: t("monitoring:cloudflare.total_requests"), val: d1Usage.totalRequests || 0, color: 'text-blue-500' },
                                        { label: t("monitoring:cloudflare.cpu_time"), val: d1Usage.cpuTime || 0, color: 'text-orange-500' },
                                        { label: t("monitoring:cloudflare.db_storage"), val: `${((cloudflareStats.usage.storage_bytes || 0) / 1024 / 1024).toFixed(2)} MB`, color: 'text-emerald-500' }
                                    ].map((stat, i) => (
                                        <div key={i} className="space-y-1 group">
                                            <p className="text-[10px] font-black uppercase italic tracking-tighter text-slate-400 group-hover:text-slate-600 transition-colors">{stat.label}</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className={cn("text-2xl font-black italic", stat.color)}>{stat.val}</p>
                                                {stat.limit && <p className="text-[10px] font-bold text-slate-300">/ {stat.limit}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-5 rounded-3xl bg-blue-50/50 border border-blue-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                            <span className="text-[10px] font-black uppercase italic tracking-widest text-blue-600">{t("monitoring:cloudflare.read_rows")}</span>
                                        </div>
                                        <span className="font-black italic text-slate-700">{cloudflareStats.usage.read_rows?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-5 rounded-3xl bg-orange-50/50 border border-orange-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                            <span className="text-[10px] font-black uppercase italic tracking-widest text-orange-600">{t("monitoring:cloudflare.write_rows")}</span>
                                        </div>
                                        <span className="font-black italic text-slate-700">{cloudflareStats.usage.write_rows?.toLocaleString() || 0}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-300 font-black uppercase italic tracking-[0.2em] text-xs border-2 border-dashed border-slate-100 rounded-3xl">
                                {t("monitoring:cloudflare.no_usage_data")}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* R2 Infrastructure */}
                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
                    <CardHeader className="bg-slate-50/50">
                        <CardTitle className="flex items-center gap-3 text-sm font-black uppercase italic tracking-widest">
                            <HardDrive className="h-5 w-5 text-emerald-500" /> {t("monitoring:cloudflare.r2_infra")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        {r2Usage?.buckets?.length > 0 ? (
                            r2Usage.buckets.map((bucket: any) => (
                                <div key={bucket.name} className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-black uppercase italic tracking-widest text-slate-900">{bucket.name}</p>
                                        <Badge className="text-[8px] font-black uppercase border-none bg-emerald-100 text-emerald-600 italic">{t("monitoring:cloudflare.standard")}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase italic">{t("monitoring:cloudflare.est_size")}</p>
                                            <p className="text-xl font-black italic text-slate-900">{bucket.size_formatted}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase italic">{t("monitoring:cloudflare.objects")}</p>
                                            <p className="text-xl font-black italic text-slate-900">{bucket.objects?.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/20">
                                <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">{t("monitoring:cloudflare.no_buckets")}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* AI / Vectorize Hub */}
                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
                    <CardHeader className="bg-slate-50/50">
                        <CardTitle className="flex items-center gap-3 text-sm font-black uppercase italic tracking-widest">
                            <Brain className="h-5 w-5 text-purple-500" /> {t("monitoring:cloudflare.ai_infra")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl shadow-purple-200 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-xl">
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase italic tracking-widest opacity-80">{t("monitoring:ai.vectorize_engine")}</p>
                                        <p className="text-sm font-black italic">{t("monitoring:ai.kb_sync")}</p>
                                    </div>
                                </div>
                                <Badge className="bg-emerald-400 text-slate-900 font-black border-none uppercase text-[8px] italic px-3">{vectorizeUsage?.status || "LIVE"}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/10 rounded-2xl p-4">
                                    <p className="text-[8px] font-black uppercase opacity-70 mb-1">{t("monitoring:ai.active_indexes")}</p>
                                    <p className="text-2xl font-black italic">{vectorizeUsage?.indexes || 0}</p>
                                </div>
                                <div className="bg-white/10 rounded-2xl p-4">
                                    <p className="text-[8px] font-black uppercase opacity-70 mb-1">{t("monitoring:ai.kv_namespaces")}</p>
                                    <p className="text-2xl font-black italic">{cloudflareStats?.usage?.kvUsage?.namespaces || 0}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">{t("monitoring:ai.live_capabilities")}</p>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { label: t("monitoring:ai.semantic_search"), ok: true },
                                    { label: t("monitoring:ai.prompt_eng"), ok: true },
                                    { label: t("monitoring:ai.context_window"), val: t("monitoring:common.optimized") }
                                ].map((cap, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-100">
                                        <span className="text-[11px] font-black uppercase italic tracking-tight text-slate-700">{cap.label}</span>
                                        {cap.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <span className="text-[9px] font-black text-blue-500 uppercase">{cap.val}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Config Dump */}
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
                <CardHeader className="bg-slate-900 py-4 px-8">
                    <CardTitle className="text-xs font-black uppercase italic tracking-[0.2em] text-white flex items-center gap-3">
                        <Settings className="h-4 w-4 text-slate-500" /> {t("monitoring:cloudflare.configuration")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid md:grid-cols-2 gap-3">
                        {Object.entries(cloudflareStats?.config || {}).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                                <code className="text-[10px] font-black uppercase italic text-blue-600">{key}</code>
                                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                                    {typeof val === 'string' && val.length > 20 ? '••••' + val.substring(val.length - 8) : String(val)}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
