import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Terminal as TerminalIcon, Search, Trash2, Filter, Activity, Maximize2, Eye } from 'lucide-react';
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";

interface LiveLogsProps {
    logs: any[];
    onClear: () => void;
}

export const LiveLogs: React.FC<LiveLogsProps> = ({
    logs,
    onClear
}) => {
    const { t } = useTranslation(['monitoring', 'common']);
    const [isAutoScroll, setIsAutoScroll] = React.useState(true);
    const [logSearchTerm, setLogSearchTerm] = React.useState("");
    const [maxLogs, setMaxLogs] = React.useState(500);
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isAutoScroll && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, isAutoScroll]);

    const filteredLogs = logs.filter(log => {
        if (!logSearchTerm) return true;
        const search = logSearchTerm.toLowerCase();
        return (
            log.message?.toLowerCase().includes(search) || 
            log.context?.toLowerCase().includes(search) ||
            log.level?.toLowerCase().includes(search)
        );
    });

    return (
        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-slate-900 border-slate-800 text-slate-100 flex flex-col h-[600px]">
            <CardHeader className="bg-slate-950/50 border-b border-white/5 py-4 px-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-red-500/10 text-red-500 animate-pulse">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xs font-black uppercase italic tracking-[0.2em] text-white">System Mainframe</CardTitle>
                            <CardDescription className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Agent Stream • TLS Encrypted</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-white/5">
                            <Input 
                                placeholder="Search stack..." 
                                value={logSearchTerm}
                                onChange={(e) => setLogSearchTerm(e.target.value)}
                                className="h-7 w-40 bg-transparent border-none text-[10px] uppercase font-black italic focus-visible:ring-0 placeholder:text-slate-700"
                            />
                            <Search className="h-3.5 w-3.5 text-slate-700 mr-2" />
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/10 text-slate-400" onClick={onClear}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed custom-scrollbar bg-slate-950/30">
                <div className="space-y-1">
                    {filteredLogs.map((log, i) => (
                        <div key={i} className="flex gap-4 group hover:bg-white/5 p-1 rounded transition-colors">
                            <span className="shrink-0 text-slate-600 font-bold opacity-50 group-hover:opacity-100">{log.timestamp?.split('T')[1]?.split('.')[0] || '00:00:00'}</span>
                            <span className={cn(
                                "shrink-0 font-black uppercase italic tracking-tighter w-12",
                                log.level === 'error' ? 'text-red-500' :
                                log.level === 'warning' ? 'text-amber-500' :
                                log.level === 'debug' ? 'text-blue-400' : 'text-emerald-500'
                            )}>
                                [{log.level || 'INFO'}]
                            </span>
                            <span className="shrink-0 text-indigo-400 font-bold uppercase tracking-widest text-[9px]">
                                {log.context || 'SYSTEM'}
                            </span>
                            <span className="text-slate-300 break-all font-medium whitespace-pre-wrap">{log.message}</span>
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </CardContent>
            <div className="bg-slate-950/80 border-t border-white/5 py-3 px-8 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase italic tracking-widest text-slate-500">Auto-Scroll</span>
                        <Switch checked={isAutoScroll} onCheckedChange={setIsAutoScroll} className="scale-75 data-[state=checked]:bg-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase italic tracking-widest text-slate-500">Buffer:</span>
                        <input 
                            type="number" 
                            value={maxLogs} 
                            onChange={(e) => setMaxLogs(parseInt(e.target.value))}
                            className="bg-transparent border-none text-[10px] font-black italic text-emerald-500 w-12 focus:outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-[9px] font-black uppercase italic tracking-[0.2em] text-emerald-500">Stream Active</span>
                </div>
            </div>
        </Card>
    );
};
