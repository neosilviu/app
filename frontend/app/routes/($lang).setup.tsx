import React, { useState } from 'react';
import { useNavigate, useParams, Link, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '~/hooks/useAuth';
import { getLocalizedPath, renderString } from '~/lib/core';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { toast } from 'sonner';
import { useConfig } from '~/hooks/useConfig';
import { getDb } from '~/lib/d1.server';
import { GlassCard } from '~/components/ui/GlassCard';
import { Shield, Rocket, User, Mail, Lock, Brain, Sparkles } from 'lucide-react';

export const handle = {
    i18n: ["common", "auth"],
};

export async function loader({ context }: LoaderFunctionArgs) {
    const env = (context as any).cloudflare?.env || (process as any).env;
    const db = getDb(env);
    try {
        // Verificăm în tabelul 'user' (Better-Auth) - Include unified roles
        const result = await db.query("SELECT COUNT(*) as count FROM user WHERE role IN ('superadmin', 'workspace_owner', 'workspace_admin', 'admin')");
        const count = result[0]?.count || 0;
        return { hasAdmin: count > 0 };
    } catch (e: any) {
        // Dacă tabelul nu există, înseamnă că nu avem admini
        return { hasAdmin: false };
    }
}

// REMOVED redundant action here.
// The form submits via the registerAdmin method in useAuth which calls /api/auth/setup-admin
// handled by handleBrainRequest in brain.server.ts.

export default function SetupPage() {
    const { t } = useTranslation(['common', 'auth']);
    const { uiConfig, buildInfo } = useConfig();
    const { lang } = useParams();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        name: ""
    });
    const { registerAdmin, isAdminExists } = useAuth();
    const navigate = useNavigate();

    // If admin already exists, redirect to login via side-effect
    React.useEffect(() => {
        if (isAdminExists === true) {
            console.log("[Setup] Admin exists, redirecting to login");
            navigate(getLocalizedPath('/login', lang), { replace: true });
        }
    }, [isAdminExists, navigate, lang]);

    if (isAdminExists === true) {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await registerAdmin(formData);
            if (response.success) {
                toast.success(t('auth:setup_success'));
                navigate(getLocalizedPath('/', lang));
            }
        } catch (err: any) {
            toast.error(err.message || t('auth:setup_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[42%] h-[42%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[42%] h-[42%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
            </div>

            <GlassCard className="w-full max-w-xl border-slate-200/50 dark:border-slate-800/50 shadow-2xl rounded-[2.5rem] overflow-hidden relative z-10 transition-all duration-700 hover:shadow-indigo-500/10">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 text-center relative overflow-hidden">
                    {/* Decorative Sparkles */}
                    <Sparkles className="absolute top-4 right-4 text-white/20 animate-spin-slow" size={40} />
                    <Brain className="absolute bottom-[-10px] left-[-10px] text-white/5" size={120} />
                    
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/30 transform hover:rotate-3 transition-transform">
                            <Rocket className="text-white" size={38} />
                        </div>
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg">
                            {renderString(uiConfig?.layout?.appName, lang) || 'Studio App'} <span className="text-white/40">v2</span>
                        </h2>
                        <p className="text-indigo-100 font-black uppercase tracking-[0.3em] text-[10px] mt-4 opacity-70">
                            Enterprise Level 8 Deployment
                        </p>
                    </div>
                </div>

                <div className="p-10">
                    <div className="mb-10 text-center">
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight mb-2">
                            {t('auth:initial_setup')}
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">
                            {t('auth:setup_description')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-6">
                            <div className="space-y-2 group">
                                <Label htmlFor="name" className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 ml-1 flex items-center gap-1 group-focus-within:text-indigo-500 transition-colors">
                                    <User size={10} /> {t('auth:full_name')}
                                </Label>
                                <Input
                                    required
                                    id="name"
                                    className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all font-bold"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t('auth:full_name_placeholder')}
                                    autoComplete="name"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 group">
                                    <Label htmlFor="email" className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 ml-1 flex items-center gap-1 group-focus-within:text-indigo-500 transition-colors">
                                        <Mail size={10} /> {t('auth:email')}
                                    </Label>
                                    <Input
                                        required
                                        id="email"
                                        type="email"
                                        className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all font-bold"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder={t('auth:email_placeholder')}
                                        autoComplete="username"
                                    />
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="password" title={t('auth:password')} className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 ml-1 flex items-center gap-1 group-focus-within:text-indigo-500 transition-colors">
                                        <Lock size={10} /> {t('auth:password')}
                                    </Label>
                                    <Input
                                        required
                                        id="password"
                                        type="password"
                                        className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all font-bold"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={t('auth:password_placeholder')}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase italic tracking-widest text-xs shadow-xl shadow-indigo-100 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[0px] transition-all gap-2 relative overflow-hidden" 
                            disabled={loading}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {loading ? <Rocket className="animate-bounce" size={16} /> : <Shield size={16} />}
                                {loading ? t('auth:registering') : t('auth:create_admin')}
                            </span>
                        </Button>

                        <div className="text-center mt-6">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {t('auth:already_have_account')} 
                                <Link to={getLocalizedPath('/login', lang)} className="ml-2 py-1.5 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-indigo-600 hover:bg-slate-200 transition-colors">
                                    {t('auth:login_here')}
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
                {buildInfo && (
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <span>Build: {buildInfo.version}-{buildInfo.hash}</span>
                        <span>{new Date(buildInfo.date).toLocaleString()}</span>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
