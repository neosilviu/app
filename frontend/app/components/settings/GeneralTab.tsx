import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { GlassCard } from '~/components/ui/GlassCard';
import { BufferedInput } from '~/components/ui/BufferedInput';
import { Building, Activity, RefreshCcw, Search, Database, Clock, Code } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { socketRequest } from '~/lib/core';
import { toast } from 'sonner';

import { renderString, cn } from '~/lib/utils';

const getLang = () => {
    if (typeof window === 'undefined') return 'ro';
    const parts = window.location.pathname.split('/');
    return parts[1] && parts[1].length === 2 ? parts[1] : 'ro';
};

interface GeneralTabProps {
    settings: any;
    setSettings: (s: any) => void;
    systemSettings: any;
    setSystemSettings: (s: any) => void;
    updateSystemSetting: (key: string, value: any, namespace?: string) => void;
    systemInfo: any;
    handleSave: () => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ 
    settings, 
    setSettings, 
    systemSettings, 
    setSystemSettings,
    updateSystemSetting,
    systemInfo,
    handleSave 
}) => {
    const { t } = useTranslation(['settings', 'common']);
    const lang = getLang();

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                    <CardHeader className="bg-slate-50/50 pb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                <Building className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black uppercase italic tracking-widest">{renderString(t('settings:workspace_config'), lang)}</CardTitle>
                                <CardDescription className="text-[10px] uppercase font-medium mt-1">{renderString(t('settings:workspace_config_desc'), lang)}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{renderString(t('common:workspace_name'), lang)}</Label>
                            <BufferedInput 
                                value={systemSettings?.workspace_name ?? ''}
                                onChange={(val) => updateSystemSetting('workspace_name', val, 'system_setting')}
                                placeholder={renderString(t('settings:placeholder_ws_name'), lang)}
                                className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{renderString(t('common:logo_url'), lang)}</Label>
                            <BufferedInput 
                                value={systemSettings?.logo_url ?? ''}
                                onChange={(val) => updateSystemSetting('logo_url', val, 'system_setting')}
                                placeholder={renderString(t('settings:placeholder_logo_url'), lang)}
                                className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-mono text-xs"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                    <CardHeader className="bg-slate-50/50 pb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black uppercase italic tracking-widest">{renderString(t('settings:hardware_agent'), lang)}</CardTitle>
                                <CardDescription className="text-[10px] uppercase font-medium mt-1">{renderString(t('settings:hardware_agent_desc'), lang)}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-900">{renderString(t('settings:system_info'), lang)}</span>
                                    <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-tighter">{renderString(t('settings:live_node'), lang)}</span>
                                </div>
                                <div className="flex gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: renderString(t('settings:node_version'), lang), value: systemInfo?.nodeVersion ?? '', mono: true },
                                    { label: renderString(t('settings:platform'), lang), value: systemInfo ? `${systemInfo.platform} (${systemInfo.arch})` : '' },
                                    { label: renderString(t('settings:cpu_cores'), lang), value: systemInfo?.cpus ?? '' },
                                    { label: renderString(t('settings:local_ip'), lang), value: systemInfo?.localIps?.[0] ?? '', mono: true }
                                ].map((stat, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-white border border-slate-50 shadow-sm">
                                        <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</div>
                                        <div className={cn("text-[10px] font-bold text-slate-700", stat.mono && "font-mono")}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="workers" className="border-none">
                    <GlassCard className="overflow-hidden p-0 border-l-4 border-l-primary/30">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-white/50 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                    <Activity className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-900">{renderString(t('settings:workers_general'), lang)}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{renderString(t('settings:workers_general_desc'), lang)}</span>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase text-white italic tracking-tight">{renderString(t('common:enable_workers'), lang)}</span>
                                    <span className="text-[8px] text-slate-400 uppercase font-medium">{renderString(t('settings:master_switch'), lang)}</span>
                                </div>
                                <Switch 
                                    checked={!!systemSettings?.enable_workers} 
                                    onCheckedChange={(v) => updateSystemSetting('enable_workers', v, 'system_setting')}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(systemSettings ?? {})
                                    .filter(([key]) => key.startsWith('worker_') && key.endsWith('_enabled'))
                                    .sort()
                                    .map(([key, value]) => {
                                        let Icon = Building;
                                        if (key.includes('indexer')) Icon = Search;
                                        if (key.includes('archive')) Icon = Database;
                                        
                                        return (
                                            <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400">
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase text-slate-700 italic tracking-tight">
                                                        {t(`common:${key}`)}
                                                    </span>
                                                </div>
                                                <Switch 
                                                    checked={!!value} 
                                                    onCheckedChange={(val) => updateSystemSetting(key, val, 'system_setting')}
                                                    disabled={!systemSettings?.enable_workers}
                                                />
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </AccordionContent>
                    </GlassCard>
                </AccordionItem>
                
                {/* Maintenance & Storage */}
                <AccordionItem value="maintenance" className="border-none">
                    <GlassCard className="overflow-hidden p-0 border-l-4 border-l-blue-500/30">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-white/50 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-xl bg-blue-100 text-blue-600 group-hover:scale-110 transition-transform">
                                    <RefreshCcw className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-900">{t('settings:system_maintenance')}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{t('settings:maintenance_desc')}</span>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                             <div className="grid gap-6">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-slate-50 pb-2">
                                        <Clock className="h-3.5 w-3.5" /> {t('settings:storage_cleaning')}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                            <Label className="text-[9px] font-black uppercase text-slate-500 italic tracking-widest">{t('common:file_retention_days')}</Label>
                                            <BufferedInput 
                                                type="number"
                                                value={systemSettings?.file_retention_days ?? ''}
                                                onChange={(val) => updateSystemSetting('file_retention_days', parseInt(val), 'system_setting')}
                                                className="h-9 rounded-xl border-slate-200 font-black"
                                            />
                                        </div>
                                        <div className="space-y-2 p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                            <Label className="text-[9px] font-black uppercase text-slate-500 italic tracking-widest">{t('common:max_backups')}</Label>
                                            <BufferedInput 
                                                type="number"
                                                value={systemSettings?.max_backups ?? ''}
                                                onChange={(val) => updateSystemSetting('max_backups', parseInt(val), 'system_setting')}
                                                className="h-9 rounded-xl border-slate-200 font-black"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </GlassCard>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

