import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "~/components/ui/dialog";
import { 
    Database, 
    Search, 
    ArrowRight, 
    Table as TableIcon, 
    AlertCircle, 
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Download
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "~/components/ui/table";
import { useTranslation } from "react-i18next";
import { socketRequest } from "~/lib/core";
import { toast } from "sonner";

interface DatabaseBrowserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tableData: any[]; // The metadata about tables
    initialTable?: string | null;
}

export const DatabaseBrowserDialog: React.FC<DatabaseBrowserDialogProps> = ({
    open,
    onOpenChange,
    tableData,
    initialTable
}) => {
    const { t } = useTranslation(['monitoring', 'common']);
    const [selectedTable, setSelectedTable] = useState<string | null>(initialTable || null);
    const [searchTable, setSearchTable] = useState("");
    const [rows, setRows] = useState<any[]>([]);
    const [columns, setColumns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 50;

    useEffect(() => {
        if (open && initialTable) {
            setSelectedTable(initialTable);
        }
    }, [open, initialTable]);

    useEffect(() => {
        if (selectedTable && open) {
            fetchRows();
        } else {
            setRows([]);
            setColumns([]);
            setTotal(0);
            setPage(1);
        }
    }, [selectedTable, page, open]);

    const fetchRows = async () => {
        if (!selectedTable) return;
        setLoading(true);
        try {
            const res = await socketRequest("monitoring:db:browse", { 
                table: selectedTable,
                page,
                pageSize
            });
            if (res.success) {
                setRows(res.data.rows || []);
                setColumns(res.data.columns || []);
                setTotal(res.data.total || 0);
            } else {
                toast.error(res.error || "Failed to fetch rows");
            }
        } catch (e) {
            toast.error("Internal socket error");
        } finally {
            setLoading(false);
        }
    };

    const filteredTables = tableData?.filter(t => 
        (t.table || t.name || "").toLowerCase().includes(searchTable.toLowerCase())
    ) || [];

    const totalPages = Math.ceil(total / pageSize);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none rounded-[2.5rem] bg-white/95 backdrop-blur-xl overflow-hidden shadow-2xl">
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Table List */}
                    <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30">
                        <DialogHeader className="p-8 pb-4">
                            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                                <Database className="h-6 w-6 text-primary" /> D1 Registry
                            </DialogTitle>
                            <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-2 italic">
                                Local SQLite & Cloud Sync
                            </DialogDescription>
                        </DialogHeader>

                        <div className="px-6 pb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                <Input 
                                    className="h-9 pl-9 rounded-xl text-xs bg-white border-slate-100" 
                                    placeholder="Find system tables..."
                                    value={searchTable}
                                    onChange={(e) => setSearchTable(e.target.value)}
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1 px-4">
                            <div className="space-y-1 pb-8">
                                {filteredTables.map((table) => {
                                    const tableName = table.table || table.name;
                                    const isSelected = selectedTable === tableName;
                                    return (
                                        <button
                                            key={tableName}
                                            onClick={() => {
                                                setSelectedTable(tableName);
                                                setPage(1);
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition-all group ${
                                                isSelected 
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                                : 'hover:bg-white text-slate-600'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <TableIcon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                                                <span className="text-[11px] font-black uppercase italic tracking-widest truncate max-w-[150px]">
                                                    {tableName.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <Badge className={`h-5 min-w-[32px] justify-center px-1 text-[9px] font-black italic rounded-lg border-none ${
                                                isSelected 
                                                ? 'bg-white/20 text-white' 
                                                : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {table.counts?.local ?? table.count ?? 0}
                                            </Badge>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Main View: Table Content */}
                    <div className="flex-1 flex flex-col bg-white overflow-hidden">
                        {selectedTable ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                                    <div>
                                        <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                                            {selectedTable}
                                            <Badge variant="outline" className="text-[9px] uppercase font-black italic border-slate-200">
                                                {total} Records
                                            </Badge>
                                        </h3>
                                        <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 mt-1">
                                            Local Database Browser • Page {page} of {totalPages || 1}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 rounded-lg"
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1 || loading}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-[10px] font-black italic px-2">{page}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 rounded-lg"
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page >= totalPages || loading}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="w-px h-6 bg-slate-100 mx-1" />
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-9 rounded-xl text-[10px] font-black uppercase italic gap-2"
                                            onClick={fetchRows}
                                            disabled={loading}
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
                                        </Button>
                                        <Button size="sm" className="h-9 rounded-xl text-[10px] font-black uppercase italic gap-2 shadow-lg shadow-primary/20">
                                            <Download className="h-3.5 w-3.5" /> Export
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-hidden relative">
                                    {loading && (
                                        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                                                <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 animate-pulse">Loading table data...</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <ScrollArea className="h-full">
                                        {rows.length > 0 ? (
                                            <div className="p-0">
                                                <Table>
                                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                                        <TableRow className="bg-slate-50/50 border-slate-100 hover:bg-slate-50/50">
                                                            {columns.map(col => (
                                                                <TableHead key={col.name} className="text-[9px] font-black uppercase tracking-widest text-slate-400 py-4 h-auto px-6">
                                                                    {col.name}
                                                                </TableHead>
                                                            ))}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {rows.map((row, idx) => (
                                                            <TableRow key={idx} className="hover:bg-slate-50/30 border-slate-50 transition-colors">
                                                                {columns.map(col => (
                                                                    <TableCell key={col.name} className="py-3 px-6 text-[11px] font-medium text-slate-600 max-w-[250px] truncate">
                                                                        {typeof row[col.name] === 'object' ? JSON.stringify(row[col.name]) : String(row[col.name] ?? '')}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ) : !loading && (
                                            <div className="flex flex-col items-center justify-center h-[50vh] opacity-40">
                                                <div className="text-center space-y-4">
                                                    <div className="h-20 w-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto border-2 border-slate-100 border-dashed">
                                                        <AlertCircle className="h-8 w-8 text-slate-300" />
                                                    </div>
                                                    <p className="text-sm font-black uppercase italic tracking-widest">No records found</p>
                                                    <p className="text-[10px] max-w-[300px] leading-relaxed font-bold uppercase text-slate-400 italic">This table appears to be empty or restricted.</p>
                                                </div>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                                
                                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between px-8">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[9px] font-black uppercase italic text-slate-400">Database Connected</span>
                                        </div>
                                        <span className="text-[9px] font-black uppercase italic text-slate-300">|</span>
                                        <span className="text-[9px] font-black uppercase italic text-slate-400">Rows {Math.min(rows.length, pageSize)} of {total}</span>
                                    </div>
                                    <p className="text-[9px] font-black uppercase italic text-slate-300 tracking-tighter">Enterprise Level 8 Audit Console</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-8 animate-in fade-in duration-500">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full" />
                                    <div className="relative h-32 w-32 border-2 border-slate-100 rounded-[2.5rem] flex items-center justify-center bg-white shadow-2xl">
                                        <Database className="h-12 w-12 text-slate-200" />
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <h4 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">SYSTEM DATABASE EXPLORER</h4>
                                    <p className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-400">SELECT A TABLE FROM THE SIDEBAR TO BEGIN AUDIT</p>
                                </div>
                                <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
                                    {[
                                        { l: 'READ-ONLY', v: 'TRUE' },
                                        { l: 'SYNC-STATUS', v: 'LIVE' },
                                        { l: 'LATENCY', v: '0.2ms' }
                                    ].map((stat, i) => (
                                        <div key={i} className="p-4 rounded-3xl bg-slate-50 border border-slate-100 text-center">
                                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{stat.l}</p>
                                            <p className="text-[11px] font-black italic text-slate-900">{stat.v}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
