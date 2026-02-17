import type { Route } from "./+types/($lang)._app._index";
import React, { useEffect, useState } from 'react';
import { useConfig } from '~/hooks/useConfig';
import { Link, useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { IconMap } from '~/lib/icons';
import { Activity, LayoutDashboard, Sparkles, Database, ArrowRight, UserPlus, Mail, CheckSquare, HardDrive, Cpu, Zap, RefreshCw, MessageSquare, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { localAgentApi, api, socketRequest } from '~/lib/core';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { resolveCollection, cn, normalizeEntity, normalizeFormData, renderString } from '~/lib/core';
import { useAuth } from '~/hooks/useAuth';
import { EntityWidget } from '~/components/dashboard/EntityWidget';
import { UnifiedActivityFeed } from '~/components/dashboard/UnifiedActivityFeed';

/**
 * LOGICA DE SERVER - Mega-Route Pattern
 */
export async function loader({ request, context, params }: Route.LoaderArgs) {
  return {};
}

export default function Dashboard() {
  const { entity: configMap, uiConfig, constants } = useConfig();
  const { user, hasPermission, hasPageAccess } = useAuth();
  const { lang = 'ro' } = useParams();
  const { t, i18n } = useTranslation(['common', 'entity', 'dashboard']);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [activity, setActivity] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [aiJobs, setAiJobs] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const dashboardConfig = constants?.DASHBOARD || {};
  const cards = dashboardConfig.cards || [];
  const currentLang = (i18n.language || lang) as 'ro' | 'en';
  
  const welcomeText = dashboardConfig.welcomeMessage?.[currentLang] || t('dashboard:welcome');

  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem('token');
        if (!token && !import.meta.env.DEV) {
           setLoading(false);
           return;
        }

        const canReadAudit = hasPermission('audit_log', 'read');
        const canViewMonitoring = hasPageAccess('monitoring');

        // Use Socket.IO for monitoring and Brain API for Audit Logs (Enterprise Level 10)
        const [statsRes, auditRes, healthRes, todosRes, workersRes] = await Promise.allSettled([
          canViewMonitoring 
            ? socketRequest("monitoring:db", { withRecent: true }).catch(() => ({ success: false }))
            : Promise.resolve({ success: true, data: { tables: [] } } as any),
          canReadAudit 
            ? api.brain.get(`db/audit_log?limit=15&workspaceId=${user?.workspaceId || 'system'}`).catch(() => ({ success: false, data: [] }))
            : Promise.resolve({ success: true, data: [] } as any),
          canViewMonitoring
            ? socketRequest("monitoring:workers").catch(() => ({ success: false }))
            : Promise.resolve({ success: true, data: [] } as any),
          socketRequest("monitoring:todos").catch(() => ({ success: false })),
          api.brain.get(`db/worker?limit=10`).catch(() => ({ success: false, data: [] }))
        ]);
        
        // Map monitoring:db table data to entity stats format
        const dbData = statsRes.status === 'fulfilled' && statsRes.value?.data?.tables 
          ? statsRes.value.data.tables.reduce((acc: any, t: any) => {
              // Find the entity definition for this table
              const entityName = Object.keys(configMap).find(key => resolveCollection(key) === t.table);
              const entityDef = entityName ? configMap[entityName] : null;
              
              // Normalize recent data to prevent React rendering errors
              const normalizedRecent = entityDef && Array.isArray(t.recent) 
                ? t.recent.map((item: any) => normalizeFormData(item, entityDef.fields || []))
                : (t.recent || []);
              
              acc[t.table] = { total: t.counts?.local || 0, recentData: normalizedRecent };
              return acc;
            }, {})
          : {};
        
        setStats(dbData);
        
        // Activity from Audit Logs
        const activityData = auditRes.status === 'fulfilled' && Array.isArray(auditRes.value)
          ? auditRes.value
          : [];
        setActivity(activityData);
        
        // Health from workers status
        const workersData = healthRes.status === 'fulfilled' ? healthRes.value?.data : null;
        setHealth(workersData);

        // Workers from Brain Entity (Level 11)
        const v3Workers = workersRes.status === 'fulfilled' && Array.isArray(workersRes.value)
          ? workersRes.value
          : [];
        setWorkers(v3Workers);

        // AI Jobs (Level 11)
        const jobs = await api.brain.get(`db/ai_task?limit=5&sortBy=createdAt&sortOrder=DESC`).catch(() => []);
        setAiJobs(Array.isArray(jobs) ? jobs : []);
        
        // Todos
        const todosData = todosRes.status === 'fulfilled' && Array.isArray(todosRes.value?.data)
          ? todosRes.value.data
          : [];
        setTodos(todosData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [lang, user]);

  const handleRestartWorkers = async () => {
    try {
      if (!confirm(t('dashboard:confirm_restart'))) return;
      
      const resp = await api.local.post('system/control/restart-workers');
      if (resp.data?.success) {
        toast.success(t('dashboard:workers_restarting'));
        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (e) {
      toast.error(t('dashboard:restart_failed'));
    }
  };

  const handleToggleWorker = async (id: string) => {
    try {
      const resp = await api.brain.action('worker', 'toggle', { id });
      if (resp.success) {
        toast.success(t('dashboard:worker_updated'));
        // Refresh workers list
        const updated = await api.brain.get(`db/worker?limit=10`);
        if (Array.isArray(updated)) setWorkers(updated);
      }
    } catch (e: any) {
      toast.error(e.message || 'Eroare la comutare worker');
    }
  };

  const dashboardWidgets = Object.entries(configMap || {})
    .map(([name, def]) => normalizeEntity({ ...def, name }))
    .filter(ent => {
      // Enterprise Level 10: Dynamic Widget Eligibility Resolution
      // showInDashboard is an optional secondary override (defaulting to true if enabled)
      const isEnabled = ent.dashboardConfig?.enabled !== false;
      const isVisibilityOverridden = ent.dashboardConfig?.showInDashboard === false;
      return isEnabled && !isVisibilityOverridden;
    })
    .sort((a, b) => (a.dashboardConfig?.priority ?? 99) - (b.dashboardConfig?.priority ?? 99));

  return (
    <div className="space-y-6 animate-in fade-in duration-700 p-2 md:p-4 pb-20">
      {/* Dashboard Icons Row */}
      <div className="flex items-center justify-end gap-2">
          <WorkerStatusBadge name="WhatsApp" status={health?.workerStatus?.whatsapp?.status} />
          <WorkerStatusBadge name="Gmail" status={health?.workerStatus?.gmail?.status} />
          <WorkerStatusBadge name="Printer" status={health?.workerStatus?.print?.status} />
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionLink to={`/${lang}/contact/new`} icon={<UserPlus className="w-4 h-4" />} label={t('dashboard:new_contact')} color="blue" />
          <QuickActionLink to={`/${lang}/comms`} icon={<Mail className="w-4 h-4" />} label={t('dashboard:comms')} color="purple" />
          <QuickActionLink to={`/${lang}/todos/new`} icon={<CheckSquare className="w-4 h-4" />} label={t('dashboard:add_task')} color="green" />
          <QuickActionLink to={`/${lang}/printing`} icon={<Zap className="w-4 h-4" />} label={t('dashboard:print_now')} color="orange" />
      </div>

      {/* Enterprise Level 10: Dynamic Modular Dashboard Engine */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardWidgets.map((entityDef) => {
          const tableName = resolveCollection(entityDef.name);
          return (
            <EntityWidget 
              key={entityDef.name}
              entity={entityDef} 
              stats={stats[tableName]}
              loading={loading}
            />
          );
        })}
      </div>

      {/* Activity Flow & AI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-full">
            <UnifiedActivityFeed logs={activity} loading={loading} />
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-sm shadow-indigo-100 bg-indigo-600 text-white overflow-hidden relative">
               <CardHeader>
                 <CardTitle className="text-white">{t('dashboard:ai_assistant')}</CardTitle>
                 <CardDescription className="text-indigo-100">{t('dashboard:ai_assistant_desc')}</CardDescription>
               </CardHeader>
               <CardContent>
                 <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl border-none shadow-lg">
                   {t('dashboard:ask_ai')}
                 </Button>
               </CardContent>
               <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-white/10" />
            </Card>

            <Card className="border-none shadow-sm border border-gray-100">
               <CardHeader className="pb-4">
                 <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-green-600" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">{t('dashboard:system_health')}</CardTitle>
                 </div>
               </CardHeader>
               <CardContent className="space-y-6">
                  <HealthIndicator 
                    icon={<Cpu className="w-3 h-3" />} 
                    label="CPU" 
                    value={health?.cpu || 0} 
                    color="blue"
                  />
                  <HealthIndicator 
                    icon={<Activity className="w-3 h-3" />} 
                    label="RAM" 
                    value={health?.ram?.percent || 0} 
                    color="purple"
                    detail={`${((health?.ram?.total - health?.ram?.free) / (1024 * 1024 * 1024)).toFixed(1)}GB / ${(health?.ram?.total / (1024 * 1024 * 1024)).toFixed(1)}GB`}
                  />
                  <HealthIndicator 
                    icon={<HardDrive className="w-3 h-3" />} 
                    label="STORAGE" 
                    value={health?.storage || 0} 
                    color="orange"
                  />
                 
                 <div className="pt-4 border-t border-gray-50 flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      className="w-full text-[10px] font-bold uppercase tracking-widest h-9 rounded-xl border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
                      onClick={handleRestartWorkers}
                    >
                      <RefreshCw className="w-3 h-3 mr-2" />
                      {t('dashboard:restart_services')}
                    </Button>
                    <p className="text-[9px] text-gray-400 text-center italic">
                        {t('dashboard:last_update')}: {health?.timestamp ? new Date(Number(health.timestamp)).toLocaleTimeString() : 'N/A'}
                    </p>
                 </div>
               </CardContent>
            </Card>

            <AiAutonomousCard jobs={aiJobs} />

            <WorkerStatusCard 
              workers={workers} 
              loading={loading} 
              onToggle={handleToggleWorker} 
            />

            <Card className="border-none shadow-sm border border-gray-100">
               <CardHeader className="pb-4 flex flex-row items-center justify-between">
                 <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-orange-600" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">{t('dashboard:pending_tasks')}</CardTitle>
                 </div>
                 <Badge className="bg-orange-50 text-orange-600 border-none font-bold">{todos.length}</Badge>
               </CardHeader>
               <CardContent className="px-0 pb-0">
                  {todos.length > 0 ? (
                    <div className="divide-y divide-gray-50 max-h-[250px] overflow-y-auto scrollbar-hide">
                      {todos.map((todo, i) => (
                        <div key={i} className="px-6 py-3 hover:bg-gray-50/50 transition-colors">
                           <div className="text-[11px] font-bold text-gray-900 truncate">{renderString(todo.title, lang)}</div>
                           <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${todo.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                {todo.priority || 'normal'}
                              </span>
                              <span className="text-[8px] text-gray-400 font-medium">#{todo.id.split('_').pop()}</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-[10px] font-bold text-gray-300 uppercase italic">
                       {t('dashboard:all_done')}
                    </div>
                  )}
                  <div className="p-4 border-t border-gray-50">
                    <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest h-8 rounded-xl border-dashed" asChild>
                       <Link to={`/${lang}/task`}>{t('dashboard:manage_todos')}</Link>
                    </Button>
                  </div>
               </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}

function QuickActionLink({ to, icon, label, color }: { to: string, icon: any, label: string, color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white',
    purple: 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-600 hover:text-white',
    green: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-600 hover:text-white',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white'
  };

  return (
    <Link to={to} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 font-bold text-xs uppercase tracking-widest ${colors[color]}`}>
      {icon}
      {label}
    </Link>
  );
}

function HealthIndicator({ icon, label, value, color, detail }: { icon: any, label: string, value: number, color: string, detail?: string }) {
  const barColors: Record<string, string> = {
    blue: 'bg-blue-500 shadow-blue-500/50',
    purple: 'bg-purple-500 shadow-purple-500/50',
    orange: 'bg-orange-500 shadow-orange-500/50',
    green: 'bg-green-500 shadow-green-500/50'
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-0.5">
        <div className="flex items-center gap-1.5 text-gray-500">
          {icon}
          <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
        </div>
        <div className="flex items-center gap-2">
           {detail && <span className="text-[10px] font-medium text-gray-400">{detail}</span>}
           <span className="text-[10px] font-black">{Math.round(value)}%</span>
        </div>
      </div>
      <div className="w-full bg-gray-50 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden border border-gray-100/50">
        <div 
          className={`h-full rounded-full transition-all duration-1000 shadow-sm ${barColors[color]}`} 
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }} 
        />
      </div>
    </div>
  );
}

function WorkerStatusBadge({ name, status }: { name: string, status?: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-50 text-green-700 border-green-100',
    online: 'bg-green-50 text-green-700 border-green-100',
    stopped: 'bg-gray-100 text-gray-500 border-gray-200',
    error: 'bg-red-50 text-red-700 border-red-100',
    loading: 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse'
  };

  const statusColor = (status?.toLowerCase() === 'running' || status?.toLowerCase() === 'online') ? colors.running : (status?.toLowerCase() === 'stopped' ? colors.stopped : (status?.toLowerCase() === 'error' ? colors.error : colors.stopped));

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${statusColor}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${statusColor.split(' ')[1].replace('text-', '')}`} />
      {name}
    </div>
  );
}

function WorkerStatusCard({ workers, loading, onToggle }: { workers: any[], loading: boolean, onToggle: (id: string) => void }) {
  const { t } = useTranslation(['dashboard']);
  
  return (
     <Card className="border-none shadow-sm border border-gray-100">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
             <Cpu className="w-4 h-4 text-blue-600" />
             <CardTitle className="text-sm font-bold uppercase tracking-wider">{t('dashboard:workers_title')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
           {loading ? (
             <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-50 animate-pulse rounded-lg" />)}
             </div>
           ) : workers.length > 0 ? (
             <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto scrollbar-hide">
               {workers.map((w) => (
                 <div key={w.id} className="px-6 py-3 hover:bg-gray-50/50 transition-all group">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={cn(
                             "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                             w.status === 'running' ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
                          )}>
                             <WorkerIcon type={w.type} className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="text-[11px] font-bold text-gray-900 leading-tight truncate">{w.name}</div>
                             <div className="text-[9px] text-gray-400 font-medium uppercase tracking-tighter mt-0.5">
                                {w.type} • {w.lastPulse ? new Date(w.lastPulse).toLocaleTimeString() : 'N/A'}
                             </div>
                          </div>
                       </div>
                       
                       <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onToggle(w.id)}
                       >
                          {w.status === 'running' ? <Zap className="w-3 h-3 text-yellow-500" /> : <RefreshCw className="w-3 h-3" />}
                       </Button>
                    </div>
                    {w.error && (
                       <div className="mt-2 text-[8px] text-red-500 font-medium bg-red-50/50 p-1.5 rounded-lg border border-red-100/50 truncate">
                          {w.error}
                       </div>
                    )}
                 </div>
               ))}
             </div>
           ) : (
             <div className="p-8 text-center text-[10px] font-bold text-gray-300 uppercase italic">
                {t('dashboard:no_workers')}
             </div>
           )}
        </CardContent>
     </Card>
  );
}

function AiAutonomousCard({ jobs }: { jobs: any[] }) {
  const { t } = useTranslation(['dashboard']);
  
  return (
    <Card className="border-none shadow-sm border border-gray-100 overflow-hidden">
      <CardHeader className="pb-4 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600 animate-pulse" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Agent Autonom v11</CardTitle>
          </div>
          <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700 border-indigo-100 italic">Self-Healing</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-[10px] font-bold text-gray-300 uppercase italic">
            Niciun task în curs
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto scrollbar-hide">
            {jobs.map((job) => (
              <div key={job.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-gray-900 truncate max-w-[150px]">{job.prompt || 'Misiune AI'}</span>
                  <Badge variant="secondary" className={cn(
                    "text-[8px] font-black uppercase px-1.5 h-4",
                    job.status === 'completed' && "bg-green-50 text-green-700 border-green-100",
                    job.status === 'running' && "bg-blue-50 text-blue-700 border-blue-100 animate-pulse",
                    job.status === 'failed' && "bg-red-50 text-red-700 border-red-100",
                    job.status === 'pending' && "bg-gray-50 text-gray-500 border-gray-100"
                  )}>
                    {job.status}
                  </Badge>
                </div>
                <p className="text-[9px] text-gray-500 font-medium line-clamp-1">{job.prompt}</p>
                {job.error && (
                  <div className="mt-1 text-[8px] text-red-500 font-medium bg-red-50/50 p-1 rounded-lg border border-red-100/50 truncate">
                    {job.error}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                   <span className="text-[8px] text-gray-400 font-bold uppercase">{new Date(job.createdAt).toLocaleTimeString()}</span>
                   {job.status === 'completed' && <CheckSquare className="w-3 h-3 text-green-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkerIcon({ type, className }: { type: string, className?: string }) {
   if (type === 'whatsapp') return <MessageSquare className={className} />;
   if (type === 'gmail') return <Mail className={className} />;
   if (type === 'indexer') return <Database className={className} />;
   if (type === 'proxy') return <Zap className={className} />;
   return <Cpu className={className} />;
}

