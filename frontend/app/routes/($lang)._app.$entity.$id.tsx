import React from 'react';
import { useParams, useLoaderData, type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useConfig } from '~/hooks/useConfig';
import { DynamicEntityDetail } from '~/components/entity/DynamicEntityDetail';
import { ErrorBoundary } from '~/components/ControlGates';
import { Brain } from '~/brain.server';

export async function loader({ params, context }: LoaderFunctionArgs) {
    const { entity, id, lang } = params;

    if (id === 'new') {
        return { data: null };
    }

    const data = await Brain.execute(entity!, 'READ', { id, lang }, context);
    return { data };
}

export async function action({ request, params, context }: ActionFunctionArgs) {
    const { entity, id, lang } = params;
    const formData = await request.formData();
    const _action = formData.get('_action');

    if (_action === 'delete') {
        const result = await Brain.execute(entity!, 'DELETE', { id, lang }, context);
        return result;
    }

    // Default to WRITE for form submissions
    const dataString = formData.get('data');
    if (dataString) {
        const payload = JSON.parse(dataString as string || '{}');
        if (id !== 'new') payload.id = id;
        payload.lang = lang;
        const result = await Brain.execute(entity!, 'WRITE', payload, context);
        return result;
    }

    return { error: 'Invalid action' };
}

export default function EntityDetailPage() {
    const { entity, id } = useParams();
    const loaderData = useLoaderData<typeof loader>();
    const data = loaderData?.data;
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
            <DynamicEntityDetail 
                entityId={entity as string} 
                recordId={id as string} 
                config={config} 
                initialData={data}
            />
        </ErrorBoundary>
    );
}
