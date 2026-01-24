import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useSettings } from "~/hooks/useSettings";
import { toast } from "sonner";
import { 
    Printer, RefreshCcw, Clock, CheckCircle2, XCircle, FileText, List, Settings, History, Search, Save, ChevronRight, Globe, Play, Square, Trash2, Eye, Activity, AlertCircle, HardDrive, Server, Shield, Zap, Lock, Plus, Minus, Loader2, Palette, Star, AlertTriangle, FileSpreadsheet, Presentation, User, Download, Layers, ShoppingCart, Edit2, Euro, Info, Settings2, Phone, RotateCcw, BookOpen, EyeOff, CheckSquare } from 'lucide-react';
import { useAuth } from "~/hooks/useAuth";
import { DocumentPreview } from "~/components/printing/DocumentPreview";

import { Button } from "~/components/ui/button";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardFooter, 
    CardHeader, 
    CardTitle 
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "~/components/ui/tabs";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "~/components/ui/table";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion";
import { Checkbox } from "~/components/ui/checkbox";
import { GlassCard } from "~/components/ui/GlassCard";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { 
    api,
    socket,
    socketRequest,
    getTierPrice,
    calculateJobPrice,
    generateId,
    formatDate,
    deepClone,
    debounce,
    isValidEmail,
    getRomanianTime,
    checkIsWorkingHours,
    renderString
} from "~/lib/core";
import { cn } from '~/lib/core';

const getShared = (wrapper: any, name?: string) => {
    if (!wrapper) return null;
    if (name && wrapper[name]) return wrapper[name];
    if (name && wrapper.default && wrapper.default[name]) return wrapper.default[name];
    if (wrapper.default) return wrapper.default;
    return wrapper;
};
import { LocalFileBrowser } from "~/components/printing/LocalFileBrowser";
import { HardwareManager } from "~/components/printing/HardwareManager";
import { PrintingHistory } from "~/components/printing/PrintingHistory";
import { LoadingOverlay } from "~/components/LoadingOverlay";
import { JobConfigDialog } from "~/components/printing/JobConfigDialog";
import { SessionDetailDialog } from "~/components/printing/SessionDetailDialog";
import { SaveSessionDialog } from "~/components/printing/SaveSessionDialog";

// --- Types ---
interface LocalPrintJob {
    id: string;
    File?: File;
    filename?: string;
    fileUrl?: string;
    previewUrl?: string;
    copies: number;
    pagesColor: number;
    pagesBW: number;
    numPages: number;
    isBound: boolean;
    isA3: boolean;
    isCardboard: boolean;
    isFullCoverage: boolean;
    uploading: boolean;
    serverPath?: string;
    remotePath?: string;
    senderInfo?: {
        name?: string;
        phone?: string;
        email?: string;
        source?: string;
    };
    pageRange?: string;
    timestamp?: number;
}

interface PriceTier {
    maxPages: number;
    priceNormal: number;
    priceFull: number;
}

interface CardboardTier {
    maxPages: number;
    price: number;
}

interface BindingTier {
    maxPages: number;
    price: number;
}

interface PrintSettings {
    isColor: boolean;
    isDuplex: boolean;
    printerName: string;
}

import type { Route } from "./+types/($lang)._app.printing";

export async function loader({ params, request }: Route.LoaderArgs) {
    // This should be checked on the backend, but we can add client-side redirect here if needed
    return { lang: params.lang };
}

