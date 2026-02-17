import { useCallback, useState } from 'react';
import { api } from '~/lib/core';

export interface UseActionV3Options {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

/**
 * useActionV3 Hook
 * Standard way to call modular v3 actions from the frontend.
 * 
 * Usage:
 * const { execute, loading, error } = useActionV3('user', 'update-profile');
 * ...
 * <button onClick={() => execute({ name: 'New Name' })}>Save</button>
 */
export function useActionV3(entityId: string, actionId: string, options?: UseActionV3Options) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const execute = useCallback(async (body: any = {}) => {
    setLoading(true);
    setError(null);
    try {
      const routeMap: Record<string, string> = {
        'user': 'auth',
        'workspace': 'workspace',
        'system_setting': 'system',
        'audit_log': 'monitoring',
        'entity_definition': 'entity',
      };

      const topLevel = routeMap[entityId] || entityId;
      const response = await api.brain.post(`${topLevel}/${actionId}`, body);

      if (response && response.success) {
        setData(response.data);
        options?.onSuccess?.(response.data);
        return response.data;
      } else {
        const errMsg = response?.error;
        if (errMsg) setError(errMsg);
        options?.onError?.(errMsg);
        return null;
      }
    } catch (err: any) {
      const respData = err?.response?.data;
      const errMsg = respData?.error || err.message;
      if (errMsg) setError(errMsg);
      options?.onError?.(errMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [entityId, actionId, options]);

  return { execute, loading, error, data };
}
