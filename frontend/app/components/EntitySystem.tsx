import React, { useState, useMemo, useTransition, useCallback, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { type EntityType } from '~/lib/core';
import { useConfig } from "~/hooks/useConfig";
import { useAuth } from '~/hooks/useAuth';
import { socket } from '~/lib/core';
import { cn, api, renderString, normalizeEntity, formatForRender } from '~/lib/core';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '~/components/ui/form';
import { Checkbox } from '~/components/ui/checkbox';
import { FileUploader } from './ui/file-uploader';
import { Badge } from "./ui/badge";
import { TagSelector } from "./ui/tag-selector";
import { IconPicker } from './ui/IconPicker';
import { ColorPicker } from './ui/ColorPicker';
import { DatePicker } from './ui/DatePicker';
import { Edit, Trash,  ArrowUpDown, ArrowUp, ArrowDown, Check, X, Archive, RotateCcw, FileIcon, ExternalLink, Tag as TagIcon, Zap, Code, Sparkles, Star, ArrowRight, HelpCircle } from "lucide-react";
import { IconMap } from "~/lib/icons";

// --- RelationSelect Component ---

interface RelationSelectProps {
    entityType: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function RelationSelect({ entityType, value, onChange, placeholder }: RelationSelectProps) {
    const { t } = useTranslation(['common', 'entity']);
    const { lang } = useParams();
    const [options, setOptions] = useState<{ value: string, label: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (!entityType) return;

        const filters = user?.workspaceId ? { workspaceId: user.workspaceId } : {};
        
        socket.emit('db:list', { collection: entityType, filters }, (response: any) => {
            if (response.success && response.data) {
                const mapped = response.data.map((item: any) => ({
                    value: item.id,
                    label: item.name || item.title || item.label || item.id
                }));
                setOptions(mapped);
            }
            setLoading(false);
        });
    }, [entityType, user?.workspaceId]);

    return (
        <Select onValueChange={onChange} value={value || ''}>
            <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold focus:ring-indigo-500 shadow-sm">
                <SelectValue placeholder={loading ? t('common:loading') : placeholder || t('common:select_placeholder', { label: entityType ? t(`entities:${entityType}.label`, entityType) : '...' })} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white/95 backdrop-blur-md">
                {options.map((opt, idx) => (
                    <SelectItem key={`${opt.value}-${idx}`} value={opt.value} className="rounded-xl py-3 px-4 font-bold focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                        {renderString(opt.label)}
                    </SelectItem>
                ))}
                {options.length === 0 && !loading && (
                  <div className="py-8 px-4 text-center">
                    <p className="text-xs font-bold text-slate-400 italic">No records found for {entityType}</p>
                  </div>
                )}
            </SelectContent>
        </Select>
    );
}

// --- DynamicTable Component ---

interface DynamicTableProps {
  entityType: string;
  data: any[];
  loading: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onArchive?: (item: any) => void;
  onRestore?: (item: any) => void;
  onRowClick?: (item: any) => void;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export const DynamicTable = React.memo(function DynamicTable({ 
  entityType, 
  data, 
  loading, 
  selectedIds = new Set(),
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onEdit, 
  onDelete, 
  onArchive,
  onRestore,
  onRowClick 
}: DynamicTableProps) {
  const { t } = useTranslation(['common', 'entity']);
  const { lang } = useParams();
  const { entity } = useConfig();
  const config = entity[entityType];
  const [isPending, startTransition] = useTransition();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
    key: "",
    direction: null,
  });
  const [displayLimit, setDisplayLimit] = useState(config?.uiConfig?.list?.pageSize || 50);
  
  useEffect(() => {
    if (config?.uiConfig?.list?.pageSize) {
      setDisplayLimit(config.uiConfig.list.pageSize);
    }
  }, [config?.uiConfig?.list?.pageSize]);

  const sortedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!sortConfig.key || !sortConfig.direction) return data;

    if (data.length > 2000) return data;

    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && aValue.includes('T') && !isNaN(Date.parse(aValue))) {
        const aDate = Date.parse(aValue);
        const bDate = Date.parse(bValue);
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortConfig.direction === "asc" ? aDate - bDate : bDate - aDate;
        }
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const paginatedData = useMemo(() => sortedData.slice(0, displayLimit), [sortedData, displayLimit]);

  const fields = useMemo(() => {
    // Enterprise Level 8: Always use the central normalizer
    const normalizedConfig = normalizeEntity(config);
    const allFields = normalizedConfig.fields;
    const columnNames = normalizedConfig?.uiConfig?.list?.columns;
    
    // If specific columns are defined in uiConfig, use them
    if (Array.isArray(columnNames) && columnNames.length > 0) {
      return allFields.filter(f => columnNames.includes(f.name));
    }
    
    // Otherwise fallback to filtering by hideInTable/hidden
    return allFields.filter(field => !field.hideInTable && !field.hidden);
  }, [config]);

  const handleSort = useCallback((key: string) => {
    startTransition(() => {
      let direction: "asc" | "desc" | null = "asc";
      if (sortConfig.key === key && sortConfig.direction === "asc") {
        direction = "desc";
      } else if (sortConfig.key === key && sortConfig.direction === "desc") {
        direction = null;
      }
      setSortConfig({ key, direction });
    });
  }, [sortConfig]);

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key || !sortConfig.direction) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === "asc" ? <ArrowUp size={14} className="ml-1 text-blue-500" /> : <ArrowDown size={14} className="ml-1 text-blue-500" />;
  };

  const renderCell = useCallback((item: any, name: string, field: any) => {
    const value = item[name];
    if (value === null || value === undefined || value === "") return "-";

    // Audit Log specific: link entityId to the actual record
    if (entityType === "audit_log" && name === "entityId" && item.entityType) {
      return (
        <Link 
          to={`/${lang || "ro"}/${item.entityType}/${item.entityId}`} 
          className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 group"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
          <ExternalLink size={10} className="inline-block opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      );
    }

    if (field.type === "boolean") {
      return value ? (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <Check size={12} /> {t('common:yes')}
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 gap-1">
          <X size={12} /> {t('common:no')}
        </Badge>
      );
    }

    if (field.type === "datetime") {
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return formatForRender(value, lang);
        return dateFormatter.format(date);
      } catch (e) {
        return formatForRender(value, lang);
      }
    }

    if (field.type === "file") {
      const file = Array.isArray(value) ? value : value ? [value] : [];
      if (file.length === 0) return "-";
      return (
        <div className="flex -space-x-2">
          {file.map((file: any, i: number) => (
            <a 
              key={i} href={file.url} target="_blank" rel="noreferrer" title={file.name}
              className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center hover:z-10 transition-all hover:scale-110"
              onClick={(e) => e.stopPropagation()}
            >
              <FileIcon size={14} className="text-muted-foreground" />
            </a>
          ))}
          {file.length > 3 && (
            <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
              +{file.length - 3}
            </div>
          )}
        </div>
      );
    }

    if (field.type === "formula") {
      return (
        <div className="flex items-center gap-1.5 text-emerald-600 font-mono text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
          <Code size={10} />
          {formatForRender(value, lang)}
        </div>
      );
    }

    if (field.type === "icon") {
      const Icon = (value && IconMap[value]) ? IconMap[value] : HelpCircle;
      return (
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
             <Icon size={14} />
           </div>
           <span className="text-[10px] font-mono text-slate-500 uppercase">{value}</span>
        </div>
      );
    }

    if (field.type === "ai") {
      return (
        <div className="flex items-center gap-1.5 text-indigo-600 italic bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
          <Zap size={10} />
          <span className="truncate max-w-[200px]">{formatForRender(value, lang)}</span>
        </div>
      );
    }

    if (field.type === "currency") {
      const decimals = field.currency?.decimals ?? 2;
      const code = field.currency?.code || 'RON';
      const num = Number(value || 0);
      try {
        return (
          <span className="font-mono font-bold text-slate-700">
            {new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-US', {
              style: 'currency',
              currency: code,
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            }).format(num)}
          </span>
        );
      } catch (e) {
        return `${num.toFixed(decimals)} ${code}`;
      }
    }

    if (field.type === "progress" || name === 'progress') {
      const val = Number(value || 0);
      return (
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${val}%` }} />
          </div>
          <span className="text-[9px] font-black text-slate-500">{val}%</span>
        </div>
      );
    }

    if (field.type === "rating") {
      const val = Number(value || 0);
      return (
        <div className="flex items-center gap-0.5 text-amber-400">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} size={10} fill={star <= val ? "currentColor" : "none"} className={star <= val ? "" : "text-slate-200"} />
          ))}
        </div>
      );
    }

    if (field.type === "tag") {
      const tag = Array.isArray(value) ? value : String(value).split(',').filter(Boolean);
      return (
        <div className="flex flex-wrap gap-1">
          {tag.map((tag: string, i: number) => (
            <Badge key={i} variant="secondary" className="text-[8px] py-0 px-1 bg-slate-100 text-slate-600 border-none">{tag}</Badge>
          ))}
        </div>
      );
    }

    if (field.type === "color") {
      return (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: value }} />
          <span className="text-xs font-mono">{value}</span>
        </div>
      );
    }

    if ((field.type === "select" || field.type === "enum") && field.options) {
      const option = field.options.find((opt: any) => (typeof opt === 'object' ? opt.value : opt) === value);
      const label = option ? (typeof option === 'object' ? (option.label || option.value) : option) : value;
      return <Badge variant="secondary" className="font-normal">{renderString(label, lang)}</Badge>;
    }

    if (field.type === "json" || name === "details" || typeof value === 'object') {
      if (!value) return null;
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      return (
        <div className="max-w-[150px] truncate text-[10px] font-mono bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded leading-tight" title={str}>
          {str}
        </div>
      );
    }

    return String(value);
  }, []);

  const allSelected = data.length > 0 && selectedIds.size === data.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < data.length;

  if (!config || !config.fields) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <Table className="relative">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox 
                  checked={allSelected || (someSelected ? "indeterminate" : false)}
                  onCheckedChange={(checked) => {
                    startTransition(() => {
                      if (checked) onSelectAll?.();
                      else onClearSelection?.();
                    });
                  }}
                />
              </TableHead>
              {fields.map((field: any) => (
                <TableHead key={field.name} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort(field.name)}>
                  <div className="flex items-center">
                    {(t([`entities:fields.${field.name}`, renderString(field.label || field.name)], renderString(field.label || field.name)) as string)}
                    {getSortIcon(field.name)}
                  </div>
                </TableHead>
              ))}
              {config.hasTags && <TableHead>{t('common:tag') as string}</TableHead>}
              {(onEdit || onDelete || onArchive || onRestore) && (
                <TableHead className="text-right whitespace-nowrap">{t('common:actions') as string}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={fields.length + (config.hasTags ? 3 : 2)} className="h-24 text-center">{t('common:loading')}</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={fields.length + (config.hasTags ? 3 : 2)} className="h-24 text-center">{t('common:no_items_found')}</TableCell></TableRow>
            ) : (
              paginatedData.map((item, index) => {
                const rowKey = item.id || item.chatId || `row-${index}`;
                return (
                  <TableRow 
                    key={`${rowKey}-${index}`} 
                    className={`${onRowClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" : ""} ${selectedIds.has(rowKey) ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}`}
                    onClick={() => onRowClick && startTransition(() => onRowClick(item))}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(rowKey)} onCheckedChange={() => startTransition(() => onToggleSelection?.(rowKey))} />
                    </TableCell>
                    {fields.map((field: any) => (
                      <TableCell key={field.name}>{renderCell(item, field.name, field)}</TableCell>
                    ))}
                    {config.hasTags && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TagSelector 
                          entityType={entityType.replace(/s$/, '')} 
                          entityId={item.id} 
                          initialTags={item.tag || []}
                        />
                      </TableCell>
                    )}
                    {(onEdit || onDelete || onArchive || onRestore) && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          {onEdit && <Button variant="ghost" size="icon" onClick={() => onEdit?.(item)}><Edit size={16} /></Button>}
                          {item.archived ? (
                            onRestore && <Button variant="ghost" size="icon" className="text-green-500" onClick={() => onRestore?.(item)}><RotateCcw size={16} /></Button>
                          ) : (
                            onArchive && <Button variant="ghost" size="icon" className="text-amber-500" onClick={() => onArchive?.(item)}><Archive size={16} /></Button>
                          )}
                          {onDelete && <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete?.(item)}><Trash size={16} /></Button>}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {sortedData.length > displayLimit && (
        <div className="p-4 flex justify-center">
          <Button variant="outline" onClick={() => startTransition(() => setDisplayLimit((prev: number) => prev + 50))} disabled={isPending}>
            {isPending ? t('common:loading') : t('common:load_more', { count: sortedData.length - displayLimit })}
          </Button>
        </div>
      )}
    </div>
  );
});

