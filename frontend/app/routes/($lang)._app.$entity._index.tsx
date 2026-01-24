import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { Brain } from '~/brain.server';
import { DynamicEntityList } from '~/components/entity/DynamicEntityList';
import { useLoaderData, useParams } from 'react-router';
import { ErrorBoundary } from '~/components/ControlGates';
import { useConfig } from '~/hooks/useConfig';

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { entity, lang } = params;
  
  // Utilizăm handler-ul generic: o singură linie de cod pentru orice entitate!
  const data = await Brain.execute(entity!, 'READ', { lang }, context);
  
  return { data };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
    const { entity } = params;
    const formData = await request.formData();
    const action = formData.get('_action');

    if (action === 'delete') {
        const id = formData.get('id');
        if (id) {
            return await Brain.execute(entity!, 'DELETE', { id }, context);
        }
    }

    return { error: 'Invalid action', status: 400 };
}

export default function EntityIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const data = loaderData?.data;
  const { entity } = useParams();
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

  // Componenta primește datele și doar le randează
  return (
    <ErrorBoundary>
      <DynamicEntityList 
        entityId={entity!} 
        config={config} 
        initialData={data} 
      />
    </ErrorBoundary>
  );
}
