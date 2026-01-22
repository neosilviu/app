import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { BufferedInput, BufferedTextarea } from '~/components/ui/BufferedInput';
import { MessageSquare, Mail, Settings2, Zap, AlertTriangle, Send, Database, ShieldCheck, RefreshCw, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { socket, cn } from '~/lib/core';

import { renderString } from '~/lib/utils';

const getLang = () => {
    if (typeof window === 'undefined') return 'ro';
    const parts = window.location.pathname.split('/');
    return parts[1] && parts[1].length === 2 ? parts[1] : 'ro';
};

interface CommsTabProps {
    settings: any;
    setSettings: (s: any) => void;
    systemSettings: any;
    setSystemSettings: (s: any) => void;
    updateSystemSetting: (key: string, value: any, namespace?: string) => void;
    whatsappState: { status: string; qr?: string };
}

export const CommsTab: React.FC<CommsTabProps> = ({ 
    settings, 
    setSettings, 
    systemSettings, 
    setSystemSettings,
    updateSystemSetting,
    whatsappState 
}) => {
    const { t } = useTranslation(['settings', 'common']);
    const lang = getLang();

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
            <Accordion type="multiple" defaultValue={["gmail", "whatsapp"]} className="space-y-6">
                {/* Gmail Section */}
                <AccordionItem value="gmail" className="border-none">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                        <div className="flex items-center pr-6 bg-slate-50/50 hover:bg-slate-100/50 transition-all group">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline border-none flex-1">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                                        <Mail className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col items-start gap-1 text-left">
                                        <CardTitle className="text-sm font-black uppercase italic tracking-widest">Gmail Integration</CardTitle>
                                        <CardDescription className="text-[10px] uppercase font-medium">Auto-Reply, SMTP & OAuth2 API</CardDescription>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <Switch 
                                checked={!!gmailData.active} 
                                onCheckedChange={(v) => updateGmail('active', v)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            {gmailData.active && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Column 1: AI & Logic */}
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
                                                checked={!!gmailData.autoReply} 
                                                onCheckedChange={(v) => updateGmail('autoReply', v)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                            <div className="flex flex-col">
                                                <Label className="text-[11px] font-black uppercase italic tracking-tight text-slate-700">Analiză Task-uri</Label>
                                                <p className="text-[9px] text-slate-400 uppercase font-bold">Extracție leaduri/taskuri</p>
                                            </div>
                                            <Switch 
                                                checked={!!gmailData.aiAnalysis} 
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

                                    {/* Column 2: Identity & SMTP */}
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

                                    {/* Column 3: API Auth (OAuth2) */}
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
                    </Card>
                </AccordionItem>

                {/* WhatsApp Section */}
                <AccordionItem value="whatsapp" className="border-none">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md">
                        <div className="flex items-center pr-6 bg-emerald-50/10 hover:bg-emerald-100/10 transition-all group">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline border-none flex-1">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col items-start gap-1 text-left">
                                        <CardTitle className="text-sm font-black uppercase italic tracking-widest">WhatsApp Business Engine</CardTitle>
                                        <CardDescription className="text-[10px] uppercase font-medium">Auto-Reply, QR Control & Session Management</CardDescription>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <Switch 
                                checked={!!whatsappData.active} 
                                onCheckedChange={(v) => updateWhatsapp('active', v)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            {whatsappData.active && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Status & QR Card */}
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

                                        {/* Logic Settings */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50 shadow-sm">
                                                <div className="flex flex-col">
                                                    <Label className="text-[11px] font-black uppercase italic tracking-tight text-slate-700">Auto-Reply (AI)</Label>
                                                    <p className="text-[9px] text-slate-400 uppercase font-bold">Răspuns automat la mesaje noi</p>
                                                </div>
                                                <Switch 
                                                    checked={!!whatsappData.autoReply} 
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
                    </Card>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

