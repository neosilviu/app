import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useParams, useOutletContext } from 'react-router';
import { Save, ArrowLeft, Trash2, Shield, Clock, History, CheckCircle2, X, Plus, PlusCircle, ExternalLink, RefreshCw, MessageCircle, Phone, Send, Brain, Sparkles, Mail, HelpCircle, RotateCcw, Archive } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { IconPicker } from '~/components/ui/IconPicker';
import { ColorPicker } from '~/components/ui/ColorPicker';
import { DatePicker } from '~/components/ui/DatePicker';

import { FileUploader } from '~/components/ui/file-uploader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Dialog, DialogContent, DialogHeader,  DialogTitle, DialogDescription, DialogFooter } from '~/components/ui/dialog';
import { GlassCard } from '~/components/ui/GlassCard';
import { api, cn, socket, renderString, getLocalizedPath, resolveIcon } from '~/lib/core';
import { normalizeEntity, normalizeFormData, formatFormValue } from '~/lib/entity-engine';
import { useTranslation } from 'react-i18next';
import { useConfig } from '~/hooks/useConfig';
import { useAuth } from '~/hooks/useAuth';
import { toast } from 'sonner';
import { getErrorMessage } from '~/lib/utils';
import { EntityHistoryWidget } from '~/components/entity/EntityHistoryWidget';
import { WorkflowWidget } from '~/components/entity/WorkflowWidget';
import { ContactInteractions } from '~/components/entity/ContactInteractions';
import { SubtaskManager } from '~/components/entity/SubtaskManager';

// Global cache for workspace member fetches (Enterprise Level 8)
const globalWorkspaceMemberCache = new Map<string, number>();

interface DynamicEntityDetailProps {
    entityId: string;
    recordId: string;
    config: any;
}

