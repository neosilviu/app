import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
    Printer, RefreshCcw, Settings, Search, Save, ChevronRight, Globe, Zap, HardDrive, Server, Shield, Activity, AlertCircle, CheckCircle2, Layers, RotateCcw, EyeOff, CheckSquare, Settings2, Plus, Minus, Loader2, Square, AlertTriangle, Info, Inbox, ListX, Star } from 'lucide-react';
import { Button } from "~/components/ui/button";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "~/components/ui/table";
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger
} from "~/components/ui/dialog";
import { toast } from "sonner";
import { cn } from '~/lib/core';
import { socketRequest, api } from "~/lib/core";
import { useAuth } from "~/hooks/useAuth";

interface HardwareManagerProps {
    prices: any;
    onPricesUpdate: (newPrices: any) => void;
}

export function HardwareManager({ prices, onPricesUpdate }: HardwareManagerProps) {
    const { t } = useTranslation(['common', 'printing']);
    const { user } = useAuth();
    
    const [printers, setPrinters] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPrinterNames, setSelectedPrinterNames] = useState<string[]>([]);
    const [showHidden, setShowHidden] = useState(false);
    
    const [isEditPrinterOpen, setIsEditPrinterOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<any>(null);
    const [editPending, setEditPending] = useState(false);

    const fetchPrinters = async () => {
        setLoading(true);
        try {
            const res = await socketRequest('printing:get-printers');
            if (res.success) {
                setPrinters(res.printers || []);
            } else {
                toast.error(t('printing:error_fetching_printers') + ': ' + (res.error || 'Unknown error'));
            }
        } catch (e: any) {
             toast.error(t('printing:error_fetching_printers') + ': ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrinters();
    }, []);

    const handleTestPrint = (printerName: string) => {
        toast.promise(socketRequest('printing:test-page', { printerName }), {
            loading: t("printing:testing_printer", { name: printerName }),
            success: t("printing:test_page_sent"),
            error: t("printing:test_page_error")
        });
    };

    const handleEditPrinter = (printer: any) => {
        setEditingPrinter({
            ...printer,
            Shared: !!printer.Shared,
            Published: !!printer.Published,
            Config: {
                ...printer.Config,
                Color: printer.Config?.Color === 1 || printer.Config?.Color === true,
                Collate: !!printer.Config?.Collate,
                DuplexingMode: printer.Config?.DuplexingMode || 'OneSided',
                PaperSize: printer.Config?.PaperSize || '',
                MediaType: printer.Config?.MediaType || '',
                MediaSource: printer.Config?.MediaSource || ''
            }
        });
        setIsEditPrinterOpen(true);
    };

    const handleSavePrinterSettings = async () => {
        if (!editingPrinter) return;
        setEditPending(true);
        try {
            const infoRes = await socketRequest('printing:update-printer-info', {
                printerName: editingPrinter.Name,
                info: {
                    Comment: editingPrinter.Comment || '',
                    Location: editingPrinter.Location || '',
                    Shared: !!editingPrinter.Shared,
                    Published: !!editingPrinter.Published
                }
            });

            const configRes = await socketRequest('printing:update-printer-config', {
                printerName: editingPrinter.Name,
                config: {
                    DuplexingMode: editingPrinter.Config?.DuplexingMode,
                    Color: !!editingPrinter.Config?.Color,
                    Collate: !!editingPrinter.Config?.Collate,
                    PaperSize: editingPrinter.Config?.PaperSize,
                    MediaType: editingPrinter.Config?.MediaType,
                    MediaSource: editingPrinter.Config?.MediaSource
                }
            });

            if (infoRes.success && configRes.success) {
                toast.success(t('printing:printer_updated_success'));
                setIsEditPrinterOpen(false);
                fetchPrinters();
            } else {
                toast.error(infoRes.error || configRes.error || t('printing:error_updating_printer'));
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setEditPending(false);
        }
    };

    const handleHideSelected = async () => {
        if (selectedPrinterNames.length === 0) return;
        
        const newHidden = [...(prices?.hiddenPrinters || [])];
        selectedPrinterNames.forEach(name => {
            if (!newHidden.includes(name)) newHidden.push(name);
        });

        const newConfig = { ...prices, hiddenPrinters: newHidden };
        try {
            const res = await api.local.post('system/printing/config', newConfig);
            if (res.success) {
                onPricesUpdate(newConfig);
                setSelectedPrinterNames([]);
                toast.success(t('printing:printers_hidden_success'));
            }
        } catch (e) {}
    };

    const handleUnhideAll = async () => {
        const newConfig = { ...prices, hiddenPrinters: [] };
        try {
            const res = await api.local.post('system/printing/config', newConfig);
            if (res.success) {
                onPricesUpdate(newConfig);
                toast.success(t('printing:all_printers_visible'));
            }
        } catch (e) {}
    };

    const handlePurgeJobs = async (printerName: string) => {
        if (!confirm(t('printing:purge_confirm'))) return;
        toast.promise(socketRequest('printing:purge-jobs', { printerName }), {
            loading: t('common:processing'),
            success: () => {
                fetchPrinters();
                return t('printing:jobs_purged');
            },
            error: (err) => err.message || "Error"
        });
    };

    const handleSetDefault = async (printerName: string) => {
        toast.promise(socketRequest('printing:set-default', { printerName }), {
            loading: t('common:processing'),
            success: () => {
                fetchPrinters();
                return t('printing:set_default_success');
            },
            error: (err) => err.message || "Error"
        });
    };

    const printersWithAlerts = printers.filter(p => p.Messages?.length > 0 && !(prices?.hiddenPrinters || []).includes(p.Name));

    return (
        <div className="space-y-6">
            {/* Unified Printer Alerts Bar */}
            {printersWithAlerts.length > 0 && (
                <Card className="bg-amber-50/50 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/30 overflow-hidden shadow-sm">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-500">
                                {t('printing:active_system_alerts')} ({printersWithAlerts.length})
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-100" onClick={fetchPrinters}>
                            {t('printing:check_again')}
                        </Button>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="flex flex-wrap gap-2">
                            {printersWithAlerts.map((p, idx) => (
                                <Badge key={idx} variant="outline" className="bg-white/80 dark:bg-slate-900/80 border-amber-200 text-amber-700 text-[9px] py-1 px-2 flex items-center gap-2 group cursor-help">
                                    <span className="font-black opacity-60">{p.Name}:</span>
                                    <span className="font-bold">{p.Messages[0]}</span>
                                    {p.Messages.length > 1 && <span className="text-[8px] opacity-40">+{p.Messages.length - 1} more</span>}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {(['superadmin', 'workspace_owner', 'workspace_admin'].includes(user?.role || '')) && (
                        <>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={cn("rounded-xl h-9 text-[10px] font-black uppercase tracking-widest transition-all", selectedPrinterNames.length > 0 ? "border-amber-200 text-amber-600 bg-amber-50" : "opacity-30 border-slate-200 text-slate-400")}
                                disabled={selectedPrinterNames.length === 0}
                                onClick={handleHideSelected}
                            >
                                <EyeOff className="mr-2 h-3.5 w-3.5" />
                                {t('printing:hide_selected')} ({selectedPrinterNames.length})
                            </Button>
                            {(prices?.hiddenPrinters?.length > 0) && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="rounded-xl h-9 text-[10px] font-black uppercase tracking-widest text-slate-400"
                                    onClick={() => setShowHidden(!showHidden)}
                                >
                                    {showHidden ? t('printing:view_normal') : `${t('printing:view_hidden')} (${prices.hiddenPrinters.length})`}
                                </Button>
                            )}
                            {showHidden && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="rounded-xl h-9 text-[10px] font-black uppercase tracking-widest text-emerald-600"
                                    onClick={handleUnhideAll}
                                >
                                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                    {t('printing:restore_all')}
                                </Button>
                            )}
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="rounded-xl h-9 text-slate-400" onClick={fetchPrinters} disabled={loading}>
                        <RefreshCcw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} />
                        {t('common:reload')}
                    </Button>
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest py-1 border-slate-200 text-slate-400">
                        {printers.filter(p => showHidden ? (prices?.hiddenPrinters || []).includes(p.Name) : !(prices?.hiddenPrinters || []).includes(p.Name)).length} {t('printing:visible_printers')}
                    </Badge>
                </div>
            </div>

            {printers.length === 0 ? (
                <Card className="border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl">
                    <Printer className="h-12 w-12 mb-4 opacity-10" />
                    <p className="text-sm font-medium">{t('printing:no_printers_found')}</p>
                    <Button variant="outline" size="sm" className="mt-4 rounded-xl px-6 h-9 font-black uppercase text-[10px] tracking-widest" onClick={fetchPrinters}>
                        <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                        {t('common:reload')}
                    </Button>
                </Card>
            ) : (
                <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                            <TableRow>
                                {(['superadmin', 'workspace_owner', 'workspace_admin'].includes(user?.role || '')) && (
                                    <TableHead className="w-[40px] pl-6">
                                        <Checkbox 
                                            checked={
                                                printers.length > 0 && 
                                                printers.every(p => selectedPrinterNames.includes(p.Name))
                                            }
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedPrinterNames(printers.map(p => p.Name));
                                                } else {
                                                    setSelectedPrinterNames([]);
                                                }
                                            }}
                                        />
                                    </TableHead>
                                )}
                                <TableHead className={cn("text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 w-[30%]", !(['superadmin', 'workspace_owner', 'workspace_admin'].includes(user?.role || '')) && "pl-6")}>{t('printing:printer_details')}</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-[15%]">{t('printing:status')}</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-[30%]">{t('printing:capabilities_config')}</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('printing:infrastructure')}</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">{t('printing:actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printers
                                .filter(p => showHidden ? (prices?.hiddenPrinters || []).includes(p.Name) : !(prices?.hiddenPrinters || []).includes(p.Name))
                                .map((printer, i) => (
                                <TableRow key={i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800">
                                    {(['superadmin', 'workspace_owner', 'workspace_admin'].includes(user?.role || '')) && (
                                        <TableCell className="pl-6">
                                            <Checkbox 
                                                checked={selectedPrinterNames.includes(printer.Name)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedPrinterNames([...selectedPrinterNames, printer.Name]);
                                                    } else {
                                                        setSelectedPrinterNames(selectedPrinterNames.filter(n => n !== printer.Name));
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className={cn("py-4", !(['superadmin', 'workspace_owner', 'workspace_admin'].includes(user?.role || '')) && "pl-6")}>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0">
                                                <Printer className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-[220px]">{printer.Name}</span>
                                                    {printer.Shared && <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] px-1 py-0 font-black uppercase">{t('printing:shared')}</Badge>}
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-1">
                                                    <span className="text-[9px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                                                        <HardDrive size={10} /> {printer.PortName || 'Local'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                                        <Settings size={10} /> {printer.DriverName}
                                                    </span>
                                                    {printer.Location && (
                                                        <span className="text-[9px] italic text-slate-400 flex items-center gap-1.5">
                                                            <Server size={10} /> {printer.Location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("h-1.5 w-1.5 rounded-full", printer.PrinterStatus === 0 ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest",
                                                    printer.PrinterStatus === 0 ? "text-emerald-500" : "text-amber-500"
                                                )}>
                                                    {printer.PrinterStatus === 0 ? t('printing:normal') : t('printing:warning')}
                                                </span>
                                            </div>
                                            
                                            <div className="flex flex-col gap-1 overflow-hidden">
                                                <TooltipProvider>
                                                    {(printer.Messages?.length > 0) ? (
                                                        printer.Messages.slice(0, 2).map((msg: any, idx: number) => (
                                                            <Tooltip key={idx}>
                                                                <TooltipTrigger asChild>
                                                                    <span className="text-[9px] font-bold text-amber-600 truncate flex items-center gap-1 cursor-help">
                                                                        <AlertCircle size={10} className="shrink-0" /> {msg}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-slate-900 border-none text-white text-[10px] p-3 rounded-xl max-w-[250px]">
                                                                    <div className="flex items-start gap-2">
                                                                        <AlertTriangle size={12} className="text-amber-400 mt-0.5" />
                                                                        <p className="font-bold">{msg}</p>
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ))
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                                            <CheckCircle2 size={10} /> {t('printing:ready')}
                                                        </span>
                                                    )}
                                                    {printer.Messages?.length > 2 && (
                                                        <span className="text-[8px] text-slate-400 font-black px-1.5 py-0.5 bg-slate-100 rounded-md w-fit">
                                                            +{printer.Messages.length - 2} MORE
                                                        </span>
                                                    )}
                                                </TooltipProvider>
                                                {printer.JobCount > 0 && (
                                                    <Badge className="w-fit bg-blue-500 text-white text-[8px] px-1.5 py-0">
                                                        {t('printing:active_jobs', { count: printer.JobCount })}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] text-slate-400 uppercase font-black">{t('printing:binding_duplex')}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-bold uppercase text-indigo-600">
                                                        {printer.Config?.DuplexingMode === 'OneSided' ? t('printing:one_sided') : 
                                                        printer.Config?.DuplexingMode === 'TwoSidedLongEdge' ? t('printing:long_edge') :
                                                        printer.Config?.DuplexingMode === 'TwoSidedShortEdge' ? t('printing:short_edge') : 
                                                        printer.Config?.DuplexingMode || 'N/A'}
                                                    </span>
                                                    {printer.Caps?.Duplex && <Badge className="bg-blue-500/10 text-blue-500 border-none text-[7px] px-1 h-3 flex items-center">HW</Badge>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] text-slate-400 uppercase font-black">{t('common:color')}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("text-[9px] font-bold uppercase", (printer.Config?.Color === 1 || printer.Config?.Color === true) ? "text-rose-600" : "text-slate-500")}>
                                                        {(printer.Config?.Color === 1 || printer.Config?.Color === true) ? t('common:yes') : t('common:no')}
                                                    </span>
                                                    {printer.Caps?.Color && <Badge className="bg-rose-500/10 text-rose-600 border-none text-[7px] px-1 h-3 flex items-center">HW</Badge>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] text-slate-400 uppercase font-black">{t('printing:paper_size')}</span>
                                                <span className="text-[9px] font-bold uppercase truncate">{printer.Config?.PaperSize || 'Auto'}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] text-slate-400 uppercase font-black">{t('printing:media_type')}</span>
                                                <span className="text-[9px] font-bold uppercase truncate text-slate-500">{printer.Config?.MediaType || 'Standard'}</span>
                                            </div>
                                            {printer.Config?.MediaSource && (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] text-slate-400 uppercase font-black">{t('printing:tray')}</span>
                                                    <span className="text-[9px] font-bold uppercase truncate text-slate-400 italic">{printer.Config.MediaSource}</span>
                                                </div>
                                            )}
                                            {printer.Config?.Collate !== undefined && (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] text-slate-400 uppercase font-black">{t('printing:collate')}</span>
                                                    <span className="text-[9px] font-bold uppercase text-blue-600">
                                                        {printer.Config.Collate ? t('common:yes') : t('common:no')}
                                                    </span>
                                                </div>
                                            )}
                                            {printer.Caps?.Trays?.length > 0 && (
                                                <div className="flex flex-col gap-0.5 col-span-2 mt-1 pt-1 border-t border-slate-50">
                                                    <span className="text-[8px] text-slate-400 uppercase font-black">{t('printing:available_trays')}</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {printer.Caps.Trays.map((tray: string, idx: number) => (
                                                            <Badge key={idx} variant="outline" className="text-[7px] px-1 py-0 border-slate-100 text-slate-500 bg-slate-50/50">
                                                                {tray}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 min-w-[120px]">
                                            <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1.5">
                                                <Layers size={10} className="text-slate-400" /> {printer.PrintProcessor}
                                            </span>
                                            {printer.Published && (
                                                <span className="text-[8px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                                    <Globe size={10} /> Active Directory
                                                </span>
                                            )}
                                            {printer.Comment && (
                                                <p className="text-[9px] italic text-slate-400 line-clamp-2 leading-tight">
                                                    {printer.Comment}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end gap-1.5">
                                            {(['superadmin', 'workspace_owner', 'workspace_admin'].includes(user?.role || '')) && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button 
                                                                variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"
                                                                onClick={() => handleSetDefault(printer.Name)}
                                                            >
                                                                <Star className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="text-[10px] uppercase font-black">{t('printing:set_default')}</TooltipContent>
                                                    </Tooltip>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button 
                                                                variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                                                                onClick={() => handlePurgeJobs(printer.Name)}
                                                            >
                                                                <ListX className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="text-[10px] uppercase font-black">{t('printing:purge_jobs')}</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}

                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl px-2"
                                                onClick={() => handleTestPrint(printer.Name)}
                                            >
                                                <Zap className="mr-1 h-3.5 w-3.5" />
                                                {t('printing:test_page')}
                                            </Button>
                                            {(['superadmin', 'workspace_owner', 'workspace_admin'].includes(user?.role || '')) && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl px-2"
                                                    onClick={() => handleEditPrinter(printer)}
                                                >
                                                    <Settings2 className="mr-1 h-3.5 w-3.5" />
                                                    {t('common:edit')}
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Edit Printer Dialog */}
            <Dialog open={isEditPrinterOpen} onOpenChange={setIsEditPrinterOpen}>
                <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl dark:bg-slate-950/95 border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4 bg-slate-50/50 dark:bg-slate-900/50">
                        <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20">
                                <Settings2 size={20} />
                            </div>
                            {t('printing:edit_printer')}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            {editingPrinter?.Name} • {t('printing:printer_details_settings')}
                        </DialogDescription>
                    </DialogHeader>

                    {editingPrinter && (
                        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                            {/* Base Info */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('printing:comment')}</Label>
                                    <Input 
                                        value={editingPrinter.Comment || ''} 
                                        onChange={(e) => setEditingPrinter({...editingPrinter, Comment: e.target.value})}
                                        className="h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:ring-blue-500/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('printing:location')}</Label>
                                    <Input 
                                        value={editingPrinter.Location || ''} 
                                        onChange={(e) => setEditingPrinter({...editingPrinter, Location: e.target.value})}
                                        className="h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>

                            <Separator className="bg-slate-100/50" />

                            {/* Advanced Config */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('printing:paper_size')}</Label>
                                    <Input 
                                        value={editingPrinter.Config?.PaperSize || ''} 
                                        onChange={(e) => setEditingPrinter({
                                            ...editingPrinter, 
                                            Config: { ...editingPrinter.Config, PaperSize: e.target.value }
                                        })}
                                        placeholder="ex: A4, A3, Letter"
                                        className="h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:ring-blue-500/20 px-4 text-xs font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('printing:media_type')}</Label>
                                    <Input 
                                        value={editingPrinter.Config?.MediaType || ''} 
                                        onChange={(e) => setEditingPrinter({
                                            ...editingPrinter, 
                                            Config: { ...editingPrinter.Config, MediaType: e.target.value }
                                        })}
                                        placeholder="ex: Stationary, Cardstock"
                                        className="h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:ring-blue-500/20 px-4 text-xs font-bold"
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('printing:input_tray')}</Label>
                                    <Input 
                                        value={editingPrinter.Config?.MediaSource || ''} 
                                        onChange={(e) => setEditingPrinter({
                                            ...editingPrinter, 
                                            Config: { ...editingPrinter.Config, MediaSource: e.target.value }
                                        })}
                                        placeholder="ex: Auto, Tray 1, Manual Feed"
                                        className="h-11 rounded-xl bg-slate-50/50 border-slate-100 focus:ring-blue-500/20 px-4 text-xs font-bold"
                                    />
                                </div>
                            </div>

                            <Separator className="bg-slate-100/50" />

                            {/* Switches Grid */}
                            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-0.5">
                                        <Label className="text-[11px] font-black uppercase tracking-tight text-slate-700">{t('printing:shared')}</Label>
                                        <p className="text-[10px] text-slate-400 font-medium italic">SMB/WSD Network Share</p>
                                    </div>
                                    <Switch 
                                        checked={editingPrinter.Shared} 
                                        onCheckedChange={(v) => setEditingPrinter({...editingPrinter, Shared: v})}
                                        className="data-[state=checked]:bg-blue-500"
                                    />
                                </div>
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-0.5">
                                        <Label className="text-[11px] font-black uppercase tracking-tight text-slate-700">{t('printing:published')}</Label>
                                        <p className="text-[10px] text-slate-400 font-medium italic">Active Directory Directory</p>
                                    </div>
                                    <Switch 
                                        checked={editingPrinter.Published} 
                                        onCheckedChange={(v) => setEditingPrinter({...editingPrinter, Published: v})}
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-0.5">
                                        <Label className="text-[11px] font-black uppercase tracking-tight text-slate-700">{t('printing:collate')}</Label>
                                        <p className="text-[10px] text-slate-400 font-medium italic">1,2,3... 1,2,3...</p>
                                    </div>
                                    <Switch 
                                        checked={editingPrinter.Config?.Collate} 
                                        onCheckedChange={(v) => setEditingPrinter({
                                            ...editingPrinter, 
                                            Config: { ...editingPrinter.Config, Collate: v }
                                        })}
                                        className="data-[state=checked]:bg-blue-500"
                                    />
                                </div>
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-0.5">
                                        <Label className="text-[11px] font-black uppercase tracking-tight text-slate-700">{t('printing:color_mode')}</Label>
                                        <p className="text-[10px] text-slate-400 font-medium italic">{editingPrinter.Config?.Color ? t('printing:color') : t('printing:monochrome')}</p>
                                    </div>
                                    <Switch 
                                        checked={editingPrinter.Config?.Color} 
                                        onCheckedChange={(v) => setEditingPrinter({
                                            ...editingPrinter, 
                                            Config: { ...editingPrinter.Config, Color: v }
                                        })}
                                        className="data-[state=checked]:bg-rose-500"
                                    />
                                </div>
                            </div>

                            <Separator className="bg-slate-100/50" />

                            {/* Duplex Select */}
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('printing:duplex')}</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'OneSided', label: t('printing:one_sided'), icon: Square },
                                        { id: 'TwoSidedLongEdge', label: t('printing:long_edge'), icon: Layers },
                                        { id: 'TwoSidedShortEdge', label: t('printing:short_edge'), icon: RotateCcw }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setEditingPrinter({
                                                ...editingPrinter,
                                                Config: { ...editingPrinter.Config, DuplexingMode: mode.id }
                                            })}
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                                editingPrinter.Config?.DuplexingMode === mode.id
                                                    ? "bg-blue-50 border-blue-200 text-blue-600 shadow-inner shadow-blue-100"
                                                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-100"
                                            )}
                                        >
                                            <mode.icon size={18} className={cn(editingPrinter.Config?.DuplexingMode === mode.id ? "text-blue-500" : "text-slate-300")} />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-center">{mode.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="p-8 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsEditPrinterOpen(false)}
                            className="rounded-xl px-6 h-11 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100"
                        >
                            {t('common:cancel')}
                        </Button>
                        <Button 
                            onClick={handleSavePrinterSettings}
                            disabled={editPending}
                            className="rounded-xl px-8 h-11 bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-[11px] font-black uppercase tracking-widest"
                        >
                            {editPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {t('common:save_changes')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
