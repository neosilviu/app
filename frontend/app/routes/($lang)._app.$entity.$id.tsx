import React from 'react';
import { useParams } from 'react-router';
import { useConfig } from '~/hooks/useConfig';
import { DynamicEntityDetail } from '~/components/entity/DynamicEntityDetail';
import { ErrorBoundary } from '~/components/ControlGates';
import { api } from '~/lib/core';

export async function action({ request, params, context }: any) {
    let formData: FormData | null = null;
    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        try {
            formData = await request.formData();
        } catch (e) {
            console.warn('[ROUTE-ID] Failed to parse form data:', e);
        }
    }

    // If it's a JSON request to a UI route, it might be an accidental API call or a specific action
    if (!formData && contentType.includes('application/json')) {
        // Handle JSON body if needed, or just proxy to brain
        const { handleBrainRequest } = await import("../brain.server");
        const env = (context as any).cloudflare?.env || (process as any).env;
        const ctx = (context as any).cloudflare?.ctx;
        return await handleBrainRequest(request, env, ctx);
    }

    if (!formData) {
        return { error: 'Invalid content type' };
    }

    const method = request.method.toUpperCase();
    const action = (formData.get('_action') as string) || (method === 'DELETE' ? 'delete' : method === 'PATCH' || method === 'PUT' ? 'update' : '');
    const entity = params.entity;
    const id = params.id;

    // Enterprise Level 8: Local Brain Loopback (SSR-Safe)
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
        return await callBrain(`db/${entity}/${id}`, 'DELETE');
    }

    if (action === 'update' || action === 'put') {
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
        
        return await callBrain(`db/${entity}/${id}`, 'PUT', finalData);
    }

    return { error: 'Invalid action' };
}

export default function EntityDetailPage() {
    const { entity, id } = useParams();
    const { entity: configMap, isInitialized } = useConfig();

    if (!isInitialized) {
        return (
            <div className="p-8 text-slate-400 font-black italic uppercase">
                <div className="mb-4">Loading Engine...</div>
                <div className="text-sm text-slate-500">Registry is initializing — content will appear shortly.</div>
            </div>
        );
    }
    
    const config = configMap[entity as string];
    if (!config) {
        return (
            <div className="p-20 text-center">
                <div className="text-slate-400 font-black italic uppercase text-lg mb-2">Entity {entity} not found</div>
                <div className="text-sm text-slate-500">The collection you are trying to access does not exist in the Registry.</div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <DynamicEntityDetail entityId={entity as string} recordId={id as string} config={config} />
        </ErrorBoundary>
    );
}
