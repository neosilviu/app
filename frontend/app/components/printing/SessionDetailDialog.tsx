import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FileText, User, Phone, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface SessionDetailDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    selectedSession: any;
    setLocalJobs: React.Dispatch<React.SetStateAction<any[]>>;
}

export function SessionDetailDialog({
    isOpen,
    onOpenChange,
    selectedSession,
    setLocalJobs
}: SessionDetailDialogProps) {
    const { t } = useTranslation(['common', 'printing']);

    if (!selectedSession) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none rounded-3xl bg-white/95 backdrop-blur-xl dark:bg-slate-900/95 shadow-2xl">
                <div className="bg-primary p-8 text-white relative overflow-hidden flex-shrink-0">
                    <div className="relative z-10">
                        <Badge className="bg-white/20 text-white border-none mb-4 uppercase text-[10px] font-black tracking-widest">{t('printing:saved_order_details')}</Badge>
                        <DialogHeader className="p-0 text-left">
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight italic text-white">{selectedSession.name}</DialogTitle>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-primary-foreground/60" />
                                    <span className="text-[11px] font-bold uppercase">{selectedSession.customerName || t('common:anonymous')}</span>
                                </div>
                                {selectedSession.customerPhone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-3 w-3 text-primary-foreground/60" />
                                        <span className="text-[11px] font-bold uppercase">{selectedSession.customerPhone}</span>
                                    </div>
                                )}
                            </div>
                        </DialogHeader>
                    </div>
                    <Save className="absolute -bottom-4 -right-4 h-32 w-32 text-white/10 rotate-12" />
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('printing:total_value')}</span>
                                <span className="text-2xl font-black text-primary">{(Number(selectedSession.totalPrice || 0) / 100).toFixed(2)} {t('printing:currency')}</span>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('printing:saved_at')}</span>
                                <span className="text-sm font-bold">{new Date(selectedSession.createdAt).toLocaleString()}</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 italic">{t('printing:order_items')} ({selectedSession.items?.length || 0})</h4>
                            <div className="space-y-3">
                                {selectedSession.items?.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                                                <FileText className="h-5 w-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-[11px] uppercase italic tracking-tight">{item.filename}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[9px] font-bold px-1 py-0">{t('printing:pages_per_sheet', { count: item.numPages })}</Badge>
                                                    <Badge variant="outline" className="text-[9px] font-bold px-1 py-0">{item.copies} {t('printing:copies')}</Badge>
                                                    {item.isA3 && <Badge className="text-[9px] font-bold px-1 py-0 bg-amber-500/10 text-amber-500 border-amber-200">A3</Badge>}
                                                    {item.isBound && <Badge className="text-[9px] font-bold px-1 py-0 bg-blue-500/10 text-blue-500 border-blue-200">{t('printing:is_bound')}</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="font-black text-slate-900 dark:text-white">{(Number(item.totalPrice || 0) / 100).toFixed(2)} {t('printing:currency')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t gap-3 flex-row justify-end">
                    <Button 
                        variant="outline" 
                        className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8"
                        onClick={() => {
                            if (!selectedSession.items) return;
                            const restored = selectedSession.items.map((item: any) => ({
                                id: Math.random().toString(36).substr(2, 9),
                                filename: item.filename,
                                remotePath: item.remotePath,
                                copies: item.copies || 1,
                                numPages: item.numPages || 1,
                                pagesBW: item.pagesBW || 0,
                                pagesColor: item.pagesColor || 0,
                                isA3: item.isA3 || false,
                                isBound: item.isBound || false,
                                isCardboard: item.isCardboard || false,
                                isFullCoverage: item.isFullCoverage || false,
                                uploading: false,
                            }));
                            setLocalJobs(prev => [...prev, ...restored]);
                            onOpenChange(false);
                            toast.success(t('printing:items_restored'));
                        }}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t('printing:restore_to_queue')}
                    </Button>
                    <Button 
                        className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('common:close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
