import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '~/components/ui/card';
import { IconMap } from '~/lib/icons';
import { 
    Plus, Trash, Save, Sparkles, Settings as SettingsIcon, Database, Shield, Layout, 
    ChevronRight, Menu as MenuIcon, User, Users, Briefcase, 
    CheckCircle2, PlusCircle, RefreshCw, Activity, Search, Box,
    Eye, ExternalLink, Layers,
    ArrowDownUp, HelpCircle, Type, Zap, Trash2, Image as ImageIcon,
    Cloud, HardDrive, File, DollarSign, Percent, List, Tag, AlignLeft,
    Clock, Calendar, ToggleRight, Mail, Phone, Music, Palette,
    Star, FileCode, Code2, MapPin, Calculator, Handshake, Edit3, QrCode,
    Rocket, ShieldAlert
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from '~/components/ui/badge';
import { GlassCard } from '~/components/ui/GlassCard';
import { Label } from '~/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { 
  socket,
  api,
  cn,
  renderString
} from '~/lib/core';
import { toast } from 'sonner';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { AiSettingsPanel } from '~/components/AiSettingsPanel';
import { RegistrySettingsPanel } from '~/components/RegistrySettingsPanel';
import { EntityDefinitionsPanel } from '~/components/EntityDefinitionsPanel';
import { AiArchitectSandbox } from '~/components/AiArchitectSandbox';
import { useAuth } from '~/hooks/useAuth';

const getIconComponent = (name: any) => {
    if (!name || typeof name !== 'string') return Box;
    if (IconMap[name]) return IconMap[name];
    const normalized = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    return IconMap[normalized] || Box;
};

