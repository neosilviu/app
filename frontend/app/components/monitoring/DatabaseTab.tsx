import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Database, Table2, Cloud, ShieldCheck, Archive, Search, Zap, AlertCircle, Save, RotateCcw, RefreshCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";
import { BufferedInput } from "~/components/ui/BufferedInput";

interface DatabaseTabProps {
    dbStats: any;
    localStats: any;
    syncHeavyData: boolean;
    togglingSync: boolean;
    handleToggleSync: (enabled: boolean) => void;
    handleSyncToD1: () => void;
    handleBrowseTable: (name: string, source: 'local' | 'remote') => void;
    integrityResult: any;
    checkingIntegrity: boolean;
    handleCheckIntegrity: () => void;
    handleRepairIntegrity: () => void;
    backups: any[];
    creatingBackup: boolean;
    handleCreateBackup: () => void;
    maxBackups: number;
    setMaxBackups: (v: number) => void;
    handleUpdateMaxBackups: () => void;
    isUpdatingMaxBackups: boolean;
    handleRestoreBackup: (filename: string) => void;
}

export const DatabaseTab: React.FC<DatabaseTabProps> = ({
    dbStats,
    localStats,
    syncHeavyData,
    togglingSync,
    handleToggleSync,
    handleSyncToD1,
    handleBrowseTable,
    integrityResult,
    checkingIntegrity,
    handleCheckIntegrity,
    handleRepairIntegrity,
    backups,
    creatingBackup,
    handleCreateBackup,
    maxBackups,
    setMaxBackups,
    handleUpdateMaxBackups,
    isUpdatingMaxBackups,
    handleRestoreBackup
}) => {
    const { t } = useTranslation(['monitoring', 'common']);

    return (
        <div className="space-y-6">
            {localStats?.env === 'development' && (
                <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase italic tracking-widest text-amber-900">{t("monitoring:database.dev_mode_notice_title") || "Development Mode"}</p>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed italic">{t("monitoring:database.dev_mode_notice") || "You are in development mode. Cloud synchronization is disabled. Data is stored only locally."}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tables & Distribution */}
                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
                    <CardHeader className="bg-slate-50/50 pb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                                <Table2 className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t("monitoring:database.distribution")}</CardTitle>
                                <CardDescription className="text-[10px] uppercase font-medium mt-1">{t("monitoring:database.distribution_desc")}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/20 hover:bg-slate-50/20 border-none">
                                    <TableHead className="px-8 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">{t("monitoring:database.table_name")}</TableHead>
                                    <TableHead className="h-12 text-right text-[10px] font-black uppercase tracking-widest text-blue-600">{t("monitoring:database.ssot_local")}</TableHead>
                                    <TableHead className="h-12 text-right text-[10px] font-black uppercase tracking-widest text-orange-500">{t("monitoring:database.brain_d1")}</TableHead>
                                    <TableHead className="px-8 h-12 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">{t("monitoring:database.action")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dbStats?.tables?.map((item: any, idx: number) => (
                                    <TableRow key={item.table || idx} className="hover:bg-slate-50/50 border-slate-50/50 border-b last:border-none transition-colors group">
                                        <TableCell className="px-8 py-4">
                                            <span className="font-black uppercase italic tracking-tight text-slate-700">
                                                {item.table ? item.table.replace(/_/g, ' ') : t("common:not_available")}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-mono font-black text-blue-600 text-xs">{item.counts?.local || 0}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-mono font-black text-orange-500 text-xs">{item.counts?.remote || 0}</span>
                                        </TableCell>
                                        <TableCell className="px-8 text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 rounded-xl text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleBrowseTable(item.table, 'local')}
                                            >
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* Sync & Integrity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500">
                                        <Cloud className="h-5 w-5" />
                                    </div>
                                    <Switch 
                                        checked={syncHeavyData} 
                                        onCheckedChange={handleToggleSync}
                                        disabled={togglingSync}
                                        className="data-[state=checked]:bg-orange-500"
                                    />
                                </div>
                                <div className="mt-4">
                                    <CardTitle className="text-xs font-black uppercase italic tracking-widest">{t("monitoring:database.cloud_sync")}</CardTitle>
                                    <CardDescription className="text-[9px] uppercase font-bold mt-1 leading-tight">{t("monitoring:database.cloud_sync_desc")}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={handleSyncToD1}
                                    className="w-full h-10 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-widest text-[10px] shadow-lg shadow-orange-200"
                                >
                                    {t("monitoring:database.sync_now")}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div className={cn(
                                        "p-2.5 rounded-2xl",
                                        integrityResult?.totalIssues > 0 ? "bg-red-500/10 text-red-500" : integrityResult ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                                    )}>
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                    {checkingIntegrity && <RefreshCcw className="h-4 w-4 animate-spin text-slate-400" />}
                                </div>
                                <div className="mt-4">
                                    <CardTitle className="text-xs font-black uppercase italic tracking-widest">{t("monitoring:database.integrity_title")}</CardTitle>
                                    <Badge variant="outline" className="mt-1 text-[8px] border-none bg-slate-100 uppercase font-black italic">
                                        {integrityResult ? `${integrityResult.totalIssues} Issues` : 'No check run'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleCheckIntegrity} className="h-9 flex-1 rounded-xl border-slate-200 font-bold uppercase italic text-[9px]">
                                    {t("monitoring:database.check")}
                                </Button>
                                {integrityResult?.totalIssues > 0 && (
                                    <Button onClick={handleRepairIntegrity} className="h-9 flex-1 rounded-xl bg-red-600 text-white font-bold uppercase italic text-[9px] shadow-lg shadow-red-200">
                                        {t("monitoring:database.repair_auto")}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Backups Integration */}
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-md">
                        <CardHeader className="bg-slate-50/50 pb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500">
                                        <Archive className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t("monitoring:backups.title")}</CardTitle>
                                        <CardDescription className="text-[10px] uppercase font-medium mt-1">Version Control & Rolling Recovery</CardDescription>
                                    </div>
                                </div>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={handleCreateBackup} 
                                    disabled={creatingBackup}
                                    className="h-9 rounded-2xl bg-purple-600 text-white hover:bg-purple-700 font-black uppercase italic tracking-widest text-[9px] px-4"
                                >
                                    {creatingBackup ? <RefreshCcw className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
                                    Snapshot
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="px-8 py-4 flex items-center justify-between border-b border-slate-50">
                                <span className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">Retention Limit</span>
                                <div className="flex items-center gap-2">
                                    <BufferedInput 
                                        type="number" 
                                        value={maxBackups} 
                                        onChange={(v) => setMaxBackups(parseInt(v))}
                                        className="h-7 w-16 text-center font-black italic text-purple-600 bg-purple-50 border-none rounded-lg text-xs"
                                    />
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-300 hover:text-purple-600" onClick={handleUpdateMaxBackups}>
                                        <Save className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                <Table>
                                    <TableBody>
                                        {backups.map((backup, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50/50 border-slate-50/50 border-b last:border-none group">
                                                <TableCell className="px-8 py-3.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black italic text-slate-700 truncate max-w-[200px]">{backup.name}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{backup.date || 'T-' + i}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-8 text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleRestoreBackup(backup.name)} className="h-8 rounded-xl text-purple-600 bg-purple-50 opacity-0 group-hover:opacity-100 transition-opacity font-black uppercase italic text-[9px]">
                                                        <RotateCcw className="h-3 w-3 mr-1.5" /> Restore
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
