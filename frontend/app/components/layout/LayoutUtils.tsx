import React, { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ChevronRight, Home, Bug, Send, AlertCircle } from 'lucide-react';
import { getNavItemByPath } from '~/lib/core';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { cn, getLocalizedPath, api, renderString } from '~/lib/core';
import { useAuth } from '~/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

// ============================================================================
// BREADCRUMBS COMPONENT
// ============================================================================

export function Breadcrumbs() {
  const location = useLocation();
  const { entities } = useConfig();
  const { t } = useTranslation();
  const { lang, ...params } = useParams();

  let pathnames = location.pathname.split('/').filter((x) => x);
  
  // If first segment is language, skip it for crumbs
  if (lang && pathnames[0] === lang) {
    pathnames = pathnames.slice(1);
  }
  
  if (pathnames.length === 0) return null;

  return (
    <nav className="flex items-center text-sm text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <Link 
        to={getLocalizedPath("/", lang)} 
        className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
      >
        <Home size={14} />
      </Link>

      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = getLocalizedPath(`/${pathnames.slice(0, index + 1).join('/')}`, lang);
        
        // Try to translate / find label
        let label = value;
        
        // 1. Check navigation config
        const navItem = getNavItemByPath(to);
        if (navItem) {
          label = t(navItem.label);
        } 
        // 2. Check entities config (if it's a defined entity list)
        else if (entities[value]) {
          label = entities[value].labelPlural || entities[value].label || value;
        }
        // 3. Check if it's a dynamic parameter (e.g. recordId)
        else if (params.recordId === value) {
          label = value; // Could potentially fetch record name here
        }
        else if (params.id === value && !entities[value]) {
          label = value;
        }
        
        // Handle specific segments
        if (value === 'entities') return null; // Skip the "entities" segment for cleaner UI

        return (
          <React.Fragment key={to}>
            <ChevronRight size={14} className="mx-1.5 text-slate-300 dark:text-slate-600 shrink-0" />
            {last ? (
              <span className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                {renderString(label)}
              </span>
            ) : (
              <Link 
                to={to} 
                className="hover:text-slate-900 dark:hover:text-white transition-colors truncate max-w-[150px]"
              >
                {renderString(label)}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================================================
// BUG REPORT MODAL COMPONENT
// ============================================================================

export function BugReportModal({ onOpen }: { onOpen?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.error('Te rugăm să completezi toate câmpurile');
      return;
    }

    setLoading(true);
    try {
      const response = await api.brain.post(`/api/db/collection/bug_report/${user?.workspaceId || 'all'}`, {
        title,
        description,
        status: 'new',
        priority: 'medium',
        reported_by: user?.id,
        workspaceId: user?.workspaceId,
        metadata: JSON.stringify({
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });

      if (response.success) {
        toast.success('Raport trimis cu succes! Mulțumim.');
        setTitle('');
        setDescription('');
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error reporting bug:', error);
      toast.error('Eroare la trimiterea raportului');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open && onOpen) onOpen();
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500 transition-colors">
          <Bug size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="text-red-500" size={20} />
            Raportează o Problemă
          </DialogTitle>
          <DialogDescription>
            Trimite-ne detalii despre problema întâmpinată pentru a o putea remedia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titlu Scurt</Label>
            <Input 
              id="title" 
              placeholder="Ex: Nu se încarcă lista de contacte" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descriere Detaliată</Label>
            <Textarea 
              id="description" 
              placeholder="Ce s-a întâmplat? Ce pași ai urmat?" 
              className="min-h-[100px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Vom colecta automat informații despre browser și pagina curentă pentru a ne ajuta să rezolvăm problema mai repede.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? 'Se trimite...' : (
                <>
                  <Send size={16} /> Trimite Raport
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// STATUS INDICATORS COMPONENT
// ============================================================================

interface StatusIndicatorsProps {
  isConnected: boolean;
}

export function StatusIndicators({ isConnected }: StatusIndicatorsProps) {
  return (
    <div className="hidden sm:flex items-center gap-3 mr-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Front</span>
      </div>
      
      <div className="flex items-center gap-1.5">
        <div className="relative flex h-2 w-2">
          {isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Back</span>
      </div>
    </div>
  );
}

