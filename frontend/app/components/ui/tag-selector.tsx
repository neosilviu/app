import React, { useState, useEffect, useCallback, memo } from 'react';
import { Tag as TagIcon, Plus, X, Check, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { socket, api, socketRequest } from '~/lib/core';
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Global cache to avoid redundant fetches across many instances (preventing ERR_INSUFFICIENT_RESOURCES)
let cachedAllTags: Tag[] | null = null;
let isFetchingAllTags = false;
const allTagsWaiters: ((tag: Tag[]) => void)[] = [];

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  entityType: string;
  entityId: string;
  initialTags?: Tag[];
  onTagsChange?: (tag: Tag[]) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const TagSelector = memo(function TagSelector({ entityType, entityId, initialTags, onTagsChange, size = 'sm' }: TagSelectorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [entityTags, setEntityTags] = useState<Tag[]>(initialTags || []);
  const [isAdding, setIsAdding] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [isLoading, setIsLoading] = useState(false);

  const buttonStyles = {
    sm: "h-7 px-2 text-[10px]",
    md: "h-9 px-3 text-xs",
    lg: "h-11 px-4 text-sm"
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22
  };

  const fetchTags = useCallback(async () => {
    // 0. Use global cache if available
    if (cachedAllTags) {
      setAllTags(cachedAllTags);
      return;
    }

    if (isFetchingAllTags) {
      allTagsWaiters.push(setAllTags);
      return;
    }

    isFetchingAllTags = true;
    try {
      // 1. Try Brain API (Generic CRUD)
      const res = await api.brain.get('db/collection/tag/all');
      if (res.success) {
        const validTags = (res.data || []).map((t: any) => ({
          id: t.id || t._id || t.ID || t.tagId,
          name: t.name || t.label || '',
          color: t.color || '#3b82f6'
        }));
        cachedAllTags = validTags;
        setAllTags(validTags);
        allTagsWaiters.forEach(w => w(validTags));
        allTagsWaiters.length = 0;
        return;
      }
    } catch (e) {
      // Quietly fallback
    } finally {
      isFetchingAllTags = false;
    }

    // 2. Fallback to Socket
    socket.emit('tag:list', {}, (res: any) => {
      isFetchingAllTags = false; // Mark as done after socket response
      if (res.success) {
        const validTags = (res.data || []).map((t: any) => ({
          id: t.id || t._id || t.ID || t.tagId,
          name: t.name || t.label || '',
          color: t.color || '#3b82f6'
        }));
        cachedAllTags = validTags;
        setAllTags(validTags);
        allTagsWaiters.forEach(w => w(validTags));
        allTagsWaiters.length = 0;
      }
    });
  }, []);

  const fetchEntityTags = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Try Brain API (Generic CRUD for assignments - Universalized)
      const res = await api.brain.get(`db/collection/entity_relation_many/all?sourceType=${entityType}&sourceId=${entityId}&targetType=tag`);
      if (res.success) {
        const assignments = res.data || [];
        const tagIds = assignments.map((a: any) => a.targetId);
        
        // Match tag objects from allTags
        if (cachedAllTags) {
           const matches = cachedAllTags.filter(t => tagIds.includes(t.id));
           setEntityTags(matches);
        } else {
           // Fallback if allTags isn't loaded yet
           const allRes = await api.brain.get('db/collection/tag/all');
           if (allRes.success) {
              const cleanedTags = (allRes.data || []).map((t: any) => ({
                id: t.id || t._id || t.ID || t.tagId,
                name: t.name || t.label || '',
                color: t.color || '#3b82f6'
              }));
              const matches = cleanedTags.filter((t: any) => tagIds.includes(t.id));
              setEntityTags(matches);
           }
        }
        setIsLoading(false);
        return;
      }
    } catch (e) {
      // Silence log if in dev or just ignore as socket fallback will pick up
    }

    // 2. Fallback to Socket
    socket.emit('tag:get-entity-tag', { entityType, entityId }, (res: any) => {
      if (res.success) {
        const validTags = (res.data || []).map((t: any) => ({
          id: t.id || t._id || t.ID || t.tagId,
          name: t.name || t.label || '',
          color: t.color || '#3b82f6'
        }));
        setEntityTags(validTags);
        // if (onTagsChange) onTagsChange(validTags);
      }
      setIsLoading(false);
    });
  }, [entityType, entityId]); // Removed onTagsChange to stabilize dependency

  useEffect(() => {
    fetchTags();
    
    // Use a stable check for initialTags
    const hasInitial = initialTags && Array.isArray(initialTags) && initialTags.length > 0;
    
    if (!hasInitial) {
        fetchEntityTags();
    } else {
        setEntityTags(initialTags);
    }

    const handleTagsUpdated = (payload: any) => {
      fetchTags();
      if (!hasInitial || (payload && payload.entityId === entityId)) {
        fetchEntityTags();
      }
    };

    const handleDataUpdated = (payload: any) => {
      if (payload.collection === 'tag') fetchTags();
    };

    socket.on('tag:updated', handleTagsUpdated);
    socket.on('socket:data_updated', handleDataUpdated);

    return () => {
      socket.off('tag:updated', handleTagsUpdated);
      socket.off('socket:data_updated', handleDataUpdated);
    };
  }, [entityId, fetchTags, fetchEntityTags, initialTags]);

  const handleAssign = async (tag: Tag) => {
    // Robust check for tag ID extraction
    // Check various common ID field names to be ultra-resilient
    let tagId = tag?.id || (tag as any)?._id || (tag as any)?.ID || (tag as any)?.tagId || (tag as any)?.key;
    
    // Auto-fix if tagId is an object (common with some D1/JSON edge cases)
    if (tagId && typeof tagId === 'object') {
        tagId = (tagId as any).id || (tagId as any).value || (tagId as any).ID || String(tagId);
    }

    if (!tagId || !entityId) {
        console.warn("[TagSelector] Assignment blocked: tag.id missing", { 
          fullTagObject: tag, 
          entityId,
          tagIdType: typeof tagId,
          extractedId: tagId
        });
        
        // Final attempt: find by name in allTags if we have the name but lost the ID
        if (!tagId && tag?.name) {
          const found = allTags.find(t => t.name === tag.name && (t.id || (t as any)?._id || (t as any)?.ID));
          if (found) return handleAssign(found);
        }
        
        toast.error(t('common:tag_id_error'));
        return;
    }

    // Ensure tagId is string for comparison
    const finalTagId = String(tagId);

    if (entityTags.find(t => String(t.id || (t as any)?._id || (t as any)?.ID) === finalTagId)) return;
    
    try {
      // Optimistic update
      const updatedLocally = [...entityTags, { ...tag, id: finalTagId }];
      setEntityTags(updatedLocally);
      if (onTagsChange) onTagsChange(updatedLocally);

      // 1. Try Brain API
      const res = await api.brain.post('tag/assign', { 
        tagId: tagId, 
        entityType: entityType.replace(/s$/, ''), 
        entityId 
      });

      if (res.success) return;
    } catch (e) {
      console.warn("[TagSelector] Brain assign failed, falling back to socket");
    }

    // 2. Fallback to Socket
    socket.emit('tag:assign', { tagId, entityType, entityId }, (res: any) => {
      if (!res.success) {
        // Revert local state on failure
        fetchEntityTags();
        toast.error(t('common:tag_assign_error'));
      }
    });
  };

  const handleRemove = async (tagId: string) => {
    try {
      // 1. Try Brain
      const res = await api.brain.post('tag/remove', { tagId, entityType, entityId });
      if (res.success) {
        const updated = entityTags.filter(t => t.id !== tagId);
        setEntityTags(updated);
        if (onTagsChange) onTagsChange(updated);
        return;
      }
    } catch (e) {}

    // 2. Try Socket
    socket.emit('tag:remove', { tagId, entityType, entityId }, (res: any) => {
      if (res.success) {
        const updated = entityTags.filter(t => t.id !== tagId);
        setEntityTags(updated);
        if (onTagsChange) onTagsChange(updated);
      }
    });
  };

  const handleCreate = async () => {
    if (!newTagName.trim()) return;

    try {
      // 1. Try Brain
      const res = await api.brain.post('tag/create', { name: newTagName, color: newTagColor });
      if (res.success) {
        const newTag = res.data;
        setAllTags([...allTags, newTag]);
        handleAssign(newTag);
        setNewTagName('');
        setIsAdding(false);
        return;
      }
    } catch (e) {}

    // 2. Try Socket
    socket.emit('tag:create', { name: newTagName, color: newTagColor }, (res: any) => {
      if (res.success) {
        setAllTags([...allTags, res.data]);
        handleAssign(res.data);
        setNewTagName('');
        setIsAdding(false);
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {entityTags.map(tag => (
        <Badge 
          key={tag.id} 
          style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
          className={`${size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'} font-bold border flex items-center gap-1.5 group cursor-default`}
        >
          {tag.name}
          <div className="flex items-center gap-1 ml-0.5 border-l pl-1 border-current/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <Search 
              size={size === 'lg' ? 12 : 10} 
              className="cursor-pointer hover:scale-125 transition-transform" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const lang = location.pathname.split('/')[1] || 'en';
                navigate(`/${lang}/tag/${tag.id}`);
              }}
            />
            <X 
              size={size === 'lg' ? 12 : 10} 
              className="cursor-pointer hover:text-red-500 transition-colors" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRemove(tag.id);
              }}
            />
          </div>
        </Badge>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={`${buttonStyles[size]} rounded-lg border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center gap-1 shadow-sm`}
          >
            <Plus size={iconSizes[size]} strokeWidth={3} />
            <span className="font-bold uppercase tracking-wider">Tag</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          align="end" 
          className="w-[320px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white"
          onOpenAutoFocus={(e: any) => {
             // Aceasta previne eroarea de tip "Blocked aria-hidden on an element because its descendant retained focus"
             // în tabelele complexe unde focus-ul se poate pierde la randare
             e.preventDefault();
             // Focusăm manual input-ul dacă există
             const target = e.currentTarget as HTMLElement;
             if (target) {
                const input = target.querySelector('input');
                if (input) setTimeout(() => (input as HTMLInputElement).focus(), 0);
             }
          }}
        >
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('common:tag_selector_title')}</h4>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={(e) => {
                e.stopPropagation();
                setIsAdding(!isAdding);
              }}>
                {isAdding ? t('common:cancel') : t('common:tag_new')}
              </Button>
            </div>

            {isAdding ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Input 
                  placeholder={t('common:tag_placeholder')} 
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={(newTagColor && newTagColor.startsWith('#')) ? newTagColor : "#3b82f6"}
                    onChange={e => setNewTagColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-none p-0 overflow-hidden"
                  />
                  <Button className="flex-1 h-10 text-xs font-bold" onClick={handleCreate}>
                    {t('common:create')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {allTags.length === 0 && <p className="text-[10px] text-slate-400 text-center py-2">{t('common:tag_no_tags')}</p>}
                {allTags.map(tag => {
                  const isAssigned = entityTags.find(t => t.id === tag.id);
                  return (
                    <div 
                      key={tag.id}
                      onClick={() => isAssigned ? handleRemove(tag.id) : handleAssign(tag)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                        <span className="text-xs font-medium text-slate-700">{tag.name}</span>
                      </div>
                      {isAssigned && <Check size={14} className="text-green-500" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

