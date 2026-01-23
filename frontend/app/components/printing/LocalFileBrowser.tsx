import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { Folder, File, ChevronRight, ChevronLeft, Download, Trash2, RefreshCcw, Search, HardDrive, Activity, Server, FileText, FileImage, FileArchive, FileSpreadsheet, Presentation, SearchX, ArrowUpDown, Plus, Square, MessageSquare, LayoutGrid, User, MoreVertical, ArrowLeft, RefreshCw, X, Tag, Printer, Eye } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { Checkbox } from '~/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TagSelector } from '~/components/ui/tag-selector';
import { api, socket, socketRequest } from '~/lib/core';
import { toast } from 'sonner';
import { cn } from '~/lib/core';
import { FileDetailsPanel } from './FileDetailsPanel';
import { DocumentPreview } from './DocumentPreview';

interface BrowserItem {
    name: string;
    isDirectory: boolean;
    size: number;
    mtime: string;
    ext: string;
    fullPath: string; // Changed from fullPath?: string to string since it's almost always there
    source?: string;
    tag?: any[];
    notes?: string;
    contactId?: string | null;
    contact?: { id: string, name?: string, email?: string } | null;
}

export function LocalFileBrowser() {
    const [path, setPath] = useState('');
    const [items, setItems] = useState<BrowserItem[]>([]);
    const [recentArrivals, setRecentArrivals] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{fullPath: string, name: string} | null>(null);
    
    const [sources, setSources] = useState<{name: string, path: string}[]>([]);
    const [currentSource, setCurrentSource] = useState('inbox'); // 'inbox' or absolute path
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [previewItem, setPreviewItem] = useState<BrowserItem | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
    const [searchParams] = useSearchParams();
    const initialPath = searchParams.get('path');
    
    const [sortConfig, setSortConfig] = useState<{key: keyof BrowserItem, direction: 'asc' | 'desc'}>({
        key: 'name',
        direction: 'asc'
    });

    useEffect(() => {
        fetchRecentArrivals();
        fetchSources();
        
        if (initialPath) {
            // If the path looks like an absolute path (or from search), try to load its parent or itself
            const isAbsolute = initialPath.includes(':') || initialPath.startsWith('/') || initialPath.startsWith('\\');
            if (isAbsolute) {
                // If it's a file, we want the directory
                const lastSlash = Math.max(initialPath.lastIndexOf('/'), initialPath.lastIndexOf('\\'));
                const dir = lastSlash > -1 ? initialPath.substring(0, lastSlash) : '';
                const file = lastSlash > -1 ? initialPath.substring(lastSlash + 1) : initialPath;
                
                fetchDir(dir).then(() => {
                    // Pre-select the file if it was part of the path
                    if (file) {
                        setSelectedPaths(new Set([initialPath]));
                    }
                });
            } else {
                fetchDir(initialPath);
            }
        } else {
            fetchDir('');
        }
    }, [initialPath]); // Re-run if path changes in URL

    const fetchRecentArrivals = async () => {
        try {
            const res = await api.local.get('printing/recent-arrivals');
            if (res.success) {
                setRecentArrivals(res.data || res);
            }
        } catch (e) {}
    };

    const fetchSources = async () => {
        try {
            const res = await api.local.get('system/printing/config');
            if (res.success && res.config) {
                const paths = (res.config.networkDrivePaths || []).map((p: string) => ({
                    name: p.split(/[\\/]/).pop() || p,
                    path: p
                }));
                setSources([{ name: 'Local Inbox', path: 'inbox' }, ...paths]);
            }
        } catch (e) {}
    };

    const fetchDir = async (newPath: string, source = currentSource) => {
        setLoading(true);
        setIsSearchingGlobal(false);
        try {
            const res = await api.local.get(`file/local/browser?path=${encodeURIComponent(newPath)}&source=${encodeURIComponent(source)}`);
            if (res.success) {
                // res is already the data object (not nested under res.data)
                setItems(res.items);
                setPath(newPath);
                setCurrentSource(source);
                setSelectedPaths(new Set());
            } else {
                toast.error(res.error || "Failed to load directory");
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalSearch = async () => {
        if (!search.trim()) {
            fetchDir('');
            return;
        }
        setLoading(true);
        setIsSearchingGlobal(true);
        try {
            // If search starts with a comma, treat as contact search (local DB) — works offline
            if (search.trim().startsWith(',')) {
                const q = search.trim().substring(1).trim();
                // Use socket db:list for contact with query filter
                try {
                    const res: any = await socketRequest('db:list', { collection: 'contact', filters: { query: q }, page: 1, pageSize: 100 });
                    if (res?.success) {
                        // Map contact to BrowserItem-like objects for display
                        const mapped = (res.data || res).map((c: any) => ({
                            name: c.name || c.email || c.id,
                            isDirectory: false,
                            size: 0,
                            mtime: c.updatedAt || c.createdAt || new Date().toISOString(),
                            ext: '',
                            fullPath: `contact:${c.id}`,
                            source: 'contact',
                            tag: c.tag || [],
                            notes: c.notes || '',
                            contactId: c.id,
                            contact: c
                        }));
                        setItems(mapped);
                        setSelectedPaths(new Set());
                    }
                } catch (err) {
                    toast.error('Contact search failed');
                }
                return;
            }

            // Prefer socket-based paginated search against local file_index
            try {
                const res: any = await socketRequest('file:list', { page: 1, pageSize: 100, query: search });
                if (res?.success) {
                    setItems(res.data || res);
                    setSelectedPaths(new Set());
                } else {
                    // Fallback to HTTP API if socket returns failure
                    const httpRes = await api.local.get(`file/search?q=${encodeURIComponent(search)}`);
                    if (httpRes.success) setItems(httpRes.items || httpRes.data?.items || []);
                }
            } catch (e) {
                // Socket failed — fallback to HTTP
                const httpRes = await api.local.get(`file/search?q=${encodeURIComponent(search)}`);
                if (httpRes.success) setItems(httpRes.items || httpRes.data?.items || []);
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialPath) {
            fetchDir('');
        }
    }, []);

    const navigateTo = (item: BrowserItem) => {
        if (!item.isDirectory) return;
        const newPath = path ? `${path}/${item.name}` : item.name;
        fetchDir(newPath);
    };

    const goBack = () => {
        const parts = path.split(/[\\\/]/);
        parts.pop();
        fetchDir(parts.join('/'));
    };

    const toggleSort = (key: keyof BrowserItem) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedItems = useMemo(() => {
        const result = [...items];
        result.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            
            const valA = a[sortConfig.key] ?? '';
            const valB = b[sortConfig.key] ?? '';
            
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [items, sortConfig]);

    const filteredItems = sortedItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || isSearchingGlobal);

    const toggleSelect = (fullPath: string) => {
        const next = new Set(selectedPaths);
        if (next.has(fullPath)) next.delete(fullPath);
        else next.add(fullPath);
        setSelectedPaths(next);
    };

    const toggleSelectAll = () => {
        if (selectedPaths.size === filteredItems.filter(i => !i.isDirectory).length) {
            setSelectedPaths(new Set());
        } else {
            const next = new Set<string>();
            filteredItems.forEach(i => {
                if (!i.isDirectory && i.fullPath) next.add(i.fullPath);
            });
            setSelectedPaths(next);
        }
    };

    const handleAddToPrint = () => {
        if (selectedPaths.size === 0) return;
        
        const stored = localStorage.getItem('print_queue');
        let currentQueue = [];
        try { currentQueue = JSON.parse(stored || '[]'); } catch (e) {}
        
        const newJobs = Array.from(selectedPaths).map(fullPath => {
            const item = items.find(i => i.fullPath === fullPath);
            return {
                id: Math.random().toString(36).substr(2, 9),
                filename: item?.name || fullPath.split(/[\\/]/).pop(),
                remotePath: fullPath,
                copies: 1,
                pagesBW: 1,
                pagesColor: 0,
                numPages: 1,
                isBound: false,
                isA3: false,
                isCardboard: false,
                isFullCoverage: false,
                uploading: false,
                timestamp: Date.now()
            };
        });
        
        localStorage.setItem('print_queue', JSON.stringify([...currentQueue, ...newJobs]));
        window.dispatchEvent(new Event('print-queue-updated'));
        toast.success(`${newJobs.length} file added to print queue`);
        setSelectedPaths(new Set());
    };

    const handleDeleteSelected = async () => {
        if (selectedPaths.size === 0) return;
        const confirm = window.confirm(`Ești sigur că vrei să ștergi ${selectedPaths.size} fișiere? Această acțiune este ireversibilă.`);
        if (!confirm) return;

        setLoading(true);
        try {
            const res = await api.local.delete('file/local', { 
                data: { paths: Array.from(selectedPaths) } 
            });
            if (res.success) {
                toast.success(`Șters ${res.deleted?.length || 0} fișiere`);
                setSelectedPaths(new Set());
                fetchDir(path); // Refresh current dir
            } else {
                toast.error(res.error || "Eroare la ștergere");
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRecentClick = (file: any) => {
        const stored = localStorage.getItem('print_queue');
        let currentQueue = [];
        try { currentQueue = JSON.parse(stored || '[]'); } catch (e) {}
        
        const newJob = {
            id: Math.random().toString(36).substr(2, 9),
            filename: file.name,
            remotePath: file.fullPath,
            copies: 1,
            pagesBW: 1,
            pagesColor: 0,
            numPages: 1,
            isBound: false,
            isA3: false,
            isCardboard: false,
            isFullCoverage: false,
            uploading: false,
            timestamp: Date.now()
        };
        
        localStorage.setItem('print_queue', JSON.stringify([...currentQueue, newJob]));
        window.dispatchEvent(new Event('print-queue-updated'));
        toast.success(`File "${file.name}" added to print queue`);
    };

    const handleAddArrivalToQueue = (arrival: any) => {
        const stored = localStorage.getItem('print_queue');
        let currentQueue = [];
        try { currentQueue = JSON.parse(stored || '[]'); } catch (e) {}
        
        const newJobs = arrival.file.map((file: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            filename: file.name,
            remotePath: file.fullPath,
            copies: 1,
            pagesBW: 1,
            pagesColor: 0,
            numPages: 1,
            isBound: false,
            isA3: false,
            isCardboard: false,
            isFullCoverage: false,
            uploading: false,
            timestamp: Date.now()
        }));
        
        localStorage.setItem('print_queue', JSON.stringify([...currentQueue, ...newJobs]));
        window.dispatchEvent(new Event('print-queue-updated'));
        toast.success(`${newJobs.length} file from ${arrival.senderName} added to queue`);
    };

    const handleEditMetadata = async (item: BrowserItem) => {
        try {
            const newNotes = window.prompt('Notes for file:', item.notes || '') || '';
            let contactId: string | null = item.contactId || '';
            const newContact = window.prompt('Contact ID (leave empty to clear):', contactId || '');
            contactId = newContact === null ? contactId : (newContact.trim() || null);

            const res: any = await socketRequest('file:update-metadata', { fullPath: item.fullPath, notes: newNotes, contactId });
            if (res?.success) {
                // Update local item - socket response has data nested under res.data
                item.notes = res.notes || res.data?.notes || '';
                item.contactId = res.contactId || res.data?.contactId || null;
                if (item.contactId) {
                    try { 
                        const contactRes: any = await socketRequest('db:get', { collection: 'contact', id: item.contactId });
                        if (contactRes?.success) item.contact = contactRes || contactRes.data;
                        else item.contact = null;
                    } catch (e) { item.contact = null; }
                } else {
                    item.contact = null;
                }
                setItems(prev => [...prev]);
                toast.success('Metadata updated');
            } else {
                toast.error(res?.error || 'Failed to update metadata');
            }
        } catch (e: any) {
            toast.error(e.message || 'Error');
        }
    };

    const getFileIcon = (item: BrowserItem) => {
        if (item.isDirectory) return <Folder className="h-4 w-4 text-amber-500 fill-amber-500/20" />;
        const ext = item.ext.toLowerCase();
        if (['.jpg', '.png', '.gif', '.svg', '.webp'].includes(ext)) return <FileImage className="h-4 w-4 text-emerald-500" />;
        if (['.pdf', '.docx', '.doc', '.odt', '.rtf', '.txt', '.pages'].includes(ext)) return <FileText className="h-4 w-4 text-blue-500" />;
        if (['.xlsx', '.xls', '.csv', '.ods', '.numbers'].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
        if (['.pptx', '.ppt', '.odp', '.key'].includes(ext)) return <Presentation className="h-4 w-4 text-orange-500" />;
        if (['.zip', '.rar', '.7z', '.tar'].includes(ext)) return <FileArchive className="h-4 w-4 text-purple-500" />;
        return <File className="h-4 w-4 text-slate-400" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 overflow-hidden rounded-3xl">
            <CardHeader className="border-b bg-slate-50/50 p-6 dark:bg-slate-800/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight italic">
                                <HardDrive className="h-5 w-5 text-primary" />
                                File Explorer
                            </CardTitle>
                            <CardDescription className="font-mono text-[10px] uppercase mt-1">
                                {isSearchingGlobal ? 'Global Search Results' : (path ? path.replace(/\//g, '') : 'ROOT')}
                            </CardDescription>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                            <Input 
                                placeholder="Search file (Enter for global)..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                                className="pl-9 h-10 w-64 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-primary shadow-sm"
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={() => (isSearchingGlobal ? handleGlobalSearch() : fetchDir(path))} disabled={loading} className="rounded-xl">
                            <RefreshCcw className={loading ? "animate-spin" : ""} size={16} />
                        </Button>
                        {selectedPaths.size > 0 && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                                <Button 
                                    variant="destructive" 
                                    className="rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
                                    onClick={handleDeleteSelected}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Șterge ({selectedPaths.size})
                                </Button>
                                <Button 
                                    className="rounded-xl px-4 h-10 bg-primary hover:bg-primary/90 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20" 
                                    onClick={handleAddToPrint}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add {selectedPaths.size} to Queue
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs defaultValue="recent" className="w-full">
                    <div className="px-6 py-2 border-b bg-slate-50/30 dark:bg-slate-800/20">
                        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                            <TabsTrigger value="recent" className="text-[10px] font-black uppercase tracking-widest gap-2">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Recent Arrivals
                                {recentArrivals.length > 0 && (
                                    <span className="bg-primary text-white text-[8px] px-1.5 rounded-full">
                                        {recentArrivals.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="browser" className="text-[10px] font-black uppercase tracking-widest gap-2">
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Browser
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="recent" className="m-0 p-6 min-h-[400px]">
                        {recentArrivals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                                <p className="font-black uppercase tracking-widest text-xs">No recent arrivals</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Latest Unprocessed Arrivals</h3>
                                    <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase tracking-widest text-primary" onClick={fetchRecentArrivals}>
                                        <RefreshCcw className="h-2.5 w-2.5 mr-1" /> refresh
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {recentArrivals.map((notif) => (
                                        <div key={notif.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-primary/30 transition-all flex flex-col">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={cn(
                                                    "w-7 h-7 rounded-lg flex items-center justify-center text-white",
                                                    notif.source === 'whatsapp' ? "bg-emerald-500" : "bg-blue-500"
                                                )}>
                                                    {notif.source === 'whatsapp' ? <Plus className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-black uppercase tracking-tight truncate leading-tight italic">{notif.senderName}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {notif.source}
                                                    </p>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 text-primary hover:bg-primary/5"
                                                    title="Add all to queue"
                                                    onClick={() => handleAddArrivalToQueue(notif)}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            
                                            {notif.body && (
                                                <p className="text-[9px] text-slate-500 mb-3 bg-slate-50 p-2 rounded-lg line-clamp-2 italic">
                                                    "{notif.body}"
                                                </p>
                                            )}

                                            <div className="space-y-1.5 mt-auto">
                                                {notif.file.map((f: any) => (
                                                    <button
                                                        key={f.id}
                                                        onClick={() => handleRecentClick(f)}
                                                        className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-left group"
                                                    >
                                                        <FileText className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                                                        <span className="text-[10px] font-bold uppercase truncate flex-1">{f.name}</span>
                                                        <div className="opacity-0 group-hover:opacity-100 p-1 bg-primary/10 rounded-md">
                                                            <Plus className="h-2.5 w-2.5 text-primary" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="browser" className="m-0">
                        <div className="flex items-center justify-between p-4 bg-slate-50 border-b gap-4">
                            {!isSearchingGlobal && (
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                                    <Button variant="ghost" size="sm" onClick={() => fetchDir('')} className="h-7 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10">Root</Button>
                                    {path.split(/[\\\/]/).filter(p => p).map((part, idx, arr) => (
                                        <React.Fragment key={idx}>
                                            <ChevronRight className="h-3 w-3 text-slate-400" />
                                            <Button
                                                variant="ghost" size="sm"
                                                onClick={() => fetchDir(arr.slice(0, idx+1).join('/'))}
                                                className="h-7 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200"
                                            >
                                                {part}
                                            </Button>
                                        </React.Fragment>
                                    ))}
                                    {path && (
                                        <Button variant="outline" size="sm" onClick={goBack} className="ml-auto h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                                            <ChevronLeft className="mr-1 h-3 w-3" />
                                            Back
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Source Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Source:</span>
                                <select 
                                    className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-[10px] font-bold uppercase tracking-tight focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                    value={currentSource}
                                    onChange={(e) => fetchDir('', e.target.value)}
                                >
                                    {sources.map(s => (
                                        <option key={s.path} value={s.path}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                                    <TableRow>
                                        <TableHead className="w-[40px] pl-6">
                                            <Checkbox
                                                checked={selectedPaths.size > 0 && selectedPaths.size === filteredItems.filter(i => !i.isDirectory).length}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary"
                                            onClick={() => toggleSort('name')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </div>
                                        </TableHead>
                                        <TableHead
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary"
                                            onClick={() => toggleSort('size')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Size {sortConfig.key === 'size' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </div>
                                        </TableHead>
                                        <TableHead
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary"
                                            onClick={() => toggleSort('mtime')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Modified {sortConfig.key === 'mtime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </div>
                                        </TableHead>
                                        {isSearchingGlobal && (
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source</TableHead>
                                        )}
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etichete</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={isSearchingGlobal ? 6 : 5} className="h-64 text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <SearchX className="h-12 w-12 mb-4 opacity-20" />
                                                    <p className="font-black uppercase tracking-widest text-xs">No items found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((item, i) => (
                                            <TableRow
                                                key={item.fullPath || i}
                                                className={`group hover:bg-primary/5 cursor-pointer border-indigo-50/50 dark:border-slate-800/50 transition-colors ${selectedPaths.has(item.fullPath!) ? 'bg-primary/5' : ''}`}
                                                onClick={() => item.isDirectory ? navigateTo(item) : (item.fullPath && toggleSelect(item.fullPath))}
                                            >
                                                <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                                                    {!item.isDirectory && (
                                                        <Checkbox
                                                            checked={selectedPaths.has(item.fullPath!)}
                                                            onCheckedChange={() => toggleSelect(item.fullPath!)}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (item.isDirectory) {
                                                                navigateTo(item);
                                                            } else if (item.fullPath) {
                                                                setPreviewItem(item);
                                                                setIsPreviewOpen(true);
                                                            }
                                                        }}
                                                        className="flex items-center gap-3 w-full hover:text-primary transition-colors"
                                                    >
                                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm transition-transform group-hover:scale-110">
                                                            {getFileIcon(item)}
                                                        </div>
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-tight truncate max-w-[200px] md:max-w-md">
                                                                {item.name}
                                                            </span>
                                                            {item.isDirectory && <span className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest mt-0.5">Directory</span>}
                                                        </div>
                                                    </button>
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] text-slate-500">
                                                    {item.isDirectory ? '--' : formatSize(item.size)}
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] text-slate-500">
                                                    {new Date(item.mtime).toLocaleString()}
                                                </TableCell>
                                                {isSearchingGlobal && (
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-1 py-0">
                                                            {item.source}
                                                        </Badge>
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <TagSelector 
                                                        entityType="local_file"
                                                        entityId={item.fullPath}
                                                        initialTags={item.tag}
                                                        onTagsChange={(newTags) => {
                                                            item.tag = newTags;
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-[10px]">
                                                    {item.contact?.name || item.contactId || '-'}
                                                </TableCell>
                                                <TableCell className="text-[10px] max-w-[240px] truncate">
                                                    {item.notes || ''}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!item.isDirectory && (
                                                            <>
                                                                <Button 
                                                                    variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100 rounded-lg"
                                                                    onClick={() => {
                                                                        setPreviewItem(item);
                                                                        setIsPreviewOpen(true);
                                                                    }}
                                                                >
                                                                    <Eye size={14} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg">
                                                                    <Download size={14} />
                                                                </Button>
                                                            </>
                                                        )}
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100 rounded-lg" onClick={(e) => { e.stopPropagation(); handleEditMetadata(item); }} title="Edit metadata">
                                                                <FileText size={14} />
                                                            </Button>
                                                        {(isSearchingGlobal ? item.source === 'Inbox' : currentSource === 'inbox') && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg">
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
            {/* File Details Panel */}
            {selectedFile && (
                <FileDetailsPanel
                    filePath={selectedFile.fullPath}
                    fileName={selectedFile.name}
                    onClose={() => setSelectedFile(null)}
                />
            )}

            <DocumentPreview
                isOpen={isPreviewOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsPreviewOpen(false);
                        setPreviewItem(null);
                    }
                }}
                filePath={previewItem?.fullPath}
                fileUrl={previewItem ? `/api/file/download?path=${encodeURIComponent(previewItem.fullPath)}&source=${previewItem.source?.toLowerCase() || currentSource.toLowerCase()}` : ''}
                fileName={previewItem?.name || ''}
                fileType={previewItem?.name.split('.').pop()?.toLowerCase() || ''}
            />
        </Card>
    );
}

