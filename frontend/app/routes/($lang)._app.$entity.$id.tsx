import React from 'react';
import { useParams } from 'react-router';
import { useConfig } from '~/hooks/useConfig';
import { DynamicEntityDetail } from '~/components/entity/DynamicEntityDetail';
import { Database, AlertTriangle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useSmartBack } from '~/hooks/useSmartBack';
import { useTranslation } from 'react-i18next';

export async function loader({ params }: any) {
  return {
    entityId: params.entity,
    id: params.id,
    lang: params.lang
  };
}

// Dummy action to satisfy React Router 7's check for POST requests.
// API calls are intercepted in entry.server.tsx before this is ever reached.
export async function action() {
  return new Response("OK", { status: 200 });
}

export default function GenericEntityDetailPage() {
  const { entity: entityId, id: recordId, lang } = useParams<{ entity: string; id: string; lang: string }>();
  const { entity: configMap, loading: configLoading } = useConfig();
  const { t } = useTranslation(['common', 'entity']);
  const goBack = useSmartBack();

  if (configLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 animate-pulse">
        <Database className="w-12 h-12 text-slate-200" />
        <div className="h-4 bg-slate-100 rounded w-32" />
      </div>
    );
  }

  // Enterprise Level 10: Case-Insensitive Lookup
  const normalizedEntityId = (entityId || '').toLowerCase();
  const configKey = Object.keys(configMap).find(k => k.toLowerCase() === normalizedEntityId);
  const config = configKey ? configMap[configKey] : undefined;

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-rose-50 dark:bg-rose-950/20 rounded-3xl border border-rose-100 dark:border-rose-900/50 m-6">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/40 rounded-full flex items-center justify-center text-rose-600 mb-6">
            <AlertTriangle size={40} />
        </div>
        <h1 className="text-2xl font-black text-rose-900 dark:text-rose-100 mb-2">{t('entity:unknown_entity')}</h1>
        <p className="text-rose-600/70 max-w-md text-center">
            Entity "{entityId}" is not defined in the system registry.
        </p>
        <Button variant="outline" className="mt-8 border-rose-200 text-rose-700" onClick={() => goBack()}>
          {t('common:back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
        <DynamicEntityDetail 
            entityId={entityId!} 
            recordId={recordId!} 
            config={config} 
        />
    </div>
  );
}