export default function PrintingPage() {
    const { t } = useTranslation(['common', 'printing']);
    const { user, hasPageAccess } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const { lang } = useParams();
    const [spoolerJobs, setSpoolerJobs] = useState<any[]>([]);
    const [historyJobs, setHistoryJobs] = useState<any[]>([]);
    const [savedSessions, setSavedSessions] = useState<any[]>([]);
    const [printers, setPrinters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<any>(null); // Added for auto-preview
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);

    // --- Configuration State ---
    const [prices, setPrices] = useState<any>(null);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    const [searchParams] = useSearchParams();

    // --- Deep Link Preview ---
    useEffect(() => {
        const pathParam = searchParams.get('path');
        if (pathParam) {
            setPreviewItem({
                fullPath: pathParam,
                name: pathParam.split(/[\\\/]/).pop() || 'Document'
            });
            setIsPreviewOpen(true);
        }
    }, [searchParams]);

    const fetchPrintingConfig = async () => {
        try {
            const res = await socketRequest('printing:get-config', {});
            if (res.success && res.config) {
                setPrices(res.config);
            }
        } catch (e) {
            console.warn('Failed to fetch printing config via socket, falling back to HTTP', e);
            // Fallback to HTTP if socket fails
            try {
                const httpRes = await api.local.get('system/printing/config');
                if (httpRes.success && httpRes.data.config) {
                    setPrices(httpRes.data.config);
                }
            } catch (httpErr) {}
        }
    };
    
    // --- Local Queue State ---
    const [localJobs, setLocalJobs] = useState<LocalPrintJob[]>([]);
    const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
    const editingJob = React.useMemo(() => localJobs.find(j => j.id === selectedJobId), [localJobs, selectedJobId]);

    const [printSettings, setPrintSettings] = useState<PrintSettings>({
        isColor: false,
        isDuplex: false,
        printerName: '',
    });

    // Stats
    const [stats, setStats] = useState({
        pending: 0,
        completed: 0,
        failed: 0,
        totalPages: 0
    });

    // Persistence
    const loadSavedQueue = () => {
        const stored = localStorage.getItem('print_queue');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const TTL = 2 * 60 * 60 * 1000; // 2 hours
                const now = Date.now();

                // Clean up stale or non-restorable jobs
                const validJobs = parsed.filter((p: any) => {
                    const isNewEnough = p.timestamp ? (now - p.timestamp < TTL) : true;
                    const hasData = !!p.remotePath; // If it's a browser/inbox File
                    const wasUploaded = !!p.serverPath; // If it was a manually uploaded File that finished
                    
                    return isNewEnough && (hasData || wasUploaded);
                });

                if (validJobs.length !== parsed.length) {
                    localStorage.setItem('print_queue', JSON.stringify(validJobs));
                }

                setLocalJobs(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const toAdd = validJobs.filter((p: any) => !existingIds.has(p.id));
                    return [...prev, ...toAdd];
                });
            } catch (e) {}
        }
    };

    useEffect(() => {
        loadSavedQueue();
        window.addEventListener('print-queue-updated', loadSavedQueue);
        return () => window.removeEventListener('print-queue-updated', loadSavedQueue);
    }, []);

    useEffect(() => {
        // Only save what can be stringified
        const toSave = localJobs.map(j => {
            const { File, fileUrl, ...rest } = j;
            return rest;
        });
        localStorage.setItem('print_queue', JSON.stringify(toSave));
    }, [localJobs]);

    // Price Calculation Logic
    const calculateJobPriceLocal = (job: LocalPrintJob) => {
        return calculateJobPrice(job, prices);
    };

    const totalPrice = localJobs.reduce((acc, job) => acc + calculateJobPriceLocal(job), 0);

    const saveSession = async (name: string, customerData: { customerName: string, customerPhone: string, customerEmail?: string, contactId?: string }) => {
        if (localJobs.length === 0) return toast.error(renderString(t("printing:queue_empty"), lang));

        setRefreshing(true);
        try {
            await api.local.post('printing/sessions', {
                name: name,
                customerName: customerData.customerName,
                customerPhone: customerData.customerPhone,
                customerEmail: customerData.customerEmail,
                contactId: customerData.contactId,
                items: localJobs.map(j => ({
                    filename: j.File?.name || j.filename || renderString(t("printing:document"), lang),
                    remotePath: j.remotePath,
                    copies: j.copies,
                    pagesBW: j.pagesBW,
                    pagesColor: j.pagesColor,
                    numPages: j.numPages,
                    isA3: j.isA3,
                    isBound: j.isBound,
                    isCardboard: j.isCardboard,
                    isFullCoverage: j.isFullCoverage,
                    totalPrice: calculateJobPriceLocal(j)
                })),
                totalPrice: totalPrice
            });
            toast.success(renderString(t("printing:order_saved_success"), lang));
            setIsSaveModalOpen(false);
            setLocalJobs([]); // Clear queue after save
        } catch (e: any) {
            toast.error(renderString(t("printing:error_saving_session"), lang) + ": " + e.message);
        } finally {
            setRefreshing(false);
        }
    };

    const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const File = e.target.files;
        if (!File) return;
        
        Array.from(File).forEach(File => {
            const id = generateId("print_");
            const job: LocalPrintJob = {
                id,
                File,
                fileUrl: URL.createObjectURL(File),
                copies: 1,
                pagesColor: 0,
                pagesBW: 1, // Assume 1 page for now, user can edit
                numPages: 1,
                isBound: false,
                isA3: false,
                isCardboard: false,
                isFullCoverage: false,
                uploading: false,
                timestamp: Date.now(),
            };
            setLocalJobs(prev => [...prev, job]);
        });
        e.target.value = "";
    };

    const removeJob = (id: string) => {
        setLocalJobs(prev => {
            const job = prev.find(j => j.id === id);
            if (job?.fileUrl) URL.revokeObjectURL(job.fileUrl);
            return prev.filter(j => j.id !== id);
        });
    };

    const updateJob = (id: string, updates: Partial<LocalPrintJob>) => {
        setLocalJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
    };

    const handlePrintQueue = async () => {
        if (localJobs.length === 0) return;
        if (!printSettings.printerName) return toast.error(renderString(t("printing:select_printer_first"), lang));

        setRefreshing(true);
        try {
            for (const job of localJobs) {
                const formData = new FormData();
                if (job.File) {
                    formData.append('File', job.File);
                } else if (job.remotePath) {
                    formData.append('remotePath', job.remotePath);
                } else {
                    continue;
                }
                
                formData.append('printer', printSettings.printerName);
                formData.append('options', JSON.stringify({
                    copies: job.copies,
                    color: printSettings.isColor,
                    duplex: printSettings.isDuplex,
                    a3: job.isA3
                }));

                const res = await api.local.post('print/execute', formData);
                if (!res.success) throw new Error(res.error);
            }
            toast.success(renderString(t("printing:jobs_sent_to_printer"), lang));
            setLocalJobs([]);
            localStorage.setItem('print_queue', JSON.stringify([]));
            setIsJobDialogOpen(false);
        } catch (e: any) {
            toast.error(renderString(t("printing:error_prefix"), lang) + e.message);
        } finally {
            setRefreshing(false);
            refreshAll();
        }
    };

    const fetchSpoolerJobs = async () => {
        try {
            const res = await socketRequest('cups:get-jobs', {});
            if (res.success) {
                setSpoolerJobs(res.jobs || []);
            }
        } catch (e) {}
    };

    const handleRestartSpooler = async () => {
        toast.promise(socketRequest('printing:restart-spooler'), {
            loading: renderString(t('printing:spooler_restarting'), lang),
            success: () => {
                setTimeout(fetchSpoolerJobs, 2000);
                return renderString(t('printing:spooler_restarted'), lang);
            },
            error: (err: any) => err.message || renderString(t('common:error_occurred'), lang)
        });
    };

    const fetchPrinters = async () => {
        try {
            const res = await socketRequest('printing:get-printers');
            if (res.success) {
                setPrinters(res.printers || []);
            } else {
                toast.error(t('printing:error_fetching_printers') + ': ' + (res.error || 'Unknown error'));
            }
        } catch (e: any) {
             toast.error(t('printing:error_fetching_printers') + ': ' + e.message);
        }
    };

    const fetchHistory = async () => {
        try {
            // Use a timeout to prevent the whole page from being blocked
            const res: any = await Promise.race([
                api.brain.get('db/collection/print_job'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
            
            // Handle various response structures (direct array or wrapped in success/data)
            let data = [];
            if (Array.isArray(res)) {
                data = res;
            } else if (res?.success && Array.isArray(res.data)) {
                data = res.data;
            } else if (res?.data && Array.isArray(res.data)) {
                data = res.data;
            }

            if (data) {
                setHistoryJobs(data);
                
                // Calculate stats from history today
                const today = new Date().toISOString().split('T')[0];
                const todayJobs = data.filter((j: any) => (j.created_at || j.date || "").includes(today));
                
                setStats({
                    pending: spoolerJobs.length,
                    completed: todayJobs.filter((j: any) => j.status === 'completed').length,
                    failed: data.filter((j: any) => j.status === 'failed').length,
                    totalPages: data.reduce((acc: number, curr: any) => acc + (curr.pages || 0), 0)
                });
            }
        } catch (error: any) {
            // Handle 404 specifically (collection empty or not created yet)
            if (error.response?.status === 404) {
                console.warn("Print history collection not found (404). Initializing empty.");
                setHistoryJobs([]);
                return;
            }

            if (error.message !== 'timeout') {
                console.error('Failed to fetch print history:', error);
            }
            // Fail silently - page will still load with empty history
        }
    };

    const fetchSavedSessions = async () => {
        try {
            const res = await api.local.get('printing/sessions');
            if (res.success) {
                setSavedSessions(res.data || []);
            }

// Funcția refreshAll rămâne neschimbată, doar o apelăm
const refreshAll = () => {
  fetchHistory();
  // ... alte funcții de refresh
};
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        }
    };

    const refreshAll = async () => {
        setRefreshing(true);
        
        // Run everything in parallel to drastically reduce load time
        // Including history in the parallel batch so cards populate faster
        await Promise.allSettled([
            fetchSpoolerJobs(),
            fetchPrinters(),
            fetchPrintingConfig(),
            fetchSavedSessions(),
            fetchHistory()
        ]);
        
        setRefreshing(false);
        setLoading(false);
    };

    useEffect(() => {
        refreshAll();
        const interval = setInterval(fetchSpoolerJobs, 10000); 
        return () => clearInterval(interval);
    }, []);

    const handleCancelJob = async (jobId: string) => {
        if (!window.confirm(renderString(t('printing:confirm_cancel'), lang))) return;
        try {
            const res = await socketRequest('cups:cancel-job', jobId);
            if (res.success) {
                toast.success(renderString(t('printing:job_cancelled'), lang));
                fetchSpoolerJobs();
            } else {
                toast.error(res.error || renderString(t("printing:error_cancelling_job"), lang));
            }
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleSavePrices = async () => {
        setRefreshing(true);
        try {
            // Sort tiers by maxPages before saving to ensure pricing logic works correctly
            const sortedPrices = {
                ...prices,
                bwTiers: [...(prices.bwTiers || [])].sort((a, b) => a.maxPages - b.maxPages),
                colorTiers: [...(prices.colorTiers || [])].sort((a, b) => a.maxPages - b.maxPages),
                bwA3Tiers: [...(prices.bwA3Tiers || [])].sort((a, b) => a.maxPages - b.maxPages),
                colorA3Tiers: [...(prices.colorA3Tiers || [])].sort((a, b) => a.maxPages - b.maxPages),
                bindingTiers: [...(prices.bindingTiers || [])].sort((a, b) => a.maxPages - b.maxPages),
                cardboardA4Tiers: [...(prices.cardboardA4Tiers || [])].sort((a, b) => a.maxPages - b.maxPages),
                cardboardA3Tiers: [...(prices.cardboardA3Tiers || [])].sort((a, b) => a.maxPages - b.maxPages),
            };

            // Use socket.io instead of HTTP to avoid connection issues
            const res = await socketRequest('printing:update-config', { config: sortedPrices });
            if (res.success) {
                setPrices(sortedPrices); // Update local state with sorted values
                toast.success(renderString(t("printing:config_saved_success"), lang));
            } else {
                toast.error(res.error || renderString(t("printing:failed_save_config"), lang));
            }
        } catch (e: any) {
            toast.error(renderString(t("printing:failed_save_config"), lang) + ": " + e.message);
        } finally {
            setRefreshing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = (status || '').toLowerCase();
        let label = status;
        
        if (s.includes('completed') || s.includes('printed')) label = renderString(t('common:status_completed'), lang);
        else if (s.includes('error') || s.includes('failed')) label = renderString(t('common:status_failed'), lang);
        else if (s.includes('printing') || s.includes('processing')) label = renderString(t('common:status_processing'), lang);
        else if (s.includes('pending') || s.includes('waiting')) label = renderString(t('common:status_pending'), lang);

        if (s.includes('completed') || s.includes('printed')) 
            return <Badge className="bg-emerald-500/10 text-emerald-500 border-none px-3">{label}</Badge>;
        if (s.includes('error') || s.includes('failed')) 
            return <Badge className="bg-red-500/10 text-red-500 border-none px-3">{label}</Badge>;
        if (s.includes('printing') || s.includes('processing')) 
            return <Badge className="bg-blue-500/10 text-blue-500 border-none px-3 animate-pulse">{label}</Badge>;
        return <Badge className="bg-slate-500/10 text-slate-500 border-none px-3">{label}</Badge>;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Printer className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-muted-foreground font-medium animate-pulse">{renderString(t("common:loading"), lang)}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-2 md:p-4 animate-in fade-in duration-500">
            <div className="hidden md:grid gap-2 md:grid-cols-4">
                <GlassCard className="border-blue-500/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-2 px-3">
                        <CardTitle className="text-[8px] font-black uppercase tracking-widest text-muted-foreground italic">{renderString(t('printing:printer_status'), lang)}</CardTitle>
                        <Printer className="h-3 w-3 text-blue-500" />
                    </CardHeader>
                    <CardContent className="pb-2 px-3">
                        <div className="text-lg font-black leading-none">{renderString(t("printing:online"), lang)}</div>
                        <div className="text-[7px] text-muted-foreground mt-0.5 uppercase font-bold text-emerald-600/60 flex items-center gap-1">
                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                            {renderString(t("printing:ready"), lang)}
                        </div>
                    </CardContent>
                </GlassCard>

                <GlassCard className="border-amber-500/10 shadow-sm relative">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-2 px-3">
                        <CardTitle className="text-[8px] font-black uppercase tracking-widest text-muted-foreground italic">{renderString(t('printing:in_queue'), lang)}</CardTitle>
                        <List className="h-3 w-3 text-amber-500" />
                    </CardHeader>
                    <CardContent className="pb-2 px-3">
                        <div className="text-lg font-black leading-none">{spoolerJobs.length}</div>
                        <p className="text-[7px] text-muted-foreground mt-0.5 uppercase font-bold text-amber-600/60">{renderString(t("printing:active_spooler"), lang)}</p>
                        
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={refreshAll} 
                            disabled={refreshing}
                            className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full hover:bg-amber-500/10 transition-colors"
                        >
                            <RefreshCcw className={cn("h-3 w-3 text-amber-500", refreshing && "animate-spin")} />
                        </Button>
                    </CardContent>
                </GlassCard>

                <GlassCard className="border-emerald-500/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-2 px-3">
                        <CardTitle className="text-[8px] font-black uppercase tracking-widest text-muted-foreground italic">{renderString(t('printing:completed_today'), lang)}</CardTitle>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="pb-2 px-3">
                        <div className="text-lg font-black leading-none">{stats.completed}</div>
                        <p className="text-[7px] text-muted-foreground mt-0.5 uppercase font-bold text-emerald-600/60">{renderString(t('common:today'), lang)}</p>
                    </CardContent>
                </GlassCard>

                <GlassCard className="border-primary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-2 px-3">
                        <CardTitle className="text-[8px] font-black uppercase tracking-widest text-muted-foreground italic">{renderString(t('printing:total_pages'), lang)}</CardTitle>
                        <FileText className="h-3 w-3 text-primary" />
                    </CardHeader>
                    <CardContent className="pb-2 px-3">
                        <div className="text-lg font-black leading-none">{stats.totalPages}</div>
                        <p className="text-[7px] text-muted-foreground mt-0.5 uppercase font-bold text-primary/60">{renderString(t('printing:total_volume'), lang)}</p>
                    </CardContent>
                </GlassCard>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="storage" className="space-y-4">
                <div className="sticky top-0 z-20 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/50 p-1.5 backdrop-blur-xl dark:bg-slate-900/50">
                    <TabsList className="grid h-12 w-full grid-cols-4 gap-1.5 bg-transparent">
                        <TabsTrigger value="storage" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-black italic uppercase text-[11px] tracking-widest p-0">
                            <HardDrive className="mr-2 h-4 w-4 text-amber-500" />
                            {renderString(t('printing:inbox'), lang)}
                        </TabsTrigger>
                        <TabsTrigger value="queue" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-black italic uppercase text-[11px] tracking-widest p-0">
                            <ShoppingCart className="mr-2 h-4 w-4 text-indigo-500" />
                            {renderString(t('printing:print_queue'), lang)}
                            {localJobs.length > 0 && (
                                <Badge className="ml-2 h-4 min-w-4 bg-primary text-[8px] flex items-center justify-center p-0 rounded-full">{localJobs.length}</Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="spooler" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-black italic uppercase text-[11px] tracking-widest p-0">
                            <Activity className="mr-2 h-4 w-4 text-blue-500" />
                            {renderString(t('printing:active_queue'), lang)}
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800 font-black italic uppercase text-[11px] tracking-widest p-0">
                            <History className="mr-2 h-4 w-4 text-primary" />
                            {renderString(t('common:activity_log'), lang)}
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Storage/Inbox Tab */}
                <TabsContent value="storage" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    <LocalFileBrowser />
                </TabsContent>

                {/* Local Queue Tab Content */}
                <TabsContent value="queue" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* File Upload Section */}
                        <div className="lg:col-span-1 space-y-4">
                            <GlassCard className="border-dashed border-2 border-primary/20 hover:border-primary/50 transition-all">
                                <CardHeader className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary italic flex items-center gap-1">
                                                <Plus className="h-3 w-3" />
                                                {renderString(t('printing:add_to_queue'), lang)}
                                            </CardTitle>
                                            <CardDescription className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:add_files'), lang)}</CardDescription>
                                        </div>
                                        <div className="p-1.5 bg-primary/10 rounded-full">
                                            <Download className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    <div 
                                        className="relative group cursor-pointer"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const File = e.dataTransfer.files;
                                            if (File) {
                                                const event = { target: { File } } as any;
                                                handleAddFiles(event);
                                            }
                                        }}
                                    >
                                        <input 
                                            type="File" 
                                            multiple 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            onChange={handleAddFiles}
                                        />
                                        <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                                            <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                                                <Download className="h-8 w-8" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest italic">{renderString(t('common:click_drag_drop'), lang)}</p>
                                                <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter italic">{renderString(t('printing:supported_formats'), lang)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Config */}
                                    <div className="mt-8 space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                                                    <Printer className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">{renderString(t('common:printer'), lang)}</span>
                                                    <select 
                                                        className="bg-transparent font-bold text-xs focus:outline-none appearance-none cursor-pointer pr-4"
                                                        value={printSettings.printerName}
                                                        onChange={(e) => setPrintSettings(prev => ({ ...prev, printerName: e.target.value }))}
                                                    >
                                                        <option value="">{renderString(t('common:select_option'), lang)}</option>
                                                        {printers
                                                            .filter(p => !prices?.activePrinters || prices.activePrinters.includes(p.Name))
                                                            .map(p => (
                                                                <option key={p.Name} value={p.Name}>{p.Name}</option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-slate-400" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                className={cn("h-12 flex flex-col gap-0 border-slate-200 rounded-xl", printSettings.isColor && "border-indigo-500/30 bg-indigo-500/10")}
                                                onClick={() => setPrintSettings(prev => ({ ...prev, isColor: !prev.isColor }))}
                                            >
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{renderString(t('printing:color_mode'), lang)}</span>
                                                <span className="text-xs font-bold uppercase">{printSettings.isColor ? renderString(t('common:color'), lang) : renderString(t('common:bw'), lang)}</span>
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                className={cn("h-12 flex flex-col gap-0 border-slate-200 rounded-xl", printSettings.isDuplex && "border-emerald-500/30 bg-emerald-500/10")}
                                                onClick={() => setPrintSettings(prev => ({ ...prev, isDuplex: !prev.isDuplex }))}
                                            >
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{renderString(t('printing:sides'), lang)}</span>
                                                <span className="text-xs font-bold uppercase">{printSettings.isDuplex ? renderString(t('common:duplex'), lang) : renderString(t('common:simplex'), lang)}</span>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                                <Separator className="bg-slate-100 dark:bg-slate-800" />
                                <CardFooter className="p-4">
                                    <div className="w-full space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{renderString(t('printing:total'), lang)}</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-black text-slate-900 dark:text-white leading-none tracking-tight italic">{(totalPrice / 100).toFixed(2)}</span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase italic">{renderString(t('printing:currency'), lang)}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button 
                                                variant="outline"
                                                className="h-10 rounded-xl flex flex-col gap-0 border-slate-200 hover:bg-slate-50 uppercase text-[8px] font-black tracking-widest"
                                                onClick={() => setIsSaveModalOpen(true)}
                                                disabled={refreshing || localJobs.length === 0}
                                            >
                                                <Save className="h-3 w-3 mb-0.5 text-slate-500" />
                                                {renderString(t('printing:save'), lang)}
                                            </Button>
                                            <Button 
                                                className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xl shadow-emerald-500/10 font-black uppercase tracking-widest italic text-[9px] group border-none"
                                                disabled={localJobs.length === 0 || !printSettings.printerName || refreshing}
                                                onClick={handlePrintQueue}
                                            >
                                                {refreshing ? (
                                                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <Zap className="h-3.5 w-3.5 group-hover:scale-125 transition-transform text-emerald-200" />
                                                        {renderString(t('printing:print_execute'), lang)}
                                                    </div>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardFooter>
                            </GlassCard>
                        </div>

                        {/* Local Jobs List */}
                        <div className="lg:col-span-2">
                            <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 overflow-hidden h-full flex flex-col min-h-[400px]">
                                <CardHeader className="border-b bg-slate-50/50 p-4 dark:bg-slate-800/50 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                                <List className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-bold italic uppercase tracking-tight">{renderString(t('printing:active_queue'), lang)}</CardTitle>
                                                <CardDescription className="text-[9px] font-bold uppercase text-slate-400">{renderString(t('printing:ready_to_dispatch'), lang)}</CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-red-500 hover:bg-red-50 font-black uppercase text-[8px] tracking-widest rounded-xl h-7"
                                                onClick={() => {
                                                    localJobs.forEach(j => j.fileUrl && URL.revokeObjectURL(j.fileUrl));
                                                    setLocalJobs([]);
                                                }}
                                                disabled={localJobs.length === 0}
                                            >
                                                <Trash2 className="mr-1.5 h-3 w-3" />
                                                {renderString(t('printing:purge_queue'), lang)}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 overflow-y-auto flex-grow h-[10px]">
                                    {localJobs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-20 text-center h-full gap-4 grayscale opacity-30">
                                            <div className="p-10 bg-slate-100 rounded-full">
                                                <FileText className="h-12 w-12 text-slate-400" />
                                            </div>
                                            <div className="max-w-[240px]">
                                                <p className="font-black uppercase text-[10px] tracking-widest mb-1 italic">{renderString(t('printing:workspace_empty'), lang)}</p>
                                                <p className="text-[10px] font-bold leading-normal italic text-slate-400">{renderString(t('printing:workspace_empty_desc'), lang)}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-0 divide-y dark:divide-slate-800">
                                            {localJobs.map((job) => (
                                                <div key={job.id} className="group p-4 flex items-center gap-4 hover:bg-white dark:hover:bg-slate-900/40 transition-all">
                                                    <div 
                                                        className="relative shrink-0 cursor-pointer group/preview"
                                                        onClick={() => {
                                                            setSelectedJobId(job.id);
                                                            setIsPreviewOpen(true);
                                                        }}
                                                    >
                                                        <div className="h-20 w-16 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex items-center justify-center shadow-sm group-hover:border-primary/50 transition-all rotate-[-2deg] group-hover/preview:rotate-0 group-hover/preview:scale-110 relative">
                                                            {job.File?.type.startsWith('image/') && job.fileUrl ? (
                                                                <img src={job.fileUrl} className="w-full h-full object-cover" alt="Preview" />
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <FileText className="h-8 w-8 text-primary/30" />
                                                                    <span className="text-[7px] font-black uppercase text-slate-400 tracking-tighter">{job.File?.name.split('.').pop()}</span>
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Eye className="h-6 w-6 text-white" />
                                                            </div>
                                                            {job.uploading && (
                                                                <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center">
                                                                    <RefreshCcw className="h-5 w-5 text-white animate-spin" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex-grow min-w-0" onClick={() => {
                                                        setSelectedJobId(job.id);
                                                        setIsJobDialogOpen(true);
                                                    }}>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate uppercase tracking-tight italic group-hover:text-primary transition-colors cursor-pointer">{job.File?.name || renderString(t('printing:document'), lang)}</h4>
                                                            {job.isA3 && <Badge className="bg-amber-500 text-white border-none py-0 px-2 h-4 text-[8px] font-black uppercase tracking-tighter">{renderString(t('printing:format_a3'), lang)}</Badge>}
                                                            {job.isCardboard && <Badge className="bg-indigo-500 text-white border-none py-0 px-2 h-4 text-[8px] font-black uppercase tracking-tighter">{renderString(t('printing:format_cardboard'), lang)}</Badge>}
                                                        </div>
                                                        <div className="flex items-center gap-4 mt-2 font-bold text-[9px] text-slate-400 uppercase tracking-tighter italic">
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                                                                <Layers className="h-3 w-3 text-primary" /> 
                                                                <span>{job.pagesBW + job.pagesColor} {renderString(t('printing:pages'), lang)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                                                                <RefreshCcw className="h-3 w-3 text-indigo-500" /> 
                                                                <span>{job.copies} {renderString(t('printing:copies'), lang)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-md">
                                                                <Euro className="h-3 w-3" /> 
                                                                <span>{renderString(t('printing:currency'), lang)} {(calculateJobPriceLocal(job) / 100).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeJob(job.id);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedJobId(job.id);
                                                                    setIsPreviewOpen(true);
                                                                }}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-9 w-9 bg-white dark:bg-slate-700 text-primary shadow-sm rounded-lg hover:scale-110 active:scale-95 transition-all"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedJobId(job.id);
                                                                    setIsJobDialogOpen(true);
                                                                }}
                                                            >
                                                                <Settings2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                                <Separator className="bg-slate-100 dark:bg-slate-800" />
                                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shrink-0">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic flex items-center gap-2">
                                        <Info className="h-3.5 w-3.5 text-primary" />
                                        {renderString(t('printing:calculated_based_on', { count: localJobs.length }), lang)}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">{renderString(t('printing:subtotal'), lang)}</span>
                                            <span className="text-sm font-black text-slate-900 dark:text-white leading-none">{renderString(t('printing:currency'), lang)} {(totalPrice / 100).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Active Spooler Tab */}
                <TabsContent value="spooler" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    <Tabs defaultValue="active_queue" className="w-full">
                        <div className="flex items-center justify-between mb-4">
                            <TabsList className="bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl">
                                <TabsTrigger value="active_queue" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary shadow-sm px-4 py-2">
                                    <Activity className="h-3 w-3 mr-2 text-blue-500" />
                                    {renderString(t('printing:active_queue'), lang)}
                                </TabsTrigger>
                                <TabsTrigger value="hardware" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary shadow-sm px-4 py-2">
                                    <Printer className="h-3 w-3 mr-2 text-emerald-500" />
                                    {renderString(t('printing:hardware'), lang)}
                                </TabsTrigger>
                                {hasPageAccess('settings') && (
                                    <TabsTrigger value="settings" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary shadow-sm px-4 py-2">
                                        <Settings2 className="h-3 w-3 mr-2 text-slate-500" />
                                        {renderString(t('common:settings'), lang)}
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </div>

                        <TabsContent value="active_queue">
                            <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 overflow-hidden">
                                <CardHeader className="border-b bg-slate-50/50 p-6 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Activity className="h-5 w-5 text-blue-500" />
                                                {renderString(t('printing:spooler_queue'), lang)}
                                            </CardTitle>
                                            <CardDescription>{renderString(t('printing:spooler_desc'), lang)}</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-8 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 transition-all gap-2"
                                                onClick={handleRestartSpooler}
                                            >
                                                <RefreshCcw className="h-3.5 w-3.5" />
                                                {renderString(t('printing:restart_spooler'), lang)}
                                            </Button>
                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                            <TableRow>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('printing:job_id'), lang)}</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('printing:document'), lang)}</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('printing:status'), lang)}</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('printing:details'), lang)}</TableHead>
                                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('printing:actions'), lang)}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {spoolerJobs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-40 text-center text-slate-400 italic">
                                                        {renderString(t('printing:no_jobs'), lang)}
                                                    </TableCell>
                                                </TableRow>
                                            ) : spoolerJobs.map((job, i) => (
                                                <TableRow key={i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <TableCell className="font-mono text-[10px] py-4 text-slate-500">#{job.id}</TableCell>
                                                    <TableCell className="font-bold text-slate-900 dark:text-white">{job.title}</TableCell>
                                                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">{job.user} • {job.size}</span>
                                                            <span className="text-[9px] text-slate-400">{job.date}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-full"
                                                            onClick={() => handleCancelJob(job.id)}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="hardware">
                            <HardwareManager prices={prices} onPricesUpdate={setPrices} />
                        </TabsContent>

                        {hasPageAccess('settings') && (
                            <TabsContent value="settings">
                                <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 overflow-hidden">
                                     <CardHeader className="border-b bg-slate-50/50 p-6 dark:bg-slate-800/50 flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Settings2 className="h-5 w-5 text-slate-500" />
                                                {renderString(t('printing:system_pricing_settings'), lang)}
                                            </CardTitle>
                                            <CardDescription>{renderString(t('printing:manage_settings_desc'), lang)}</CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-black tracking-widest text-slate-400 hover:text-slate-600" onClick={fetchPrintingConfig}>
                                                <RefreshCcw className="h-3 w-3 mr-1" /> {renderString(t('printing:reload'), lang)}
                                            </Button>
                                            <Button 
                                                size="sm"
                                                className="h-7 rounded-lg bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest px-4 shadow-lg shadow-slate-200"
                                                onClick={handleSavePrices}
                                                disabled={refreshing}
                                            >
                                                {refreshing ? <RefreshCcw className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
                                                {renderString(t('printing:save_changes'), lang)}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 overflow-hidden">
                                        <Accordion type="multiple" defaultValue={["infrastructure"]} className="w-full">
                                            {prices && (
                                                <>
                                                    {/* System Infrastructure Section */}
                                                    <AccordionItem value="infrastructure" className="border-none">
                                                        <AccordionTrigger className="px-8 py-4 hover:bg-slate-50/50 hover:no-underline">
                                                            <div className="flex items-center gap-2">
                                                                <Server className="h-4 w-4 text-blue-600" />
                                                                <span className="text-xs font-black uppercase tracking-wider">{renderString(t('printing:system_infrastructure'), lang)}</span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-8 pb-8 pt-2">
                                                            <div className="grid gap-8 md:grid-cols-2">
                                                    {/* Network Storage */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                                                                <HardDrive className="h-4 w-4 text-blue-600" />
                                                            </div>
                                                            <h3 className="font-black uppercase text-xs tracking-widest italic text-blue-600">{renderString(t('printing:network_storage_paths'), lang)}</h3>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase italic">{renderString(t('printing:active_shared_folders'), lang)}</p>
                                                                    <div className="flex gap-2">
                                                                        <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-mono">{renderString(t('printing:example_path_local'), lang)}</span>
                                                                        <span className="text-[8px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded font-mono">{renderString(t('printing:example_path_network'), lang)}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {(prices.networkDrivePaths || []).map((path: string, i: number) => (
                                                                        <div key={i} className="flex gap-2">
                                                                            <Input 
                                                                                value={path}
                                                                                onChange={(e) => {
                                                                                    const newPaths = [...prices.networkDrivePaths];
                                                                                    newPaths[i] = e.target.value;
                                                                                    setPrices({...prices, networkDrivePaths: newPaths});
                                                                                }}
                                                                                className="h-8 text-xs font-mono bg-white dark:bg-slate-900"
                                                                            />
                                                                            <Button 
                                                                                variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:bg-indigo-50"
                                                                                onClick={() => {
                                                                                    socket.emit('system:test-path', { path }, (res: any) => {
                                                                                        if (res.success) {
                                                                                            toast.success(res.message || renderString(t("printing:path_accessible"), lang));
                                                                                        } else {
                                                                                            toast.error(res.error || renderString(t("printing:path_error"), lang));
                                                                                        }
                                                                                    });
                                                                                }}
                                                                                title={renderString(t('printing:test_connectivity'), lang)}
                                                                            >
                                                                                <Activity className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button 
                                                                                variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                                                                                onClick={() => {
                                                                                    const newPaths = prices.networkDrivePaths.filter((_: any, idx: number) => idx !== i);
                                                                                    setPrices({...prices, networkDrivePaths: newPaths});
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                    <Button 
                                                                        variant="outline" size="sm" 
                                                                        className="w-full h-8 border-dashed rounded-xl text-[10px] uppercase font-black"
                                                                        onClick={() => {
                                                                            setPrices({
                                                                                ...prices, 
                                                                                networkDrivePaths: [...(prices.networkDrivePaths || []), '']
                                                                            });
                                                                        }}
                                                                    >
                                                                        <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add_network_path'), lang)}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Allowed Extensions */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                                                                <Shield className="h-4 w-4 text-amber-600" />
                                                            </div>
                                                            <h3 className="font-black uppercase text-xs tracking-widest italic text-amber-600">{renderString(t('printing:allowed_file_types'), lang)}</h3>
                                                        </div>
                                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-3 italic">{renderString(t('printing:inbox_filters'), lang)}</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {(prices.allowedExtensions || []).map((ext: string, i: number) => (
                                                                    <Badge key={i} variant="secondary" className="pl-2 pr-1 h-6 gap-1 bg-white dark:bg-slate-900 border-slate-200">
                                                                        <span className="text-[10px] font-mono lowercase">{ext}</span>
                                                                        <button 
                                                                            onClick={() => {
                                                                                const newExts = prices.allowedExtensions.filter((_: any, idx: number) => idx !== i);
                                                                                setPrices({...prices, allowedExtensions: newExts});
                                                                            }}
                                                                            className="hover:text-red-500 transition-colors"
                                                                        >
                                                                            <XCircle className="h-3 w-3" />
                                                                        </button>
                                                                    </Badge>
                                                                ))}
                                                                <div className="flex gap-1 w-full mt-2">
                                                                    <Input 
                                                                        placeholder=".ext" 
                                                                        className="h-8 w-20 text-[10px] font-mono"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const val = e.currentTarget.value.trim().toLowerCase();
                                                                                if (val && !prices.allowedExtensions.includes(val)) {
                                                                                    setPrices({
                                                                                        ...prices,
                                                                                        allowedExtensions: [...prices.allowedExtensions, val.startsWith('.') ? val : `.${val}`]
                                                                                    });
                                                                                    e.currentTarget.value = '';
                                                                                }
                                                                            }
                                                                        }}
                                                                    />
                                                                    <span className="text-[9px] text-slate-400 font-bold self-center uppercase italic">{renderString(t('printing:press_enter_to_add'), lang)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Printer Visibility Settings */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                                                                <Printer className="h-4 w-4 text-emerald-600" />
                                                            </div>
                                                            <h3 className="font-black uppercase text-xs tracking-widest italic text-emerald-600">{renderString(t('printing:visible_printers'), lang)}</h3>
                                                        </div>
                                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-3 italic">{renderString(t('printing:choose_printers_shown'), lang)}</p>
                                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                                {printers.map((p: any) => {
                                                                    const isActive = !prices.activePrinters || prices.activePrinters.includes(p.Name);
                                                                    return (
                                                                        <div key={p.Name} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                            <div className="flex items-center gap-3">
                                                                                <Printer className={cn("h-4 w-4", isActive ? "text-emerald-500" : "text-slate-300")} />
                                                                                <span className={cn("text-[10px] font-bold uppercase", !isActive && "text-slate-400")}>{p.Name}</span>
                                                                            </div>
                                                                            <Switch 
                                                                                checked={isActive} 
                                                                                onCheckedChange={(checked) => {
                                                                                    const current = prices.activePrinters || printers.map((pr: any) => pr.Name);
                                                                                    let next;
                                                                                    if (checked) {
                                                                                        next = [...current, p.Name];
                                                                                    } else {
                                                                                        next = current.filter((name: string) => name !== p.Name);
                                                                                    }
                                                                                    setPrices({...prices, activePrinters: next});
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Advanced System Settings */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                                                                <Zap className="h-4 w-4 text-indigo-600" />
                                                            </div>
                                                            <h3 className="font-black uppercase text-xs tracking-widest italic text-indigo-600">{renderString(t('printing:heavy_task_engine'), lang)}</h3>
                                                        </div>
                                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="space-y-0.5">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest italic">{renderString(t('printing:office_converter'), lang)}</Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-[9px] text-slate-400 font-bold uppercase">{renderString(t('printing:office_converter_desc'), lang)}</p>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-4 w-4 text-indigo-400 hover:text-indigo-600"
                                                                            onClick={async () => {
                                                                                const res = await socketRequest('system:detect-engines');
                                                                                if (res.success) {
                                                                                    const engines = res.engines;
                                                                                    if (engines.libreoffice.installed || engines.microsoft.installed) {
                                                                                        const found = [];
                                                                                        if (engines.libreoffice.installed) found.push("LibreOffice");
                                                                                        if (engines.microsoft.installed) found.push("Microsoft Office");
                                                                                        toast.success(renderString(t('printing:engines_found', { list: found.join(", ") }), lang));
                                                                                        if (engines.libreoffice.installed) setPrices({...prices, officeConverterType: 'libreoffice', libreofficePath: engines.libreoffice.path});
                                                                                        else if (engines.microsoft.installed) setPrices({...prices, officeConverterType: 'microsoft'});
                                                                                    } else {
                                                                                        toast.error(renderString(t('printing:no_engine_detected'), lang));
                                                                                    }
                                                                                }
                                                                            }}
                                                                            title={renderString(t('printing:auto_detect_engines'), lang)}
                                                                        >
                                                                            <RefreshCcw className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        className="h-8 px-2 text-[9px] font-black uppercase italic border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                                                        onClick={async () => {
                                                                            const type = prices.officeConverterType || 'libreoffice';
                                                                            toast.loading(renderString(t('printing:testing_engine', { type }), lang), { id: 'test-engine' });
                                                                            const res = await socketRequest('system:test-engine', { type });
                                                                            if (res.success) toast.success(res.message, { id: 'test-engine' });
                                                                            else toast.error(res.error, { id: 'test-engine' });
                                                                        }}
                                                                    >
                                                                        {renderString(t('printing:test'), lang)}
                                                                    </Button>
                                                                    <select 
                                                                        className="h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-[10px] font-bold uppercase transition-all focus:ring-2 focus:ring-primary/20 outline-none"
                                                                        value={prices.officeConverterType || 'libreoffice'}
                                                                        onChange={(e) => setPrices({...prices, officeConverterType: e.target.value})}
                                                                    >
                                                                        <option value="libreoffice">{renderString(t('printing:libreoffice_local'), lang)}</option>
                                                                        <option value="microsoft">{renderString(t('printing:microsoft_office_com'), lang)}</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            {prices.officeConverterType === 'libreoffice' && (
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest italic flex items-center gap-1.5">
                                                                        {renderString(t('printing:libreoffice_path'), lang)}
                                                                        <span className="text-[9px] text-slate-400 font-medium normal-case">{renderString(t('printing:soffice_path_notice'), lang)}</span>
                                                                    </Label>
                                                                    <Input
                                                                        className="h-8 text-[11px] font-mono bg-white/50 border-dashed"
                                                                        placeholder="C:\Program File\LibreOffice\program\soffice.exe"
                                                                        value={prices.libreofficePath || ''}
                                                                        onChange={(e) => setPrices({...prices, libreofficePath: e.target.value})}
                                                                    />
                                                                </div>
                                                            )}

                                                            <Separator className="bg-slate-200/50 dark:bg-slate-800/50" />

                                                            <div className="flex items-center justify-between">
                                                                <div className="space-y-0.5">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest italic">{renderString(t('printing:max_archive_size'), lang)}</Label>
                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{renderString(t('printing:max_archive_size_desc'), lang)}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Input 
                                                                        type="number"
                                                                        className="h-8 w-20 text-[10px] font-bold text-center bg-white dark:bg-slate-900"
                                                                        value={Math.round((prices.maxArchiveSize || 104857600) / (1024 * 1024))}
                                                                        onChange={(e) => setPrices({...prices, maxArchiveSize: (parseInt(e.target.value) || 0) * 1024 * 1024})}
                                                                    />
                                                                    <span className="text-[8px] font-black uppercase text-slate-400">{renderString(t('printing:mb'), lang)}</span>
                                                                </div>
                                                            </div>

                                                            <Separator className="bg-slate-200/50 dark:bg-slate-800/50" />

                                                            <div className="flex items-center justify-between">
                                                                <div className="space-y-0.5">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest italic">{renderString(t('printing:auto_cleanup_archives'), lang)}</Label>
                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{renderString(t('printing:delete_archives_desc'), lang)}</p>
                                                                </div>
                                                                <Switch 
                                                                    checked={prices.deleteArchivesAfterExtraction !== false}
                                                                    onCheckedChange={(checked) => setPrices({...prices, deleteArchivesAfterExtraction: checked})}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                                    </AccordionItem>

                                                    {/* A4 Pricing Section */}
                                                    <AccordionItem value="pricing_a4" className="border-none border-t border-slate-100">
                                                        <AccordionTrigger className="px-8 py-4 hover:bg-slate-50/50 hover:no-underline">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="h-4 w-4 text-blue-600" />
                                                                <span className="text-xs font-black uppercase tracking-wider">{renderString(t('printing:pricing_a4_tiers'), lang)}</span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-8 pb-8 pt-2">
                                                            <div className="space-y-12">
                                                                {/* B&W Tiers Grid */}
                                                                <div className="grid gap-8 md:grid-cols-2">
                                                        {/* B&W A4 */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                                        <FileText className="h-4 w-4 text-slate-600" />
                                                                    </div>
                                                                    <h3 className="font-black uppercase text-xs tracking-widest italic">{renderString(t('printing:bw_tiers_a4'), lang)}</h3>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" size="sm" className="h-7 px-2 text-[9px] uppercase font-black border-dashed"
                                                                    onClick={() => {
                                                                        const newTiers = [...(prices.bwTiers || []), { maxPages: 0, priceNormal: 0, priceFull: 0 }];
                                                                        setPrices({...prices, bwTiers: newTiers});
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add_tier'), lang)}
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(prices.bwTiers || []).map((tier: any, i: number) => (
                                                                    <div key={i} className="flex gap-2 items-end group">
                                                                        <div className="flex-[0.8] space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:max_pgs'), lang)}</Label>
                                                                            <Input type="number" value={tier.maxPages} onChange={(e) => {
                                                                                const newTiers = [...prices.bwTiers];
                                                                                newTiers[i].maxPages = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bwTiers: newTiers});
                                                                            }} className="h-8 text-xs font-bold" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:normal_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceNormal} onChange={(e) => {
                                                                                const newTiers = [...prices.bwTiers];
                                                                                newTiers[i].priceNormal = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bwTiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:full_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceFull} onChange={(e) => {
                                                                                const newTiers = [...prices.bwTiers];
                                                                                newTiers[i].priceFull = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bwTiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                            const newTiers = prices.bwTiers.filter((_: any, idx: number) => idx !== i);
                                                                            setPrices({...prices, bwTiers: newTiers});
                                                                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Color A4 */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                                                                        <Layers className="h-4 w-4 text-indigo-600" />
                                                                    </div>
                                                                    <h3 className="font-black uppercase text-xs tracking-widest italic text-indigo-600">{renderString(t('printing:color_tiers_a4'), lang)}</h3>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" size="sm" className="h-7 px-2 text-[9px] uppercase font-black border-dashed"
                                                                    onClick={() => {
                                                                        const newTiers = [...(prices.colorTiers || []), { maxPages: 0, priceNormal: 0, priceFull: 0 }];
                                                                        setPrices({...prices, colorTiers: newTiers});
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add_tier'), lang)}
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(prices.colorTiers || []).map((tier: any, i: number) => (
                                                                    <div key={i} className="flex gap-2 items-end group">
                                                                        <div className="flex-[0.8] space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:max_pgs'), lang)}</Label>
                                                                            <Input type="number" value={tier.maxPages} onChange={(e) => {
                                                                                const newTiers = [...prices.colorTiers];
                                                                                newTiers[i].maxPages = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, colorTiers: newTiers});
                                                                            }} className="h-8 text-xs font-bold" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:normal_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceNormal} onChange={(e) => {
                                                                                const newTiers = [...prices.colorTiers];
                                                                                newTiers[i].priceNormal = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, colorTiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:full_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceFull} onChange={(e) => {
                                                                                const newTiers = [...prices.colorTiers];
                                                                                newTiers[i].priceFull = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, colorTiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                            const newTiers = prices.colorTiers.filter((_: any, idx: number) => idx !== i);
                                                                            setPrices({...prices, colorTiers: newTiers});
                                                                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        {/* A3 Pricing Section */}
                                                    <AccordionItem value="pricing_a3" className="border-none border-t border-slate-100">
                                                        <AccordionTrigger className="px-8 py-4 hover:bg-slate-50/50 hover:no-underline">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="h-4 w-4 text-blue-600" />
                                                                <span className="text-xs font-black uppercase tracking-wider">{renderString(t('printing:pricing_a3_tiers'), lang)}</span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-8 pb-8 pt-2">
                                                            {/* A3 Tiers Grid */}
                                                            <div className="grid gap-8 md:grid-cols-2">
                                                        {/* B&W A3 */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                                        <FileText className="h-4 w-4 text-slate-600" />
                                                                    </div>
                                                                    <h3 className="font-black uppercase text-xs tracking-widest italic">{renderString(t('printing:bw_tiers_a3'), lang)}</h3>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" size="sm" className="h-7 px-2 text-[9px] uppercase font-black border-dashed"
                                                                    onClick={() => {
                                                                        const newTiers = [...(prices.bwA3Tiers || []), { maxPages: 0, priceNormal: 0, priceFull: 0 }];
                                                                        setPrices({...prices, bwA3Tiers: newTiers});
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add_tier'), lang)}
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(prices.bwA3Tiers || []).map((tier: any, i: number) => (
                                                                    <div key={i} className="flex gap-2 items-end group">
                                                                        <div className="flex-[0.8] space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:max_pgs'), lang)}</Label>
                                                                            <Input type="number" value={tier.maxPages} onChange={(e) => {
                                                                                const newTiers = [...prices.bwA3Tiers];
                                                                                newTiers[i].maxPages = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bwA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs font-bold" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:normal_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceNormal} onChange={(e) => {
                                                                                const newTiers = [...prices.bwA3Tiers];
                                                                                newTiers[i].priceNormal = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bwA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:full_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceFull} onChange={(e) => {
                                                                                const newTiers = [...prices.bwA3Tiers];
                                                                                newTiers[i].priceFull = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bwA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                            const newTiers = prices.bwA3Tiers.filter((_: any, idx: number) => idx !== i);
                                                                            setPrices({...prices, bwA3Tiers: newTiers});
                                                                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Color A3 */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                                                                        <Layers className="h-4 w-4 text-indigo-600" />
                                                                    </div>
                                                                    <h3 className="font-black uppercase text-xs tracking-widest italic text-indigo-600">{renderString(t('printing:color_tiers_a3'), lang)}</h3>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" size="sm" className="h-7 px-2 text-[9px] uppercase font-black border-dashed"
                                                                    onClick={() => {
                                                                        const newTiers = [...(prices.colorA3Tiers || []), { maxPages: 0, priceNormal: 0, priceFull: 0 }];
                                                                        setPrices({...prices, colorA3Tiers: newTiers});
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add_tier'), lang)}
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(prices.colorA3Tiers || []).map((tier: any, i: number) => (
                                                                    <div key={i} className="flex gap-2 items-end group">
                                                                        <div className="flex-[0.8] space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:max_pgs'), lang)}</Label>
                                                                            <Input type="number" value={tier.maxPages} onChange={(e) => {
                                                                                const newTiers = [...prices.colorA3Tiers];
                                                                                newTiers[i].maxPages = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, colorA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs font-bold" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:normal_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceNormal} onChange={(e) => {
                                                                                const newTiers = [...prices.colorA3Tiers];
                                                                                newTiers[i].priceNormal = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, colorA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:full_price'), lang)}</Label>
                                                                            <Input type="number" value={tier.priceFull} onChange={(e) => {
                                                                                const newTiers = [...prices.colorA3Tiers];
                                                                                newTiers[i].priceFull = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, colorA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                            const newTiers = prices.colorA3Tiers.filter((_: any, idx: number) => idx !== i);
                                                                            setPrices({...prices, colorA3Tiers: newTiers});
                                                                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>

                                            {/* Special Services Section */}
                                                    <AccordionItem value="services" className="border-none border-t border-slate-100">
                                                        <AccordionTrigger className="px-8 py-4 hover:bg-slate-50/50 hover:no-underline">
                                                            <div className="flex items-center gap-2">
                                                                <Star className="h-4 w-4 text-blue-600" />
                                                                <span className="text-xs font-black uppercase tracking-wider">{renderString(t('printing:special_services'), lang)}</span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="px-8 pb-8 pt-2">
                                                            {/* Services Grid (Binding, Cardboard A4, Cardboard A3) */}
                                                            <div className="grid gap-8 md:grid-cols-3">
                                                        {/* Binding */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                                                                        <BookOpen className="h-4 w-4 text-amber-600" />
                                                                    </div>
                                                                    <h3 className="font-black uppercase text-[10px] tracking-widest italic text-amber-600">{renderString(t('printing:binding'), lang)}</h3>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" size="sm" className="h-7 px-2 text-[9px] uppercase font-black border-dashed"
                                                                    onClick={() => {
                                                                        const newTiers = [...(prices.bindingTiers || []), { maxPages: 0, price: 0 }];
                                                                        setPrices({...prices, bindingTiers: newTiers});
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add'), lang)}
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(prices.bindingTiers || []).map((tier: any, i: number) => (
                                                                    <div key={i} className="flex gap-2 items-end group">
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:max_pgs'), lang)}</Label>
                                                                            <Input type="number" value={tier.maxPages} onChange={(e) => {
                                                                                const newTiers = [...prices.bindingTiers];
                                                                                newTiers[i].maxPages = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bindingTiers: newTiers});
                                                                            }} className="h-8 text-xs font-bold" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:price'), lang)}</Label>
                                                                            <Input type="number" value={tier.price} onChange={(e) => {
                                                                                const newTiers = [...prices.bindingTiers];
                                                                                newTiers[i].price = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, bindingTiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                            const newTiers = prices.bindingTiers.filter((_: any, idx: number) => idx !== i);
                                                                            setPrices({...prices, bindingTiers: newTiers});
                                                                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Cardboard A4 */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                                                                        <Square className="h-4 w-4 text-emerald-600" />
                                                                    </div>
                                                                    <h3 className="font-black uppercase text-[10px] tracking-widest italic text-emerald-600">{renderString(t('printing:cardboard_a4'), lang)}</h3>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" size="sm" className="h-7 px-2 text-[9px] uppercase font-black border-dashed"
                                                                    onClick={() => {
                                                                        const newTiers = [...(prices.cardboardA4Tiers || []), { maxPages: 0, price: 0 }];
                                                                        setPrices({...prices, cardboardA4Tiers: newTiers});
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add'), lang)}
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(prices.cardboardA4Tiers || []).map((tier: any, i: number) => (
                                                                    <div key={i} className="flex gap-2 items-end group">
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:max_shts'), lang)}</Label>
                                                                            <Input type="number" value={tier.maxPages} onChange={(e) => {
                                                                                const newTiers = [...prices.cardboardA4Tiers];
                                                                                newTiers[i].maxPages = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, cardboardA4Tiers: newTiers});
                                                                            }} className="h-8 text-xs font-bold" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:price'), lang)}</Label>
                                                                            <Input type="number" value={tier.price} onChange={(e) => {
                                                                                const newTiers = [...prices.cardboardA4Tiers];
                                                                                newTiers[i].price = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, cardboardA4Tiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                            const newTiers = prices.cardboardA4Tiers.filter((_: any, idx: number) => idx !== i);
                                                                            setPrices({...prices, cardboardA4Tiers: newTiers});
                                                                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Cardboard A3 */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                                                                        <Square className="h-4 w-4 text-emerald-600" />
                                                                    </div>
                                                                    <h3 className="font-black uppercase text-[10px] tracking-widest italic text-emerald-600">{renderString(t('printing:cardboard_a3'), lang)}</h3>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" size="sm" className="h-7 px-2 text-[9px] uppercase font-black border-dashed"
                                                                    onClick={() => {
                                                                        const newTiers = [...(prices.cardboardA3Tiers || []), { maxPages: 0, price: 0 }];
                                                                        setPrices({...prices, cardboardA3Tiers: newTiers});
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" /> {renderString(t('printing:add_tier'), lang)}
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(prices.cardboardA3Tiers || []).map((tier: any, i: number) => (
                                                                    <div key={i} className="flex gap-2 items-end group">
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:max_shts'), lang)}</Label>
                                                                            <Input type="number" value={tier.maxPages} onChange={(e) => {
                                                                                const newTiers = [...prices.cardboardA3Tiers];
                                                                                newTiers[i].maxPages = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, cardboardA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs font-bold" />
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold text-slate-400">{renderString(t('printing:price'), lang)}</Label>
                                                                            <Input type="number" value={tier.price} onChange={(e) => {
                                                                                const newTiers = [...prices.cardboardA3Tiers];
                                                                                newTiers[i].price = parseInt(e.target.value) || 0;
                                                                                setPrices({...prices, cardboardA3Tiers: newTiers});
                                                                            }} className="h-8 text-xs" />
                                                                        </div>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                            const newTiers = prices.cardboardA3Tiers.filter((_: any, idx: number) => idx !== i);
                                                                            setPrices({...prices, cardboardA3Tiers: newTiers});
                                                                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </>
                                    )}
                                </Accordion>
                            </CardContent>
                                    <CardFooter className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-t flex justify-between items-center">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase italic">{renderString(t('printing:prices_decimal_notice'), lang)}</p>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                        )}
                    </Tabs>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    <PrintingHistory 
                        historyJobs={historyJobs}
                        savedSessions={savedSessions}
                        setSelectedSession={setSelectedSession}
                        setIsSessionDialogOpen={setIsSessionDialogOpen}
                        getStatusBadge={getStatusBadge}
                        lang={lang || 'ro'}
                    />
                </TabsContent>
            </Tabs>

            {/* Edit Job Dialog */}
            <JobConfigDialog 
                isOpen={isJobDialogOpen}
                onOpenChange={setIsJobDialogOpen}
                job={editingJob}
                prices={prices}
                onUpdate={updateJob}
                t={t}
                lang={lang || 'ro'}
            />

            {/* Saved Order Detail Dialog */}
            <SessionDetailDialog 
                isOpen={isSessionDialogOpen}
                onOpenChange={setIsSessionDialogOpen}
                selectedSession={selectedSession}
                setLocalJobs={setLocalJobs}
            />

            {/* Save Order Modal */}
            <SaveSessionDialog 
                isOpen={isSaveModalOpen}
                onOpenChange={setIsSaveModalOpen}
                onSave={(sessionData) => {
                    saveSession(sessionData.name, {
                        customerName: sessionData.customerName,
                        customerPhone: sessionData.customerPhone,
                        customerEmail: sessionData.customerEmail,
                        contactId: sessionData.contactId
                    });
                }}
                totalAmount={totalPrice}
            />

            {/* Document Preview */}
            {(() => {
                // Priority to previewItem (deep link)
                if (previewItem) {
                    return (
                        <DocumentPreview 
                            isOpen={isPreviewOpen}
                            onOpenChange={(open) => {
                                setIsPreviewOpen(open);
                                if (!open) setPreviewItem(null);
                            }}
                            fileUrl={`/api/File/download?path=${encodeURIComponent(previewItem.fullPath)}`}
                            fileName={previewItem.name || 'document'}
                            filePath={previewItem.fullPath}
                        />
                    );
                }

                const job = localJobs.find(j => j.id === selectedJobId);
                if (!job) return null;
                return (
                    <DocumentPreview 
                        isOpen={isPreviewOpen}
                        onOpenChange={setIsPreviewOpen}
                        fileUrl={job.fileUrl || ''}
                        fileName={job.File?.name || 'document'}
                        fileType={job.File?.type}
                        fileSize={job.File?.size}
                        previewUrl={job.previewUrl}
                        filePath={job.remotePath}
                    >
                        <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{renderString(t('common:status'), lang)}</span>
                                    <Badge className="bg-emerald-500/20 text-emerald-500 border-none px-2 py-0 text-[10px] font-black uppercase tracking-tighter mt-1 italic">
                                        {renderString(t('printing:active_queue'), lang)}
                                    </Badge>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{renderString(t('common:pages'), lang)}</span>
                                    <span className="text-white font-black text-sm italic">{job.pagesBW + job.pagesColor}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{renderString(t('printing:copies'), lang)}</span>
                                    <span className="text-white font-black text-sm italic">{job.copies}</span>
                                </div>
                            </div>
                            
                            <Button 
                                className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-2xl shadow-lg shadow-white/5"
                                onClick={() => {
                                    setIsPreviewOpen(false);
                                    setIsJobDialogOpen(true);
                                }}
                            >
                                <Settings2 className="h-4 w-4 mr-2" />
                                {renderString(t('printing:edit_configuration'), lang)}
                            </Button>
                        </div>
                    </DocumentPreview>
                );
            })()}

            <LoadingOverlay isVisible={refreshing} message={renderString(t('common:please_wait'), lang)} />
        </div>
    );
}