export default function SuperadminPage() {
    const navigate = useNavigate();
    const { lang } = useParams();
    const { entities, uiConfig, refreshConfig, navigation, updateUiConfig, marketplace, constants } = useConfig();
    const { t } = useTranslation(['common', 'superadmin', 'settings', 'ai_settings', 'entities']);
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, switchWorkspace } = useAuth();
    
    // Tab Sync Logic
    const currentTab = searchParams.get('tab') || 'ai-architect';
    const [activeTab, setActiveTab ] = useState(currentTab);

    useEffect(() => {
        if (currentTab !== activeTab) {
            setActiveTab(currentTab);
        }
    }, [currentTab]);

    useEffect(() => {
        if (searchParams.get('tab') !== activeTab) {
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('tab', activeTab);
                return next;
            }, { replace: true });
        }
    }, [activeTab]);

    const [installing, setInstalling] = useState<string | null>(null);

    // AI Architect State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);

    // AI Architect Logic using Registry
    const handleGenerateArchitecture = async () => {
        if (!aiPrompt) return;
        setIsAiGenerating(true);
        try {
            const res = await api.brain.post('ai', {
                action: 'architect',
                prompt: aiPrompt,
                provider: constants.AI_CONFIG?.active_provider,
                model: constants.AI_CONFIG?.model,
                geminiApiKey: constants.AI_CONFIG?.providers?.gemini?.apiKey,
                claudeApiKey: constants.AI_CONFIG?.providers?.claude?.apiKey
            });

            if (res.success) {
                setAiResult(res.data);
                toast.success("Arhitectură generată cu succes!");
            } else {
                toast.error("Eroare AI: " + res.error);
            }
        } catch (e: any) {
            toast.error("Eroare la conectarea cu Brain: " + e.message);
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleDeployFullArchitecture = async () => {
        if (!aiResult) return;
        setIsAiGenerating(true);
        try {
            const res = await api.brain.post('entities', { 
                action: 'install', 
                template: {
                    id: crypto.randomUUID(),
                    name: `AI Generated: ${aiPrompt.slice(0, 20)}...`,
                    entities: aiResult.entities || [],
                    automations: aiResult.automations || [],
                    widgets: aiResult.widgets || []
                }
            });

            if (res.success) {
                toast.success("Arhitectură instalată cu succes!");
                refreshConfig(true);
                setAiResult(null);
            } else {
                toast.error("Eroare instalare: " + res.error);
            }
        } catch (e: any) {
            toast.error("Eroare la instalare: " + e.message);
        } finally {
            setIsAiGenerating(false);
        }
    };

    // Nav Overrides State
    const [navOverrides, setNavOverrides] = useState<any>(uiConfig?.navOverrides || {});

    useEffect(() => {
        if (uiConfig?.navOverrides) {
            setNavOverrides(uiConfig.navOverrides);
        }
    }, [uiConfig]);

    const handleInstallTemplate = async (template: any) => {
        setInstalling(template.id);
        try {
            const res = await api.brain.post('entities', { action: 'install', template });
            if (res.success) {
                toast.success(`Template "${template.name}" installed in Cloud!`);
                refreshConfig(true);
            } else {
                throw new Error(res.error);
            }
        } catch (e: any) {
            console.warn("[SUPERADMIN] Cloud install failed, trying Local Socket fallback...");
            socket.emit('entity:builder:install-template', { template }, (response: any) => {
                if (response.success) {
                    toast.success(`Template "${template.name}" installed locally!`);
                    refreshConfig(true);
                } else {
                    toast.error(`Failed: ${response.error}`);
                }
            });
        } finally {
            setInstalling(null);
        }
    };

    const handleSaveNav = () => {
        updateUiConfig({ navOverrides }).then(() => {
            toast.success('Navigation DNA Committed successfully to Cloud & Local!');
        }).catch(err => {
            toast.error('Failed to commit DNA: ' + err.message);
        });
    };

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 animate-in fade-in duration-500 text-slate-900 dark:text-white">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="sticky top-0 z-20 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/50 p-2 backdrop-blur-xl dark:bg-slate-900/50">
                    <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 bg-transparent">
                        <TabsTrigger value="ai-architect" className="rounded-xl font-black italic uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                            <Sparkles className="mr-2 h-4 w-4" />
                            {renderString(t('superadmin:tabs.ai_architect'), lang)}
                        </TabsTrigger>
                        <TabsTrigger value="registry" className="rounded-xl font-black italic uppercase text-[10px] tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            <Database className="mr-2 h-4 w-4" />
                            {renderString(t('settings:registry_title'), lang)}
                        </TabsTrigger>
                        <TabsTrigger value="marketplace" className="rounded-xl font-black italic uppercase text-[10px] tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                            <Briefcase className="mr-2 h-4 w-4" />
                            {renderString(t('superadmin:tabs.marketplace'), lang)}
                        </TabsTrigger>
                        <TabsTrigger value="ai-settings" className="rounded-xl font-black italic uppercase text-[10px] tracking-widest data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                            <SettingsIcon className="mr-2 h-4 w-4" />
                            {renderString(t('superadmin:tabs.ai_settings'), lang)}
                        </TabsTrigger>
                        <TabsTrigger value="builder" className="rounded-xl font-black italic uppercase text-[10px] tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                            <Box className="mr-2 h-4 w-4" />
                            Entity Builder
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="ai-architect" className="mt-0 focus-visible:outline-none">
                    <AiArchitectSandbox />
                </TabsContent>

                <TabsContent value="marketplace" className="mt-0 focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {marketplace.map((template) => {
                            const Icon = getIconComponent(template.icon || 'box');
                            return (
                                <GlassCard key={template.id} className="flex flex-col group hover:ring-2 hover:ring-primary/20 transition-all">
                                    <CardHeader>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-3 bg-slate-100 rounded-2xl text-primary">
                                                <Icon size={24} />
                                            </div>
                                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">{template.entities.length} Entities</Badge>
                                        </div>
                                        <CardTitle className="text-lg font-black italic uppercase tracking-tighter">{renderString(template.name, lang)}</CardTitle>
                                        <CardDescription className="line-clamp-2 text-xs font-medium">{renderString(template.description, lang)}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="flex flex-wrap gap-1">
                                            {template.entities.map((e: any) => (
                                                <Badge key={e.id} variant="secondary" className="text-[8px] uppercase">{renderString(e.label, lang)}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-4 border-t border-slate-100/50">
                                        <Button 
                                            className="w-full rounded-xl font-black uppercase italic text-[10px] tracking-widest"
                                            onClick={() => handleInstallTemplate(template)}
                                            disabled={installing === template.id}
                                        >
                                            {installing === template.id ? <RefreshCw className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
                                            {renderString(t('superadmin:marketplace.install_architecture'), lang)}
                                        </Button>
                                    </CardFooter>
                                </GlassCard>
                            )
                        })}

                        {/* AI Generate Placeholder */}
                        <GlassCard className="border-2 border-dashed border-primary/30 flex flex-col items-center justify-center p-12 text-center bg-primary/5">
                            <div className="p-4 bg-primary/10 rounded-full text-primary mb-4 animate-pulse">
                                <Sparkles size={32} />
                            </div>
                            <h3 className="font-black italic uppercase tracking-tighter text-lg mb-2">{renderString(t('superadmin:marketplace.build_with_ai'), lang)}</h3>
                            <p className="text-xs text-slate-500 mb-6">{renderString(t('superadmin:marketplace.ai_description'), lang)}</p>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="rounded-xl border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest">
                                        {renderString(t('superadmin:marketplace.launch_ai'), lang)}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl border-none shadow-2xl p-8 max-h-[92vh] flex flex-col">
                                    <DialogHeader className="flex-shrink-0">
                                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">{renderString(t('superadmin:marketplace.ai_title'), lang)}</DialogTitle>
                                        <DialogDescription className="text-slate-500">{renderString(t('superadmin:marketplace.ai_prompt_desc'), lang)}</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-6 pt-4 flex-1 flex flex-col min-h-0">
                                        <textarea 
                                            className="w-full h-32 p-4 rounded-2xl bg-slate-50 border-none focus:ring-1 focus:ring-primary/20 text-sm font-medium flex-1"
                                            placeholder={renderString(t('superadmin:marketplace.ai_placeholder'), lang)}
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                        />
                                        <Button 
                                            className="w-full h-12 rounded-2xl bg-primary font-black uppercase italic tracking-widest text-xs"
                                            onClick={handleGenerateArchitecture}
                                            disabled={isAiGenerating || !aiPrompt}
                                        >
                                            {isAiGenerating ? renderString(t('superadmin:marketplace.synthesizing'), lang) : renderString(t('superadmin:marketplace.generate_schema'), lang)}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </GlassCard>
                    </div>
                </TabsContent>

                <TabsContent value="registry" className="mt-0 focus-visible:outline-none">
                    <RegistrySettingsPanel />
                </TabsContent>

                <TabsContent value="ai-settings" className="mt-0 focus-visible:outline-none">
                    <div className="max-w-5xl mx-auto space-y-6 pb-20">
                        <div className="text-center space-y-2 mb-8">
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter">AI Registry Control</h2>
                            <p className="text-slate-500 font-medium">Configure AI providers, models, and prompts. Everything stored in registry - NO hardcoding!</p>
                        </div>
                        
                        <AiSettingsPanel />
                    </div>
                </TabsContent>

                <TabsContent value="builder" className="mt-0 focus-visible:outline-none">
                    <EntityDefinitionsPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}


