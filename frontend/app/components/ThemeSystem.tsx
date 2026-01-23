import React, { useState, useEffect } from "react";
import { Moon, Sun, Laptop, Palette, Save, RotateCcw, X, Keyboard, Layers, ArrowRight, Check, Zap, Pin, LayoutGrid } from "lucide-react";
import { useParams } from "react-router";
import { renderString } from "~/lib/utils";
import { useConfig } from '~/hooks/useConfig';
import { useTheme, type CustomTheme } from '~/hooks/useTheme';
import { Button } from "./ui/button";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { resolveIcon } from "~/lib/icons";

// --- Presets ---

const THEME_PRESETS: Record<string, CustomTheme> = {
  light: {
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#f59e0b',
    background: '#f8fafc',
    surface: '#ffffff',
    foreground: '#0f172a',
    radius: '0.75rem',
    shadowIntensity: 'soft'
  },
  dark: {
    primary: '#60a5fa',
    secondary: '#94a3b8',
    accent: '#fbbf24',
    background: '#020617',
    surface: '#0f172a',
    foreground: '#f8fafc',
    radius: '0.75rem',
    shadowIntensity: 'strong'
  },
  ocean: {
    primary: '#0ea5e9',
    secondary: '#64748b',
    accent: '#2dd4bf',
    background: '#f0f9ff',
    surface: '#ffffff',
    foreground: '#0c4a6e',
    radius: '1rem',
    shadowIntensity: 'soft'
  },
  sunset: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    accent: '#fbbf24',
    background: '#fff1f2',
    surface: '#ffffff',
    foreground: '#4c0519',
    radius: '1.25rem',
    shadowIntensity: 'soft'
  },
  forest: {
    primary: '#10b981',
    secondary: '#34d399',
    accent: '#84cc16',
    background: '#f0fdf4',
    surface: '#ffffff',
    foreground: '#064e3b',
    radius: '0.5rem',
    shadowIntensity: 'soft'
  },
  midnight: {
    primary: '#818cf8',
    secondary: '#a5b4fc',
    accent: '#e879f9',
    background: '#0f172a',
    surface: '#1e293b',
    foreground: '#f1f5f9',
    radius: '0.375rem',
    shadowIntensity: 'strong'
  }
};

// --- ThemeToggle Component ---

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
      <Button variant={theme === "light" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setTheme("light")}>
        <Sun size={16} />
      </Button>
      <Button variant={theme === "dark" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setTheme("dark")}>
        <Moon size={16} />
      </Button>
      <Button variant={theme === "system" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setTheme("system")}>
        <Laptop size={16} />
      </Button>
    </div>
  );
}

// --- ThemeEditor Component ---

