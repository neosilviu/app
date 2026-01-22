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
import { SuperAdminGate } from '~/components/ControlGates';
import { useConfig } from '~/hooks/useConfig';

export const handle = {
    i18n: ["common", "auth"],
};

export default function RegisterPage() {
    const { t } = useTranslation(['common', 'auth']);
    const { uiConfig } = useConfig();
    const { lang } = useParams();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });
    const [loading, setLoading] = useState(false);
    const { registerAdmin, isAdminExists } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (isAdminExists === true) {
            navigate(getLocalizedPath('/login', lang));
        }
    }, [isAdminExists, navigate, lang]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await registerAdmin(formData);
            toast.success(t('auth:register_success'));
            navigate(getLocalizedPath('/', lang));
        } catch (err: any) {
            toast.error(err.message || err || t('auth:register_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <SuperAdminGate>
                <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl overflow-hidden">
                    <CardHeader className={`bg-${uiConfig.brand.primary} text-white p-8 text-center`}>
                        <CardTitle className="text-3xl font-bold">{renderString(uiConfig.layout.appName, lang)}</CardTitle>
                        <CardDescription className="text-white/80 mt-2">{t('auth:signup_subtitle')}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('auth:full_name')}</Label>
                                <Input 
                                    id="name" 
                                    value={formData.name} 
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                                    required 
                                    placeholder={t('auth:full_name_placeholder')}
                                    className="rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('auth:email')}</Label>
                                <Input 
                                    id="email" 
                                    type="email" 
                                    value={formData.email} 
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                                    required 
                                    placeholder={t('auth:email_placeholder')}
                                    autoComplete="username"
                                    className="rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" title={t('auth:password')} className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('auth:password')}</Label>
                                <Input 
                                    id="password" 
                                    type="password" 
                                    value={formData.password} 
                                    placeholder={t('auth:password_placeholder')}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                                    required 
                                    autoComplete="new-password"
                                    className="rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                            <Button 
                                type="submit" 
                                className={`w-full bg-${uiConfig.brand.primary} hover:bg-${uiConfig.brand.accent} text-white py-6 rounded-xl font-bold text-lg shadow-lg transition-all`} 
                                disabled={loading}
                            >
                                {loading ? t('auth:registering') : t('auth:register')}
                            </Button>
                        </form>
                        <div className="mt-6 text-center text-sm text-slate-500">
                            {t('auth:already_have_account')} <Link to={getLocalizedPath("/login", lang)} className={`font-bold text-${uiConfig.brand.primary} hover:underline`}>{t('auth:login')}</Link>
                        </div>
                    </CardContent>
                </Card>
            </SuperAdminGate>
        </div>
    );
}
