import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, socketRequest, cn } from '~/lib/core';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Tag as TagIcon, Mail, Users, HardDrive, Search, ChevronRight, ArrowLeft, X, Plus, Edit2 } from 'lucide-react';
import { useConfig } from '~/hooks/useConfig';

import { DynamicEntityDetail } from '~/components/entity/DynamicEntityDetail';

export default function TagDetailPage() {
  const { recordId: tagId, lang, entity: entityParam } = useParams();
  const { t } = useTranslation(['common', 'gmail', 'entity']);
  const navigate = useNavigate();
  const { entity: configMap } = useConfig();
  const [tag, setTag] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Helper to normalize tag data and extract strings from i18n objects
  const normalizeTag = (rawTag: any) => {
    if (!rawTag) return null;
    return {
      ...rawTag,
      name: typeof rawTag.name === 'string' ? rawTag.name : rawTag.name?.ro || rawTag.name?.en || 'Unnamed Tag',
      description: typeof rawTag.description === 'string' ? rawTag.description : rawTag.description?.ro || rawTag.description?.en || '',
      label: typeof rawTag.label === 'string' ? rawTag.label : rawTag.label?.ro || rawTag.label?.en || ''
    };
  };

  // Use DynamicEntityDetail for "new" tag
  if (tagId === 'new') {
    return <DynamicEntityDetail entityId="tag" recordId="new" config={configMap?.['tag']} />;
  }

  useEffect(() => {
    if (!tagId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Tag Info from Brain (Cloud - where tag are stored)
        const tagRes = await api.brain.get(`db/tag/${tagId}`);
        if (tagRes.success) setTag(normalizeTag(tagRes.data));

        // 2. Fetch Global Results (Now from Brain for unified cloud data)
        const cloudResultsRes = await api.brain.get(`tag/results/${tagId}`);
        if (cloudResultsRes.success) {
          setResults(cloudResultsRes.data || []);
        } else {
          // Fallback to socket if cloud is empty or failed
          const res: any = await socketRequest('tag:get-global-results', { tagId });
          if (res.success) {
            setResults(res.data || []);
          }
        }
      } catch (e) {
        console.error("Failed to fetch tag results", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tagId, navigate, lang]);

  if (isEditing) {
    return (
      <div className="h-full relative overflow-y-auto">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsEditing(false)} 
          className="absolute top-4 right-4 z-[60] bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all hover:scale-110"
        >
          <X className="w-5 h-5 text-slate-500" />
        </Button>
        <DynamicEntityDetail entityId="tag" recordId={tagId!} config={configMap?.['tag']} />
      </div>
    );
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'contact': return <Users className="w-4 h-4" />;
      case 'file': return <HardDrive className="w-4 h-4" />;
      default: return <TagIcon className="w-4 h-4" />;
    }
  };

  const getEntityLabel = (type: string) => {
    const config = configMap?.[type] || configMap?.[type + (type.endsWith('s') ? '' : 's')];
    return config?.label || type.toUpperCase();
  };

  const handleItemClick = (item: any) => {
    const type = item._entity;
    // Map to the correct entity path if needed
    let path = `/${lang}/${type}/${item.id}`;
    if (type === 'email') path = `/${lang}/gmail?emailId=${item.id}`;
    
    navigate(path);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/${lang}/tag`)} className="rounded-full bg-white shadow-sm border border-gray-100 hover:bg-gray-50">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-gray-400" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {tag?.name || t('common:loading')}
              </h1>
              {tag?.color && (
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
              )}
            </div>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {t('entity:results_for_tag', { tag: tag?.name })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <Button 
             variant="outline" 
             size="sm" 
             className="bg-white rounded-xl font-bold border-indigo-100 text-indigo-600 hover:bg-indigo-50" 
             onClick={() => setIsEditing(true)}
           >
             <Edit2 className="w-4 h-4 mr-2" />
             Edit Tag
           </Button>
           <Button variant="outline" size="sm" className="bg-white rounded-xl font-bold" onClick={() => navigate(`/${lang}/tag`)}>
             <X className="w-4 h-4 mr-2" />
             {t('common:close')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse border-none shadow-sm h-32 bg-white" />
          ))
        ) : results.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-20 bg-white rounded-3xl shadow-sm border border-gray-100 italic text-gray-400">
             <Search className="w-12 h-12 mb-4 opacity-10" />
             <p>{t('common:no_results_found', { query: tag?.name })}</p>
             <p className="text-xs mt-2 font-normal">No items are currently associated with this tag.</p>
          </div>
        ) : (
          results.map((item) => (
            <Card 
              key={`${item._entity}-${item.id}`} 
              className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group rounded-2xl bg-white overflow-hidden"
              onClick={() => handleItemClick(item)}
            >
              <CardContent className="p-0">
                <div className="p-4 flex items-start gap-4">
                  <div className={cn(
                      "w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors",
                      item._entity === 'email' && "bg-blue-50/50 text-blue-500/50",
                      item._entity === 'contact' && "bg-green-50/50 text-green-500/50",
                      item._entity === 'file' && "bg-purple-50/50 text-purple-500/50",
                  )}>
                    {getEntityIcon(item._entity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-tighter px-1.5 py-0 border-gray-100 text-gray-400 bg-gray-50/50">
                        {getEntityLabel(item._entity)}
                      </Badge>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 truncate leading-tight">
                      {item.name || item.subject || item.filename || item.title || item.id}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 truncate opacity-60">
                      {(item.email || item.body || item.description || '').replace(/<[^>]*>?/gm)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 self-center" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {loading && (
        <div className="fixed bottom-8 right-8 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-2">
           <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
           <span className="text-xs font-bold text-gray-500">Scanning associations...</span>
        </div>
      )}
    </div>
  );
}

