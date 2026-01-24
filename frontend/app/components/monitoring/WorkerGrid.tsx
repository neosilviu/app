import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Zap, RotateCcw, Play, Square } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";

interface WorkerGridProps {
    workerStats: any;
    handleRestartWorker: (name: string) => void;
    handleStopWorker: (name: string) => void;
    handleStartWorker: (name: string) => void;
}

export const WorkerGrid: React.FC<WorkerGridProps> = ({ 
    workerStats, 
    handleRestartWorker, 
    handleStopWorker, 
    handleStartWorker 
}) => {
    const { t } = useTranslation(['monitoring', 'common']);

    const getStatusColor = (status: string, restriction: any) => {
        const ok = ['READY', 'running', 'CONNECTED', 'READY (API)', 'READY (IMAP)', 'ONLINE'].includes(status);
        const warning = ['restricted', 'METADATA_ONLY', 'limited', 'DEGRADED'].includes(status) || !!restriction;
        const pending = ['INITIALIZING', 'CONNECTING', 'AUTHENTICATING', 'QR_RECEIVED', 'SYNCING', 'processing', 'starting'].includes(status);
        
        if (ok) return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
        if (warning) return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]";
        if (pending) return "bg-blue-500 animate-pulse";
        return "bg-red-500";
    };

    return (
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
            <CardHeader className="bg-slate-50/50 pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t("monitoring:local.background_services")}</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-medium mt-1">{t("monitoring:local.background_description")}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/20 hover:bg-slate-50/20 border-none">
                            <TableHead className="px-8 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">{t("monitoring:local.service")}</TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">{t("monitoring:local.status")}</TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">{t("monitoring:local.memory")}</TableHead>
                            <TableHead className="px-8 h-12 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">{t("monitoring:local.action")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.keys(workerStats?.workerStatus || {}).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-48 text-center text-slate-400 font-bold uppercase italic text-xs tracking-widest">
                                    {t("monitoring:local.no_services")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            Object.entries(workerStats?.workerStatus || {}).map(([name, data]: [string, any]) => {
                                const status = (data && typeof data === 'object') ? data.status : (data || 'unknown');
                                const memory = (data && typeof data === 'object') ? data.memory : null;
                                const restriction = (data && typeof data === 'object') ? data.restriction : null;
                                const isRunning = status === 'running' || status === 'READY' || status === 'CONNECTED';

                                return (
                                    <TableRow key={name} className="hover:bg-slate-50/50 border-slate-50/50 transition-colors group">
                                        <TableCell className="px-8 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black uppercase italic tracking-tight text-slate-700">
                                                    {name.split(':')[0].replace(/-/g, ' ')}
                                                </span>
                                                {name.includes(':') && (
                                                    <span className="text-[10px] text-slate-400 font-mono font-bold">{name.split(':')[1]}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", getStatusColor(status, restriction))} />
                                                <div className="flex flex-col">
                                                    <Badge className={cn(
                                                        "text-[9px] font-black uppercase italic tracking-tighter px-2 h-5 rounded-lg border-none",
                                                        getStatusColor(status, restriction).includes('emerald') ? "bg-emerald-500" :
                                                        getStatusColor(status, restriction).includes('amber') ? "bg-amber-500" :
                                                        getStatusColor(status, restriction).includes('blue') ? "bg-blue-500" : "bg-red-500"
                                                    )}>
                                                        {status}
                                                    </Badge>
                                                    {restriction && (
                                                        <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest mt-1">{restriction.replace('_', ' ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {memory ? (
                                                <div className="flex flex-col gap-1.5 w-28">
                                                    <div className="flex justify-between text-[10px] font-black font-mono text-slate-500">
                                                        <span>{memory.rss}MB</span>
                                                        <span className="text-slate-300">/ {memory.limit}M</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={cn(
                                                                "h-full transition-all duration-500",
                                                                (memory.rss / memory.limit) > 0.8 ? "bg-red-500" : 
                                                                (memory.rss / memory.limit) > 0.6 ? "bg-amber-500" : "bg-primary"
                                                            )}
                                                            style={{ width: `${Math.min(100, (memory.rss / memory.limit) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-black italic uppercase">---</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-8 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-xl text-blue-500 hover:bg-blue-50"
                                                    onClick={() => handleRestartWorker(name)}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                                {isRunning ? (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-xl text-red-500 hover:bg-red-50"
                                                        onClick={() => handleStopWorker(name)}
                                                    >
                                                        <Square className="h-3.5 w-3.5 fill-current" />
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-xl text-emerald-500 hover:bg-emerald-50"
                                                        onClick={() => handleStartWorker(name)}
                                                    >
                                                        <Play className="h-3.5 w-3.5 fill-current" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
