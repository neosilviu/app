import React from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '~/components/ui/GlassCard';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Rocket, Cpu, Network, ShieldCheck, Zap, Brain, Lock, Globe, Server, Database, Cloud, LayoutDashboard } from 'lucide-react';
import { renderString } from '~/lib/core';
import { useParams } from 'react-router';

export default function PlansPage() {
    const { t } = useTranslation(['common']);
    const { lang } = useParams();

    const roadmap = [
        {
            title: "Model Context Protocol (MCP) Portals",
            status: "Experimental",
            icon: Network,
            color: "text-blue-500",
            description: "Consolidare și control acces la serverele și instrumentele MCP direct prin portalul Cloudflare. Permite AI-ului să acceseze resursele locale (Imprimante, WhatsApp, DB) într-un mod securizat și standardizat.",
            items: [
                "Integrare Cloudflare One Access pentru tunele MCP securizate",
                "Portal de management al tool-urilor expuse către LLM-uri",
                "Shadow AI Monitoring & Governance la nivel de workspace",
                "Zero-configuration tunnels pentru agenții locali noi"
            ]
        },
        {
            title: "V2 Heavy Worker Infrastructure",
            status: "In Progress",
            icon: Cpu,
            color: "text-amber-500",
            description: "Upgrade la sistemul de workeri pentru procesarea task-urilor complexe direct pe hardware-ul local.",
            items: [
                "Headless Office Rendering (Docx/Xlsx to PDF Preview)",
                "AI Image Background Removal (Local Model Processing)",
                "Video Frame Extraction pentru printare rapidă",
                "Advanced OCR pentru documentele scanate"
            ]
        },
        {
            title: "Global Mesh State (D1 + SQLite Sync)",
            status: "Planning",
            icon: Database,
            color: "text-indigo-500",
            description: "Sincronizare ultra-rapidă între 'The Brain' (Cloud) și 'Local Agents' pentru continuitate offline perfectă.",
            items: [
                "Conflict Resolution automat pentru editări concurente",
                "Sincronizare parțială selectivă pentru date 'grele'",
                "Backup automat în Cloudflare R2 pentru fișiere locale"
            ]
        }
    ];

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-200">
                        <Rocket className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                            Future Roadmap & AI Vision
                        </h1>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest pl-1">
                            Superadmin Exclusive Insight
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roadmap.map((plan, i) => (
                    <GlassCard key={i} className="flex flex-col border-slate-100 hover:border-indigo-200 transition-all group overflow-hidden">
                        <div className="p-6 space-y-4 flex-1">
                            <div className="flex justify-between items-start">
                                <div className={`p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 group-hover:scale-110 transition-transform duration-500`}>
                                    <plan.icon className={`w-8 h-8 ${plan.color}`} />
                                </div>
                                <Badge variant="outline" className="rounded-full font-black text-[9px] uppercase tracking-tighter border-slate-200">
                                    {plan.status}
                                </Badge>
                            </div>
                            
                            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                {renderString(plan.title, lang)}
                            </h3>
                            
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                {renderString(plan.description, lang)}
                            </p>

                            <div className="pt-4 space-y-2">
                                {plan.items.map((item, j) => (
                                    <div key={j} className="flex items-start gap-2">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </GlassCard>
                ))}
            </div>

            <GlassCard className="p-8 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border-dashed border-2">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="flex-1 space-y-4 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                            <Brain size={14} /> AI Controls & MCP Portals
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                            Consolidarea controlului AI prin Cloudflare One
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">
                            Implementarea Portalurilor MCP va transforma Studio App dintr-un agent local într-un ecosistem AI centralizat. 
                            Vei putea gestiona cine are acces la ce instrumente (Imprimantă, WhatsApp, CRM) direct din panoul Cloudflare Admin, 
                            asigurând că AI-ul nu accesează niciodată date critice fără permisiune explicită.
                        </p>
                        <div className="flex gap-4 justify-center md:justify-start">
                            <Button variant="secondary" className="rounded-2xl font-black gap-2">
                                <Lock size={16} /> Cloudflare Access
                            </Button>
                            <Button variant="outline" className="rounded-2xl font-black gap-2">
                                <ShieldCheck size={16} /> MCP Governance
                            </Button>
                        </div>
                    </div>
                    <div className="relative w-64 h-64 flex items-center justify-center">
                        <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full animate-pulse" />
                        <div className="relative p-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 rotate-3 group-hover:rotate-0 transition-transform duration-700">
                             <img src="/logo.png" className="w-32 h-32 grayscale brightness-50 opacity-20" alt="" />
                             <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="w-16 h-16 text-indigo-500 animate-bounce" />
                             </div>
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
