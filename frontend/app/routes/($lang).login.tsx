import React, { useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '~/hooks/useAuth';
import { getLocalizedPath, renderString } from '~/lib/core';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { toast } from 'sonner';
import { useConfig } from '~/hooks/useConfig';
import { Command } from 'lucide-react';

export const handle = {
    i18n: ["common", "auth"],
};

export default function LoginPage() {
    const { t } = useTranslation(['common', 'auth']);
    const { uiConfig } = useConfig();
    const { lang } = useParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, isAdminExists } = useAuth();
    const navigate = useNavigate();

    // Auto-redirect to setup if no admin exists
    React.useEffect(() => {
        if (isAdminExists === false) {
            navigate(getLocalizedPath('/setup', lang));
        }
    }, [isAdminExists, navigate, lang]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login({ email, password });
            toast.success(t('auth:login_success'));
            // Mergem direct la dashboard. 
            // Nu mai apelăm setLoading(false) aici pentru a preveni "flicker"-ul paginii de login
            navigate(getLocalizedPath('/', lang));
        } catch (error: any) {
            toast.error(error.message || t('auth:login_error'));
            setLoading(false);
        }
    };

    // Robust theme variables
    const primaryColor = uiConfig?.brand?.primary || '';
    const accentColor = uiConfig?.brand?.accent || '';
    const appName = renderString(uiConfig?.layout?.appName || uiConfig?.appName || '', lang);
    const welcomeMsg = t('auth:welcome_back');

    const headerStyle: React.CSSProperties = {
        backgroundColor: primaryColor.startsWith('#') ? primaryColor : undefined
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            {loading && (
                <div className="fixed inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600 dark:text-slate-400 font-bold animate-pulse">
                        {t('auth:signing_in')}
                    </p>
                </div>
            )}
            <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden bg-white">
                <CardHeader 
                    className={`bg-${primaryColor} text-white p-10 text-center flex flex-col items-center gap-4`}
                    style={headerStyle}
                >
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-inner mb-2">
                        <Command className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black tracking-tight">{appName}</CardTitle>
                        <CardDescription className="text-white/90 font-medium mt-1">{welcomeMsg}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t('auth:email')}</Label>
                            <Input 
                                id="email" 
                                type="email" 
                                placeholder={t('auth:email_placeholder')}
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required 
                                autoComplete="username"
                                className="rounded-2xl border-slate-200 dark:border-slate-800 h-12 px-4 focus:ring-2 focus:ring-offset-2 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" title={t('auth:password')} className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{t('auth:password')}</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                placeholder={t('auth:password_placeholder')}
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                                autoComplete="current-password"
                                className="rounded-2xl border-slate-200 dark:border-slate-800 h-12 px-4 focus:ring-2 focus:ring-offset-2 transition-all"
                            />
                        </div>
                        <Button 
                            type="submit" 
                            className={`w-full bg-${primaryColor} hover:opacity-90 text-white py-7 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2`} 
                            style={{ backgroundColor: primaryColor.startsWith('#') ? primaryColor : undefined }}
                            disabled={loading}
                        >
                            {loading ? t('auth:signing_in') : t('auth:sign_in')}
                        </Button>
                    </form>
                    
                    {isAdminExists === false && (
                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-sm text-slate-500 mb-2">{t('auth:no_account')}</p>
                            <Link 
                                to={getLocalizedPath("/setup", lang)} 
                                className={`inline-block font-bold text-sm px-4 py-2 rounded-lg bg-${primaryColor}/10 text-${primaryColor} hover:bg-${primaryColor}/20 transition-all`}
                                style={{ color: primaryColor.startsWith('#') ? primaryColor : undefined }}
                            >
                                {t('auth:register')}
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
