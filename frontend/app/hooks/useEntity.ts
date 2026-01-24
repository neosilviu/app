import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router";
import { 
  socket,
  socketRequest,
  api,
  debounce,
  normalizeEntity
} from "../lib/core";
import { db, resolveCollection } from '../lib/core';
import { toast } from "sonner";
import { renderString } from "../lib/utils";
import { useAuth } from "~/hooks/useAuth";
import { useConfig } from "~/hooks/useConfig";
import { useTheme } from "~/hooks/useTheme";

export interface EntityOptions {
  filters?: Record<string, any>;
  pageSize?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  includeArchived?: boolean;
  skipFetch?: boolean;
}

export function useEntity<T = any>(entityName: string, options: EntityOptions = {}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!options.skipFetch);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const skipNextSocketUpdate = useRef<string | null>(null);
  const { user, hasPermission } = useAuth();
  const { entity, constants } = useConfig();
  const { autoRefreshEnabled, canAutoRefresh } = useTheme();
  const params = useParams();
  const lang = (params.lang as string) || 'ro';

  // Get offline-capable entities from Registry
  const offlineEntities = useMemo(() => 
    constants?.offlineCapableEntities || [],
    [constants]
  );

  const isKnownEntity = useMemo(() => {
    if (!entityName || entityName === 'undefined') return false;
    return !!entity[entityName] || 
           offlineEntities.includes(entityName) || 
           ['workspace', 'user', 'SYSTEM_SETTING', 'entity_definition'].includes(entityName);
  }, [entityName, entity, offlineEntities]);

  // Selection helpers
  const getPk = useCallback((item: any) => {
    return item.id || item.chatId || item.sessionId || item.id;
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids?: string[]) => {
    if (ids) {
      setSelectedIds(new Set(ids));
    } else {
      setSelectedIds(new Set(data.map((item: any) => getPk(item))));
    }
  }, [data, getPk]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Load from IndexedDB cache first
  useEffect(() => {
    const loadCached = async () => {
      if (!entityName || options.skipFetch || !isKnownEntity) return;
      const cached = await db.entityData
        .where('entityType')
        .equals(entityName)
        .toArray();
      
      // Filter by workspace if user is loaded and not a superadmin
      let filtered = (user?.workspaceId && !hasPermission('*'))
        ? cached.filter((c: any) => c.workspaceId === user.workspaceId).map((c: any) => c.data)
        : cached.map((c: any) => c.data);

      // Filter by archived status
      if (!options.includeArchived) {
        filtered = filtered.filter((item: any) => !item.archived || item.archived === 0);
      }

      if (filtered.length > 0) {
        setData(filtered);
        setLoading(false);
      }
    };
    loadCached();
  }, [entityName, user?.workspaceId, options.includeArchived]);

  const fetchAll = useCallback(async () => {
    if (!entityName || options.skipFetch || !isKnownEntity) {
      if (options.skipFetch || !isKnownEntity) setLoading(false);
      return;
    }
    
    // Only show loading if we don't have data yet
    if (data.length === 0) {
      setLoading(true);
    }

    const filters = { ...options.filters };
    const GLOBAL_ENTITIES = ['workspace', 'user', 'role', 'SYSTEM_SETTING', 'entity_definition', 'audit_log', '_ai_prompt', 'workspace_user', 'workspace_invitation', 'workspace_setting'];
    const isGlobal = GLOBAL_ENTITIES.includes(entityName);
    
    // Handle archived items
    if (!options.includeArchived && !filters.archived && !isGlobal) {
      filters.archived = 0;
    }

    // Add workspaceId filter if not explicitly provided
    // Skip this for global/system entities
    if (user?.workspaceId && !filters.workspaceId && !isGlobal) {
      filters.workspaceId = user.workspaceId;
    }

    try {
      const workspaceId = filters.workspaceId || 'all';
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (key !== 'workspaceId') queryParams.append(key, String(value));
      });
      if (options.pageSize) queryParams.append('pageSize', String(options.pageSize));
      if (options.page) queryParams.append('page', String(options.page));
      if (options.sortBy) queryParams.append('sortBy', options.sortBy);
      if (options.sortOrder) queryParams.append('sortOrder', options.sortOrder);

      const url = `db/collection/${entityName}/${workspaceId}?${queryParams.toString()}`;
      
      let responseData;
      try {
        const response = await api.brain.get(url);
        if (!response || typeof response === 'string') throw new Error("Invalid response");
        
        responseData = response;
        console.log(`[useEntity] Brain API returned ${responseData.data?.length || 0} records for ${entityName}`);
        
        // HYBRID FIX: If Brain returns empty but we are connected to a socket,
        // it's possible the data exists only on the Local Agent (e.g. contact, file)
        // or hasn't synced up yet.
        // IMPROVED: If we are in dev or Brain has significantly fewer records than local usually has, 
        // we should check Local Agent regardless or merge them.
        const resolvedName = resolveCollection(entityName);
        const isLocalEntity = offlineEntities.includes(resolvedName);
        
        // If Brain returned FEWER than 100 records for a local entity like contact, we suspect local has more.
        const brainHasFewRecords = responseData.success && responseData.data?.length < 100;
        
        if (responseData.success && (responseData.data?.length === 0 || brainHasFewRecords) && socket.connected && isLocalEntity) {
            console.log(`[useEntity] Brain returned only ${responseData.data?.length || 0} ${entityName}, checking Socket fallback for more...`);
            const effectivePageSize = options.pageSize || 10000;
            console.log(`[useEntity] Requesting ${entityName} via Socket with pageSize=${effectivePageSize}`);
            const localRes = await socketRequest('db:list', { 
              collection: entityName, 
              workspaceId, 
              filters,
              pageSize: effectivePageSize, // Default to 10000 for local entities to fetch all data
              page: options.page,
              sortBy: options.sortBy,
              sortOrder: options.sortOrder
            });
            
            if (localRes?.success && localRes.data?.length > (responseData.data?.length || 0)) {
              responseData = localRes;
            }
        }
      } catch (err) {
        console.warn(`[useEntity] Brain API failed for ${entityName}, trying Socket fallback...`);
        const resolvedName = resolveCollection(entityName);
        const isLocalEntity = offlineEntities.includes(resolvedName);
        const effectivePageSize = options.pageSize || (isLocalEntity ? 10000 : undefined);
        console.log(`[useEntity] Socket fallback for ${entityName} with pageSize=${effectivePageSize}`);
        const localRes = await socketRequest('db:list', { 
          collection: entityName, 
          workspaceId, 
          filters,
          pageSize: effectivePageSize, // Default to 10000 for local entities to fetch all data
          page: options.page,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder
        });
        console.log(`[useEntity] Socket fallback returned ${localRes?.data?.length || 0} records`);
        if (localRes?.success) {
          responseData = localRes;
        } else {
          throw err;
        }
      }
      
      setLoading(false);
      if (responseData.success) {
        const newData = Array.isArray(responseData.data) ? responseData.data : [];
        setData(prev => {
          if (prev.length === newData.length && JSON.stringify(prev[0]) === JSON.stringify(newData[0])) {
             return prev;
          }
          return newData;
        });
        
        // Update IndexedDB cache
        await db.entityData.where('entityType').equals(entityName).delete();
        if (newData.length > 0) {
          const cacheEntries = newData.map((item: any) => {
            const pk = getPk(item);
            return {
              id: `${entityName}:${pk}`,
              entityType: entityName,
              data: item,
              updatedAt: Date.now()
            };
          });
          await db.entityData.bulkPut(cacheEntries);
        }
      } else {
        setError(responseData.error);
        toast.error(`Failed to fetch ${entityName}: ${responseData.error}`);
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
      console.error(`Failed to fetch ${entityName}`, err);
    }
  }, [entityName, JSON.stringify(options), user?.workspaceId]);

  const debouncedFetchAll = useMemo(
    () => debounce(fetchAll, 300),
    [fetchAll]
  );

  useEffect(() => {
    fetchAll();

    // Listen for real-time updates
    const handleDataUpdate = (payload: any) => {
      if (!autoRefreshEnabled || !canAutoRefresh) return;
      const collection = typeof payload === 'string' ? payload : payload?.collection;
      const id = typeof payload === 'object' ? payload?.id : null;

      if (id && skipNextSocketUpdate.current === id) {
        skipNextSocketUpdate.current = null;
        return;
      }

      if (collection === 'batch' && skipNextSocketUpdate.current === 'batch') {
        skipNextSocketUpdate.current = null;
        return;
      }

      if (collection === entityName || collection === "batch") {
        debouncedFetchAll();
      }
    };

    const handleListUpdate = (payload: any) => {
      if (!autoRefreshEnabled || !canAutoRefresh) return;
      if (payload?.collection === entityName || payload?.collection === "batch") {
        if (payload?.collection === 'batch' && skipNextSocketUpdate.current === 'batch') {
          skipNextSocketUpdate.current = null;
          return;
        }
        debouncedFetchAll();
      }
    };

    const handleTagsUpdate = () => {
      if (autoRefreshEnabled && canAutoRefresh) debouncedFetchAll();
    };

    socket.on("data:updated", handleDataUpdate);
    socket.on("socket:data_updated", handleDataUpdate);
    socket.on("socket:list_updated", handleListUpdate);

    if (entityName === 'tag' || entityName === 'tag') {
      socket.on("tag:updated", handleTagsUpdate);
    }

    return () => {
      socket.off("data:updated", handleDataUpdate);
      socket.off("socket:data_updated", handleDataUpdate);
      socket.off("socket:list_updated", handleListUpdate);
      if (entityName === 'tag' || entityName === 'tag') {
        socket.off("tag:updated", handleTagsUpdate);
      }
    };
  }, [entityName, debouncedFetchAll, autoRefreshEnabled, canAutoRefresh]);

  const create = async (itemData: Partial<T>) => {
    const payload = { ...itemData } as any;
    const workspaceId = payload.workspaceId || user?.workspaceId || 'all';

    try {
      let result;
      try {
        const response = await api.brain.post(`db/collection/${entityName}/${workspaceId}`, payload);
        console.log(`[useEntity] Brain API create response for ${entityName}:`, response);
        result = response;
      } catch (err) {
        console.warn(`[useEntity] Brain API create failed for ${entityName}, trying Socket fallback...`);
        result = await socketRequest('db:create', { collection: entityName, workspaceId, data: payload });
      }

      if (result.success) {
        const newItem = result.data;
        console.log(`[useEntity] Adding new item to state:`, newItem);
        skipNextSocketUpdate.current = newItem.id;
        setData(prev => [newItem, ...prev]);
        toast.success(`${entityName} created successfully`);
        return newItem.id;
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Failed to create ${entityName}: ${error.message}`);
      throw error;
    }
  };

  const update = async (id: string, itemData: Partial<T>) => {
    const payload = { ...itemData } as any;
    try {
      let result;
      try {
        const response = await api.brain.put(`db/collection/${entityName}/${id}`, payload);
        result = response;
      } catch (err) {
        console.warn(`[useEntity] Brain API update failed for ${entityName}, trying Socket fallback...`);
        result = await socketRequest('db:update', { collection: entityName, id, data: payload });
      }

      if (result.success) {
        skipNextSocketUpdate.current = id;
        setData(prev => prev.map((item: any) => 
          item.id === id ? { ...item, ...payload, updatedAt: new Date().toISOString() } : item
        ));
        toast.success(`${entityName} updated successfully`);
        return id;
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Failed to update ${entityName}: ${error.message}`);
      throw error;
    }
  };

  const remove = async (id: string, force: boolean = false) => {
    try {
      let result;
      try {
        const url = `db/collection/${entityName}/${id}${force ? '?force=true' : ''}`;
        const response = await api.brain.delete(url);
        result = response;
      } catch (err) {
        console.warn(`[useEntity] Brain API delete failed for ${entityName}, trying Socket fallback...`);
        result = await socketRequest('db:delete', { collection: entityName, id });
      }

      // Check for dependencies (Enterprise Level 8 Safety)
      if (result.success && result.data?.hasDependencies && !force) {
        if (confirm(result.data.message)) {
          return await remove(id, true); // Retry with force
        } else {
          return false;
        }
      }

      if (result.success) {
        skipNextSocketUpdate.current = id;
        setData(prev => prev.filter((item: any) => item.id !== id));
        toast.success(renderString({ ro: "Înregistrare ștearsă", en: "Deleted" }, lang));
        return true;
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Failed to delete ${entityName}: ${error.message}`);
      throw error;
    }
  };

  const archive = async (id: string) => {
    try {
      let result;
      try {
        const response = await api.brain.patch(`db/collection/${entityName}/${id}/archive`);
        result = response;
      } catch (err) {
        console.warn(`[useEntity] Brain API archive failed for ${entityName}, trying Socket fallback...`);
        result = await socketRequest('db:archive', { collection: entityName, id });
      }

      if (result.success) {
        skipNextSocketUpdate.current = id;
        setData(prev => prev.filter((item: any) => item.id !== id));
        toast.success(`${entityName} archived successfully`);
        return true;
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Failed to archive ${entityName}: ${error.message}`);
      throw error;
    }
  };

  const restore = async (id: string) => {
    try {
      const item = await getOne(id);
      if (item) {
        await update(id, { ...item, archived: 0 } as any);
        toast.success(`${entityName} restored successfully`);
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(`Failed to restore ${entityName}: ${error.message}`);
      throw error;
    }
  };

  const bulkArchive = async (ids: string[]) => {
    try {
      const operations = ids.map(id => ({
        type: 'set',
        collection: entityName,
        id,
        data: { archived: 1 }
      }));
      const response = await api.brain.post('db/batch', { operations, workspaceId: user?.workspaceId });
      if (response.success) {
        skipNextSocketUpdate.current = 'batch';
        setData(prev => prev.filter((item: any) => !ids.includes(item.id)));
        toast.success(`${ids.length} items archived`);
        clearSelection();
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(`Failed to archive items: ${error.message}`);
      throw error;
    }
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      const operations = ids.map(id => ({
        type: 'delete',
        collection: entityName,
        id
      }));
      const response = await api.brain.post('db/batch', { operations, workspaceId: user?.workspaceId });
      if (response.success) {
        skipNextSocketUpdate.current = 'batch';
        setData(prev => prev.filter((item: any) => !ids.includes(item.id)));
        toast.success(`${ids.length} items deleted`);
        clearSelection();
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(`Failed to delete items: ${error.message}`);
      throw error;
    }
  };

  const importData = async (file: File, mapping: Record<string, string>) => {
    // Check if there are existing items to ask about duplicates
    if (data.length > 0) {
      const confirmDuplicate = confirm("Am detectat rânduri existente. Dorești să SĂRIM (Skip) rândurile care par a fi duplicate? (Apasă CANCEL pentru a le importa pe toate)");
      (window as any)._importSkipDuplicates = confirmDuplicate;
    } else {
      (window as any)._importSkipDuplicates = false;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let text = e.target?.result as string;
        
        // Normalize text: remove BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        const toastId = toast.loading('Importăm datele...');
        
        // Ensure we have content
        if (!text || text.trim().length === 0) {
          toast.error('Fișierul este gol', { id: toastId });
          reject(new Error('File is empty'));
          return;
        }

        const skipDuplicates = (window as any)._importSkipDuplicates;
        
        const worker = new Worker(new URL('../lib/import-worker.ts', import.meta.url), { type: 'module' });
        let totalImported = 0;
        let totalSkipped = 0;
        let chunkCount = 0;
        let allProcessedItems: any[] = []; // Track all items in this import session
        let lastToastUpdate = Date.now();
        
        const skipFields = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'archived', 'archivedAt', 'workspaceId'];

        // Timeout protection
        const importTimeout = setTimeout(() => {
          worker.terminate();
          console.error('[IMPORT] Timeout - worker did not finish');
          toast.error('Import timeout - please try again', { id: toastId });
          reject(new Error('Import timeout'));
        }, 30000); // 30 seconds

        worker.onerror = (error: any) => {
            clearTimeout(importTimeout);
            console.error('[WORKER-ERROR]', error);
            worker.terminate();
            toast.error(`Import error: ${error.message || 'Unknown'}`, { id: toastId });
            reject(error);
          };
          
          const chunkQueue: any[] = [];
          let isProcessingQueue = false;

          const processQueue = async () => {
            if (isProcessingQueue) return;
            isProcessingQueue = true;

            while (chunkQueue.length > 0) {
              const eventData = chunkQueue.shift();
              try {
                const { success, data: chunk, error, done } = eventData;

                chunkCount++;
                console.log(`[IMPORT] Chunk ${chunkCount} processing: success=${success}, items=${chunk?.length || 0}, done=${done}`);

                if (success && chunk && Array.isArray(chunk)) {
                  const toImport: any[] = [];
                  
                  // Get entity config to apply default values for missing columns
                  const entityDef = (entity as any)[entityName];
                  const fieldDefaults: Record<string, any> = {};
                  if (entityDef?.fields) {
                    Object.entries(entityDef.fields).forEach(([fieldName, fieldConfig]: [string, any]) => {
                      const d = fieldConfig.default !== undefined ? fieldConfig.default : fieldConfig.defaultValue;
                      if (d !== undefined) {
                        fieldDefaults[fieldName] = d;
                      }
                    });
                  }

                  for (const item of chunk) {
                    if (!item || typeof item !== 'object') continue;

                    // Apply default values from registry if the column is missing or empty
                    Object.entries(fieldDefaults).forEach(([key, defaultValue]) => {
                      if (item[key] === undefined || item[key] === null || String(item[key]).trim() === '') {
                        item[key] = defaultValue;
                      }
                    });

                    let isDuplicate = false;
                    if (skipDuplicates) {
                      // Session deduplication
                      for (const processed of allProcessedItems) {
                        const relevantKeys = Object.keys(item).filter(k => !skipFields.includes(k) && (item as any)[k]);
                        if (relevantKeys.length === 0) continue;
                        const allMatch = relevantKeys.every(key => {
                          const v1 = String((item as any)[key] || '').toLowerCase().trim();
                          const v2 = String((processed as any)[key] || '').toLowerCase().trim();
                          return v1 === v2 && v1.length > 0;
                        });
                        if (allMatch) { isDuplicate = true; break; }
                      }

                      // DB deduplication (against existing visible data)
                      if (!isDuplicate && data.length > 0) {
                        for (const existing of data) {
                          const relevantKeys = Object.keys(item).filter(k => !skipFields.includes(k) && (item as any)[k]);
                          if (relevantKeys.length === 0) continue;
                          const allMatch = relevantKeys.every(key => {
                            const v1 = String((item as any)[key] || '').toLowerCase().trim();
                            const v2 = String((existing as any)[key] || '').toLowerCase().trim();
                            return v1 === v2 && v1.length > 0;
                          });
                          if (allMatch) { isDuplicate = true; break; }
                        }
                      }
                    }

                    if (isDuplicate) {
                      totalSkipped++;
                    } else {
                      toImport.push(item);
                      allProcessedItems.push(item);
                    }
                  }

                  if (toImport.length > 0) {
                    try {
                      const operations = toImport.map((item: any) => ({
                        type: 'set',
                        collection: entityName,
                        data: item
                      }));

                      const resp = await api.brain.post("db/batch", { operations, workspaceId: user?.workspaceId });
                      if (resp.success) {
                        totalImported += toImport.length;
                        console.log(`[IMPORT] Batch ${chunkCount} successful. Total now: ${totalImported}`);
                      } else {
                        throw new Error(resp.error || 'Server rejected batch');
                      }
                    } catch (err: any) {
                      console.error("[IMPORT] Batch failed:", err);
                      // Non-fatal error for the whole process, but maybe show toast
                      toast.error(`Eroare la procesarea lotului ${chunkCount}: ${err.message || 'Server error'}`);
                    }
                  }

                  if (done) {
                    clearTimeout(importTimeout);
                    console.log(`[IMPORT] ✓ DONE! Imported: ${totalImported}, Skipped: ${totalSkipped}`);
                    worker.terminate();
                    
                    toast.success(
                      `✓ Import complet\n📊 Importate: ${totalImported} | Duplicate omise: ${totalSkipped}`,
                      { id: toastId, duration: 5000 }
                    );
                    
                    await fetchAll();
                    resolve({ imported: totalImported, skipped: totalSkipped });
                    return; // Exit processQueue
                  } else {
                    const now = Date.now();
                    if (now - lastToastUpdate > 1000) {
                      const msg = `⏳ Importând... [${totalImported} importate | ${totalSkipped} omise]`;
                      toast.loading(msg, { id: toastId });
                      lastToastUpdate = now;
                    }
                  }
                } else if (error) {
                    throw new Error(error);
                } else if (done) {
                    // Empty but done
                    clearTimeout(importTimeout);
                    worker.terminate();
                    toast.success(`✓ Import complet!`, { id: toastId });
                    await fetchAll();
                    resolve({ imported: totalImported, skipped: totalSkipped });
                    return;
                }
              } catch (err: any) {
                console.error('[IMPORT] Chunk processing error:', err);
                // If it's the last chunk and it failed, we still need to resolve or reject
                if (eventData.done) {
                    clearTimeout(importTimeout);
                    worker.terminate();
                    reject(err);
                    return;
                }
              }
            }
            isProcessingQueue = false;
          };

          worker.onmessage = (event) => {
            chunkQueue.push(event.data);
            processQueue();
          };

        console.log('[IMPORT] Starting worker with file:', file.name, 'Mapping:', mapping);
        console.log('[IMPORT] FileReader result length:', text?.length || 0, 'First 100 chars:', text?.substring(0, 100));
        worker.postMessage({
          fileText: text,
          mapping,
          entityType: entityName,
          workspaceId: user?.workspaceId
        });
      };
      reader.readAsText(file);
    });
  };

  const getOne = useCallback(async (id: string): Promise<T | null> => {
    try {
      if (!entityName || entityName === 'undefined' || !isKnownEntity) return null;

      // Local-only entities (stored in Local Agent DB)
      const localEntities = ['bug_report', 'audit_log', 'changelog', 'notification'];
      
      if (localEntities.includes(entityName)) {
        // Use Socket for local entities
        const response = await socketRequest('db:get', { collection: entityName, id });
        if (response?.success && response?.data) {
          return response.data;
        }
        return null;
      }
      
      // Use Brain API for cloud entities
      try {
        const response = await api.brain.get(`db/collection/${entityName}/item/${id}`);
        if (response.success) {
          return response.data;
        }
      } catch (err: any) {
        // Record not found is not a critical error for getOne
        if (err?.response?.status === 404) {
          return null;
        }
        throw err;
      }
      return null;
    } catch (err) {
      console.error(`Failed to get ${entityName} item ${id}`, err);
      return null;
    }
  }, [entityName, isKnownEntity]);

  const importWithAI = async (text: string, file?: File) => {
    const toastId = toast.loading('AI is parsing data...');
    try {
      // Enterprise Level 8: Always use the central normalizer
      const config = entity[entityName];
      const normalized = normalizeEntity(config);
      
      const schema: Record<string, string> = {};
      normalized.fields.forEach((field: any) => {
        if (!field.readOnly && field.name !== 'id') {
          schema[field.name] = field.type;
        }
      });

      let response;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('schema', JSON.stringify(schema));
        formData.append('text', text); // Also send text if provided
        formData.append('lang', lang);
        
        response = await api.brain.post(`db/collection/${entityName}/import-ai`, formData);
      } else {
        response = await api.brain.post(`db/collection/${entityName}/import-ai`, {
          text,
          schema,
          lang
        });
      }

      if (response.success) {
        let items = response.data;
        if (!Array.isArray(items)) items = [items];

        // Filter out duplicates (identical to existing items)
        if (data.length > 0) {
          const skipFields = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'archived', 'archivedAt', 'workspaceId'];
          items = items.filter((newItem: any) => {
            const isDuplicate = data.some((existing: any) => {
              // Get all keys from the new item that are NOT metadata
              const relevantKeys = Object.keys(newItem).filter(k => !skipFields.includes(k));
              if (relevantKeys.length === 0) return false;
              
              // Check if every relevant field matches
              return relevantKeys.every(key => {
                const v1 = newItem[key];
                const v2 = existing[key];
                
                // Flexible comparison (handle null/undefined/string/number)
                if (v1 === v2) return true;
                if (!v1 && !v2) return true;
                return String(v1).toLowerCase().trim() === String(v2).toLowerCase().trim();
              });
            });
            return !isDuplicate;
          });
        }

        if (items.length === 0) {
          toast.success('AI a extras datele dar toate există deja în sistem', { id: toastId });
          return true;
        }

        toast.loading(`Importăm ${items.length} elemente noi...`, { id: toastId });
        
        // Final cleaning and mapping of values
        const config = entity[entityName];
        const normalized = normalizeEntity(config);
        const cleanedItems = items.map((item: any) => {
          const newItem = { ...item };
          
          // Try to map select options by label or name if exact value doesn't match
          normalized.fields.forEach((field: any) => {
            const name = field.name;
            if (field.type === 'select' && newItem[name]) {
              const val = String(newItem[name]).toLowerCase();
              const exactOption = field.options?.find((o: any) => String(o.value).toLowerCase() === val || String(o.label).toLowerCase() === val);
              if (exactOption) newItem[name] = exactOption.value;
            }
            if (field.type === 'number' && newItem[name]) {
              newItem[name] = Number(newItem[name].toString().replace(/[^\d.-]/g, ''));
            }
          });

          return newItem;
        });

        const operations = cleanedItems.map((item: any) => ({
          type: 'set',
          collection: entityName,
          data: item
        }));

        const importResponse = await api.brain.post('db/batch', { 
          operations, 
          workspaceId: user?.workspaceId 
        });

        if (importResponse.success) {
          toast.success(`Successfully imported ${items.length} items with AI`, { id: toastId });
          fetchAll();
          return true;
        }
      }
      throw new Error(response.error || 'Failed to import with AI');
    } catch (error: any) {
      toast.error(`AI Import failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  const exportData = async (format: 'csv' | 'json' = 'csv') => {
    const toastId = toast.loading('Exporting data...');
    try {
      const workspaceId = user?.workspaceId || 'all';
      const url = `db/collection/${entityName}/export?workspaceId=${workspaceId}&format=${format}`;
      
      const response = await api.brain.get(url, {
        responseType: 'arraybuffer'
      });

      if (format === 'csv') {
        const blob = new Blob([response], { type: 'text/csv' });
        
        // Verificăm dacă nu cumva e un JSON de eroare deghizat în Blob
        if (blob.size < 50) {
           const text = await blob.text();
           try {
             const json = JSON.parse(text);
             if (json.success === false) throw new Error(json.error || 'Server error');
           } catch(e) {}
        }

        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `${entityName}_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
        toast.success('Export CSV completat', { id: toastId });
      } else {
        // Pentru JSON, convertim arraybuffer în string
        const text = new TextDecoder().decode(new Uint8Array(response));
        const jsonData = JSON.parse(text);

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `${entityName}_export_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
        toast.success('Export JSON completat', { id: toastId });
      }
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(`Export eșuat: ${error.message}`, { id: toastId });
    }
  };

  return {
    data,
    loading,
    error,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    refresh: fetchAll,
    create,
    update,
    remove,
    archive,
    restore,
    bulkArchive,
    bulkDelete,
    importData,
    importWithAI,
    exportData,
    getOne,
  };
}

