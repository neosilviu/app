import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { 
    Brain, Sparkles, Bot, Zap, ShieldAlert, Cpu, Database, Network, 
    MessageSquareQuote, Plus, Trash, ShieldCheck 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { REGISTRY_BASELINE } from '~/lib/core';
import { BufferedInput, BufferedTextarea } from '~/components/ui/BufferedInput';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion';
import { useConfig } from '~/hooks/useConfig';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';

import { renderString } from '~/lib/utils';

const getLang = () => {
    if (typeof window === 'undefined') return 'ro';
    const parts = window.location.pathname.split('/');
    return parts[1] && parts[1].length === 2 ? parts[1] : 'ro';
};

interface AITabProps {
    settings: any; // Workspace Settings
    setSettings: (s: any) => void;
    systemSettings: any; // System Settings (SuperAdmin)
    setSystemSettings: (s: any) => void;
    updateSystemSetting: (key: string, value: any, namespace?: string) => void;
}

export const AITab: React.FC<AITabProps> = ({ 
    settings, 
    setSettings, 
    systemSettings, 
    setSystemSettings,
    updateSystemSetting 
}) => {
    const { t } = useTranslation(['settings', 'common']);
    const { constants } = useConfig();
    const lang = getLang();

    // Registry Source (SuperAdmin Definitions)
    const globalConfig = constants.AI_CONFIG ?? {};
    const globalModels = globalConfig.models ?? [];
    
    // Workspace Specific AI Settings
    const wsAi = settings?.ai ?? {
        preferredModel: globalConfig?.active_model,
        temperature: globalConfig?.temperature,
        maxTokens: globalConfig?.max_tokens,
        customPrompts: []
    };

    const updateWsAi = (key: string, value: any) => {
        setSettings({
            ...settings,
            ai: { ...(settings?.ai ?? {}), [key]: value }
        });
    };

    const addPrompt = () => {
        const newPrompts = [...(wsAi?.customPrompts ?? []), { id: `ws_${Date.now()}`, name: renderString(t('common:new_prompt'), lang), content: '' }];
        updateWsAi('customPrompts', newPrompts);
    };

    const removePrompt = (id: string) => {
        const newPrompts = (wsAi?.customPrompts ?? []).filter((p: any) => p.id !== id);
        updateWsAi('customPrompts', newPrompts);
    };

    const updatePrompt = (id: string, field: string, value: any) => {
        const newPrompts = (wsAi?.customPrompts ?? []).map((p: any) => 
            p.id === id ? { ...p, [field]: value } : p
        );
        updateWsAi('customPrompts', newPrompts);
    };

    return (
        <div className="space-y-6">
            <Accordion type="multiple" defaultValue={["model_pref", "ws_prompts"]} className="space-y-6">
                {/* 1. Workspace Model Preference */}
                <AccordionItem value="model_pref" className="border-none">
                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm">
                        <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                                    <Cpu className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <CardTitle className="text-sm font-black uppercase italic tracking-widest">{renderString(t('settings:workspace_ai_engine'), lang)}</CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold text-slate-400">{renderString(t('settings:workspace_ai_engine_desc'), lang)}</CardDescription>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 italic">{renderString(t('settings:preferred_model'), lang)}</Label>
                                    <Select 
                                        value={wsAi.preferredModel} 
                                        onValueChange={(v) => updateWsAi('preferredModel', v)}
                                    >
                                        <SelectTrigger className="h-12 rounded-2xl bg-white border-none shadow-sm font-bold">
                                            <SelectValue placeholder={renderString(t('settings:select_model'), lang)} />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                                            {globalModels.map((m: any) => (
                                                <SelectItem key={m.id} value={m.id} className="rounded-xl">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{m.name}</span>
                                                        <span className="text-[9px] uppercase font-black text-slate-400">{m.provider}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase italic">{t('settings:models_limit_note')}</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 italic">{t('settings:ai_personality')}</Label>
                                        <Select 
                                            value={wsAi.personality ?? ''} 
                                            onValueChange={(v) => updateWsAi('personality', v)}
                                        >
                                            <SelectTrigger className="h-12 rounded-2xl bg-white border-none shadow-sm font-bold">
                                                <SelectValue placeholder={t('settings:select_personality')} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                                <SelectItem value="professional" className="rounded-xl">{t('settings:personality_professional')}</SelectItem>
                                                <SelectItem value="creative" className="rounded-xl">{t('settings:personality_creative')}</SelectItem>
                                                <SelectItem value="technical" className="rounded-xl">{t('settings:personality_technical')}</SelectItem>
                                                <SelectItem value="friendly" className="rounded-xl">{t('settings:personality_friendly')}</SelectItem>
                                                <SelectItem value="analytical" className="rounded-xl">{t('settings:personality_analytical')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 p-4 bg-white/50 rounded-2xl border border-slate-100/50">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 italic">{t('settings:creativity')} ({wsAi.temperature})</Label>
                                            <input 
                                                type="range" min="0" max="1" step="0.1" 
                                                value={wsAi.temperature}
                                                onChange={(e) => updateWsAi('temperature', parseFloat(e.target.value))}
                                                className="w-full h-1 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                            />
                                        </div>
                                        <div className="space-y-2 p-4 bg-white/50 rounded-2xl border border-slate-100/50">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 italic">{t('settings:response_length')}</Label>
                                            <input 
                                                type="number" 
                                                value={wsAi.maxTokens}
                                                onChange={(e) => updateWsAi('maxTokens', parseInt(e.target.value))}
                                                className="w-full bg-transparent border-none text-[12px] font-bold focus:ring-0 p-0"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white">
                                        <div className="flex flex-col">
                                            <Label className="text-[11px] font-black uppercase italic tracking-widest">{t('settings:fast_mode')}</Label>
                                            <span className="text-[9px] text-slate-400 uppercase font-bold">{t('settings:fast_mode_desc')}</span>
                                        </div>
                                        <Switch 
                                            checked={!!wsAi.fastMode} 
                                            onCheckedChange={(v) => updateWsAi('fastMode', v)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </Card>
                </AccordionItem>

                {/* 2. Workspace Custom Prompts */}
                <AccordionItem value="ws_prompts" className="border-none">
                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm">
                        <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
                                    <MessageSquareQuote className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t('settings:workspace_custom_prompts')}</CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold text-slate-400">{t('settings:workspace_custom_prompts_desc')}</CardDescription>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            <div className="flex justify-between items-center bg-purple-50/50 p-4 rounded-2xl border border-purple-100/50">
                                <p className="text-[10px] text-purple-700 font-bold uppercase tracking-tight">
                                    {t('settings:custom_prompts_info')}
                                </p>
                                <Button size="sm" onClick={addPrompt} className="bg-purple-600 text-white rounded-xl h-8 text-[9px] font-black uppercase tracking-widest">
                                    <Plus className="h-3 w-3 mr-1" /> {t('settings:new_prompt')}
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {(wsAi.customPrompts || []).map((p: any) => (
                                    <div key={p.id} className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-3 relative group">
                                        <div className="flex justify-between items-center">
                                            <BufferedInput 
                                                value={p.name}
                                                onChange={(v) => updatePrompt(p.id, 'name', v)}
                                                className="border-none font-black uppercase italic tracking-widest text-[10px] p-0 h-auto w-auto focus-visible:ring-0 bg-transparent text-slate-600"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => removePrompt(p.id)} className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash size={14} />
                                            </Button>
                                        </div>
                                        <BufferedTextarea 
                                            value={p.content}
                                            onChange={(v) => updatePrompt(p.id, 'content', v)}
                                            placeholder={t('settings:placeholder_prompt_content')}
                                            className="min-h-[100px] rounded-2xl bg-slate-50 border-none text-[11px] font-medium leading-relaxed p-4 scrollbar-hide"
                                        />
                                    </div>
                                ))}

                                {(wsAi.customPrompts ?? []).length === 0 && (
                                    <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                        <Bot className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                                        <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">{t('settings:no_custom_prompts')}</p>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </Card>
                </AccordionItem>

                {/* 3. System DNA Overrides */}
                <AccordionItem value="dna_overrides" className="border-none">
                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm">
                        <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <CardTitle className="text-sm font-black uppercase italic tracking-widest">{t('settings:system_dna_overrides')}</CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold text-slate-400">{t('settings:system_dna_overrides_desc')}</CardDescription>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 mb-4">
                                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-tight flex items-center gap-2">
                                    <Sparkles size={12} className="animate-pulse" />
                                    {t('settings:dna_overrides_info')}
                                </p>
                            </div>

                            <div className="space-y-6">
                                {Object.entries(globalConfig.prompts ?? {}).map(([key, defaultValue]: [string, any]) => (
                                    <div key={key} className="space-y-2 p-4 bg-white rounded-2xl border border-slate-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 italic">{key.replace(/_/g, ' ')}</Label>
                                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter opacity-50">{t('settings:locked_dna')}</Badge>
                                        </div>
                                        <BufferedTextarea 
                                            value={wsAi.prompts?.[key] ?? ''}
                                            onChange={(v) => updateWsAi('prompts', { ...(wsAi.prompts ?? {}), [key]: v })}
                                            placeholder={`${t('settings:default_prefix')}: ${typeof defaultValue === 'string' ? defaultValue.substring(0, 100) : t('settings:system_default')}...`}
                                            className="min-h-[80px] rounded-xl bg-slate-50/50 border-none text-[10px] font-medium p-3"
                                        />
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings:dna_override_help')}</p>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

