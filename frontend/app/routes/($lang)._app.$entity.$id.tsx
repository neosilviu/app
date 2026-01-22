import React from 'react';
import { useParams } from 'react-router';
import { useConfig } from '~/hooks/useConfig';
import { DynamicEntityDetail } from '~/components/entities/DynamicEntityDetail';
import { ErrorBoundary } from '~/components/ControlGates';
import { api } from '~/lib/core';

export async function action({ request, params }: any) {
    const formData = await request.formData();
    const action = formData.get('_action');
    const entity = params.entity;
    const id = params.id;

    if (action === 'delete') {
        return await api.brain.delete(`db/${entity}/${id}`);
    }

    if (action === 'update' || action === 'put') {
        const data = JSON.parse(formData.get('data') || '{}');
        return await api.brain.put(`db/${entity}/${id}`, data);
    }

    return { error: 'Invalid action' };
}

export default function EntityDetailPage() {
    const { entity, id } = useParams();
    const { entities, isInitialized } = useConfig();

    if (!isInitialized) {
        return (
            <div className="p-8 text-slate-400 font-black italic uppercase">
                <div className="mb-4">Loading Engine...</div>
                <div className="text-sm text-slate-500">Registry is initializing — content will appear shortly.</div>
            </div>
        );
    }
    
    const config = entities[entity as string];
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
