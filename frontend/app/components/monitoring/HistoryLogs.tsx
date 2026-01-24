import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { History, Search, Filter, Trash2, Download } from 'lucide-react';
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";

interface HistoryLogsProps {
    logs: any[];
    loading: boolean;
    onFetch: (filters?: any) => void;
    onDownload: () => void;
    onClear: () => void;
}

export const HistoryLogs: React.FC<HistoryLogsProps> = ({
    logs,
    loading,
    onFetch,
    onDownload,
    onClear
}) => {
    const { t } = useTranslation(['monitoring', 'common']);
    const [search, setSearch] = React.useState("");

    React.useEffect(() => {
        onFetch();
    }, []);

    const filteredLogs = logs?.filter(log => 
        log.message?.toLowerCase().includes(search.toLowerCase()) ||
        log.level?.toLowerCase().includes(search.toLowerCase()) ||
        log.context?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
            <CardHeader className="bg-slate-50/50 pb-6 px-8 flex flex-row items-center justify-between">
                <div>
                   <CardTitle className="flex items-center gap-3 text-sm font-black uppercase italic tracking-widest leading-none">
                        <History className="h-5 w-5 text-primary" /> {t("monitoring:history.audit_trail")}
                    </CardTitle>
                </div>
                <div className="flex gap-4">
                    <div className="relative w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input 
                            placeholder={t("monitoring:history.search_events") || "Search events..."} 
                            className="h-10 pl-10 pr-4 rounded-2xl bg-white border-slate-100 text-[11px] font-black uppercase italic tracking-widest placeholder:text-slate-300"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-10 w-10 rounded-2xl bg-white border-slate-100 text-slate-400 hover:text-slate-600"
                        onClick={onDownload}
                        title={t("monitoring:history.export_json")}
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-10 w-10 rounded-2xl bg-slate-50 border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50/50"
                        onClick={onClear}
                        title={t("monitoring:history.clear_logs")}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[600px] overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
                            <tr className="border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black uppercase italic tracking-widest text-slate-400">{t("monitoring:history.time")}</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase italic tracking-widest text-slate-400">{t("monitoring:history.event")}</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase italic tracking-widest text-slate-400">{t("monitoring:history.resource")}</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase italic tracking-widest text-slate-400">{t("monitoring:history.user")}</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase italic tracking-widest text-slate-400">{t("monitoring:history.snapshot")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLogs.length > 0 ? filteredLogs.map((log: any, idx: number) => (
                                <tr key={idx} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-8 py-4">
                                        <p className="text-[10px] font-black italic tracking-tight">{new Date(log.created_at).toLocaleTimeString()}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">{new Date(log.created_at).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <Badge variant="outline" className={cn(
                                            "rounded-xl h-6 px-3 border-none font-black uppercase italic tracking-widest text-[9px]",
                                            log.event_type?.includes('UPDATE') ? 'bg-amber-100 text-amber-700' :
                                            log.event_type?.includes('DELETE') ? 'bg-red-100 text-red-700' :
                                            'bg-emerald-100 text-emerald-700'
                                        )}>
                                            {log.event_type}
                                        </Badge>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase italic text-slate-600">{log.entity_type}</span>
                                            <span className="text-[10px] font-mono text-slate-400 italic">#{log.entity_id}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="text-[10px] font-black italic text-slate-500">{log.user_id ? `UserID: ${log.user_id}` : 'SYSTEM'}</span>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex gap-2">
                                            {log.snapshot_before && (
                                                <Badge className="bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black italic tracking-widest px-2 py-0.5" title="Previous State">
                                                    {t("monitoring:history.pre")}
                                                </Badge>
                                            )}
                                            {log.snapshot_after && (
                                                <Badge className="bg-slate-900 text-white rounded-lg text-[9px] font-black italic tracking-widest px-2 py-0.5" title="Current State">
                                                    {t("monitoring:history.post")}
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <Filter className="h-10 w-10" />
                                            <p className="text-sm font-black uppercase italic tracking-widest">{t("monitoring:history.no_events")}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};
