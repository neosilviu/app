import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router';
import { Save, ArrowLeft, Trash2, Shield, Clock, History, CheckCircle2, X, Plus, ExternalLink, RefreshCw, MessageCircle, Phone, Send, Brain, Sparkles, Mail, HelpCircle, RotateCcw } from 'lucide-react';
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
import { api, cn, socket, renderString, getLocalizedPath, ValidationUtils } from '~/lib/core';
import { normalizeEntity } from '~/lib/entity-engine';
import { useTranslation } from 'react-i18next';
import { useConfig } from '~/hooks/useConfig';
import { toast } from 'sonner';
import { EntityHistoryWidget } from '~/components/entity/EntityHistoryWidget';
import { WorkflowWidget } from '~/components/entity/WorkflowWidget';

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
    const { constants, entity } = useConfig();
    
    // Normalize fields (Enterprise Level 8) - use the central Lens
    const fieldsList = React.useMemo(() => {
        const normalized = normalizeEntity(config);
        return normalized.fields;
    }, [config]);

    const isNew = recordId === 'new';
    const features = config.features || {};
    const isCreatable = features.creatable !== false;
    const isEditable = features.editable !== false;
    const isDeletable = features.deletable !== false;

    // A record is read-only if it's not new and not editable, OR if it's new but not creatable
    const isGlobalReadOnly = (isNew && !isCreatable) || (!isNew && !isEditable);

    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [isAiExtracting, setIsAiExtracting] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [extractionSource, setExtractionSource] = useState<'text' | 'file' | 'inbox'>('text');
    const [extractionText, setExtractionText] = useState('');

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
                setFormData((prev: any) => ({ ...prev, ...res.data }));
                toast.success(t('common:restore_success')); 
                setIsAiModalOpen(false);
            } else {
                toast.error(res.error || t('common:save_error'));
            }
        } catch (e: any) {
            toast.error(e.message);
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

    const fetchRelatedData = async () => {
        const relations = fieldsList.filter((f: any) => (f.type === 'entity_relation' || f.type === 'relation' || f.type === 'relation-many') && (f.relationEntity || f.relation?.target));
        for (const rel of relations) {
            const target = rel.relationEntity || rel.relation?.target;
            try {
                const res = await api.brain.get(`db/${target}`);
                if (res.success) {
                    setRelatedData(prev => ({ ...prev, [target]: res.data || [] }));
                }
            } catch (e) {}
        }

        // Enterprise Level 8: Fetch Children Records (Inbound Relations)
        if (!isNew && recordId) {
            const allEntitiesRes = await api.brain.get('entity');
            if (allEntitiesRes.success) {
                const potentialChildren = allEntitiesRes.data.filter((e: any) => {
                    const normalized = normalizeEntity(e);
                    return normalized.fields.some((f: any) => (f.relationEntity === entityId || f.relation?.target === entityId));
                });

                for (const childEntity of potentialChildren) {
                    const normalized = normalizeEntity(childEntity);
                    const relField: any = normalized.fields.find((f: any) => (f.relationEntity === entityId || f.relation?.target === entityId));
                    const fieldName = relField.name || relField.id;

                    // Enterprise Level 8: Specialized Fetching
                    // When listing contact for a workspace, we usually mean "Members" (Users with roles)
                    // Regular contact (customers) are handled via separate modules or specialized filters
                    let endpoint = `db/${normalized.name}?${fieldName}=${recordId}`;
                    if (normalized.name === 'contact' && entityId === 'workspace') {
                        // Use the optimized 'users' endpoint which handles role filtering and hierarchy sorting
                        endpoint = `workspace/member?workspaceId=${recordId}`;
                    }

                    const res = await api.brain.get(endpoint);
                    if (res.success && res.data.length > 0) {
                        setChildrenRecords(prev => ({ ...prev, [normalized.name]: res.data }));
                        setChildDefinitions(prev => ({ ...prev, [normalized.name]: normalized }));
                    }
                }
            }
        }
    };

    const shouldShowField = (field: any) => {
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
            const fieldLabel = renderString(f.label, lang);

            // 1. Required Check
            if (isRequired && (val === undefined || val === null || val === '')) {
                newErrors[f.name] = ValidationUtils.getErrorMessage('required', fieldLabel, constants, lang);
                return;
            }

            // Skip further validation if empty and not required
            if (val === undefined || val === null || val === '') return;

            // 2. Email Special Check (Enterprise Architecture)
            if (f.type === 'email' && !ValidationUtils.isValidEmail(String(val))) {
                newErrors[f.name] = ValidationUtils.getErrorMessage('invalid_email', fieldLabel, constants, lang);
                return;
            }

            // 3. Pattern Check (Regex)
            const pattern = f.validation?.pattern || f.pattern;
            if (pattern && !new RegExp(pattern).test(String(val))) {
                newErrors[f.name] = f.patternMessage || f.validation?.message || ValidationUtils.getErrorMessage('invalid_format', fieldLabel, constants, lang);
            }

            // 4. Min/Max Validation (Registry Driven)
            const min = f.validation?.min !== undefined ? f.validation.min : f.min;
            const max = f.validation?.max !== undefined ? f.validation.max : f.max;

            if (f.type === 'number' || f.type === 'currency') {
                if (min !== undefined && Number(val) < min) {
                    newErrors[f.name] = ValidationUtils.getErrorMessage('min_value', fieldLabel, constants, lang, { min });
                }
                if (max !== undefined && Number(val) > max) {
                    newErrors[f.name] = ValidationUtils.getErrorMessage('max_value', fieldLabel, constants, lang, { max });
                }
            } else if (typeof val === 'string') {
                if (min !== undefined && val.length < min) {
                    newErrors[f.name] = ValidationUtils.getErrorMessage('min_length', fieldLabel, constants, lang, { min });
                }
                if (max !== undefined && val.length > max) {
                    newErrors[f.name] = ValidationUtils.getErrorMessage('max_length', fieldLabel, constants, lang, { max });
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const fetchRecord = async () => {
        fetchRelatedData();
        if (isNew) return;
        setLoading(true);
        try {
            const res = await api.brain.get(`db/${entityId}/item/${recordId}`);
            if (res.success) {
                setFormData(res.data || {});
                // Fetch audit logs for this specific record (Enterprise Level 8 feature)
                const auditRes = await api.brain.get(`db/audit_log?entityType=${entityId}&entityId=${recordId}`);
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
    };

    useEffect(() => {
        fetchRecord();
    }, [entityId, recordId]);

    const handleSave = async () => {
        if (!validateForm()) {
            toast.error(t('common:validation_error'));
            return;
        }
        setSaving(true);
        try {
            const method = isNew ? api.brain.post : api.brain.patch;
            const endpoint = isNew ? `db/${entityId}` : `db/${entityId}/${recordId}`;
            
            const res = await method(endpoint, formData);
            if (res.success) {
                toast.success(t(isNew ? 'common:create_success' : 'common:update_success'));
                if (isNew) navigate(`../${res.data?.id || res.data?.ID || ''}`, { replace: true });
                else fetchRecord();
            } else {
                toast.error(t(isNew ? 'common:create_error' : 'common:update_error') + ": " + res.error);
                if (res.validationErrors) setErrors(res.validationErrors);
            }
        } catch (e: any) {
            toast.error(t('common:save_error') + ": " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        // First generic confirmation
        if (!confirm(t('common:confirm_delete'))) return;

        try {
            // Step 1: Attempt delete (Enterprise Level 8: uses DB collection endpoint)
            let res = await api.brain.delete(`db/collection/${entityId}/item/${recordId}`);
            
            // Step 2: Handle dependency check (Enterprise Level 8 Safety)
            if (res.success && res.data?.hasDependencies) {
                if (confirm(res.data.message)) {
                    // Step 3: Force delete if user confirms
                    res = await api.brain.delete(`db/collection/${entityId}/item/${recordId}?force=true`);
                } else {
                    return; // User cancelled
                }
            }

            if (res.success) {
                toast.success(t('common:delete_success'));
                navigate('..', { replace: true });
            } else {
                toast.error(res.error || t('common:delete_error'));
            }
        } catch (e: any) {
            console.error("Delete error:", e);
            toast.error(t('common:delete_error') + ": " + e.message);
        }
    };

    const handleRollback = async (auditId: string) => {
        if (!confirm(t('common:confirm_restore'))) return;
        try {
            // Enterprise Level 8: Unified Action Endpoint
            const res = await api.brain.post(`action/undo/${auditId}`);
            if (res.success) {
                toast.success(t('common:restore_success'));
                fetchRecord();
            } else {
                toast.error(t('common:restore_error') + ": " + res.error);
            }
        } catch (e: any) {
            toast.error(t('common:restore_error') + ": " + e.message);
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
                if (!phone) return toast.error(t('common:missing_phone'));
                const waText = action.template ? processTemplate(action.template) : '';
                window.open(`https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(waText)}`, '_blank');
                break;
            case 'email-trigger':
                const email = action.emailField ? formData[action.emailField] : (field.type === 'email' ? val : '');
                if (!email) return toast.error(t('common:missing_email'));
                window.location.href = `mailto:${email}`;
                break;
            case 'phone-call':
                const num = action.phoneNumberField ? formData[action.phoneNumberField] : (field.type === 'phone' ? val : '');
                if (!num) return toast.error(t('common:missing_phone'));
                window.location.href = `tel:${num}`;
                break;
            case 'url-link':
                const url = action.urlField ? formData[action.urlField] : (field.type === 'url' ? val : '');
                if (!url) return toast.error(t('common:missing_url'));
                if (url) window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
                break;
        }
    };

    const renderField = (field: any) => {
        if (!shouldShowField(field)) return null;
        
        // Respect Hidden Fields from Registry & Audit Field Protection (Enterprise Level 8)
        const AUDIT_FIELDS = ['id', 'ID', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'archived', 'archivedAt', 'deletedAt', 'password', 'secret'];
        const isHidden = config.uiConfig?.form?.hiddenFields?.includes(field.name);
        if (isHidden) return null;

        const { name, type, label, description, registryKey, relationEntity, req, required, ui } = field;
        
        const isAuditField = AUDIT_FIELDS.includes(name);
        // Hide audit fields by default unless specifically allowed in uiConfig
        if (isAuditField && !config.uiConfig?.form?.showAuditFields) return null;

        const rawValue = formData[name] || '';
        const error = errors[name];
        const isRequired = req || required;

        // Date Formatting Helper (fixes "yyyy-MM-ddThh:mm" conformance error)
        const formatValue = (val: any, fieldType: string) => {
            if (!val) return '';
            if (fieldType === 'date' || fieldType === 'datetime' || fieldType === 'datetime-local') {
                try {
                    const date = new Date(val);
                    if (isNaN(date.getTime())) return '';
                    if (fieldType === 'date') return date.toISOString().split('T')[0];
                    // Format for datetime-local: YYYY-MM-DDTHH:mm
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                } catch (e) { return val; }
            }
            return val;
        };

        const value = formatValue(rawValue, type);

        // Protection Logic (Enterprise Level 8)
        const isReadOnly = field.readonly || field.readOnly || isGlobalReadOnly || isAuditField || config.uiConfig?.form?.readOnlyFields?.includes(name) || (name === 'id' && !isNew);

        // Dynamic Grid Span (Enterprise Level 8)
        const totalCols = Number(config.uiConfig?.form?.columns || 2);
        
        let width = ui?.width || field.width || (type === 'textarea' || type === 'richtext' || type === 'ai-text' ? 12 : 6);
        // Normalize "1/1", "1/2" format from builder
        if (width === '1/1') width = 12;
        if (width === '1/2') width = 6;
        if (width === '1/4') width = 3;
        
        let colClass = "col-span-1";
        if (width >= 12) {
            colClass = "col-span-full";
        } else if (totalCols === 4) {
            if (width >= 9) colClass = "md:col-span-4";
            else if (width >= 6) colClass = "md:col-span-2";
            else if (width >= 3) colClass = "md:col-span-1";
        } else if (totalCols === 2) {
            if (width >= 6) colClass = "md:col-span-2";
        }

        const handleChange = (val: any) => {
            setFormData((prev: any) => ({ ...prev, [name]: val }));
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
                        <Select value={value} onValueChange={handleChange} disabled={isReadOnly}>
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
                    ) : (type === 'entity_relation' || type === 'relation' || type === 'relation-many') && targetEntity ? (
                        field.type === 'relation-many' ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-1.5 p-3 min-h-[52px] rounded-xl bg-slate-50 border border-slate-200">
                                    {((Array.isArray(value) ? value : (value ? String(value).split(',').filter(Boolean) : []))).map((id: string) => {
                                        const item = (Array.isArray(relatedData[targetEntity]) ? relatedData[targetEntity] : []).find(i => String(i.id) === String(id));
                                        return (
                                            <Badge 
                                                key={id} 
                                                variant="outline" 
                                                style={{ 
                                                    backgroundColor: item?.color ? `${item.color}15` : undefined,
                                                    borderColor: item?.color ? `${item.color}40` : undefined,
                                                    color: item?.color || undefined
                                                }}
                                                className="px-3 py-1 rounded-lg flex items-center gap-2 group/badge transition-all hover:brightness-95"
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item?.color || '#818cf8' }} />
                                                <span className="font-bold text-[10px] uppercase tracking-wider">{renderString(item?.[field.relation?.field || 'name'] || id, lang)}</span>
                                                {!isReadOnly && (
                                                    <X 
                                                        size={12} 
                                                        className="cursor-pointer opacity-50 hover:opacity-100" 
                                                        onClick={() => {
                                                            const current = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
                                                            const next = current.filter(v => String(v) !== String(id));
                                                            handleChange(next.join(','));
                                                        }}
                                                    />
                                                )}
                                            </Badge>
                                        );
                                    })}
                                    {(!value || (Array.isArray(value) && value.length === 0)) && (
                                        <div className="flex items-center gap-2 text-slate-400 italic text-[10px] ml-1 mt-1">
                                            <Plus size={12} /> {renderString(t('common:click_to_add', { label: renderString(label || 'tag', lang) }), lang)}
                                        </div>
                                    )}
                                </div>
                                {!isReadOnly && (
                                    <Select 
                                        onValueChange={(val) => {
                                            const current = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
                                            if (!current.includes(val)) {
                                                const next = [...current, val];
                                                handleChange(next.join(','));
                                            }
                                        }}
                                        disabled={isReadOnly}
                                    >
                                        <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs ring-offset-indigo-500">
                                            <SelectValue placeholder={`${renderString(t('common:add'), lang)} ${renderString(label || name, lang)}...`} />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                                            {(Array.isArray(relatedData[targetEntity]) ? relatedData[targetEntity] : [])
                                                .filter(item => {
                                                    const current = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
                                                    return !current.includes(String(item.id));
                                                })
                                                .map((item: any, idx) => {
                                                    const targetDef = entity[targetEntity];
                                                    const dispField = field.relation?.displayField || field.relation?.field || targetDef?.displayField || 'name';
                                                    
                                                    return (
                                                        <SelectItem key={`${item.id}-${idx}`} value={String(item.id)} className="rounded-xl font-bold py-3">
                                                            <div className="flex items-center gap-2">
                                                                {item.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />}
                                                                <span>{renderString(item[dispField] || item.name || item.id, lang)}</span>
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                })
                                            }
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        ) : (
                            <Select value={String(value)} onValueChange={handleChange} disabled={isReadOnly}>
                                <SelectTrigger className={cn("h-12 rounded-xl bg-slate-50 border-slate-200 font-bold", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 opacity-60")}>
                                    <SelectValue placeholder={`${renderString(t('common:choose'), lang)} ${renderString(label || name, lang)}`} />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    {(relatedData[targetEntity] || []).map((item: any, idx) => {
                                        const targetDef = entity[targetEntity];
                                        const dispField = field.relation?.displayField || field.relation?.field || targetDef?.displayField || 'name';
                                        
                                        return (
                                            <SelectItem key={`${item.id}-${idx}`} value={String(item.id)} className="rounded-xl font-bold py-3">
                                                <span>{renderString(item[dispField] || item.name || item.id, lang)}</span>
                                            </SelectItem>
                                        );
                                    })}
                                    {(relatedData[targetEntity] || []).length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400 italic">{renderString(t('common:no_records_in', { label: targetEntity }), lang)}</div>
                                    )}
                                </SelectContent>
                            </Select>
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
                            value={value}
                            disabled={isReadOnly}
                            onChange={(e) => handleChange(e.target.value)}
                            className={cn("w-full min-h-[120px] p-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 font-medium text-sm", error && "border-rose-300 bg-rose-50/20", isReadOnly && "bg-slate-100 cursor-not-allowed")}
                            placeholder={ui?.placeholder ? renderString(ui.placeholder, lang) : `${renderString(t('common:enter'), lang)} ${renderString(label || name, lang)}...`}
                        />
                    ) : type === 'icon' ? (
                        <IconPicker 
                            value={value} 
                            onChange={handleChange}
                            className={cn("h-12 rounded-xl bg-slate-50 border-slate-200", isReadOnly && "bg-slate-100 opacity-60")}
                        />
                    ) : type === 'color' ? (
                        <ColorPicker 
                            value={value} 
                            onChange={handleChange}
                            className={cn("h-12 rounded-xl bg-slate-50 border-slate-200", isReadOnly && "bg-slate-100 opacity-60")}
                        />
                    ) : type === 'date' || type === 'datetime' ? (
                        <DatePicker 
                            value={value} 
                            onChange={handleChange}
                            showTime={type === 'datetime'}
                            placeholder={`${renderString(t('common:choose'), lang)} ${renderString(label || name, lang)}`}
                            className={cn("bg-white border-slate-100", isReadOnly && "bg-slate-100 opacity-60 pointer-events-none")}
                        />
                    ) : type === 'ai-text' ? (
                        <div className="space-y-2">
                            <textarea 
                                value={value}
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
                            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
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
                                    value={value}
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
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-32">
            {/* Navigation Header */}
            <div className="flex items-center justify-between">
                <Button 
                    variant="outline" 
                    onClick={() => navigate('..')}
                    className="group rounded-2xl h-12 pl-3 pr-6 bg-white border-slate-200 shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                >
                    <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
                    <span className="text-[10px] font-black uppercase italic tracking-widest">{renderString(t('common:back'), lang)}</span>
                </Button>

                <div className="flex items-center gap-2">
                    {!isNew && isDeletable && (
                        <Button 
                            variant="ghost" 
                            onClick={handleDelete}
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl h-12 px-6"
                        >
                            <Trash2 size={20} className="mr-2" />
                            <span className="text-[10px] font-black uppercase italic tracking-widest">{renderString(t('common:delete'), lang)}</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    <GlassCard className="overflow-hidden border-indigo-100/30">
                        <div className="p-8 space-y-8">
                            {config.layout?.sections && config.layout.sections.length > 0 ? (
                                config.layout.sections.map((section: any, idx: number) => (
                                    <div key={section.id || section.title || idx} className="space-y-6 pt-6 border-t border-slate-100 first:border-0 first:pt-0">
                                        {(section.title || section.description) && (
                                            <div className="space-y-1">
                                                {section.title && <h3 className="text-sm font-black italic uppercase tracking-tighter text-slate-800">{renderString(section.title, lang)}</h3>}
                                                {section.description && <p className="text-[10px] text-slate-400 font-medium">{renderString(section.description, lang)}</p>}
                                            </div>
                                        )}
                                        <div className={cn(
                                            "grid gap-x-6 gap-y-8",
                                            section.columns === 1 ? 'grid-cols-1' :
                                            section.columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                            section.columns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 
                                            section.columns === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'
                                        )}>
                                            {(section.fields || []).map((fieldName: string) => {
                                                const field = fieldsList.find((f: any) => f.name === fieldName);
                                                return field ? renderField(field) : null;
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={cn(
                                    "grid gap-x-6 gap-y-8",
                                    (config.uiConfig?.form?.columns || 2) == 1 ? 'grid-cols-1' :
                                    (config.uiConfig?.form?.columns || 2) == 2 ? 'grid-cols-1 md:grid-cols-2' :
                                    (config.uiConfig?.form?.columns || 2) == 3 ? 'grid-cols-1 md:grid-cols-3' :
                                    (config.uiConfig?.form?.columns || 2) == 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'
                                )}>
                                    {fieldsList.map(renderField)}
                                </div>
                            )}
                        </div>
                    </GlassCard>

                    {/* Related Children Entities (Level 8 Inbound Relations) */}
                    {!isNew && config.uiConfig?.form?.showChildren !== false && Object.keys(childrenRecords).length > 0 && (
                        <div className="space-y-6">
                            {Object.entries(childrenRecords)
                                .filter(([childEntityName]) => !(config.uiConfig?.form?.hiddenChildren || []).includes(childEntityName))
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
                                                        : `${childLabel} ${renderString(t('common:in_this'), lang)} ${renderString(config.label || entityId, lang)}`}
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
                                {config.features?.authorTracking !== false && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 uppercase tracking-widest">{renderString(t('common:creator'), lang)}</span>
                                        <span className="text-slate-600">{renderString(formData.created_by || formData.createdBy || t('common:administrator'), lang)}</span>
                                    </div>
                                )}
                                {config.features?.timestamps !== false && (
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

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 px-6 md:px-12 z-50 flex items-center justify-end gap-4 animate-in slide-in-from-bottom duration-500">
                <div className="flex-1 flex items-center gap-2">
                    {!isNew && (
                        <Badge className="bg-indigo-50 text-indigo-600 border-none font-black italic uppercase tracking-widest text-[10px] px-3 py-1">
                            {renderString(config.label || entityId, lang)} #{String(recordId).slice(-6)}
                        </Badge>
                    )}
                </div>
                {!isGlobalReadOnly && (
                    <Button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 px-12 shadow-2xl shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-1 active:scale-95"
                    >
                        {saving ? <RefreshCw className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
                        <span className="text-sm font-black uppercase italic tracking-widest">{isNew ? renderString(t('common:create'), lang) : renderString(t('common:save'), lang)}</span>
                    </Button>
                )}
            </div>
        </div>
    );
}