export function ThemeEditor({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useParams();
  const { customTheme, updateCustomTheme, theme: currentMode, setTheme: setMode } = useTheme();
  const { t } = useTranslation(['common', 'settings']);
  const [theme, setTheme] = useState<CustomTheme>(THEME_PRESETS.light);
  const [activeTab, setActiveTab] = useState<'visual' | 'shortcuts' | 'presets' | 'sidebar'>('presets');
  const [loading, setLoading] = useState(true);
  const { entity, uiConfig, navigation } = useConfig();

  useEffect(() => {
    if (isOpen) {
      if (customTheme) {
        setTheme(customTheme);
      }
      setLoading(false);
    }
  }, [isOpen, customTheme]);

  const handleSave = () => {
    updateCustomTheme(theme, true);
    toast.success(renderString(t('settings:theme_saved_success'), lang));
    onClose();
  };

  const applyPreset = (presetKey: string) => {
    const preset = THEME_PRESETS[presetKey];
    if (preset) {
      const newTheme = { ...preset };
      setTheme(newTheme);
      updateCustomTheme(newTheme, false); // Active preview
      
      // If we pick a preset like 'dark' or 'midnight', we might want to switch the mode too
      if (['dark', 'midnight'].includes(presetKey)) {
        setMode('dark');
      } else if (['light', 'ocean', 'sunset', 'forest'].includes(presetKey)) {
        setMode('light');
      }
    }
  };

  const updateShortcut = (action: string, key: string) => {
    let currentShortcuts = theme.shortcuts || uiConfig.shortcuts || [];
    const exists = currentShortcuts.some((s: any) => s.action === action);
    let newShortcuts;
    if (exists) {
      newShortcuts = currentShortcuts.map((s: any) => s.action === action ? { ...s, key: key.toLowerCase() } : s);
    } else {
      const isNav = action.startsWith('nav:');
      const isNew = action.startsWith('new:');
      const isList = action.startsWith('list:');
      const entityId = action.replace(isNav ? 'nav:' : (isNew ? 'new:' : 'list:'), '');
      const entityDef = entity[entityId];
      
      let label: any = action;
      if (isList) {
        label = { 
          ro: `Listă completă: ${renderString(entityDef?.labelPlural || entityDef?.label, 'ro') || entityId}`,
          en: `Full list: ${renderString(entityDef?.labelPlural || entityDef?.label, 'en') || entityId}`
        };
      } else if (isNav) {
        label = { 
          ro: `Navigare către ${renderString(entityDef?.labelPlural || entityDef?.label, 'ro') || entityId}`,
          en: `Navigate to ${renderString(entityDef?.labelPlural || entityDef?.label, 'en') || entityId}`
        };
      } else if (isNew) {
        label = { 
          ro: `Adăugare ${renderString(entityDef?.label, 'ro') || entityId}`,
          en: `Add new ${renderString(entityDef?.label, 'en') || entityId}`
        };
      }

      newShortcuts = [...currentShortcuts, {
        action: action as any,
        key: key.toLowerCase(),
        ctrlKey: true,
        label
      }];
    }
    const newTheme = { ...theme, shortcuts: newShortcuts };
    setTheme(newTheme);
    updateCustomTheme(newTheme, false); // Update live for potential shortcut triggers
  };

  const toggleSidebarPin = (itemId: string, itemData: any) => {
    let currentPins = theme.sidebarShortcuts || [];
    const isPinned = currentPins.some((p: any) => p.id === itemId);
    
    let newPins;
    if (isPinned) {
        newPins = currentPins.filter((p: any) => p.id !== itemId);
    } else {
        newPins = [...currentPins, { 
            id: itemId, 
            label: itemData.label, 
            icon: itemData.icon, 
            path: itemData.path,
            priority: (currentPins.length + 1) * 10
        }];
    }
    
    const newTheme = { ...theme, sidebarShortcuts: newPins };
    setTheme(newTheme);
    updateCustomTheme(newTheme, false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-hidden rounded-2xl gap-0 border-none shadow-2xl flex flex-col bg-white dark:bg-slate-900" showCloseButton={false}>
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-950/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Palette size={20} /></div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-800 dark:text-white">{renderString(t('settings:theme_editor') || t('common:theme_editor'), lang)}</DialogTitle>
              <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">{renderString(t('settings:advanced_ui_config'), lang)}</DialogDescription>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} className="text-gray-500 dark:text-gray-400" /></button>
        </div>

        <div className="flex bg-gray-100/50 dark:bg-slate-900/50 p-1 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
          <button onClick={() => setActiveTab('presets')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'presets' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <Layers size={14} /> {renderString(t('settings:theme_presets_label'), lang)}
          </button>
          <button onClick={() => setActiveTab('visual')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'visual' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <Palette size={14} /> {renderString(t('settings:theme_custom_colors'), lang)}
          </button>
          <button onClick={() => setActiveTab('shortcuts')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'shortcuts' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <Keyboard size={14} /> {renderString(t('settings:theme_shortcuts'), lang)}
          </button>
          <button onClick={() => setActiveTab('sidebar')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'sidebar' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <Pin size={14} /> {renderString(t('settings:theme_sidebar'), lang)}
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-white dark:bg-slate-900">
          {activeTab === 'presets' ? (
            <div className="space-y-8">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">{t('settings:select_theme')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings:theme_select_desc')}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                  <button 
                    key={key} 
                    onClick={() => applyPreset(key)}
                    className={cn(
                      "group relative p-4 rounded-2xl border-2 transition-all text-left",
                      theme.primary === preset.primary && theme.background === preset.background
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10" 
                        : "border-gray-100 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">{key}</span>
                      {theme.primary === preset.primary && theme.background === preset.background && (
                        <div className="p-1 bg-blue-500 text-white rounded-full"><Check size={10} /></div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: preset.primary }} />
                        <div className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: preset.secondary }} />
                        <div className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: preset.accent }} />
                      </div>
                      <div className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all bg-white dark:bg-slate-900" style={{ backgroundColor: preset.surface, borderRadius: preset.radius }}>
                        <div className="h-2 w-1/2 rounded-full mb-2" style={{ backgroundColor: preset.primary + '30' }} />
                        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-800" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-8 border-t border-gray-100 dark:border-slate-800">
                <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">{renderString(t('settings:theme_mode'), lang)}</h3>
                    <div className="flex gap-4">
                        {[
                            { id: 'light', icon: Sun, label: renderString(t('settings:mode_light'), lang) },
                            { id: 'dark', icon: Moon, label: renderString(t('settings:mode_dark'), lang) },
                            { id: 'system', icon: Laptop, label: renderString(t('settings:mode_system'), lang) }
                        ].map((m) => (
                            <button 
                                key={m.id}
                                onClick={() => setMode(m.id as any)}
                                className={cn(
                                    "flex-1 flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                                    currentMode === m.id 
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                                        : "border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 text-gray-500 dark:text-gray-400"
                                )}
                            >
                                <m.icon size={20} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'visual' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">{t('settings:main_colors')}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <ColorInput label={t('settings:primary')} value={theme.primary} onChange={v => { const nt = {...theme, primary: v}; setTheme(nt); updateCustomTheme(nt, false); }} />
                    <ColorInput label={t('settings:secondary')} value={theme.secondary} onChange={v => { const nt = {...theme, secondary: v}; setTheme(nt); updateCustomTheme(nt, false); }} />
                    <ColorInput label={t('settings:accent')} value={theme.accent} onChange={v => { const nt = {...theme, accent: v}; setTheme(nt); updateCustomTheme(nt, false); }} />
                  </div>
                </div>
                <div className="pt-4">
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">{t('settings:background_colors')}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <ColorInput label={t('settings:page_bg')} value={theme.background} onChange={v => { const nt = {...theme, background: v}; setTheme(nt); updateCustomTheme(nt, false); }} />
                    <ColorInput label={t('settings:surface')} value={theme.surface} onChange={v => { const nt = {...theme, surface: v}; setTheme(nt); updateCustomTheme(nt, false); }} />
                    <ColorInput label={t('settings:text')} value={theme.foreground} onChange={v => { const nt = {...theme, foreground: v}; setTheme(nt); updateCustomTheme(nt, false); }} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">{t('settings:aspect_layout')}</h3>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t('settings:border_radius')} ({theme.radius})</label>
                      <input type="range" min="0" max="2" step="0.1" value={parseFloat(theme.radius || '0.75')} onChange={e => setTheme({...theme, radius: `${e.target.value}rem`})} className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-black">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">{t('settings:width')}</label>
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                          <button onClick={() => setTheme({...theme, layout: 'boxed'})} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${theme.layout === 'boxed' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>Boxed</button>
                          <button onClick={() => setTheme({...theme, layout: 'fluid'})} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${theme.layout === 'fluid' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>Fluid</button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase font-bold">{t('settings:density')}</label>
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                          <button onClick={() => setTheme({...theme, density: 'comfortable'})} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${theme.density === 'comfortable' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>{renderString({ ro: 'Normal', en: 'Normal' }, lang)}</button>
                          <button onClick={() => setTheme({...theme, density: 'compact'})} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${theme.density === 'compact' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>{renderString({ ro: 'Compact', en: 'Compact' }, lang)}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 font-bold">{renderString({ ro: 'Efecte Sidebar', en: 'Sidebar Effects' }, lang)}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{renderString({ ro: 'Efect Sticlă', en: 'Glass Effect' }, lang)}</label>
                      <button 
                        onClick={() => setTheme({...theme, sidebarGlass: !theme.sidebarGlass})}
                        className={`w-8 h-4 rounded-full transition-colors relative ${theme.sidebarGlass ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${theme.sidebarGlass ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t('settings:collapsed_sidebar')}</label>
                      <button 
                        onClick={() => setTheme({...theme, sidebarCollapsed: !theme.sidebarCollapsed})}
                        className={`w-8 h-4 rounded-full transition-colors relative ${theme.sidebarCollapsed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${theme.sidebarCollapsed ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                     <div className="space-y-2 text-black">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t('settings:shadows')}</label>
                      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                        {(['none', 'soft', 'strong'] as const).map((s) => (
                           <button 
                             key={s}
                             onClick={() => setTheme({...theme, shadowIntensity: s})} 
                             className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${theme.shadowIntensity === s ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                           >
                            {t(`settings:shadows_${s}`)}
                           </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 text-black">
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 font-bold">{t('settings:scrollbar')}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <ColorInput label={renderString({ ro: 'Glisor', en: 'Thumb' }, lang)} value={theme.scrollbarThumb || ''} onChange={v => setTheme({...theme, scrollbarThumb: v})} />
                    <ColorInput label={renderString({ ro: 'Cale', en: 'Track' }, lang)} value={theme.scrollbarTrack || ''} onChange={v => setTheme({...theme, scrollbarTrack: v})} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('settings:preview')}</h3>
                <div className="bg-gray-50 dark:bg-slate-950/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 space-y-6">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: theme.primary }} />
                    <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: theme.secondary }} />
                    <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: theme.accent }} />
                  </div>
                  <div className="p-4 border dark:border-slate-800 bg-white dark:bg-slate-900" style={{ borderRadius: theme.radius }}>
                    <div className="h-2 w-1/2 rounded mb-3" style={{ backgroundColor: theme.primary + '20' }} />
                    <h4 className="text-xs font-bold mb-2 text-gray-800 dark:text-white">Exemplu Card</h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 opacity-70 mb-4">Previzualizarea stilului ales.</p>
                    <button className="w-full py-2 text-[10px] font-bold text-white shadow-lg" style={{ backgroundColor: theme.primary, borderRadius: `calc(${theme.radius} * 0.5)` }}>Buton</button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'shortcuts' ? (
              <div className="space-y-8 h-full flex flex-col">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1 font-bold">{t('settings:theme_shortcuts')}</h3>
                  <p className="text-[10px] text-gray-500 mb-4">{renderString({ ro: 'Aceste scurtături folosesc tasta CTRL + tasta definită.', en: 'These shortcuts use the CTRL key + the defined key.' }, lang)}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(theme.shortcuts || uiConfig.shortcuts || []).length === 0 ? (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-2xl bg-gray-50/50 dark:bg-slate-950/20">
                          <Keyboard size={40} className="mb-4 opacity-20" />
                          <p className="text-sm font-medium">{renderString({ ro: 'Nicio scurtătură configurată.', en: 'No shortcuts configured.'}, lang)}</p>
                          <p className="text-[10px] mt-1">{renderString({ ro: 'Acestea se încarcă din setările globale.', en: 'These are loaded from global settings.' }, lang)}</p>
                      </div>
                    ) : (
                      (theme.shortcuts || uiConfig.shortcuts || []).map((s: any) => (
                        <div key={s.action} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/40 group">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600">
                                <Zap size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 block">{renderString(s.label, lang)}</span>
                              <span className="text-[9px] text-gray-400 font-mono uppercase tracking-tighter">{s.action}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md text-[9px] font-black shadow-inner">CTRL</span>
                            <span className="text-gray-300">+</span>
                            <input 
                              type="text" 
                              maxLength={1} 
                              value={s.key} 
                              onChange={(e) => updateShortcut(s.action, e.target.value)} 
                              className="w-9 h-9 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white shadow-sm" 
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
          ) : activeTab === 'sidebar' ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white">{renderString(t('settings:theme_sidebar'), lang)}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {renderString(t('settings:theme_sidebar_desc'), lang)}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(entity).map(([id, config]: [string, any]) => {
                    const isPinned = (theme.sidebarShortcuts || []).some((p: any) => p.id === id);
                    const Icon = resolveIcon(config.icon);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleSidebarPin(id, {
                          label: config.labelPlural || config.label,
                          icon: config.icon,
                          path: `/${id}`
                        })}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border-2 transition-all group",
                          isPinned
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                            : "border-gray-50 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                        )}
                      >
                        <div className="flex items-center gap-3 text-black dark:text-white">
                          <div className={cn("p-2 rounded-lg transition-colors", isPinned ? "bg-amber-100 dark:bg-amber-800/40 text-amber-600" : "bg-gray-100 dark:bg-slate-800 group-hover:bg-gray-200 text-slate-500")}>
                            <Icon size={16} />
                          </div>
                          <span className="text-xs font-bold">{renderString(config.labelPlural || config.label, lang)}</span>
                        </div>
                        <Pin size={14} className={cn("transition-all", isPinned ? "opacity-100 rotate-45 text-amber-500" : "opacity-20 group-hover:opacity-100")} />
                      </button>
                    );
                  })}
                </div>
              </div>
          ) : null}
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-950 flex-shrink-0">
          <button onClick={() => { 
              const lightPreset = THEME_PRESETS.light;
              setTheme(lightPreset);
              updateCustomTheme(lightPreset, false);
              setMode('light');
          }} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><RotateCcw size={16} /> {t('common:reset')}</button>
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg transition-transform active:scale-95"> <Save size={18} /> {t('common:save')} </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safeColor = (value && value.startsWith('#')) ? value : '#000000';
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{label}</label>
      <div className="flex items-center gap-2 p-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
        <input type="color" value={safeColor} onChange={e => onChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 text-xs font-mono outline-none bg-transparent dark:text-white" placeholder="#000000" />
      </div>
    </div>
  );
}