export function DynamicEntityDetail({ entityId, recordId, config }: DynamicEntityDetailProps) {
    const { lang } = useParams();
    const { t } = useTranslation(['common', 'entity', 'superadmin']);
    const navigate = useNavigate();
    const location = useLocation();
    const { constants, entity, refreshConfig } = useConfig();
    const { user, hasPermission, loading: authLoading } = useAuth();
    const { setDynamicTitle } = useOutletContext<any>() || {};
    
    // Enterprise Level 8: Ensure we have the latest entity definition on mount/when entityId changes
    // This fixes the issue where new fields added to an entity don't appear in the edit form
    useEffect(() => {
        refreshConfig(true);
    }, [entityId, refreshConfig]);
    
    // Normalize entity configuration (Enterprise Level 8)
    const normalizedConfig = React.useMemo(() => normalizeEntity(config), [config]);
    const fieldsList = normalizedConfig.fields;
    const finalConfig = normalizedConfig; // Use normalized version for UI logic

    const isNew = recordId === 'new';
    const features = finalConfig.features || {};
    
    // RBAC Permissions (Level 8)
    const canCreate = hasPermission(`${entityId}:create`) || hasPermission(`${entityId}:*`) || hasPermission('workspace:manage');
    const canUpdate = hasPermission(`${entityId}:update`) || hasPermission(`${entityId}:*`) || hasPermission('workspace:manage');
    const canDelete = hasPermission(`${entityId}:delete`) || hasPermission(`${entityId}:*`) || hasPermission('workspace:manage');

    const isCreatable = features.creatable !== false && canCreate;
    const isEditable = features.editable !== false && canUpdate;
    const isDeletable = features.deletable !== false && canDelete;

    // A record is read-only if it's not new and not editable, OR if it's new but not creatable
    const isGlobalReadOnly = (isNew && !isCreatable) || (!isNew && !isEditable);

    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [isAiExtracting, setIsAiExtracting] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [extractionSource, setExtractionSource] = useState<'text' | 'file' | 'inbox'>('text');
    const [extractionText, setExtractionText] = useState('');

    // Enterprise Level 8: Sync record name to Page Title
    useEffect(() => {
        if (!setDynamicTitle) return;

        const getDisplayName = () => {
             const df = finalConfig.displayField || 'name';
             const val = formData[df] || formData.name || formData.Name || formData.label || formData.title || formData.displayName;
             if (!val || String(val) === 'undefined') return null;
             return val;
        };

        if (isNew) {
            setDynamicTitle(renderString(t('common:new_record', { label: renderString(finalConfig.label, lang) }), lang));
        } else {
            const displayName = getDisplayName();
            if (displayName) {
                setDynamicTitle(renderString(displayName, lang));
            } else if (formData && Object.keys(formData).length > 0) {
                // If we have data but no name, set null to allow fallback to ID in Breadcrumbs
                setDynamicTitle(null);
            }
        }
    }, [formData, isNew, finalConfig.displayField, finalConfig.label, setDynamicTitle, lang, t]);

    const handleAiExtraction = async () => {
        setIsAiExtracting(true);
        try {
            const res = await api.brain.post(`ai/extract`, {
                entityId,
                sourceType: extractionSource,
                content: extractionText,
                schema: fieldsList
            });

            if (res.success && res.data) {
                // Enterprise Level 8: Recursive merge to preserve existing data but overwrite with AI findings
                // Normalize AI data to prevent object rendering errors
                const normalizedAiData = normalizeFormData(res.data, fieldsList);
                setFormData((prev: any) => ({ ...prev, ...normalizedAiData }));
                toast.success(renderString({
                    ro: "Datele au fost extrase și aplicate cu succes!",
                    en: "Data extracted and applied successfully!"
                }, lang));
                setIsAiModalOpen(false);
            } else {
                toast.error(getErrorMessage(res.error, "AI Extraction failed"));
            }
        } catch (e: any) {
            toast.error(getErrorMessage(e, "AI Extraction failed"));
        } finally {
            setIsAiExtracting(false);
        }
    };

    // Default values for new records (Enterprise Level 8)
    useEffect(() => {
        if (isNew && fieldsList.length > 0) {
            const defaults: any = {};
            
            // Extract from query params if available (e.g. ?workspaceId=...)
            const searchParams = new URLSearchParams(location.search);
            
            fieldsList.forEach((f: any) => {
                // Priority 0: URL Query Params
                const queryVal = searchParams.get(f.name);
                if (queryVal) {
                    defaults[f.name] = queryVal;
                }
                // Priority 1: Hardcoded default
                else if (f.default !== undefined && f.default !== 'now') {
                    defaults[f.name] = f.default;
                } 
                // Priority 2: Generated values (e.g. 'now')
                else if (f.generated === 'now' || f.default === 'now') {
                    defaults[f.name] = new Date().toISOString();
                }
            });
            setFormData(defaults);
        }
    }, [isNew, fieldsList, location.search]);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [relatedData, setRelatedData] = useState<Record<string, any[]>>({});
    const [childrenRecords, setChildrenRecords] = useState<Record<string, any[]>>({});
    const [childDefinitions, setChildDefinitions] = useState<Record<string, any>>({});

    // Cache to prevent duplicate API calls
    const fetchedRelatedDataRef = useRef<string>('');

    const fetchRelatedData = useCallback(async () => {
        if (authLoading) return;
        
        const cacheKey = `${entityId}-${recordId}`;
        if (fetchedRelatedDataRef.current === cacheKey) return; // Already fetched
        
        // Enterprise Level 8: Include 'tag' and 'multi-select' in related data fetching
        const relations = fieldsList.filter((f: any) => 
            (f.type === 'entity_relation' || f.type === 'relation' || f.type === 'relation-many' || f.type === 'tag' || f.type === 'multi-select' || f.relation) && 
            (f.relationEntity || f.relation?.target || (f.type === 'tag' ? 'tag' : null))
        );

        // Enterprise Level 8: Always pass current workspace as context if not global
        const workspaceBus = user?.workspaceId || 'system';

        // Enterprise Level 8: Fetch Relations and Children in independent parallel tracks
        // This prevents waterfalls and makes the UI feel much faster
        
        // 1. Relations Track
        relations.forEach(async (rel) => {
            const target = rel.relationEntity || rel.relation?.target || (rel.type === 'tag' ? 'tag' : null);
            if (!target) return;

            try {
                const res = await api.brain.get(`db/${target}?workspaceId=${workspaceBus}`);
                if (res.success) {
                    const targetEntityDef = entity[target];
                    const normalizedData = (res.data || []).map((item: any) => {
                        if (targetEntityDef) return normalizeFormData(item, targetEntityDef.fields);
                        return {
                            ...item,
                            id: item.id || item.ID || item.uuid,
                            name: item.name || item.Name || item.label || item.Label
                        };
                    });
                    setRelatedData(prev => ({ ...prev, [target]: normalizedData }));
                }
            } catch (e) {
                console.error(`[RELATION-FETCH-ERROR] ${target}:`, e);
            }
        });

        // 2. Children Records Track (Inbound Relations)
        if (!isNew && recordId) {
            const entitiesList = Object.values(entity || {});
            const potentialChildren = entitiesList.filter((e: any) => {
                const normalized = normalizeEntity(e);
                return normalized.fields.some((f: any) => (f.relationEntity === entityId || f.relation?.target === entityId));
            });

            potentialChildren.forEach(async (childEntity) => {
                const normalized = normalizeEntity(childEntity);
                const relField: any = normalized.fields.find((f: any) => (f.relationEntity === entityId || f.relation?.target === entityId));
                const fieldName = relField.name || relField.id;

                let endpoint = `db/${normalized.name || normalized.id}?${fieldName}=${recordId}`;
                
                if ((normalized.name === 'contact' || normalized.id === 'contact') && entityId === 'workspace') {
                    endpoint = `workspace/member?workspaceId=${recordId}`;
                    
                    const cacheKey = `workspace-member-${recordId}`;
                    const now = Date.now();
                    const lastFetch = globalWorkspaceMemberCache.get(cacheKey);
                    if (lastFetch && (now - lastFetch) < 300000) return; 
                    globalWorkspaceMemberCache.set(cacheKey, now);
                }

                try {
                    const res = await api.brain.get(endpoint);
                    if (res.success && res.data && res.data.length > 0) {
                        const normalizedChildren = res.data.map((item: any) => normalizeFormData(item, normalized.fields));
                        // Enterprise Level 8: Type casting to ensure computed property safety
                        const childKey = String(normalized.name || normalized.id);
                        setChildrenRecords(prev => ({ ...prev, [childKey]: normalizedChildren }));
                        setChildDefinitions(prev => ({ ...prev, [childKey]: normalized }));
                    }
                } catch (e) {
                    console.error(`[CHILDREN-FETCH-ERROR] ${normalized.name}:`, e);
                }
            });
        }
        
        fetchedRelatedDataRef.current = cacheKey; // Mark as fetched
    }, [fieldsList, isNew, recordId, entityId]);

    const shouldShowField = (field: any) => {
        const name = field.name || field.id;
        const hiddenFields = finalConfig.uiConfig?.form?.hiddenFields || [];
        if (hiddenFields.includes(name)) return false;

        if (!field.ui?.showIf && !field.showIf) return true;
        const condition = field.ui?.showIf || field.showIf;
        
        // Handle Level 8 Object Condition
        if (typeof condition === 'object' && condition.field) {
            const { field: k, operator, value: v } = condition;
            const currentVal = formData[k];
            
            switch (operator) {
                case 'eq': return currentVal == v;
                case 'neq': return currentVal != v;
                case 'gt': return Number(currentVal) > Number(v);
                case 'gte': return Number(currentVal) >= Number(v);
                case 'lt': return Number(currentVal) < Number(v);
                case 'lte': return Number(currentVal) <= Number(v);
                case 'in': return Array.isArray(v) ? v.includes(currentVal) : false;
                case 'not_in': return Array.isArray(v) ? !v.includes(currentVal) : true;
                case 'contains': return String(currentVal).toLowerCase().includes(String(v).toLowerCase());
                case 'empty': return !currentVal;
                case 'not_empty': return !!currentVal;
                default: return true;
            }
        }

        // Handle Legacy String Condition
        try {
            if (typeof condition !== 'string') return true;
            const expr = condition;
            if (expr.includes('==')) {
                const [k, v] = expr.split('==').map((s: string) => s.trim().replace(/['"]/g, ''));
                return formData[k] == v;
            }
            if (expr.includes('!=')) {
                const [k, v] = expr.split('!=').map((s: string) => s.trim().replace(/['"]/g, ''));
                return formData[k] != v;
            }
            if (expr.startsWith('!')) {
                const k = expr.substring(1).trim();
                return !formData[k];
            }
            return !!formData[expr.trim()];
        } catch (e) {
            console.warn("Invalid showIf expression:", condition);
            return true;
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        fieldsList.forEach((f: any) => {
            if (!shouldShowField(f)) return;
            const val = formData[f.name];
            const isRequired = f.req || f.required;

            // Required Check
            if (isRequired && (val === undefined || val === null || val === '')) {
                newErrors[f.name] = "Acest câmp este obligatoriu";
                return;
            }

            // Skip further validation if empty and not required
            if (val === undefined || val === null || val === '') return;

            // Pattern Check (Regex)
            const pattern = f.validation?.pattern || f.pattern;
            if (pattern && !new RegExp(pattern).test(String(val))) {
                newErrors[f.name] = f.patternMessage || f.validation?.message || "Format invalid (Regex)";
            }

            // Min/Max Length or Value
            const min = f.validation?.min !== undefined ? f.validation.min : f.min;
            const max = f.validation?.max !== undefined ? f.validation.max : f.max;

            if (f.type === 'number' || f.type === 'currency') {
                if (min !== undefined && Number(val) < min) newErrors[f.name] = `Valoarea minimă este ${min}`;
                if (max !== undefined && Number(val) > max) newErrors[f.name] = `Valoarea maximă este ${max}`;
            } else if (typeof val === 'string') {
                if (min !== undefined && val.length < min) newErrors[f.name] = `Lungimea minimă este ${min} caractere`;
                if (max !== undefined && val.length > max) newErrors[f.name] = `Lungimea maximă este ${max} caractere`;
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const fetchRecord = useCallback(async () => {
        if (authLoading) return;
        
        // Fix for 404 /null fetch
        if (isNew || !recordId || recordId === 'null' || recordId === 'undefined') {
            if (isNew) fetchRelatedData();
            return;
        }

        // Enterprise Level 8: Concurrent Fetching
        // We fetch the main record AND audit logs in parallel
        // We do NOT await fetchRelatedData here to avoid blocking the UI flow (feel-fast optimization)
        setLoading(true);
        try {
            // Start fetching relations and children async
            fetchRelatedData();

            const [recordRes, auditRes] = await Promise.all([
                api.brain.get(`db/${entityId}/item/${recordId}`),
                api.brain.get(`db/audit_log?entityType=${entityId}&entityId=${recordId}`).catch(() => ({ success: false })),
            ]);

            if (recordRes.success) {
                // Normalize data to extract primitive values from relation objects (fix React rendering error)
                const normalizedData = normalizeFormData(recordRes.data || {}, fieldsList);
                setFormData(normalizedData);
                
                // Set audit logs if available
                if (auditRes.success) setAuditLogs(auditRes.data || []);
            } else {
                toast.error("Record not found");
                navigate('..');
            }
        } catch (e: any) {
            toast.error("Error loading record: " + e.message);
        } finally {
            setLoading(false);
        }
    }, [fetchRelatedData, isNew, recordId, entityId, navigate, fieldsList, authLoading]);

    useEffect(() => {
        fetchedRelatedDataRef.current = ''; // Reset cache when entity/record changes
        fetchRecord();
    }, [entityId, recordId, authLoading, fetchRecord]);

    const savingRef = useRef(false);
    const handleSave = async (e?: React.MouseEvent) => {
        // 🔒 IMMEDIATE LOCK - prevent ANY duplicate execution
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (savingRef.current) {
            // console.log('[SAVE-LOCK] ⛔ Duplicate call blocked - already saving');
            return;
        }
        
        if (!validateForm()) {
            toast.error("Vă rugăm să corectați erorile din formular");
            return;
        }
        
        // Set lock BEFORE any async operation
        savingRef.current = true;
        setSaving(true);
        // console.log('[SAVE-START]', { entityId, recordId, isNew, method: isNew ? 'POST' : 'PATCH' });
        
        try {
            const method = isNew ? api.brain.post : api.brain.patch;
            const endpoint = isNew ? `db/${entityId}` : `db/${entityId}/${recordId}`;
            
            // Filter out generated fields for new records (they should be handled by DB)
            const dataToSend = { ...formData };
            if (isNew) {
                fieldsList.forEach((f: any) => {
                    if (f.generated) {
                        delete dataToSend[f.name];
                    }
                });
            }

            // Enterprise Level 8: Flatten rich objects (relations) to IDs before sending to Brain
            // This prevents "FOREIGN KEY constraint failed" from stringified JSON objects.
            Object.keys(dataToSend).forEach(key => {
                const field = fieldsList.find(f => (f.name === key || f.id === key));
                if (field) {
                    dataToSend[key] = formatFormValue(dataToSend[key], field.type);
                }
            });
            
            // console.log('[SAVE-SEND]', { endpoint, dataKeys: Object.keys(dataToSend) });
            
            const res = await method(endpoint, dataToSend);
            // console.log('[SAVE-RESPONSE]', { success: res.success, resId: res.data?.id });
            
            if (res.success) {
                toast.success(isNew ? "Creat cu succes" : "Actualizat cu succes");
                if (isNew) {
                    // Enterprise Level 8: Resilient ID Resolution
                    const newId = res.data?.id || res.data?.ID || res.data?.uuid || res.data?.key || 
                                     (finalConfig.displayField ? res.data[finalConfig.displayField] : '');
                    
                    if (newId) {
                        navigate(`/${lang}/${entityId}/${newId}`, { replace: true });
                    } else {
                        console.warn('[SAVE-NAVIGATE] No ID found in response, falling back to list');
                        navigate(`/${lang}/${entityId}`, { replace: true });
                    }
                } else {
                    // console.log('[SAVE-REFRESH]', 'Fetching updated record');
                    fetchRecord();
                }
            } else {
                toast.error("Salvare eșuată: " + res.error);
                if (res.validationErrors) setErrors(res.validationErrors);
            }
        } catch (e: any) {
            console.error('[SAVE-ERROR]', e.message);
            toast.error("Eroare la salvare: " + e.message);
        } finally {
            // console.log('[SAVE-FINALLY] Unlocking save button');
            savingRef.current = false;
            setSaving(false);
        }
    }; 

    const handleDelete = async () => {
        // First generic confirmation
        if (!confirm(renderString({
            ro: "Ești sigur că vrei să ștergi această înregistrare? Acțiunea este ireversibilă.",
            en: "Are you sure you want to delete this record? This action cannot be undone."
        }, lang))) return;

        console.log('[DELETE] Starting delete for', entityId, recordId);
        setSaving(true);
        try {
            // Step 1: Attempt delete (Enterprise Level 8: uses DB collection endpoint)
            let res = await api.brain.delete(`db/collection/${entityId}/item/${recordId}`);
            console.log('[DELETE] Delete response:', res);

            // Step 2: Handle dependency check (Enterprise Level 8 Safety)
            if (res.success && res.data?.hasDependencies) {
                if (confirm(res.data.message)) {
                    // Step 3: Force delete if user confirms
                    res = await api.brain.delete(`db/collection/${entityId}/item/${recordId}?force=true`);
                    console.log('[DELETE] Force delete response:', res);
                } else {
                    return; // User cancelled
                }
            }

            if (res.success) {
                console.log('[DELETE] Delete successful, navigating back');
                toast.success(renderString({ ro: "Înregistrare ștearsă", en: "Record deleted" }, lang));
                navigate('..', { replace: true });
            } else {
                console.error('[DELETE] Delete failed:', res.error);
                toast.error(res.error || "Delete failed");
            }
        } catch (e: any) {
            console.error('[DELETE] Delete error:', e);
            toast.error("Delete failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async () => {
        const isCurrentlyArchived = formData.archived === 1 || formData.archived === true || formData.status === 'archived';
        const confirmMsg = isCurrentlyArchived 
            ? { ro: "Sigur doriți să dezarhivați această înregistrare?", en: "Are you sure you want to unarchive this record?" }
            : { ro: "Sigur doriți să arhivați această înregistrare?", en: "Are you sure you want to archive this record?" };

        if (!confirm(renderString(confirmMsg, lang))) return;

        setSaving(true);
        try {
            // Enterprise Level 8: Efficient partial update for status change
            // We support both a dedicated 'archived' flag and a 'status' field
            const updatePayload: any = {
                archived: isCurrentlyArchived ? 0 : 1,
                archivedAt: isCurrentlyArchived ? null : new Date().toISOString()
            };

            // If entity has status field, also update it
            if (formData.status !== undefined) {
                updatePayload.status = isCurrentlyArchived ? 'active' : 'archived';
            }

            const res = await api.brain.post(`db/collection/${entityId}/item/${recordId}`, updatePayload);

            if (res.success) {
                toast.success(renderString(isCurrentlyArchived ? { ro: "Dezarhivat!", en: "Unarchived!" } : { ro: "Arhivat!", en: "Archived!" }, lang));
                fetchRecord(); // Refresh to show changes
            } else {
                toast.error(res.error || "Action failed");
            }
        } catch (e: any) {
            toast.error("Action failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleQuickCreate = async (targetEntity: string, fieldName: string, type: string) => {
        const entityLabel = renderString(entity[targetEntity]?.label || targetEntity, lang);
        
        // Enterprise Level 8: Context-aware prompt labels
        const promptLabel = targetEntity === 'entity_note'
            ? { ro: 'Introdu conținutul notei', en: 'Enter note content' }
            : { ro: `Introdu numele pentru nou(a) ${entityLabel}`, en: `Enter name for the new ${entityLabel}` };

        const name = prompt(renderString(promptLabel, lang));
        
        if (!name) return;

        setSaving(true);
        try {
            // Enterprise Level 8: Global Quick Create Service
            const workspaceId = user?.workspaceId || 'system';

            // Enterprise Level 8: Entity-specific requirement resolving
            // We automatically inject parent link (entityType/entityId) for polymorphic entities
            const additionalData: any = {};
            const targetDef = entity[targetEntity] ? normalizeEntity(entity[targetEntity]) : null;
            
            if (targetDef) {
                const isPolymorphic = targetDef.fields.some((f: any) => f.name === 'entityType' && (f.required || f.req)) && 
                                     targetDef.fields.some((f: any) => f.name === 'entityId' && (f.required || f.req));
                
                if (isPolymorphic) {
                    if (isNew) {
                         toast.error(renderString({
                            ro: `Trebuie să salvezi înregistrarea înainte de a adăuga ${entityLabel}!`,
                            en: `You must save the record before adding ${entityLabel}!`
                        }, lang));
                        setSaving(false);
                        return;
                    }
                    additionalData.entityType = entityId;
                    additionalData.entityId = recordId;
                    
                    // Remap name to specialized content fields if applicable
                    if (targetEntity === 'entity_note') {
                        additionalData.content = name;
                        additionalData.authorId = user?.id;
                    }
                }
            }

            const res = await api.brain.quickCreate(targetEntity, name, additionalData, workspaceId);

            if (res.success && res.data) {
                toast.success(renderString({ ro: "Creat cu succes!", en: "Created successfully!" }, lang));
                
                // Refresh ONLY the related data for this target
                const refreshRes = await api.brain.get(`db/${targetEntity}?workspaceId=${workspaceId}`);
                if (refreshRes.success) {
                    const targetEntityDef = entity[targetEntity];
                    const normalizedData = (refreshRes.data || []).map((item: any) => {
                        if (targetEntityDef) return normalizeFormData(item, targetEntityDef.fields);
                        return {
                            ...item,
                            id: item.id || item.ID || item.uuid,
                            name: item.name || item.Name || item.label || item.Label
                        };
                    });
                    setRelatedData(prev => ({ ...prev, [targetEntity]: normalizedData }));
                }

                // Update formData to include the newly created ID
                const newId = String(res.data.id);
                const isMany = type === 'relation-many' || type === 'tag' || type === 'multi-select';
                
                setFormData((prev: any) => {
                    const currentVal = prev[fieldName];
                    if (isMany) {
                        const currentArr = Array.isArray(currentVal) 
                            ? currentVal 
                            : (typeof currentVal === 'string' && currentVal ? currentVal.split(',').filter(Boolean) : []);
                        
                        // Check if already in array (prevent duplicates)
                        const exists = currentArr.some((v: any) => {
                            const vId = (typeof v === 'object' && v !== null) ? (v.id || v.ID) : String(v);
                            return String(vId) === String(newId);
                        });
                        
                        if (exists) return prev;
                        
                        return { ...prev, [fieldName]: [...currentArr, newId] };
                    } else {
                        return { ...prev, [fieldName]: newId };
                    }
                });
            } else {
                toast.error(res.error || "Creation failed");
            }
        } catch (e: any) {
            toast.error("Creation failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRollback = async (auditId: string) => {
        if (!confirm("Sigur doriți să restaurați această versiune? Datele actuale vor fi suprascrise.")) return;
        try {
            // Enterprise Level 8: Unified Action Endpoint
            const res = await api.brain.post(`action/undo/${auditId}`);
            if (res.success) {
                toast.success("Date restaurate cu succes!");
                fetchRecord();
            } else {
                toast.error("Restauraore eșuată: " + res.error);
            }
        } catch (e: any) {
            toast.error("Eroare la restaurare: " + e.message);
        }
    };

    const handleFieldAction = async (action: any, field: any) => {
        const val = formData[field.name];
        // Replace placeholders in templates
        const processTemplate = (tpl: string) => {
            return tpl.replace(/{{(\w+)}}/g, (_, key) => formData[key] || '');
        };

        switch (action.type) {
            case 'whatsapp-trigger':
                const phone = action.phoneNumberField ? formData[action.phoneNumberField] : (field.type === 'phone' ? val : '');
                if (!phone) return toast.error("Număr de telefon lipsă");
                const waText = action.template ? processTemplate(action.template) : '';
                window.open(`https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(waText)}`, '_blank');
                break;
            case 'email-trigger':
                const email = action.emailField ? formData[action.emailField] : (field.type === 'email' ? val : '');
                if (!email) return toast.error("Adresă de email lipsă");
                window.location.href = `mailto:${email}`;
                break;
            case 'phone-call':
                const num = action.phoneNumberField ? formData[action.phoneNumberField] : (field.type === 'phone' ? val : '');
                if (!num) return toast.error("Număr de telefon lipsă");
                window.location.href = `tel:${num}`;
                break;
            case 'url-link':
                const url = action.urlField ? formData[action.urlField] : (field.type === 'url' ? val : '');
                if (url) window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
                break;
        }
    };

    const renderField = (field: any, forceCols?: number) => {
        if (!field || !shouldShowField(field)) return null;
        
        const { name, type, label, description, registryKey, relationEntity, req, required, ui } = field;

        // Respect Hidden Fields from Registry & Audit Field Protection (Enterprise Level 8)
        const AUDIT_FIELDS = ['id', 'ID', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'archived', 'archivedAt', 'deletedAt', 'password', 'secret', 'deletedBy'];
        const isAuditField = AUDIT_FIELDS.includes(name);
        
        // Respect Global Hidden flag from Registry (Except for Audit Fields which have their own toggle)
        if (field.hidden && !isAuditField) return null;

        // Hide audit fields by default unless specifically allowed in uiConfig (showTimestamps or showAuditFields)
        const showAudit = finalConfig.uiConfig?.form?.showTimestamps === true || finalConfig.uiConfig?.form?.showAuditFields === true;
        if (isAuditField && !showAudit) return null;

        const rawValue = formData[name] || '';
        const error = errors[name];
        const isRequired = req || required;

        // Use centralized form value formatting (Enterprise Level 8)
        const value = formatFormValue(rawValue, type);

        // Protection Logic (Enterprise Level 8)
        const isReadOnly = field.readonly || field.readOnly || isGlobalReadOnly || isAuditField || finalConfig.uiConfig?.form?.readOnlyFields?.includes(name) || (name === 'id' && !isNew);

        // Dynamic Grid Span (Enterprise Level 8)
        const totalCols = Number(forceCols || finalConfig.uiConfig?.form?.columns || 2);
        
        let width = ui?.width || field.width || (type === 'textarea' || type === 'richtext' || type === 'ai-text' ? 12 : 6);
        // Normalize "1/1", "1/2" format from builder
        if (width === '1/1') width = 12;
        if (width === '1/2') width = 6;
        if (width === '1/3') width = 4;
        if (width === '1/4') width = 3;
        
        let colSpan = 1;
        if (width >= 12) {
            colSpan = totalCols;
        } else {
            // Enterprise Level 8: Precision Grid Calculation (Consistent with EntitySystem)
            const ratio = (typeof width === 'number' ? width : parseInt(String(width))) / 12;
            colSpan = Math.max(1, Math.floor(ratio * totalCols + 0.05)); 
        }

        // Cap to total columns
        if (colSpan > totalCols) colSpan = totalCols;

        const colClass = colSpan === totalCols 
            ? "col-span-full" 
            : totalCols === 3 
                ? "col-span-1" // If 3 cols, we almost always want 1 span for ratio 0.5
                : `sm:col-span-${colSpan}`;

        const handleChange = (val: any) => {
            // Use centralized form value formatting to prevent object storage
            const normalizedVal = formatFormValue(val, type);

            setFormData((prev: any) => ({ ...prev, [name]: normalizedVal }));
            if (errors[name]) {
                setErrors(prev => {
                    const next = { ...prev };
                    delete next[name];
                    return next;
                });
            }
        };

        const targetEntity = relationEntity || field.relation?.target;
        const helpText = ui?.helpText || field.helpText;

        return (
            <div key={field.key || name} className={cn("space-y-2", colClass)}>
                <div className="flex items-center justify-between ml-1">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        <Label className={cn(
                            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap",
                            error ? "text-rose-500" : "text-slate-500"
                        )}>
                            {renderString(label || name, lang)}
                            {isRequired && <span className="text-rose-500">*</span>}
                        </Label>
                        
                        {helpText && (
                            <div className="group relative">
                                <HelpCircle size={10} className="text-slate-300 cursor-help hover:text-indigo-400 transition-colors" />
                                <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-800/95 backdrop-blur-sm text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-xl">
                                    {renderString(helpText, lang)}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Field Actions */}
                    {ui?.actions && ui.actions.length > 0 && (
                        <div className="flex gap-1">
                            {ui.actions.map((act: any, i: number) => (
                                <Button 
                                    key={act.id || `act-${i}`} 
                                    variant="ghost" 
                                    size="icon" 
                                    className={cn(
                                        "h-5 w-5 rounded-md",
                                        act.variant === 'success' ? 'text-emerald-500 hover:bg-emerald-50' : 
                                        act.variant === 'destructive' ? 'text-rose-500 hover:bg-rose-50' : 'text-indigo-500 hover:bg-indigo-50'
                                    )}
                                    onClick={() => handleFieldAction(act, field)}
                                    title={act.label}
                                >
                                    {act.icon === 'MessageCircle' ? <MessageCircle size={10} /> : 
                                     act.icon === 'Phone' ? <Phone size={10} /> :
                                     act.icon === 'Mail' ? <Mail size={10} /> :
                                     act.icon === 'Send' ? <Send size={10} /> : <ExternalLink size={10} />}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="relative group">
                    {/* Render Input based on type */}
                    {type === 'registry' && registryKey ? (
                        <Select value={String(value ?? '')} onValueChange={handleChange} disabled={isReadOnly}>
                            <SelectTrigger className={cn("h-12 rounded-xl bg-slate-50 border-slate-200", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 opacity-60")}>
                                <SelectValue placeholder={`${renderString(t('common:select'), lang)} ${renderString(label || name, lang)}`} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                {Object.entries(constants[registryKey] || {}).map(([k, v]: [string, any], idx) => (
                                    <SelectItem key={`${k}-${idx}`} value={k} className="rounded-xl font-bold py-3">
                                        <div className="flex items-center gap-2">
                                            {v.color && <div key="color-circle" className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />}
                                            <span key="label-text">{renderString(v.label || v.name || k, lang)}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (type === 'entity_relation' || type === 'relation' || type === 'relation-many' || type === 'tag' || type === 'multi-select') && (targetEntity || type === 'tag') ? (
                        ((field.type === 'relation-many' || field.type === 'tag' || field.type === 'multi-select' || field.multiple === true)) ? (
                            <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-50/50 border border-slate-200 min-h-[44px] transition-all hover:border-indigo-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50/50">
                                {(() => {
                                    // Enterprise Level 8: Robust relation-many parsing in Detail view
                                    if (Array.isArray(value)) return value;
                                    if (typeof value === 'string' && value) {
                                        const clean = value.trim();
                                        if (clean.startsWith('[') && clean.endsWith(']')) {
                                            try {
                                                const parsed = JSON.parse(clean);
                                                return Array.isArray(parsed) ? parsed : [parsed];
                                            } catch {
                                                return clean.split(',').filter(Boolean);
                                            }
                                        }
                                        return clean.split(',').filter(Boolean);
                                    }
                                    return [];
                                })().map((id: any) => {
                                    // Level 8: if id is object, extract id string
                                    const itemId = (typeof id === 'object' && id !== null) ? (id.id || id.ID || id.uuid) : String(id);
                                    const resolvedTarget = type === 'tag' ? 'tag' : targetEntity;
                                    const item = (Array.isArray(relatedData[resolvedTarget]) ? relatedData[resolvedTarget] : []).find(i => String(i.id || i.ID) === String(itemId)) || (typeof id === 'object' ? id : null);
                                    
                                    // Improved Display Field Selection
                                    const targetDef = resolvedTarget ? (entity as any)?.[resolvedTarget] : null;
                                    const displayFieldName = field.relation?.displayField || field.relation?.field || targetDef?.displayField || 'name';
                                    const label = item ? (item[displayFieldName] || item.name || item.id || item.ID || itemId) : itemId;

                                    return (
                                        <Badge 
                                            key={itemId} 
                                            variant="outline" 
                                            style={{ 
                                                backgroundColor: (item?.color || item?.colorTheme) ? `${item.color || item.colorTheme}15` : undefined,
                                                borderColor: (item?.color || item?.colorTheme) ? `${item.color || item.colorTheme}40` : undefined,
                                                color: (item?.color || item?.colorTheme) || undefined
                                            }}
                                            className="px-2.5 py-1 rounded-xl flex items-center gap-1.5 group/badge transition-all hover:brightness-95 border-none shadow-sm"
                                        >
                                            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: (item?.color || item?.colorTheme) || '#818cf8' }} />
                                            <span className="font-bold text-[9px] uppercase tracking-wider">
                                                {renderString(label, lang)}
                                            </span>
                                            {!isReadOnly && (
                                                <X 
                                                    size={10} 
                                                    className="cursor-pointer opacity-50 hover:opacity-100" 
                                                    onClick={() => {
                                                        const current = Array.isArray(value) ? value : (value ? String(value).split(',').filter(Boolean) : []);
                                                        const next = current.filter(v => ((typeof v === 'object' && v !== null) ? String(v.id || v.ID) : String(v)) !== String(itemId));
                                                        handleChange(next);
                                                    }}
                                                />
                                            )}
                                        </Badge>
                                    );
                                })}

                                {!isReadOnly && (
                                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                        <Select 
                                            onValueChange={(val) => {
                                                const current = Array.isArray(value) ? value : (value ? String(value).split(',').filter(Boolean) : []);
                                                const currentIds = current.map(v => (typeof v === 'object' && v !== null) ? String(v.id || v.ID) : String(v));
                                                
                                                if (!currentIds.includes(String(val))) {
                                                    const next = [...current, val];
                                                    handleChange(next);
                                                }
                                            }}
                                            disabled={isReadOnly}
                                        >
                                            <SelectTrigger className="h-8 rounded-xl bg-white/80 border-none font-bold text-[9px] uppercase italic tracking-wider ring-offset-indigo-500 shadow-sm hover:bg-white transition-all flex-1">
                                                <SelectValue placeholder={`${renderString(t('common:add'), lang)}...`} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                                {(Array.isArray(relatedData[type === 'tag' ? 'tag' : (targetEntity || '')]) ? relatedData[type === 'tag' ? 'tag' : (targetEntity || '')] : [])
                                                    .filter(item => {
                                                        const current = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
                                                        const currentIds = current.map(v => (typeof v === 'object' && v !== null) ? String(v.id || v.ID) : String(v));
                                                        return !currentIds.includes(String(item.id || item.ID));
                                                    })
                                                    .map((item: any, idx) => {
                                                        const resolvedT = type === 'tag' ? 'tag' : targetEntity;
                                                        const targetDef = resolvedT ? (entity as any)?.[resolvedT] : null;
                                                        const dispField = field.relation?.displayField || field.relation?.field || targetDef?.displayField || 'name';
                                                        const displayLabel = item[dispField] || item.name || item.id || item.ID;
                                                        
                                                        return (
                                                            <SelectItem key={`${item.id || item.ID}-${idx}`} value={String(item.id || item.ID)} className="rounded-xl font-bold py-3">
                                                                <div className="flex items-center gap-2">
                                                                    {(item.color || item.colorTheme) && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.colorTheme }} />}
                                                                    <span>{renderString(displayLabel, lang)}</span>
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })
                                                }
                                            </SelectContent>
                                        </Select>
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shrink-0"
                                            onClick={() => handleQuickCreate(type === 'tag' ? 'tag' : targetEntity, name, type)}
                                            title={renderString(constants?.I18N?.actions?.addNew, lang)}
                                        >
                                            <Plus size={16} />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                                <div className="flex gap-2">
                                    <Select 
                                        value={String((typeof value === 'object' && value !== null) ? (value.id || value.ID || '') : (value ?? ''))} 
                                        onValueChange={handleChange} 
                                        disabled={isReadOnly}
                                    >
                                        <SelectTrigger className={cn("h-12 rounded-xl bg-slate-50 border-slate-200 font-bold flex-1", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 opacity-60")}>
                                            <SelectValue placeholder={`${renderString(t('common:choose'), lang)} ${renderString(label || name, lang)}`} />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                                            {(relatedData[targetEntity] || []).map((item: any, idx) => {
                                                const targetDef = entity[targetEntity];
                                                const dispField = field.relation?.displayField || field.relation?.field || targetDef?.displayField || 'name';
                                                const displayLabel = item[dispField] || item.name || item.id;
                                                
                                                return (
                                                    <SelectItem key={`${item.id}-${idx}`} value={String(item.id)} className="rounded-xl font-bold py-3">
                                                        <div className="flex items-center gap-2">
                                                            {(item.color || item.colorTheme) && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.colorTheme }} />}
                                                            <span>{renderString(displayLabel, lang)}</span>
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })}
                                            {(relatedData[targetEntity] || []).length === 0 && (
                                                <div className="p-4 text-center text-xs text-slate-400 italic">{renderString(t('common:no_records_in', { label: targetEntity }), lang)}</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {!isReadOnly && (
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shrink-0"
                                            onClick={() => handleQuickCreate(targetEntity, name, type)}
                                            title={renderString(constants?.I18N?.actions?.addNew, lang)}
                                        >
                                            <Plus size={18} />
                                        </Button>
                                    )}
                                </div>
                        )
                    ) : (type === 'enum' || type === 'selection') ? (
                        (() => {
                            const optionsList = field.options || (field.enum ? field.enum.map((v: any) => ({ label: v, value: v })) : []);
                            const isReadOnly = field.readOnly || isGlobalReadOnly;
                            const isFullWidth = width >= 12;

                            return field.ui?.variant === 'buttons' ? (
                                <div 
                                    className={cn(
                                        "flex flex-wrap gap-2", 
                                        isFullWidth && "p-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-[20px] w-full gap-1 border border-slate-200/50 backdrop-blur-sm"
                                    )}
                                    style={{
                                        backgroundColor: (isFullWidth && field.ui?.backgroundColor) ? field.ui.backgroundColor : undefined
                                    }}
                                >
                                    {optionsList.map((opt: any, idx: number) => {
                                        const optVal = typeof opt === 'object' ? opt.value : opt;
                                        const optLabel = typeof opt === 'object' ? opt.label : opt;
                                        const isActive = field.multiple 
                                            ? (Array.isArray(value) ? value.includes(optVal) : String(value).split(',').includes(optVal))
                                            : value === optVal;
                                        
                                        return (
                                            <Button
                                                key={`${optVal}-${idx}`}
                                                type="button"
                                                variant={isActive ? 'default' : 'ghost'}
                                                size="sm"
                                                disabled={isReadOnly}
                                                onClick={() => {
                                                    if (field.multiple) {
                                                        const current = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
                                                        const next = current.includes(optVal) 
                                                            ? current.filter(v => v !== optVal)
                                                            : [...current, optVal];
                                                        handleChange(next.join(','));
                                                    } else {
                                                        handleChange(optVal);
                                                    }
                                                }}
                                                style={isActive && field.ui?.activeColor ? { backgroundColor: field.ui.activeColor, color: '#fff' } : {}}
                                                className={cn(
                                                    "rounded-xl font-bold h-10 px-4 transition-all duration-300",
                                                    isFullWidth && "flex-1",
                                                    isActive 
                                                        ? (!field.ui?.activeColor ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400" : "") 
                                                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50 dark:hover:bg-slate-700/50",
                                                    isReadOnly && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {(opt as any).color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (opt as any).color }} />}
                                                    {renderString(optLabel, lang)}
                                                </div>
                                            </Button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Select 
                                    value={String(value || '')} 
                                    onValueChange={handleChange} 
                                    disabled={isReadOnly}
                                >
                                    <SelectTrigger className={cn("h-12 rounded-xl bg-slate-50 border-slate-200 font-bold", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 opacity-60")}>
                                        <SelectValue placeholder={`${renderString(t('common:choose'), lang)} ${renderString(label || name, lang)}`}>
                                            {(() => {
                                                const opt = optionsList.find((o: any) => (typeof o === 'object' ? o.value : o) === value);
                                                return opt ? renderString(typeof opt === 'object' ? opt.label : opt, lang) : value;
                                            })()}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                        {optionsList.map((opt: any, idx: number) => {
                                            const optVal = typeof opt === 'object' ? opt.value : opt;
                                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                                            return (
                                                <SelectItem key={`${optVal}-${idx}`} value={String(optVal)} className="rounded-xl font-bold py-3">
                                                    <div className="flex items-center gap-2">
                                                        {(opt as any).color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (opt as any).color }} />}
                                                        <span>{renderString(optLabel, lang)}</span>
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            );
                        })()
                    ) : type === 'boolean' || type === 'toggle' ? (
                        <div className={cn("flex items-center gap-3 h-12 px-4 rounded-xl bg-slate-50 border border-slate-200", error && "border-rose-300 bg-rose-50/20", isReadOnly && "opacity-60 cursor-not-allowed")}>
                            <input 
                                type="checkbox" 
                                checked={!!value} 
                                disabled={isReadOnly}
                                onChange={(e) => handleChange(e.target.checked)}
                                className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-slate-600">{renderString(t('common:active'), lang)}</span>
                        </div>
                    ) : type === 'file' || type === 'image' ? (
                        <FileUploader 
                            value={value} 
                            onChange={handleChange} 
                            multiple={field.multiple}
                            variant={type === 'image' ? 'image' : 'file'}
                            accept={type === 'image' ? 'image/*' : undefined}
                        />
                    ) : type === 'textarea' || type === 'richtext' ? (
                        <textarea 
                            value={value ?? ''}
                            disabled={isReadOnly}
                            onChange={(e) => handleChange(e.target.value)}
                            className={cn("w-full min-h-[120px] p-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 font-medium text-sm", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 cursor-not-allowed")}
                            placeholder={ui?.placeholder ? renderString(ui.placeholder, lang) : `${renderString(t('common:enter'), lang)} ${renderString(label || name, lang)}...`}
                        />
                    ) : type === 'icon' ? (
                        <IconPicker 
                            value={value ?? ''} 
                            onChange={handleChange}
                            className={cn("h-12 rounded-xl bg-slate-50 border-slate-200", isReadOnly && "bg-slate-100 opacity-60")}
                        />
                    ) : type === 'color' ? (
                        <ColorPicker 
                            value={value ?? ''} 
                            onChange={handleChange}
                            className={cn("h-12 rounded-xl bg-slate-50 border-slate-200", isReadOnly && "bg-slate-100 opacity-60")}
                        />
                    ) : type === 'date' || type === 'datetime' ? (
                        <DatePicker 
                            value={value ?? ''} 
                            onChange={handleChange}
                            showTime={type === 'datetime'}
                            placeholder={`${renderString(t('common:choose'), lang)} ${renderString(label || name, lang)}`}
                            className={cn("bg-white border-slate-100", isReadOnly && "bg-slate-100 opacity-60 pointer-events-none")}
                        />
                    ) : type === 'ai-text' ? (
                        <div className="space-y-2">
                            <textarea 
                                value={value ?? ''}
                                disabled={isReadOnly}
                                onChange={(e) => handleChange(e.target.value)}
                                className={cn("w-full min-h-[80px] p-4 rounded-xl bg-slate-50 border border-slate-200 border-dashed border-indigo-200 focus:border-indigo-500 font-medium text-sm", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 cursor-not-allowed")}
                                placeholder={ui?.placeholder ? renderString(ui.placeholder, lang) : "AI will generate this based on your prompt..."}
                            />
                            {!isReadOnly && (
                                <Button variant="ghost" size="sm" className="w-full h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 gap-2 font-black uppercase italic tracking-widest text-[9px]">
                                    <Brain size={12} /> {renderString(t('common:regenerate_ai'), lang)}
                                </Button>
                            )}
                        </div>
                    ) : type === 'json' ? (
                        <textarea 
                            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value ?? '')}
                            disabled={isReadOnly}
                            onChange={(e) => {
                                try {
                                    const parsed = JSON.parse(e.target.value);
                                    handleChange(parsed);
                                } catch (err) {
                                    // Let them keep typing until it's valid JSON
                                    setFormData((prev: any) => ({ ...prev, [name]: e.target.value }));
                                }
                            }}
                            className={cn("w-full min-h-[100px] p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 cursor-not-allowed")}
                            placeholder='{ "key": "value" }'
                        />
                    ) : (
                        <div className="relative group/input">
                            <div className="relative overflow-hidden rounded-xl">
                                <Input 
                                    type={type === 'number' || type === 'currency' ? 'number' : (type === 'password' ? 'password' : 'text')}
                                    name={name}
                                    id={`field-${name}`}
                                    value={value ?? ''}
                                    disabled={isReadOnly}
                                    autoComplete={ui?.autoComplete || "off"}
                                    onChange={(e) => handleChange(e.target.value)}
                                    className={cn(
                                        "h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all font-bold pr-10", 
                                        error && "border-rose-300 bg-rose-50/20", 
                                        isReadOnly && "bg-slate-100 cursor-not-allowed"
                                    )}
                                    placeholder={ui?.placeholder ? renderString(ui.placeholder, lang) : `${renderString(t('common:enter'), lang)} ${renderString(label || name, lang)}...`}
                                    step={type === 'currency' ? '0.01' : '1'}
                                />
                            </div>
                            {type === 'currency' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none z-10">$</span>}
                            {type === 'percent' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none z-10">%</span>}
                            {type === 'sparkles' && <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 h-4 w-4 pointer-events-none z-10" />}
                        </div>
                    )}
                </div>
                {error && <p className="text-[10px] font-bold text-rose-500 ml-1 mt-1">{renderString(error, lang)}</p>}
                {description && !error && <p className="text-[9px] text-slate-400 font-medium ml-1 italic">{renderString(description, lang)}</p>}
            </div>
        );
    };

    if (loading) return <div className="p-8 animate-pulse text-slate-400 font-black italic uppercase">Synchronizing with Brain...</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-48">
            {/* Navigation Header */}
            <div className="flex items-center justify-between">
                <Button 
                    variant="outline" 
                    onClick={() => navigate(getLocalizedPath(`/${entityId}`, lang))}
                    className="group rounded-2xl h-12 pl-3 pr-6 bg-white border-slate-200 shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                >
                    <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
                    <span className="text-[10px] font-black uppercase italic tracking-widest">{renderString(t('common:back'), lang)}</span>
                </Button>

                <div className="flex items-center gap-2">
                    {!isNew && isDeletable && (
                        <div className="flex gap-2">
                            <Button 
                                variant="ghost" 
                                onClick={handleArchive}
                                className="text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-2xl h-12 px-6"
                            >
                                {(formData.archived === 1 || formData.archived === true || formData.status === 'archived') ? (
                                    <>
                                        <RotateCcw size={20} className="mr-2" />
                                        <span className="text-[10px] font-black uppercase italic tracking-widest">
                                            {renderString(constants?.I18N?.actions?.unarchive, lang)}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Archive size={20} className="mr-2" />
                                        <span className="text-[10px] font-black uppercase italic tracking-widest">
                                            {renderString(constants?.I18N?.actions?.archive, lang)}
                                        </span>
                                    </>
                                )}
                            </Button>
                            
                            <Button 
                                variant="ghost" 
                                onClick={handleDelete}
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl h-12 px-6"
                            >
                                <Trash2 size={20} className="mr-2" />
                                <span className="text-[10px] font-black uppercase italic tracking-widest">{renderString(t('common:delete'), lang)}</span>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Enterprise Level 8 Identity Header - Professional & Balanced */}
            {/* Enterprise Level 8 Identity Header - Professional & Compact */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 md:p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none animate-in fade-in slide-in-from-top-4 duration-700 relative overflow-hidden group">
                {/* Decorative Background Glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none shrink-0 border-2 border-white dark:border-slate-950 ring-1 ring-indigo-100 dark:ring-slate-800 z-10 transition-transform duration-500 group-hover:scale-105">
                    {(() => {
                        const displayField = finalConfig.displayField || 'name';
                        const name = formData[displayField] || formData.name || formData.label || formData.title;
                        
                        // Try to get icon first
                        if (finalConfig.icon) {
                            try {
                                const IconComp = resolveIcon(finalConfig.icon);
                                return <IconComp size={20} className="md:w-6 md:h-6" />;
                            } catch (e) {}
                        }
                        
                        // Fallback to initial
                        const char = name && typeof name === 'string' ? name.charAt(0).toUpperCase() : (finalConfig.label ? renderString(finalConfig.label, lang).charAt(0) : 'E');
                        return char;
                    })()}
                </div>
                
                <div className="space-y-1 flex-1 z-10">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                             <Badge variant="outline" className="bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50 font-black uppercase tracking-[0.2em] text-[8px] px-2 py-0.5 rounded-full whitespace-nowrap">
                                {renderString(finalConfig.label, lang)}
                            </Badge>
                            {!isNew && (
                                <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    {recordId}
                                </span>
                            )}
                        </div>
                        
                        <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-tight py-0.5">
                            {(() => {
                                const displayField = finalConfig.displayField || 'name';
                                const name = formData[displayField] || formData.name || formData.Name || formData.label || formData.title;
                                if (name && String(name) !== 'undefined') return renderString(name, lang);
                                
                                if (isNew) {
                                    return renderString(t('common:new_record', { label: renderString(finalConfig.label, lang) }), lang);
                                }
                                
                                return renderString(t('common:untitled_record'), lang);
                            })()}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {!isNew && formData.status && (
                            <Badge className="bg-emerald-500 text-white border-none px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-100 dark:shadow-none">
                                {renderString(formData.status, lang)}
                            </Badge>
                        )}
                        
                        {/* Tags as badged badges (Identity preservation) */}
                        {(() => {
                            const tagField = fieldsList.find(f => (f.type === 'relation-many' || f.type === 'tag' || f.type === 'multi-select') && (f.name === 'tag' || f.name === 'tags'));
                            if (!tagField) return null;

                            const val = formData[tagField.name];
                            const ids = Array.isArray(val) ? val : (val ? String(val).split(',').filter(Boolean) : []);
                            if (ids.length === 0) return null;

                            return (
                                <div className="flex gap-1">
                                    {ids.slice(0, 5).map((id: any, idx: number) => {
                                        const itemId = (typeof id === 'object' && id !== null) ? (id.id || id.ID || id.uuid) : String(id);
                                        const targetEntity = tagField.relationEntity || tagField.relation?.target || (tagField.type === 'tag' ? 'tag' : null);
                                        
                                        // If it's a multi-select with options, look in options
                                        if (tagField.type === 'multi-select' && tagField.options) {
                                            const opt = tagField.options.find((o: any) => (typeof o === 'object' ? o.value : o) === itemId);
                                            return (
                                                <Badge key={idx} variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none font-bold text-[8px] uppercase tracking-widest rounded-full px-2 py-0.5" style={opt?.color ? { backgroundColor: `${opt.color}15`, color: opt.color } : {}}>
                                                    {renderString(opt?.label || itemId, lang)}
                                                </Badge>
                                            );
                                        }

                                        if (!targetEntity) return null;

                                        const item = (relatedData[targetEntity] || []).find((i: any) => String(i.id || i.ID).toLowerCase() === String(itemId).toLowerCase());
                                        const labelKey = tagField.relation?.field || tagField.relation?.displayField || tagField.relation?.displayKey || 'name';
                                        
                                        // Level 8: Ultra-Resilient Label Resolution
                                        const displayLabel = item 
                                            ? (item[labelKey] || item.label || item.name || item.title || item.ID || itemId) 
                                            : (typeof id === 'object' && id !== null ? (id[labelKey] || id.label || id.name || id.id || id.ID || itemId) : itemId);

                                        return (
                                            <Badge 
                                                key={idx}
                                                variant="secondary"
                                                className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none font-bold text-[8px] uppercase tracking-widest rounded-full px-2 py-0.5 whitespace-nowrap"
                                                style={item?.color || (typeof id === 'object' && id?.color) ? { backgroundColor: `${item?.color || (id as any).color}15`, color: item?.color || (id as any).color } : {}}
                                            >
                                                {renderString(displayLabel, lang)}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    <GlassCard className="overflow-hidden border-indigo-100/30">
                        <div className="p-8 space-y-8">
                            {finalConfig.layout?.sections && finalConfig.layout.sections.length > 0 ? (
                                <div className="space-y-8">
                                    {finalConfig.layout.sections.map((section: any, idx: number) => (
                                        <div key={section.id || section.title || idx} className="space-y-6 pt-6 border-t border-slate-100 first:border-0 first:pt-0">
                                            {(section.title || section.description) && (
                                                <div className="space-y-1">
                                                    {section.title && <h3 className="text-sm font-black italic uppercase tracking-tighter text-slate-800">{renderString(section.title, lang)}</h3>}
                                                    {section.description && <p className="text-[10px] text-slate-400 font-medium">{renderString(section.description, lang)}</p>}
                                                </div>
                                            )}
                                            {(() => {
                                                const globalCols = Number(finalConfig.uiConfig?.form?.columns || 2);
                                                const sCols = Number(section.columns || globalCols);

                                                return (
                                                    <div className={cn(
                                                        "grid gap-x-6 gap-y-8",
                                                        sCols === 1 ? 'grid-cols-1' :
                                                        sCols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                                                        sCols === 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' :
                                                        sCols === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                                                        'grid-cols-1 sm:grid-cols-2'
                                                    )}>
                                                        {(section.fields || []).map((fieldName: string) => {
                                                            const field = fieldsList.find((f: any) => f.name === fieldName);
                                                            return field ? renderField(field, sCols) : null;
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ))}

                                    {/* Level 8: Catch-all for fields not assigned to any section */}
                                    {(() => {
                                        const AUDIT_FIELDS = ['id', 'ID', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'archived', 'archivedAt', 'deletedAt', 'password', 'secret', '__v', '_id'];
                                        const showAudit = finalConfig.uiConfig?.form?.showTimestamps === true || finalConfig.uiConfig?.form?.showAuditFields === true;
                                        
                                        const sectionFields = new Set(finalConfig.layout.sections.flatMap((s: any) => s.fields || []));
                                        const unsectionedFields = fieldsList.filter(f => 
                                            !sectionFields.has(f.name) && 
                                            (!AUDIT_FIELDS.includes(f.name) || showAudit) &&
                                            !finalConfig.uiConfig?.form?.hiddenFields?.includes(f.name)
                                        );

                                        if (unsectionedFields.length > 0) {
                                            const cols = Number(finalConfig.uiConfig?.form?.columns || 2);
                                            return (
                                                <div className="space-y-6 pt-8 border-t-2 border-dashed border-slate-100">
                                                    <div className="space-y-1">
                                                        <h3 className="text-[10px] font-black italic uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                                            <PlusCircle size={14} /> 
                                                            {renderString({ ro: 'Câmpuri Adiționale', en: 'Additional Fields' }, lang)}
                                                        </h3>
                                                        <p className="text-[9px] text-slate-300 font-medium italic">
                                                            {renderString({ 
                                                                ro: 'Aceste câmpuri au fost adăugate recent și nu sunt încă atribuite unei secțiuni.', 
                                                                en: 'These fields were added recently and are not yet assigned to a section.' 
                                                            }, lang)}
                                                        </p>
                                                    </div>
                                                    <div className={cn(
                                                        "grid gap-x-6 gap-y-8",
                                                        cols === 1 ? 'grid-cols-1' :
                                                        cols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                                                        cols === 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' :
                                                        cols === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                                                        'grid-cols-1 sm:grid-cols-2'
                                                    )}>
                                                        {unsectionedFields.map((f: any) => renderField(f, cols))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {(() => {
                                        const cols = Number(finalConfig.uiConfig?.form?.columns || 2);
                                        return (
                                            <div className={cn(
                                                "grid gap-x-6 gap-y-8",
                                                cols === 1 ? 'grid-cols-1' :
                                                cols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                                                cols === 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' :
                                                cols === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                                                'grid-cols-1 sm:grid-cols-2'
                                            )}>
                                                {fieldsList.map((f: any) => renderField(f, cols))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </GlassCard>

                    {/* Related Children Entities (Level 8 Inbound Relations) */}
                    {!isNew && finalConfig.uiConfig?.form?.showChildren !== false && Object.keys(childrenRecords).length > 0 && (
                        <div className="space-y-6">
                            {Object.entries(childrenRecords)
                                .filter(([childEntityName]) => !(finalConfig.uiConfig?.form?.hiddenChildren || []).includes(childEntityName))
                                .map(([childEntityName, records]) => {
                                    const childDef = childDefinitions[childEntityName];
                                    const childLabel = renderString(childDef?.label || childDef?.labelPlural || childEntityName, lang);
                                    
                                    // Find relation field for pre-filling "New" button
                                    const fieldsArr = childDef?.fields || [];
                                    const relField: any = fieldsArr.find((f: any) => (f.relationEntity === entityId || f.relation?.target === entityId));
                                    const relFieldName = relField?.name || relField?.id;

                                    const childCreatable = childDef?.features?.creatable !== false;

                                    return (
                                        <GlassCard key={childEntityName} className="p-6">
                                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                                                <h3 className="text-[10px] font-black uppercase italic tracking-widest text-indigo-500 flex items-center gap-2">
                                                    <Shield size={14} className="text-indigo-400" />
                                                    {childEntityName === 'contact' && entityId === 'workspace' 
                                                        ? renderString(t('common:associated_members'), lang) 
                                                        : `${childLabel} ${renderString(t('common:in_this'), lang)} ${renderString(finalConfig.label || entityId, lang)}`}
                                                </h3>
                                        <div className="flex items-center gap-2">
                                            {childCreatable && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 px-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 font-black uppercase italic text-[9px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(getLocalizedPath(`/${childEntityName}/new?${relFieldName}=${recordId}`, lang));
                                                    }}
                                                >
                                                    <Plus size={12} className="mr-1" />
                                                    {renderString(t('common:add'), lang)} {renderString(childDef?.label || childEntityName, lang)}
                                                </Button>
                                            )}
                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 px-3">
                                                {renderString(t('common:x_records', { count: records.length }), lang)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {records.map((rec: any) => (
                                            <div 
                                                key={rec.id} 
                                                onClick={() => navigate(getLocalizedPath(`/${childEntityName}/${rec.id}`, lang))}
                                                className="group p-3 rounded-xl border border-slate-100 bg-white/50 hover:bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all cursor-pointer relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 p-1">
                                                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:scale-150 transition-transform" />
                                                </div>
                                                <p className="text-[11px] font-black text-slate-800 group-hover:text-indigo-600 truncate mb-1">
                                                    {renderString(rec[childDef?.displayField || 'name'] || rec.name || rec.label || rec.filename || rec.id, lang)}
                                                </p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded-md group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-colors">
                                                        {renderString(rec.role || rec.status || rec.category || 'ENTRY', lang)}
                                                    </span>
                                                    <span className="text-[8px] font-medium text-slate-300 italic">{renderString(rec.email || rec.phone || '', lang)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </GlassCard>
                                    );
                                })}
                        </div>
                    )}

                    {/* Meta Info Section (Audit Logs) - Level 8 Enterprise */}
                    {!isNew && auditLogs.length > 0 && (
                        <GlassCard className="p-6 space-y-4 border-none shadow-sm bg-slate-50/30">
                            <h3 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 flex items-center gap-2">
                                <History size={14} className="text-indigo-400" /> 
                                {renderString(t('common:activity_log'), lang)}
                            </h3>
                            <div className="space-y-4 pt-2">
                                {auditLogs.slice(0, 10).map((log, idx) => {
                                   const actionColors: any = { 
                                     create: 'bg-emerald-500 shadow-emerald-200', 
                                     update: 'bg-indigo-500 shadow-indigo-200', 
                                     delete: 'bg-rose-500 shadow-rose-200', 
                                     rollback: 'bg-amber-500 shadow-amber-200',
                                     undo: 'bg-amber-500 shadow-amber-200'
                                   };
                                   
                                   return (
                                    <div key={log.id || idx} className="flex gap-4 relative group">
                                        {idx < Math.min(auditLogs.length, 10) - 1 && <div className="absolute left-2.5 top-5 w-px h-full bg-slate-200/50 dark:bg-slate-800" />}
                                        <div className={cn(
                                            "w-5 h-5 rounded-full z-10 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110",
                                            actionColors[log.action] || 'bg-slate-400'
                                        )}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                   <p className="text-[11px] font-black italic uppercase tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                       {log.action === 'create' ? renderString(t('common:create_record'), lang) : log.action === 'update' ? renderString(t('common:update_data'), lang) : log.action}
                                                       {log.action === 'undo' && <Badge className="text-[7px] bg-amber-100 text-amber-700 border-none">{renderString(t('common:restoration'), lang)}</Badge>}
                                                   </p>
                                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                      {renderString(t('common:operated_by'), lang)} <span className="text-indigo-500">{renderString(log.user || t('common:system'), lang)}</span>
                                                   </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-400 font-mono bg-white/80 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">{new Date(log.timestamp).toLocaleString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                    {(log.snapshot_before && log.action !== 'undo') && (
                                                        <Button 
                                                            variant="secondary" 
                                                            size="icon" 
                                                            className="h-7 w-7 rounded-xl text-indigo-600 hover:bg-white hover:shadow-lg transition-all opacity-0 group-hover:opacity-100"
                                                            onClick={() => handleRollback(log.id)}
                                                            title={renderString(t('common:restore_to_this_state'), lang)}
                                                        >
                                                            <RotateCcw size={12} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            {log.details && (log.action === 'update' || log.action === 'undo') && (
                                                <div className="mt-2 p-3 bg-white/60 dark:bg-slate-900/40 rounded-2xl border border-white/50 dark:border-slate-800 shadow-sm ring-1 ring-slate-100/50">
                                                    <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">{renderString(log.details, lang)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                   );
                                })}
                            </div>
                        </GlassCard>
                    )}

                    {/* Enterprise Level 8: Contact Interactions (WhatsApp, Email, Printing History) */}
                    {!isNew && entityId === 'contact' && (
                        <GlassCard className="p-8 border-none shadow-sm bg-white/40 dark:bg-slate-900/40">
                            <ContactInteractions contact={{ 
                                id: recordId as string, 
                                name: formData.name || formData.label || 'Contact',
                                email: formData.email,
                                phone: formData.phone
                            }} />
                        </GlassCard>
                    )}

                    {/* Enterprise Level 8: Subtasks for Task Entities */}
                    {!isNew && (entityId === 'todo' || entityId === 'task') && (
                        <GlassCard className="p-8 border-none shadow-sm bg-white/40 dark:bg-slate-900/40">
                            <SubtaskManager 
                                parentTaskId={recordId as string} 
                                workspaceId={formData.workspaceId}
                            />
                        </GlassCard>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="space-y-8">
                    <GlassCard className="p-6 space-y-6 bg-slate-50/50">
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase italic tracking-tighter text-indigo-600 flex items-center gap-2">
                                <Shield size={16} /> {renderString(t('common:security_settings'), lang)}
                            </h3>
                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-indigo-100 dark:border-indigo-900/50 shadow-sm space-y-3">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest">{renderString(t('common:visibility'), lang)}</span>
                                    <Badge variant="outline" className="text-emerald-500 border-emerald-200 bg-emerald-50">Global</Badge>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest">{renderString(t('common:access_rule'), lang)}</span>
                                    <span className="text-slate-700 font-black italic">Enterprise Level 8 RBAC</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h3 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 flex items-center gap-2">
                                <Clock size={16} /> {renderString(t('common:metadata'), lang)}
                            </h3>
                            <div className="space-y-2 text-[10px] font-bold">
                                <div className="flex justify-between">
                                    <span className="text-slate-400 uppercase tracking-widest">ID</span>
                                    <span className="font-mono text-slate-600 truncate max-w-[120px]">{recordId}</span>
                                </div>
                                {finalConfig.features?.authorTracking !== false && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 uppercase tracking-widest">{renderString(t('common:creator'), lang)}</span>
                                        <span className="text-slate-600">{renderString(formData.created_by || formData.createdBy || t('common:administrator'), lang)}</span>
                                    </div>
                                )}
                                {finalConfig.features?.timestamps !== false && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 uppercase tracking-widest">{renderString(t('common:updated'), lang)}</span>
                                        <span className="text-slate-600">
                                            {formData.updated_at || formData.updatedAt 
                                                ? new Date(formData.updated_at || formData.updatedAt).toLocaleDateString(lang) 
                                                : renderString(t('common:not_available'), lang)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isNew && (
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                <Button variant="outline" className="w-full rounded-xl h-12 border-slate-200 font-black uppercase italic tracking-widest text-[10px] gap-2">
                                    <ExternalLink size={14} /> {renderString(t('common:open_api'), lang)}
                                </Button>
                            </div>
                        )}
                    </GlassCard>

                    {/* Enterprise Level 8: Undo Engine Widget */}
                    {!isNew && (
                        <EntityHistoryWidget 
                            entityType={entityId} 
                            entityId={recordId}
                            maxHeight="500px"
                            showUndoButton={true}
                        />
                    )}

                    {/* Enterprise Level 8: Workflow State Machine */}
                    {!isNew && formData.status && (
                        <WorkflowWidget 
                            entityType={entityId}
                            entityId={recordId}
                            currentStatus={formData.status}
                        />
                    )}

                    <div className="p-6 rounded-[32px] bg-indigo-600 text-white space-y-4 shadow-2xl shadow-indigo-200 dark:shadow-none">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={24} />
                            <h4 className="font-black italic uppercase tracking-tighter leading-none">{renderString(t('common:smart_assistant'), lang)}</h4>
                        </div>
                        <p className="text-xs font-medium text-indigo-50 leading-relaxed">
                            {renderString(t('common:ai_help_text'), lang)}
                        </p>
                        <Button 
                            onClick={() => setIsAiModalOpen(true)}
                            className="w-full bg-white text-indigo-600 hover:bg-slate-50 font-black uppercase italic tracking-widest text-[10px] h-10 rounded-xl border-none shadow-lg"
                        >
                            {renderString(t('common:ai_extraction'), lang)} <Sparkles size={14} className="ml-2" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* AI EXTRACTION MODAL */}
            <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                <DialogContent className="sm:max-w-[600px] rounded-[40px] border-none shadow-2xl p-0 overflow-hidden bg-slate-50/95 backdrop-blur-2xl">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
                    
                    <DialogHeader className="p-8 pb-4">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                                <Brain size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
                                    {renderString(t('common:ai_extraction_title'), lang)}
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">
                                    {renderString(t('common:ai_extraction_desc'), lang)}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-8 pb-8 space-y-6">
                        {/* Source Selector */}
                        <div className="flex p-1.5 bg-slate-200/50 rounded-[20px] gap-1">
                            {(['text', 'file', 'inbox'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setExtractionSource(s)}
                                    className={cn(
                                        "flex-1 py-3 px-4 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all",
                                        extractionSource === s 
                                            ? "bg-white text-indigo-600 shadow-sm" 
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    {renderString(t(`common:source_${s}`), lang)}
                                </button>
                            ))}
                        </div>

                        {extractionSource === 'text' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Paste content below</Label>
                                <textarea 
                                    className="w-full min-h-[200px] p-6 rounded-[32px] bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all text-sm font-medium leading-relaxed shadow-sm"
                                    placeholder="Paste an email, a message or a description here..."
                                    value={extractionText}
                                    onChange={(e) => setExtractionText(e.target.value)}
                                />
                            </div>
                        )}

                        {extractionSource === 'file' && (
                            <div className="p-12 border-2 border-dashed border-indigo-200 rounded-[32px] bg-indigo-50/20 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-indigo-500 mx-auto shadow-sm">
                                    <Plus size={32} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">Selectează Document</p>
                                    <p className="text-[10px] font-bold text-slate-400">Suportă PDF, JPG, PNG sau DOCX</p>
                                </div>
                                <FileUploader 
                                    value={null}
                                    onChange={(url) => {
                                        // Auto-trigger extraction when file is uploaded
                                        setExtractionSource('file');
                                        setExtractionText(url); // We send the URL to AI
                                        toast.info("Fișier încărcat. Analizăm...");
                                    }}
                                    variant="file"
                                />
                            </div>
                        )}

                        {extractionSource === 'inbox' && (
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Latest messages</Label>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group flex items-start gap-4 shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                                            <MessageCircle size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black uppercase tracking-tight text-slate-900">WhatsApp Agent</span>
                                                <span className="text-[8px] font-bold text-slate-400 tracking-tighter">10 min ago</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 font-medium line-clamp-1 leading-tight">Vreau să programez o vizionare pentru mâine la ora 14:00 pentru apartamentul...</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-8 pt-0 flex flex-row gap-3">
                        <Button 
                            variant="ghost" 
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                            onClick={() => setIsAiModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            disabled={isAiExtracting || (!extractionText && extractionSource === 'text')}
                            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 shadow-xl shadow-indigo-100 transition-all hover:-translate-y-1"
                            onClick={handleAiExtraction}
                        >
                            {isAiExtracting ? <RefreshCw className="animate-spin mr-2" size={20} /> : <Sparkles className="mr-2" size={20} />}
                            <span className="font-extrabold uppercase italic tracking-widest text-sm">ÎNCEPE EXTRACȚIA AI</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* FLOATING BOTTOM ACTION BAR - Enterprise Level 8 (Compact Style) */}
            <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 w-auto min-w-[300px] px-6 z-50 animate-in slide-in-from-bottom duration-500">
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-2 md:p-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center justify-between gap-4">
                    <div className="flex-1 hidden md:flex items-center gap-2 ml-4">
                        {!isNew && (
                            <Badge className="bg-indigo-50 text-indigo-600 border-none font-black italic uppercase tracking-widest text-[9px] px-3 py-1">
                                {String(recordId).slice(-6)}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mr-1">
                        {!isGlobalReadOnly && (
                            <Button 
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-10 px-6 shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-1 active:scale-95"
                            >
                                {saving ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                <span className="text-xs font-black uppercase italic tracking-widest">{isNew ? renderString(t('common:create'), lang) : renderString(t('common:save'), lang)}</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