// --- DynamicForm Component ---

interface DynamicFormProps {
  entityType: string;
  onSubmit: (data: any) => void;
  initialData?: any;
  loading?: boolean;
}

export function DynamicForm({ entityType, onSubmit, initialData, loading }: DynamicFormProps) {
  const { t } = useTranslation(['common', 'validation', 'entity']);
  const { lang } = useParams();
  const { entity } = useConfig();
  let config = entity[entityType];
  
  // Enterprise Level 8: Always use the central normalizer
  const normalizedConfig = normalizeEntity(config);
  const fieldsArray = normalizedConfig.fields;
  const fieldsMap = normalizedConfig.fieldsMap;

  const schema = React.useMemo(() => {
    const schemaFields: any = {};
    fieldsArray.forEach((field: any) => {
      const name = field.name || field.id;
      if (field.readonly && !field.calculate) return;
      let fieldSchema: any;
      if (field.type === 'file') fieldSchema = field.multiple ? z.array(z.any()) : z.any();
      else if (field.type === 'boolean') fieldSchema = z.boolean();
      else if (field.type === 'number' || field.type === 'currency') fieldSchema = z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number());
      else if (field.type === 'email') fieldSchema = z.string().email(t('validation:invalid_email'));
      else if (field.type === 'phone') fieldSchema = z.string().regex(/^\+?[0-9\s\-()]*$/, t('validation:invalid_phone'));
      else if (field.type === 'datetime' || field.type === 'date' || field.type === 'time') fieldSchema = z.string();
      else fieldSchema = z.string();
      
      // New Metadata Validation
      if (field.validation) {
        const fieldLabel = t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, 'entities:fields.name'], renderString(field.label || name));
        if (field.validation.pattern) {
          fieldSchema = fieldSchema.regex(new RegExp(field.validation.pattern), t('validation:invalid_format', { label: fieldLabel }));
        }
        if (field.validation.min !== undefined && field.validation.min !== null) {
          if (field.type === 'number') fieldSchema = fieldSchema.min(field.validation.min, t('validation:min_value', { label: fieldLabel, value: field.validation.min }));
          else fieldSchema = fieldSchema.min(field.validation.min, t('validation:min_length', { label: fieldLabel, length: field.validation.min }));
        }
        if (field.validation.max !== undefined && field.validation.max !== null) {
          if (field.type === 'number') fieldSchema = fieldSchema.max(field.validation.max, t('validation:max_value', { label: fieldLabel, value: field.validation.max }));
          else fieldSchema = fieldSchema.max(field.validation.max, t('validation:max_length', { label: fieldLabel, length: field.validation.max }));
        }
      }

      if (field.required) {
        const fieldLabel = t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, 'entities:fields.name'], renderString(field.label || name));
        if (field.type !== 'boolean') fieldSchema = fieldSchema.min(1, t('validation:required', { label: fieldLabel }));
      } else {
        if (field.type === 'boolean') fieldSchema = fieldSchema.optional().nullable().default(false);
        else fieldSchema = fieldSchema.optional().nullable().or(z.literal(''));
      }
      schemaFields[name] = fieldSchema;
    });
    return z.object(schemaFields);
  }, [fieldsArray, entityType]);
  
  const defaultValues = React.useMemo(() => {
    const defaults: any = {};
    fieldsArray.forEach((field: any) => {
      const name = field.name || field.id;
      if (field.defaultValue !== undefined) {
        defaults[name] = field.defaultValue;
      } else if (field.type === 'boolean') {
        defaults[name] = false;
      }
    });
    return { ...defaults, ...(initialData || {}) };
  }, [fieldsArray, initialData]);

  const form = useForm({ 
    resolver: zodResolver(schema), 
    defaultValues,
    values: (initialData && Object.keys(initialData).length > 0) ? initialData : undefined,
    resetOptions: {
      keepDirtyValues: true, // keep dirty fields unchanged, but update defaultValues
    }
  });

  const watchedValues = form.watch();

  // Reset form when initialData changes (v7 values prop handles this mostly, but we keep it for safety if nested)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  useEffect(() => {
    fieldsArray.forEach((field: any) => {
      const name = field.name || field.id;
      // 1. Legacy/Functional Calculate
      if (field.calculate && typeof field.calculate === 'function') {
        const newValue = field.calculate(watchedValues);
        if (newValue !== form.getValues(name)) form.setValue(name, newValue, { shouldValidate: true });
      }
      
      // 2. String-based JS Formula
      if (field.type === 'formula' && field.formula?.expression) {
        try {
          // Dangerous but effective for internal tools: simple Function evaluator
          // Only evaluate if dependencies are present to avoid noise
          const data = watchedValues;
          const newValue = new Function('data', `try { return ${field.formula.expression}; } catch(e) { return ""; }`)(data);
          if (newValue !== undefined && newValue !== form.getValues(name)) {
            form.setValue(name, newValue, { shouldValidate: true });
          }
        } catch (e) {
          // Formula error - just ignore and don't block UI
        }
      }
    });
  }, [watchedValues, fieldsArray, form]);

  useEffect(() => {
    if (watchedValues.phone && !watchedValues.whatsapp && fieldsMap.whatsapp) {
      form.setValue('whatsapp', watchedValues.phone);
    }
  }, [watchedValues.phone, watchedValues.whatsapp, form, fieldsMap.whatsapp]);

  if (!config || !config.fields) return null;

  const gridColumns = Number(config.uiConfig?.form?.columns || 2);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn("grid gap-4", {
        "grid-cols-1": gridColumns === 1,
        "grid-cols-1 md:grid-cols-2": gridColumns === 2,
        "grid-cols-1 md:grid-cols-3": gridColumns === 3,
        "grid-cols-1 md:grid-cols-4": gridColumns === 4,
      })}>
        {fieldsArray.map((field: any) => {
          const name = field.name || field.id;
          // Visibility Logic
          const hiddenFields = config.uiConfig?.form?.hiddenFields || [];
          if (hiddenFields.includes(name)) return null;

          // New Advanced Visibility Logic
          if (field.visibility) {
            if (field.visibility.type === 'hidden') return null;
            if (field.visibility.type === 'conditional') {
              const { dependsOn, operator, value } = field.visibility;
              const targetValue = watchedValues[dependsOn];
              
              const isMatch = Array.isArray(value) 
                ? value.includes(targetValue)
                : targetValue == value;

              if (operator === '==' && !isMatch) return null;
              if (operator === '!=' && isMatch) return null;
              if (operator === 'in' && (!targetValue || !String(targetValue).includes(String(value)))) return null;
              if (operator === 'set' && (targetValue === null || targetValue === undefined || targetValue === '')) return null;
            }
          }

          // Legacy showIf support
          if (field.showIf) {
            const { field: targetField, equals, notEquals, contains } = field.showIf;
            const targetValue = watchedValues[targetField];
            if (equals !== undefined && targetValue !== equals) return null;
            if (notEquals !== undefined && targetValue === notEquals) return null;
            if (contains !== undefined && (!targetValue || !targetValue.includes(contains))) return null;
          }

          const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.fullWidth || name === 'name' || name === 'email' || field.width === '1/1';
          
          let colSpan = 1;
          if (isFullWidth) colSpan = gridColumns;
          else if (field.width === '1/2') colSpan = Math.max(1, Math.floor(gridColumns / 2));
          else if (field.width === '1/3') colSpan = Math.max(1, Math.floor(gridColumns / 3));
          else if (field.width === '1/4') colSpan = Math.max(1, Math.floor(gridColumns / 4));

          return (
            <div key={name} className={cn({
              "md:col-span-1": colSpan === 1,
              "md:col-span-2": colSpan === 2,
              "md:col-span-3": colSpan === 3,
              "md:col-span-4": colSpan === 4,
            })}>
              <FormField control={form.control} name={name} render={({ field: formField }) => (
                <FormItem className={field.type === 'boolean' ? "flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4" : ""}>
                  {field.type === 'boolean' ? (
                    <>
                      <FormControl>
                        <Checkbox 
                          checked={!!formField.value} 
                          onCheckedChange={formField.onChange} 
                          className="h-6 w-6 rounded-lg border-slate-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-colors"
                        />
                      </FormControl>
                      <div className="space-y-1.5 leading-none pt-0.5">
                        <FormLabel className="text-[11px] font-black uppercase tracking-widest text-slate-800 cursor-pointer flex items-center gap-2">
                          {renderString(field.label, lang) || t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, name])}
                        </FormLabel>
                        {field.description && <FormDescription className="text-[10px] font-medium text-slate-400 italic leading-snug">{renderString(field.description, lang)}</FormDescription>}
                      </div>
                    </>
                  ) : (
                    <>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2 ml-1">
                        {field.type === 'ai' && <Sparkles size={10} className="text-indigo-400" />}
                        {field.type === 'formula' && <Code size={10} className="text-emerald-400" />}
                        {renderString(field.label, lang) || t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, name])}
                        {field.required && <span className="text-rose-500 font-black">*</span>}
                      </FormLabel>
                      <FormControl>
                        {field.type === 'select' || field.type === 'enum' ? (
                          field.ui?.variant === 'buttons' ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {field.options?.map((opt: any, idx: number) => {
                                const val = typeof opt === 'object' ? opt.value : opt;
                                const lab = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                                const isSelected = formField.value === val;
                                return (
                                  <Button
                                    key={`${val}-${idx}`}
                                    type="button"
                                    variant={isSelected ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                      "h-8 text-[10px] font-bold uppercase tracking-tight rounded-md px-3",
                                      isSelected ? "bg-indigo-600 hover:bg-indigo-700" : "text-slate-500 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30"
                                    )}
                                    onClick={() => formField.onChange(val)}
                                  >
                                    {renderString(lab, lang) || (typeof lab === 'string' ? t(lab) : lab)}
                                  </Button>
                                );
                              })}
                            </div>
                          ) : (
                            <Select onValueChange={formField.onChange} value={formField.value ?? field.defaultValue ?? ''}>
                              <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold focus:ring-indigo-500 shadow-sm transition-all">
                                <SelectValue placeholder={t('common:select_placeholder', { label: renderString(field.label, lang) || t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, name]) })} />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white/95 backdrop-blur-md">
                                {field.options?.map((opt: any, idx: number) => {
                                  const val = typeof opt === 'object' ? opt.value : opt;
                                  const lab = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                                  return (
                                    <SelectItem key={`${val}-${idx}`} value={val} className="rounded-xl py-3 px-4 font-bold focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                                      {renderString(lab, lang) || (typeof lab === 'string' ? t(lab) : lab)}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          )
                        ) : field.type === 'relation' ? (
                          <RelationSelect 
                            entityType={field.relation?.target || field.relationTo} 
                            value={formField.value} 
                            onChange={formField.onChange} 
                            placeholder={t('common:select_placeholder', { label: t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, renderString(field.label || name)]) })} 
                          />
                        ) : field.type === 'progress' || name === 'progress' ? (
                          <div className="flex items-center gap-4 py-2">
                             <input 
                               type="range" 
                               min="0" 
                               max="100" 
                               step="5"
                               value={formField.value || 0}
                               onChange={(e) => formField.onChange(Number(e.target.value))}
                               className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                             />
                             <span className="text-sm font-black text-indigo-600 min-w-[3rem] text-right">{formField.value || 0}%</span>
                          </div>
                        ) : field.type === 'rating' ? (
                          <div className="flex items-center gap-2 py-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => formField.onChange(star)}
                                className={cn(
                                  "transition-all hover:scale-110",
                                  star <= (formField.value || 0) ? "text-amber-400" : "text-slate-200"
                                )}
                              >
                                <Star size={24} fill={star <= (formField.value || 0) ? "currentColor" : "none"} />
                              </button>
                            ))}
                          </div>
                        ) : field.type === 'tag' || (field.type === 'enum' && field.multiple) ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-xl bg-slate-50/50">
                                {((Array.isArray(formField.value) ? formField.value : []) as string[]).map((val, i) => (
                                  <Badge key={val || i} variant="secondary" className="gap-1 pr-1 font-bold">
                                    {renderString(field.options?.find((o: any) => (typeof o === 'object' ? o.value : o) === val)?.label || val, lang)}
                                    <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => {
                                      const newVal = (formField.value as string[]).filter(v => v !== val);
                                      formField.onChange(newVal);
                                    }} />
                                  </Badge>
                                ))}
                                {(!formField.value || formField.value.length === 0) && (
                                  <span className="text-[10px] text-slate-400 italic py-1 px-1">No selection</span>
                                )}
                              </div>
                              <select 
                                className="w-full h-8 rounded-lg border border-slate-200 text-xs px-2"
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const current = Array.isArray(formField.value) ? formField.value : [];
                                  if (!current.includes(e.target.value)) {
                                    formField.onChange([...current, e.target.value]);
                                  }
                                  e.target.value = '';
                                }}
                              >
                                <option value="">+ Add {renderString(field.label || name)}...</option>
                                {field.options?.map((opt: any, idx: number) => {
                                  const val = typeof opt === 'object' ? opt.value : opt;
                                  const lab = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                                  return (
                                    <option key={`${val}-${idx}`} value={val} disabled={(formField.value || []).includes(val)}>
                                      {renderString(lab, lang)}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                        ) : field.type === 'richtext' ? (
                          <Textarea {...formField} value={formField.value ?? ''} className="min-h-[150px] border-dashed" placeholder="Rich text support coming soon..." />
                        ) : field.type === 'file' || field.type === 'image' ? (
                          <FileUploader 
                            value={formField.value} 
                            onChange={formField.onChange} 
                            multiple={field.multiple} 
                            storage={field.storage}
                          />
                        ) : field.type === 'ai' ? (
                          <div className="relative group">
                            <Textarea 
                              {...formField} 
                              value={formField.value ?? ''} 
                              placeholder={field.placeholder || "AI will generate content..."}
                              className="pr-12 min-h-[100px] border-indigo-100 focus-visible:ring-indigo-300 transition-all"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="absolute top-2 right-2 h-8 w-8 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shadow-sm bg-white/50 backdrop-blur-sm"
                              title="Generate with AI"
                              onClick={async (e) => {
                                const btn = e.currentTarget;
                                btn.classList.add('animate-spin');
                                try {
                                  const res = await api.brain.post('ai/generate', {
                                    prompt: field.ai?.prompt,
                                    model: field.ai?.model,
                                    personality: field.ai?.personality,
                                    temperature: field.ai?.temperature,
                                    data: watchedValues
                                  });
                                  if (res.success) {
                                    formField.onChange(res.data);
                                  }
                                } catch (err) {
                                  console.error("AI Generation failed", err);
                                } finally {
                                  btn.classList.remove('animate-spin');
                                }
                              }}
                            >
                              <Sparkles size={16} />
                            </Button>
                          </div>
                        ) : field.type === 'formula' ? (
                          <div className="relative">
                            <Input 
                              {...formField} 
                              value={formField.value ?? ''} 
                              readOnly 
                              className="bg-emerald-50/30 border-emerald-100 font-mono text-[11px] text-emerald-700 pl-8 cursor-not-allowed" 
                            />
                            <Code size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                          </div>
                        ) : field.type === 'currency' ? (
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                              {field.currency?.code || 'RON'}
                            </span>
                            <Input 
                              {...formField} 
                              type="number"
                              step={1 / Math.pow(10, field.currency?.decimals ?? 2)}
                              className="h-12 pl-12 rounded-2xl bg-slate-50 border-slate-200 font-mono text-indigo-600 font-bold focus:bg-white transition-all shadow-sm"
                              placeholder="0.00"
                              value={formField.value ?? ''} 
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                formField.onChange(val);
                              }}
                            />
                          </div>
                        ) : field.type === 'textarea' ? (
                          <Textarea {...formField} value={formField.value ?? ''} className="min-h-[120px] rounded-[2rem] bg-slate-50 border-slate-200 p-6 focus:bg-white transition-all shadow-sm" />
                        ) : field.type === 'icon' ? (
                          <IconPicker 
                            value={formField.value} 
                            onChange={formField.onChange} 
                            className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold"
                          />
                        ) : field.type === 'color' ? (
                          <ColorPicker 
                            value={formField.value} 
                            onChange={formField.onChange} 
                          />
                        ) : field.type === 'date' || field.type === 'datetime' ? (
                          <DatePicker 
                            value={formField.value} 
                            onChange={formField.onChange} 
                            showTime={field.type === 'datetime'}
                            placeholder={t('common:select_placeholder', { label: renderString(field.label, lang) || t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, name]) })}
                          />
                        ) : (
                          <div className="relative overflow-hidden rounded-2xl w-full">
                            <Input 
                              {...formField}
                              type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'phone' ? 'tel' : field.type === 'time' ? 'time' : field.type === 'password' ? 'password' : 'text'} 
                              readOnly={field.readonly} 
                              className={cn(
                                "h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold focus:bg-white transition-all shadow-sm",
                                field.readonly && "bg-slate-100 cursor-not-allowed opacity-70"
                              )}
                              autoComplete={field.autoComplete || (field.type === 'password' ? (name.includes('new') ? 'new-password' : 'current-password') : field.type === 'email' ? 'username' : field.type === 'phone' ? 'tel' : name === 'name' ? 'name' : "off")}
                              placeholder={field.placeholder || t('common:type_placeholder', { label: renderString(field.label, lang) || (t([`entities:${entityType}.fields.${name}`, `entities:fields.${name}`, name]) as string) })} 
                              value={
                                field.type === 'time'
                                  ? (() => {
                                      const val = formField.value;
                                      if (!val) return '';
                                      try {
                                        // Handle Unix timestamps
                                        if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
                                          const num = typeof val === 'number' ? val : parseInt(val);
                                          const date = new Date(num);
                                          if (isNaN(date.getTime())) return val;
                                          return date.toISOString().slice(11, 16);
                                        }
                                        // Handle ISO strings
                                        const date = new Date(val);
                                        if (isNaN(date.getTime())) return val;
                                        return date.toISOString().slice(11, 16);
                                      } catch (e) {
                                        return val;
                                      }
                                    })()
                                  : formField.value ?? ''
                              }
                              onChange={(e) => {
                                if (field.type === 'phone') {
                                  formField.onChange(e.target.value.replace(/[^0-9\s\+\-\(\)]/g, ''));
                                } else if (field.type === 'time') {
                                  formField.onChange(e.target.value);
                                } else {
                                  formField.onChange(e);
                                }
                              }}
                            />
                          </div>
                        )}
                      </FormControl>
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          );
        })}
        
        {config.hasTags && initialData?.id && (
          <div className="md:col-span-2 p-4 border rounded-2xl bg-slate-50/30 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <TagIcon className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('common:tag')}</span>
            </div>
            <TagSelector 
              entityType={entityType.replace(/s$/, '')} 
              entityId={initialData.id}
              size="md"
            />
          </div>
        )}

        <div className={cn("pt-8 mt-4 border-t border-slate-100 dark:border-slate-800", {
          "md:col-span-1": gridColumns === 1,
          "md:col-span-2": gridColumns === 2,
          "md:col-span-3": gridColumns === 3,
          "md:col-span-4": gridColumns === 4,
        })}>
          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase italic tracking-widest text-xs shadow-xl shadow-indigo-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[0px] transition-all gap-2 group"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('common:saving')}
              </>
            ) : (
                <>
                   {t('common:save')}
                   <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

