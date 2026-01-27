import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useConfig } from '~/hooks/useConfig';
import { DynamicEntityList } from '~/components/entity/DynamicEntityList';
import { ErrorBoundary } from '~/components/ControlGates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '~/components/ui/dialog';
import { DynamicForm } from '~/components/EntitySystem';
import { api, renderString } from '~/lib/core';
import { toast } from 'sonner';

export async function action({ request, params, context }: any) {
    let formData: FormData | null = null;
    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        try {
            formData = await request.formData();
        } catch (e) {
            console.warn('[ROUTE-INDEX] Failed to parse form data:', e);
        }
    }

    // If it's a JSON request to a UI route, it might be an accidental API call or a specific action
    if (!formData && contentType.includes('application/json')) {
        const { handleBrainRequest } = await import("../brain.server");
        const env = (context as any).cloudflare?.env || (process as any).env;
        const ctx = (context as any).cloudflare?.ctx;
        return await handleBrainRequest(request, env, ctx);
    }

    if (!formData) {
        return { error: 'Invalid content type' };
    }

    const method = request.method.toUpperCase();
    const action = (formData.get('_action') as string) || (method === 'DELETE' ? 'delete' : '');
    const entity = params.entity;

    // Enterprise Level 8: Local Brain Loopback (SSR-Safe)
    // Instead of making an HTTP call to ourselves via axios (which fails on server), 
    // we use the internal brain handler directly.
    const callBrain = async (path: string, method: string, data?: any) => {
        const { handleBrainRequest } = await import("../brain.server");
        const env = (context as any).cloudflare?.env || (process as any).env;
        const cfCtx = (context as any).cloudflare?.ctx;
        
        const url = new URL(request.url);
        const brainUrl = `${url.origin}/api/${path}`;
        
        const brainRequest = new Request(brainUrl, {
            method,
            headers: {
                ...Object.fromEntries(request.headers.entries()),
                'content-type': 'application/json'
            },
            body: data ? JSON.stringify(data) : undefined
        });

        const response = await handleBrainRequest(brainRequest, env, cfCtx);
        return await response.json();
    };

    if (action === 'delete') {
        const id = formData.get('id') as string;
        const ids = formData.get('ids') as string;
        
        if (id) {
            return await callBrain(`db/${entity}/${id}`, 'DELETE');
        } else if (ids) {
            const idList = (ids || '').split(',');
            let successRaw = 0;
            for(const itemId of idList) {
                if (!itemId) continue;
                const res = await callBrain(`db/${entity}/${itemId}`, 'DELETE') as any;
                if (res.success) successRaw++;
            }
            return { success: successRaw === idList.filter(Boolean).length, deleted: successRaw };
        }
    }

    if (action === 'post' || action === 'create' || method === 'POST') {
        const dataRaw = formData.get('data');
        let data = {};
        if (typeof dataRaw === 'string') {
            try {
                data = JSON.parse(dataRaw);
            } catch (e: any) {
                return { error: `Format JSON invalid în câmpul 'data': ${e.message}` };
            }
        }
        
        const finalData = Object.keys(data).length > 0 ? data : Object.fromEntries(formData.entries());
        delete (finalData as any)._action;
        
        return await callBrain(`db/collection/${entity}`, 'POST', finalData);
    }

    return { error: 'Invalid action' };
}

export default function EntityIndexPage() {
    const { entity, lang } = useParams();
    const { entity: configMap, isInitialized } = useConfig();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setIsCreateOpen(true);
            const timer = setTimeout(() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('action');
                setSearchParams(newParams, { replace: true });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    if (!isInitialized) {
        return (
            <div className="p-8 text-slate-400 font-black italic uppercase">
                <div className="mb-4">Loading Engine...</div>
                <div className="text-sm text-slate-500">The Registry is still initializing — the list will appear shortly.</div>
            </div>
        );
    }
    
    const config = configMap[entity as string];
    if (!config) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-800">Entity Not Found</h1>
                <p className="text-slate-500 font-medium max-w-md mt-2">The entity definition for "{entity}" does not exist in the Registry yet. Go to SuperAdmin to create it.</p>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <DynamicEntityList entityId={entity as string} config={config} />
            
            <Dialog 
                open={isCreateOpen} 
                onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete('action');
                        setSearchParams(newParams, { replace: true });
                    }
                }}
            >
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-[2.5rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-none">
                    <div className="p-8 max-h-[92vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black italic uppercase italic tracking-tighter">
                                Adaugă {renderString(config.label || entity, lang)}
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 text-xs font-bold italic uppercase tracking-widest">
                                {renderString(config.description || `Creează o nouă înregistrare pentru ${renderString(config.label || entity, lang)}`, lang)}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                            <DynamicForm 
                                entityType={entity as string} 
                                onSubmit={async (values) => {
                                    try {
                                        const res = await api.brain.post(`db/collection/${entity}`, values);
                                        if (res.success) {
                                            toast.success("Înregistrare creată cu succes!");
                                            setIsCreateOpen(false);
                                            // Force a small delay then reload or just let the list component handle it
                                            // Reload is safer for dynamic schema changes
                                            setTimeout(() => window.location.reload(), 500);
                                        } else {
                                            toast.error(res.error || "Eroare la salvare");
                                        }
                                    } catch (e: any) {
                                        toast.error(e.message || "Eroare de conexiune");
                                    }
                                }} 
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </ErrorBoundary>
    );
}
