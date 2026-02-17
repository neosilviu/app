import React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { Settings2, Minus, Plus } from "lucide-react";
import { renderString } from "../../lib/core";
import { getTierPrice, calculateJobPrice } from "../../routes/printing-logic";

interface JobConfigDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    job: any;
    prices: any;
    onUpdate: (id: string, updates: any) => void;
    t: any;
    lang: string;
}

export function JobConfigDialog({
    isOpen,
    onOpenChange,
    job,
    prices,
    onUpdate,
    t,
    lang
}: JobConfigDialogProps) {
    if (!job) return null;

    const calculateJobPriceLocal = (job: any) => {
        return calculateJobPrice(job, prices);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[92vh] bg-white/95 backdrop-blur-xl dark:bg-slate-900/95 border-none shadow-2xl rounded-3xl p-0 overflow-hidden flex flex-col">
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="bg-primary p-8 text-white relative overflow-hidden flex-shrink-0">
                        <div className="relative z-10">
                            <Badge className="bg-white/20 text-white border-none mb-4 uppercase text-[10px] font-black tracking-widest">{renderString(t('printing:job_configuration'), lang)}</Badge>
                            <DialogHeader className="p-0 text-left border-none bg-transparent">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic truncate max-w-[80%] text-white">{job.file?.name || job.filename || renderString(t('printing:document'), lang)}</DialogTitle>
                                <DialogDescription className="text-primary-foreground/70 text-[10px] font-bold uppercase tracking-widest mt-1">
                                    {renderString(t('printing:job_config_description'), lang)}
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                        <Settings2 className="absolute -bottom-4 -right-4 h-32 w-32 text-white/10 rotate-12" />
                    </div>

                    <div className="p-8 grid gap-8 md:grid-cols-2 overflow-y-auto">
                        {/* Basic Specs */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block italic">{renderString(t('printing:quantities'), lang)}</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{renderString(t('printing:copies'), lang)}</span>
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                                            <Button 
                                                variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                                                onClick={() => onUpdate(job.id, { copies: Math.max(1, job.copies - 1) })}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <Input 
                                                type="number" 
                                                value={job.copies} 
                                                className="border-none bg-transparent text-center font-black h-8 focus-visible:ring-0"
                                                onChange={(e) => onUpdate(job.id, { copies: parseInt(e.target.value) || 1 })}
                                            />
                                            <Button 
                                                variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                                                onClick={() => onUpdate(job.id, { copies: job.copies + 1 })}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{renderString(t('printing:input_pages'), lang)}</span>
                                        <Input 
                                            type="number" 
                                            value={job.pagesBW + job.pagesColor} 
                                            className="rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-black h-10 text-center"
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 1;
                                                onUpdate(job.id, { pagesBW: val, pagesColor: 0, numPages: val });
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block italic">{renderString(t('printing:material_finish'), lang)}</Label>
                                
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase italic">{renderString(t('printing:a3_format'), lang)}</span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">{renderString(t('printing:a3_description'), lang)}</span>
                                    </div>
                                    <Switch checked={job.isA3} onCheckedChange={(checked) => onUpdate(job.id, { isA3: checked })} />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase italic">{renderString(t('printing:is_cardboard'), lang)}</span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">{renderString(t('printing:cardboard_description'), lang)}</span>
                                    </div>
                                    <Switch checked={job.isCardboard} onCheckedChange={(checked) => onUpdate(job.id, { isCardboard: checked })} />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase italic">{renderString(t('printing:binding'), lang)}</span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">{renderString(t('printing:binding_description'), lang)}</span>
                                    </div>
                                    <Switch checked={job.isBound} onCheckedChange={(checked) => onUpdate(job.id, { isBound: checked })} />
                                </div>
                            </div>
                        </div>

                        {/* Color Distribution */}
                        <div className="space-y-6">
                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-inner">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 block italic">{renderString(t('printing:color_mix'), lang)}</Label>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[9px] font-black uppercase italic">
                                            <span className="text-slate-500">{renderString(t('printing:bw_pages'), lang)}</span>
                                            <span>{job.pagesBW}</span>
                                        </div>
                                        <Input 
                                            type="range" min="0" max={job.pagesBW + job.pagesColor} step="1"
                                            value={job.pagesBW}
                                            onChange={(e) => {
                                                const bw = parseInt(e.target.value);
                                                const total = job.pagesBW + job.pagesColor;
                                                onUpdate(job.id, { pagesBW: bw, pagesColor: total - bw });
                                            }}
                                            className="accent-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[9px] font-black uppercase italic">
                                            <span className="text-indigo-500">{renderString(t('printing:color_pages'), lang)}</span>
                                            <span>{job.pagesColor}</span>
                                        </div>
                                        <Input 
                                            type="range" min="0" max={job.pagesBW + job.pagesColor} step="1"
                                            value={job.pagesColor}
                                            onChange={(e) => {
                                                const color = parseInt(e.target.value);
                                                const total = job.pagesBW + job.pagesColor;
                                                onUpdate(job.id, { pagesColor: color, pagesBW: total - color });
                                            }}
                                            className="accent-indigo-500"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <Switch checked={job.isFullCoverage} onCheckedChange={(checked) => onUpdate(job.id, { isFullCoverage: checked })} />
                                        <span className="text-[9px] font-bold uppercase italic text-slate-500">{renderString(t('printing:is_full_coverage'), lang)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Price Breakdown */}
                            <div className="p-6 rounded-3xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase italic text-slate-500">
                                    <span>{renderString(t('printing:processing_bw'), lang)}</span>
                                    <span>{renderString(t('printing:currency'), lang)} {((job.pagesBW * getTierPrice(job.numPages, job.isA3 ? prices?.bwA3Tiers : prices?.bwTiers, job.isFullCoverage) * job.copies) / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold uppercase italic text-slate-500">
                                    <span>{renderString(t('printing:processing_color'), lang)}</span>
                                    <span>{renderString(t('printing:currency'), lang)} {((job.pagesColor * getTierPrice(job.numPages, job.isA3 ? prices?.colorA3Tiers : prices?.colorTiers, job.isFullCoverage) * job.copies) / 100).toFixed(2)}</span>
                                </div>
                                {job.isBound && (
                                    <div className="flex justify-between text-[10px] font-bold uppercase italic text-slate-500 border-t border-indigo-100 dark:border-indigo-900 pt-2">
                                        <span>{renderString(t('printing:binding_extra'), lang)}</span>
                                        <span>{renderString(t('printing:currency'), lang)} {((prices?.bindingTiers?.find((t: any) => job.numPages <= t.maxPages)?.price || 0) * job.copies / 100).toFixed(2)}</span>
                                    </div>
                                )}
                                <Separator className="bg-indigo-200/50 dark:bg-indigo-900/50" />
                                <div className="flex justify-between items-baseline pt-1">
                                    <span className="text-[12px] font-black uppercase italic text-indigo-600">{renderString(t('printing:total_price'), lang)}</span>
                                    <span className="text-2xl font-black italic text-indigo-900 dark:text-indigo-400 leading-none">{renderString(t('printing:currency'), lang)} {(calculateJobPriceLocal(job) / 100).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t">
                        <Button 
                            variant="outline" 
                            className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-8"
                            onClick={() => onOpenChange(false)}
                        >
                            {renderString(t('common:close_and_save'), lang)}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
