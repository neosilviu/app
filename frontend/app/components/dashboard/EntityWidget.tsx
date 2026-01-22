import React from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { ArrowRight, Layers, Table as TableIcon, LayoutGrid, Activity } from 'lucide-react';
import { IconMap } from '~/lib/icons';
import { cn, renderString, getThemeClasses, getDisplayValue } from '~/lib/core';
import type { EntityDefinition } from '~/lib/entity-engine';

interface EntityWidgetProps {
  entity: EntityDefinition;
  stats?: {
    total: number;
    recentData?: any[];
  };
  loading?: boolean;
}

export function EntityWidget({ entity, stats, loading }: EntityWidgetProps) {
  const { lang = 'ro' } = useParams();
  const navigate = useNavigate();
  const theme = getThemeClasses(entity.colorTheme || 'blue');
  const Icon = IconMap[entity.icon || ''] || Layers;
  
  const count = stats?.total ?? 0;
  const recent = stats?.recentData ?? [];
  const widgetType = entity.dashboardConfig?.widgetType || 'stats';
  const width = entity.dashboardConfig?.width || '1/4';

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking an actual link or button inside, let it handle the event
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/${lang}/${entity.name}`);
  };

  const widthClass = {
    '1/4': 'md:col-span-1 lg:col-span-1',
    '1/2': 'md:col-span-2 lg:col-span-2',
    '3/4': 'md:col-span-3 lg:col-span-3',
    'full': 'md:col-span-4 lg:col-span-4'
  }[width as string] || 'col-span-1';

  const renderContent = () => {
    switch (widgetType) {
      case 'table':
      case 'list':
        return (
          <div className="space-y-2 mt-4">
            {recent.slice(0, 3).map((item, idx) => (
              <div key={item.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group/item transition-all hover:bg-white hover:shadow-sm">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                  {getDisplayValue(item, entity)}
                </span>
                <Link to={`/${lang}/${entity.name}/${item.id}`} className="opacity-0 group-hover/item:opacity-100 transition-all text-primary">
                  <ArrowRight size={12} />
                </Link>
              </div>
            ))}
            {recent.length === 0 && !loading && (
              <p className="text-[9px] text-slate-400 italic py-2 text-center">Nicio înregistrare recentă</p>
            )}
          </div>
        );
      
      case 'stats':
      default:
        return (
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
              {loading ? '...' : count}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-1">
              înregistrări
            </span>
          </div>
        );
    }
  };

  return (
    <Card 
      onClick={handleCardClick}
      className={cn(
        "group relative border-none shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-100 dark:border-white/5 cursor-pointer",
        widthClass
      )}
    >
      <div className="block p-5">
        <div className="flex justify-between items-start">
          <div className={cn(
            "p-3 rounded-2xl text-white shadow-lg shadow-indigo-100 dark:shadow-none transition-all duration-300 group-hover:scale-110",
            theme.bg
          )}>
            <Icon size={20} />
          </div>
          
          <div className="flex flex-col items-end gap-1">
             <Badge variant="outline" className="text-[7px] font-black tracking-tighter border-slate-200 uppercase bg-white/50">
               {entity.name}
             </Badge>
             {entity.isSystem && (
               <Badge className="bg-slate-900 text-[6px] text-white px-1 py-0 h-3 border-none">CORE</Badge>
             )}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            {renderString(entity.labelPlural || entity.label)}
          </h3>
          {renderContent()}
        </div>

        <div className="absolute right-4 bottom-4 p-2 bg-slate-100 dark:bg-white/10 rounded-full text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0">
          <ArrowRight size={14} />
        </div>
      </div>
    </Card>
  );
}
