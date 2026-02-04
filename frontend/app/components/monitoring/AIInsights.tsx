import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Brain, Zap, Database, Activity, ShieldCheck, RefreshCcw, Play, Cpu, Bot, Sparkles, Github, Search, LayoutGrid } from "lucide-react";
import { GlassCard } from "~/components/ui/GlassCard";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";
import { useConfig } from "~/hooks/useConfig";

interface AIInsightsProps {
    aiStats: any;
    cloudflareStats: any;
    isAIOperating: boolean;
    handleSyncRAG: () => void;
    handleTestAIQuality: () => void;
    aiTestOutput: string | null;
    localStats: any;
}

export const AIInsights: React.FC<AIInsightsProps> = ({
    aiStats,
    cloudflareStats,
    isAIOperating,
    handleSyncRAG,
    handleTestAIQuality,
    aiTestOutput,
    localStats
}) => {
    const { t } = useTranslation(['monitoring', 'common']);
    const { constants } = useConfig();
    const configProviders = constants.AI_CONFIG?.providers || {};
    const ICON_MAP: Record<string, any> = { Brain, Zap, Cpu, Bot, Sparkles, Github, Search, LayoutGrid };

    const providers = aiStats?.providers || cloudflareStats?.aiStats?.providers || {};

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Object.entries(providers).slice(0, 4).map(([id, p]: [string, any]) => {
                    const isOnline = p.status === 'ONLINE';
                    const pDef = configProviders[id] || {};
                    const Icon = ICON_MAP[pDef.icon] || Sparkles;
                    
                    return (
                        <GlassCard key={id} className={cn(
                            "shadow-xl rounded-3xl transition-all border-l-4",
                            isOnline ? "border-emerald-500 shadow-emerald-500/5 bg-emerald-50/10" : "border-slate-200 shadow-slate-500/5"
                        )}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">{pDef.typeName || id}</CardTitle>
                                <Icon className={cn("h-4 w-4 transition-all", isOnline ? (pDef.iconColor || 'text-emerald-500 animate-pulse') : 'text-slate-200')} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black italic tracking-tight uppercase">{isOnline ? t('common:online') : t('common:offline')}</div>
                                <p className="text-[9px] text-slate-400 mt-1 uppercase font-black">{pDef.typeName || t("monitoring:ai.llm_engine")}</p>
                            </CardContent>
                        </GlassCard>
                    );
                })}

                <GlassCard className="shadow-xl shadow-blue-500/5 rounded-3xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">{t("monitoring:ai.knowledge_base")}</CardTitle>
                        <Database className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black italic tracking-tight">{aiStats?.vectorCount || cloudflareStats?.aiStats?.vectorCount || 0}</div>
                        <p className="text-[9px] text-primary/60 mt-1 uppercase font-black">{t("monitoring:ai.vector_embeddings")}</p>
                    </CardContent>
                </GlassCard>

                <GlassCard className="shadow-xl shadow-indigo-500/5 rounded-3xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">{t("monitoring:ai.active_agents")}</CardTitle>
                        <Activity className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black italic tracking-tight">{aiStats?.activeAgents || 0}</div>
                        <p className="text-[9px] text-indigo-600/60 mt-1 uppercase font-black">{t("monitoring:ai.total_sessions")}</p>
                    </CardContent>
                </GlassCard>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Diagnostics */}
                <Card className="md:col-span-1 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
                    <CardHeader className="bg-slate-50/50 pb-6">
                        <CardTitle className="flex items-center gap-3 text-sm font-black uppercase italic tracking-widest">
                            <ShieldCheck className="h-5 w-5 text-primary" /> {t("monitoring:ai.diagnostic_tools")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-8">
                        <div className="p-5 rounded-3xl border border-slate-100 bg-white shadow-sm space-y-3">
                            <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">{t("monitoring:ai.sync_rag")}</p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full h-11 gap-3 rounded-2xl border-primary/20 hover:bg-primary/5 font-black uppercase italic tracking-widest text-[10px]"
                                onClick={handleSyncRAG}
                                disabled={isAIOperating || localStats?.env === 'development'}
                            >
                                <RefreshCcw className={cn("h-4 w-4", isAIOperating && "animate-spin")} />
                                Reindex Knowledge
                            </Button>
                        </div>
                        <div className="p-5 rounded-3xl border border-slate-100 bg-white shadow-sm space-y-3">
                            <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">{t("monitoring:ai.quality_test")}</p>
                            <Button 
                                variant="default" 
                                size="sm" 
                                className="w-full h-11 gap-3 rounded-2xl bg-primary shadow-xl shadow-primary/20 font-black uppercase italic tracking-widest text-[10px]"
                                onClick={handleTestAIQuality}
                                disabled={isAIOperating}
                            >
                                <Play className="h-4 w-4 fill-current" />
                                Run Audit Path
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* AI Console */}
                <Card className="md:col-span-2 border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-950 flex flex-col h-[480px]">
                    <CardHeader className="bg-slate-900 px-8 py-4 border-b border-white/5 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                <span className="font-mono text-[10px] font-black uppercase italic text-emerald-500 tracking-[0.2em]">AI_CORE_X7_SYNAPSE</span>
                            </div>
                            <div className="flex gap-2">
                                <div className="h-3 w-3 rounded-full bg-white/5" />
                                <div className="h-3 w-3 rounded-full bg-white/5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden relative group">
                        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="h-full overflow-auto p-8 font-mono text-[11px] text-emerald-400/90 custom-scrollbar whitespace-pre-wrap leading-relaxed">
                            {aiTestOutput || t("monitoring:ai.ready_diagnostic") || "> SYSTEM_READY_FOR_DIAGNOSTIC..."}
                            <div className="inline-block h-3.5 w-2 bg-emerald-500 ml-2 animate-pulse align-middle" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
