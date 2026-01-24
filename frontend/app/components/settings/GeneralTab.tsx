import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion';
import { GlassCard } from '~/components/ui/GlassCard';
import { Building, Activity, RefreshCcw, Search, Database, Clock, Mail, MessageSquare, Settings2, Zap, ShieldCheck, RefreshCw, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { socket } from '~/lib/core';
import { useParams } from 'react-router';
import { cn, renderString } from '~/lib/core';
import { BufferedInput, BufferedTextarea } from '~/components/ui/BufferedInput';
import { Button } from '~/components/ui/button';

interface LocalAgentTabProps {
    settings: any;
    setSettings: (s: any) => void;
    systemSettings: any;
    setSystemSettings: (s: any) => void;
    updateSystemSetting: (key: string, value: any, namespace?: string) => void;
    systemInfo: any;
    handleSave: () => void;
    whatsappState: { status: string; qr?: string };
}

export const GeneralTab: React.FC<LocalAgentTabProps> = ({ 
    settings, 
    setSettings, 
    systemSettings, 
    setSystemSettings,
    updateSystemSetting,
    systemInfo,
    handleSave,
    whatsappState
}) => {
    const { t } = useTranslation(['settings', 'common']);
    const { lang } = useParams();

    const gmailData = systemSettings?.gmail || {};
    const whatsappData = systemSettings?.whatsapp || {};

    const updateGmail = (key: string, value: any) => {
        updateSystemSetting(key, value, 'GMAIL');
    };

    const updateWhatsapp = (key: string, value: any) => {
        updateSystemSetting(key, value, 'WHATSAPP');
    };

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                <CardHeader className="bg-slate-50/50 pb-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black uppercase italic tracking-widest">{renderString(t('settings:hardware_agent'), lang)}</CardTitle>
                                <CardDescription className="text-[10px] uppercase font-medium mt-1">{renderString(t('settings:hardware_agent_desc'), lang)}</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase italic tracking-tight text-slate-500">{renderString(t('settings:use_local_agent'), lang)}</span>
                                {(systemSettings?.use_local_agent === true || systemSettings?.use_local_agent === 1 || String(systemSettings?.use_local_agent) === 'true') && (
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                )}
                             </div>
                             <Switch 
                                checked={systemSettings?.use_local_agent === true || systemSettings?.use_local_agent === 1 || String(systemSettings?.use_local_agent) === 'true'} 
                                onCheckedChange={(v) => {
                                    const confirmMsg = v 
                                        ? renderString(t('settings:confirm_enable_agent'), lang)
                                        : renderString(t('settings:confirm_disable_agent'), lang);
                                    
                                    if (window.confirm(confirmMsg)) {
                                        updateSystemSetting('use_local_agent', v, 'SYSTEM_SETTING');
                                        // If we turn off local agent, we must also turn off workers
                                        if (!v) {
                                            updateSystemSetting('enable_worker', false, 'SYSTEM_SETTING');
                                        }
                                    }
                                }}
                             />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 text-slate-500">
                    <div className="space-y-4 transition-all duration-500">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-900">{renderString(t('settings:system_info'), lang)}</span>
                                <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-tighter">{renderString(t('settings:live_node'), lang)}</span>
                            </div>
                            <div className="flex gap-1">
                                <div className={cn("h-1.5 w-1.5 rounded-full", (systemInfo && systemSettings?.use_local_agent === true) ? "bg-emerald-500 animate-pulse" : "bg-slate-300")}></div>
                                <div className={cn("h-1.5 w-1.5 rounded-full", (systemInfo && systemSettings?.use_local_agent === true) ? "bg-emerald-500" : "bg-slate-300")}></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {[
                                { label: renderString(t('settings:node_version'), lang), value: systemInfo?.nodeVersion ?? '...', mono: true },
                                { label: renderString(t('settings:platform'), lang), value: systemInfo ? `${systemInfo.platform} (${systemInfo.arch})` : '...' },
                                { label: renderString(t('settings:cpu_cores'), lang), value: systemInfo?.cpus ?? '...' },
                                { 
                                    label: "Memory (RAM)", 
                                    value: (systemInfo?.memory?.total && systemInfo?.memory?.free) 
                                        ? `${Math.round((systemInfo.memory.total - systemInfo.memory.free) / 1024 / 1024 / 1024 * 10) / 10} / ${Math.round(systemInfo.memory.total / 1024 / 1024 / 1024 * 10) / 10} GB` 
                                        : '...' 
                                },
                                { label: renderString(t('settings:local_ip'), lang), value: systemInfo?.localIps?.[0] ?? '...', mono: true }
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
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black uppercase text-white italic tracking-tight">{renderString(t('common:enable_worker'), lang)}</span>
                                        {systemSettings?.enable_worker && (
                                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        )}
                                    </div>
                                    <span className="text-[8px] text-slate-400 uppercase font-medium">{renderString(t('settings:master_switch'), lang)}</span>
                                </div>
                                <Switch 
                                    className="data-[state=checked]:bg-emerald-500"
                                    checked={(systemSettings?.enable_worker === true || systemSettings?.enable_worker === 1) && (systemSettings?.use_local_agent === true || systemSettings?.use_local_agent === 1 || String(systemSettings?.use_local_agent) === 'true')} 
                                    onCheckedChange={(v) => updateSystemSetting('enable_worker', v, 'SYSTEM_SETTING')}
                                    disabled={!(systemSettings?.use_local_agent === true || systemSettings?.use_local_agent === 1 || String(systemSettings?.use_local_agent) === 'true')}
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
                                            <div key={key} className={`flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50 shadow-sm transition-opacity ${!systemSettings?.enable_worker ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400">
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase text-slate-700 italic tracking-tight">
                                                        {t(`common:${key}`)}
                                                    </span>
                                                </div>
                                                <Switch 
                                                    checked={value === true} 
                                                    onCheckedChange={(val) => updateSystemSetting(key, val, 'SYSTEM_SETTING')}
                                                    disabled={!systemSettings?.enable_worker}
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
                                                onChange={(val) => updateSystemSetting('file_retention_days', parseInt(val), 'SYSTEM_SETTING')}
                                                className="h-9 rounded-xl border-slate-200 font-black"
                                            />
                                        </div>
                                        <div className="space-y-2 p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                            <Label className="text-[9px] font-black uppercase text-slate-500 italic tracking-widest">{t('common:max_backups')}</Label>
                                            <BufferedInput 
                                                type="number"
                                                value={systemSettings?.max_backups ?? ''}
                                                onChange={(val) => updateSystemSetting('max_backups', parseInt(val), 'SYSTEM_SETTING')}
                                                className="h-9 rounded-xl border-slate-200 font-black"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </GlassCard>
                </AccordionItem>

                {/* Gmail Section */}
                <AccordionItem value="gmail" className="border-none">
                    <GlassCard className="overflow-hidden p-0 border-l-4 border-l-orange-500/30">
                        <div className="flex items-center pr-6 hover:bg-white/50 transition-all group">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline border-none flex-1 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                                        <Mail className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col items-start gap-1 text-left">
                                        <span className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-900">Gmail Integration</span>
                                        <span className="text-[10px] text-slate-400 font-medium uppercase">Auto-Reply, SMTP & OAuth2 API</span>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <Switch 
                                checked={gmailData.active === true} 
                                onCheckedChange={(v) => updateGmail('active', v)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            {gmailData.active && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-slate-50 pb-2">
                                            AI & Logic Settings
                                        </h4>
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                            <div className="flex flex-col">
                                                <Label className="text-[11px] font-black uppercase italic tracking-tight text-slate-700">Auto-Reply (AI)</Label>
                                                <p className="text-[9px] text-slate-400 uppercase font-bold">Răspuns automat prin AI</p>
                                            </div>
                                            <Switch 
                                                checked={gmailData.autoReply === true} 
                                                onCheckedChange={(v) => updateGmail('autoReply', v)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                            <div className="flex flex-col">
                                                <Label className="text-[11px] font-black uppercase italic tracking-tight text-slate-700">Analiză Task-uri</Label>
                                                <p className="text-[9px] text-slate-400 uppercase font-bold">Extracție leaduri/taskuri</p>
                                            </div>
                                            <Switch 
                                                checked={gmailData.aiAnalysis === true} 
                                                onCheckedChange={(v) => updateGmail('aiAnalysis', v)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 italic tracking-widest">Interval Sync (sec)</Label>
                                                <BufferedInput 
                                                    type="number"
                                                    value={gmailData.syncInterval ?? 15}
                                                    onChange={(v) => updateGmail('syncInterval', parseInt(v))}
                                                    className="h-10 rounded-xl font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 italic tracking-widest">Trash Days</Label>
                                                <BufferedInput 
                                                    type="number"
                                                    value={gmailData.emptyTrashDays ?? 30}
                                                    onChange={(v) => updateGmail('emptyTrashDays', parseInt(v))}
                                                    className="h-10 rounded-xl font-bold"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-slate-50 pb-2">
                                            Identity & SMTP Security
                                        </h4>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-500 italic tracking-widest">Gmail Account Email</Label>
                                            <BufferedInput 
                                                value={gmailData.accountEmail || ""}
                                                onChange={(val) => updateGmail('accountEmail', val)}
                                                placeholder="user@gmail.com"
                                                className="h-10 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-orange-500 italic tracking-widest">SMTP User</Label>
                                            <BufferedInput 
                                                value={gmailData.smtp_user || ""}
                                                onChange={(val) => updateGmail('smtp_user', val)}
                                                placeholder="smtp-user@gmail.com"
                                                className="h-10 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-orange-500 italic tracking-widest">SMTP App-Password</Label>
                                            <BufferedInput 
                                                type="password"
                                                value={gmailData.smtp_pass || ""}
                                                onChange={(val) => updateGmail('smtp_pass', val)}
                                                placeholder="••••••••••••••••"
                                                className="h-10 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 mt-4 p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100/50 space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2 border-b border-indigo-100/50 pb-2">
                                            <Settings2 className="h-4 w-4" /> OAuth2 API Configuration (Developer Console)
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-500 italic">Client ID</Label>
                                                <BufferedInput 
                                                    value={gmailData.clientId || ""}
                                                    onChange={(v) => updateGmail('clientId', v)}
                                                    className="h-9 rounded-lg font-mono text-[10px]"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-500 italic">Client Secret</Label>
                                                <BufferedInput 
                                                    type="password"
                                                    value={gmailData.clientSecret || ""}
                                                    onChange={(v) => updateGmail('clientSecret', v)}
                                                    className="h-9 rounded-lg font-mono text-[10px]"
                                                />
                                            </div>
                                            <div className="md:col-span-2 space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-500 italic">Refresh Token</Label>
                                                <BufferedInput 
                                                    value={gmailData.refreshToken || ""}
                                                    onChange={(v) => updateGmail('refreshToken', v)}
                                                    className="h-9 rounded-lg font-mono text-[10px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AccordionContent>
                    </GlassCard>
                </AccordionItem>

                {/* WhatsApp Section */}
                <AccordionItem value="whatsapp" className="border-none">
                    <GlassCard className="overflow-hidden p-0 border-l-4 border-l-emerald-500/30">
                        <div className="flex items-center pr-6 hover:bg-white/50 transition-all group">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline border-none flex-1 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col items-start gap-1 text-left">
                                        <span className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-900">WhatsApp Business Engine</span>
                                        <span className="text-[10px] text-slate-400 font-medium uppercase">Auto-Reply, QR Control & Session Management</span>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <Switch 
                                checked={whatsappData.active === true} 
                                onCheckedChange={(v) => updateWhatsapp('active', v)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            {whatsappData.active === true && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4 shadow-xl">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-full flex items-center justify-center",
                                                        whatsappState.status === 'READY' || whatsappState.status === 'CONNECTED' ? "bg-emerald-500" : "bg-blue-500 animate-pulse"
                                                    )}>
                                                        {whatsappState.status === 'READY' || whatsappState.status === 'CONNECTED' ? <ShieldCheck size={18} /> : <RefreshCw size={18} className="animate-spin" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">Connection Status</p>
                                                        <p className="text-sm font-bold uppercase">{whatsappState.status}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" className="h-8 rounded-lg bg-white/10 border-white/20 text-[9px] uppercase font-black italic" onClick={() => socket.emit('whatsapp:initialize')}>Reset Session</Button>
                                                </div>
                                            </div>

                                            {whatsappState.status === 'QR_RECEIVED' && whatsappState.qr ? (
                                                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl">
                                                    <img 
                                                        src={whatsappState.qr.startsWith('data:') ? whatsappState.qr : `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(whatsappState.qr)}&size=200x200`} 
                                                        alt="QR" 
                                                        className="w-40 h-40"
                                                    />
                                                    <p className="text-slate-900 text-[9px] font-black uppercase italic mt-4 text-center">Open WhatsApp on your phone<br/>Link a Device</p>
                                                </div>
                                            ) : (whatsappState.status === 'READY' || whatsappState.status === 'CONNECTED') ? (
                                                <div className="py-12 flex flex-col items-center justify-center gap-2 border border-emerald-500/30 rounded-2xl bg-emerald-500/5">
                                                    <Zap className="text-emerald-500 h-8 w-8" />
                                                    <span className="text-[10px] font-black uppercase italic text-emerald-400">System Connected & Encrypted</span>
                                                    <Button variant="ghost" className="mt-4 text-red-400 hover:text-red-300 text-[10px] uppercase font-bold" onClick={() => socket.emit('whatsapp:logout')}>
                                                        <LogOut size={12} className="mr-2" /> Logout Session
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="py-12 flex flex-col items-center justify-center gap-2 border border-white/10 rounded-2xl">
                                                    <RefreshCw className="text-slate-500 h-8 w-8 animate-spin" />
                                                    <span className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest">Waiting for Local Agent...</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                                <div className="flex flex-col">
                                                    <Label className="text-[11px] font-black uppercase italic tracking-tight text-slate-700">Auto-Reply (AI)</Label>
                                                    <p className="text-[9px] text-slate-400 uppercase font-bold">Răspuns automat la mesaje noi</p>
                                                </div>
                                                <Switch 
                                                    checked={whatsappData.autoReply === true} 
                                                    onCheckedChange={(v) => updateWhatsapp('autoReply', v)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 italic tracking-widest">Greeting Message</Label>
                                                <BufferedTextarea 
                                                    value={whatsappData.greetingMessage || ""}
                                                    onChange={(val) => updateWhatsapp('greetingMessage', val)}
                                                    placeholder="Bună! Te contactăm în legătură cu..."
                                                    className="rounded-xl resize-none h-24 text-xs font-medium"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-500 italic tracking-widest">About Status</Label>
                                                <BufferedInput 
                                                    value={whatsappData.aboutStatus || ""}
                                                    onChange={(val) => updateWhatsapp('aboutStatus', val)}
                                                    className="h-10 rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AccordionContent>
                    </GlassCard>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

