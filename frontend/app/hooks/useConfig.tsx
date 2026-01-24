import { createContext, useContext, useState, useEffect, useRef, type ReactNode, type FC } from 'react';
import i18next from 'i18next';
import { resolveIcon } from '../lib/icons';
import { 
    REGISTRY_BASELINE as STATIC_CONSTANTS
} from '../lib/core';
import { 
    socket, 
    socketRequest, 
    api,
    debounce 
} from '../lib/core';
import { getBrowserDb } from '../lib/core';
import { normalizeEntity } from '../lib/entity-engine';

export interface NavItem {
    id?: string;
    path: string;
    label: any;
    icon?: string;
    priority?: number;
    hidden?: boolean;
    badge?: string;
    permission?: string;
    workerName?: string;
    localAgentOnly?: boolean;
    category?: string;
    action?: () => void;
}

/**
 * Filter and sort navigation items based on permissions and settings
 * (Pure function for use in useAuth or components)
 */
export const filterNavigationItems = (
    items: NavItem[], 
    hasPageAccess: (id: string) => boolean, 
    useLocalAgent: boolean
) => {
    if (!items) return [];
    return items
      .filter(item => {
        if (item.hidden) return false;

        // Condition: If it requires local agent, check it first
        if (item.localAgentOnly === true && !useLocalAgent) return false;

        // Registry-Driven access check
        if (!item.id) return true;
        return hasPageAccess(item.id);
      })
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));
};

const resolveNavIcons = (nav: NavItem[]) => {
    return nav;
};

/**
 * Registry I18N Helper - Syncs Registry translations to i18next
 */
const syncI18n = (i18nData: any) => {
    if (!i18nData || typeof i18nData !== 'object') return;
    
    Object.entries(i18nData).forEach(([lang, data]: [string, any]) => {
        if (!data || typeof data !== 'object') return;
        
        // Detect if data contains namespaces or is flat
        const hasNamespaces = Object.values(data).some(v => v !== null && typeof v === 'object' && !Array.isArray(v));
        
        if (hasNamespaces) {
            Object.entries(data).forEach(([ns, nsData]) => {
                if (nsData && typeof nsData === 'object') {
                    i18next.addResourceBundle(lang, ns, nsData, true, true);
                }
            });
        } else {
            // Flat object treated as 'common' namespace
            i18next.addResourceBundle(lang, 'common', data, true, true);
        }
    });

    // console.log('[I18N] Registry translations synced');
};

const deepMerge = (target: any, source: any) => {
    const result = { ...target };
    if (!source || typeof source !== 'object') return result;
    
    Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    });
    return result;
};

const mergeConstantsIntoEntities = (ents: Record<string, any>, consts: Record<string, any>) => {
    const result: Record<string, any> = {};
    Object.keys(ents).forEach(entityKey => {
        const rawEntity = { ...ents[entityKey] };
        
        // Mark as baseline if it exists in static constants
        if ((STATIC_CONSTANTS.ENTITY_CONFIG as any)?.[entityKey] || (STATIC_CONSTANTS.ENTITY_CONFIG as any)?.[entityKey]) {
            rawEntity.__is_baseline = true;
        }

        // Apply Registry Overrides (if any)
        const registryOverride = consts.ENTITY_CONFIG?.[entityKey] || consts.ENTITY_CONFIG?.[entityKey] || {};
        Object.assign(rawEntity, registryOverride);

        // ENSURE NORMALIZATION (Enterprise Level 8)
        // This generates missing labels, sets defaults, humanizes technical IDs, etc.
        const entity = normalizeEntity({ ...rawEntity, id: entityKey });

        // Extra Logic: Map Options from Constants (Registry-based selection lists)
        if (entity.fields && Array.isArray(entity.fields)) {
            entity.fields.forEach((field: any) => {
                // 1. Map Options from Constants
                if (field.type === 'select' || field.type === 'enum' || field.type === 'selection') {
                    const lookupKey = field.optionsKey || `${entityKey.toUpperCase()}_STATUS`;
                    if (consts[lookupKey]) {
                        // Normalize options so labels are strings (pick current i18n language if label is an object)
                        const rawOptions = consts[lookupKey];
                        const lang = i18next?.language || 'en';
                        field.options = (Array.isArray(rawOptions) ? rawOptions : []).map((opt: any) => {
                            if (typeof opt === 'string') return { value: opt, label: opt };
                            const value = opt.value ?? opt.key ?? opt.id ?? opt;
                            let label = opt.label ?? opt.name ?? value;
                            if (label && typeof label === 'object') {
                                label = label[lang] || label['en'] || Object.values(label)[0];
                            }
                            return { value, label };
                        });
                    } else if (field.name === 'priority' && consts.PRIORITIES) {
                        field.options = consts.PRIORITIES;
                    }
                }

                // 2. Map Dynamic Defaults from Registry
                if (entity.defaults?.[field.name] !== undefined) {
                    field.defaultValue = entity.defaults[field.name];
                }
            });
            
            // Re-sync fieldsMap after potential updates
            entity.fieldsMap = entity.fields.reduce((acc: any, f: any) => ({ ...acc, [f.name]: f }), {});
        }
        
        result[entityKey] = entity;
    });
    return result;
};

// --- INITIAL DEFAULTS (LAZY INIT TO AVOID PROXY WARNINGS) ---
const getInitialConfig = () => {
    // Access Proxy only when called, not at module load
    const nav = STATIC_CONSTANTS.NAV || { main: [], worker: [], admin: [], user: [], entity: [] };
    
    return {
        entity: STATIC_CONSTANTS.ENTITY_CONFIG || STATIC_CONSTANTS.ENTITY_CONFIG || {},
        uiConfig: STATIC_CONSTANTS.THEME || {},
        navigation: {
            main: nav.main || [],
            worker: nav.worker || [],
            entity: nav.entity || [],
            admin: nav.admin || [],
            user: nav.user || [],
            shortcuts: nav.shortcuts || nav.SHORTCUT || []
        },
        constants: STATIC_CONSTANTS
    };
};

interface ConfigContextType {
    entity: Record<string, any>;
    constants: Record<string, any>;
    marketplace: any[];
    uiConfig: any;
    navigation: {
        main: NavItem[];
        worker: NavItem[];
        entity: NavItem[];
        admin: NavItem[];
        user: NavItem[];
        shortcuts: NavItem[];
    };
    loading: boolean;
    isInitialized: boolean;
    buildInfo: any;
    refreshConfig: (force?: boolean) => Promise<void>;
    updateUiConfig: (newUiConfig: any) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [entity, setEntity] = useState<Record<string, any>>(() => getInitialConfig().entity);
    const [constants, setConstants] = useState<Record<string, any>>(() => getInitialConfig().constants);
    const [marketplace, setMarketplace] = useState<any[]>([]);
    const [uiConfig, setUiConfig] = useState<any>(() => getInitialConfig().uiConfig);
    const [navigation, setNavigation] = useState(() => getInitialConfig().navigation);
    const [loading, setLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);

    useEffect(() => {
        if (typeof __APP_VERSION__ !== 'undefined') {
            try {
                setBuildInfo(JSON.parse(__APP_VERSION__));
            } catch (e) {
                console.error('[CONFIG] Failed to parse build info', e);
            }
        }
    }, []);

    const lastFetchTimeRef = useRef(0);
    const isFetchingRef = useRef(false);

    const [autoRefreshEnabled] = useState(true);
    const [canAutoRefresh] = useState(true);

    const applyNavOverrides = (base: any[], overrides?: Record<string, any>) => {
        if (!base) return [];
        return base.map(item => {
            const override = overrides?.[item.id] || {};
            // Keep icon as string name, don't resolve here
            return {
                ...item,
                ...override,
                icon: override.icon || item.icon
            };
        });
    };

    const syncNavigation = (ents: any, dynamicNav: any, ui: any, initial: any) => {
        // Enterprise Level 8: Prioritize fully synthesized navigation from the Brain
        // If dynamicNav (from Server) already has the sections, we just use them and apply overrides.
        const isSynthesized = dynamicNav && (dynamicNav.main || dynamicNav.entity || dynamicNav.admin);

        const baseMain = dynamicNav?.main || initial.navigation.main;
        const baseWorker = dynamicNav?.worker || initial.navigation.worker;
        const baseEntity = dynamicNav?.entity || initial.navigation.entity;
        const baseAdmin = dynamicNav?.admin || initial.navigation.admin;
        const baseShortcuts = dynamicNav?.shortcuts || dynamicNav?.SHORTCUT || initial.navigation.shortcuts;
        const baseUser = dynamicNav?.user || dynamicNav?.USER || initial.navigation.user;

        if (isSynthesized) {
            setNavigation({
                main: applyNavOverrides(baseMain, ui?.navOverrides?.main),
                worker: applyNavOverrides(baseWorker, ui?.navOverrides?.worker),
                entity: applyNavOverrides(baseEntity, ui?.navOverrides?.entity),
                admin: applyNavOverrides(baseAdmin, ui?.navOverrides?.admin),
                user: applyNavOverrides(baseUser, ui?.navOverrides?.user),
                shortcuts: applyNavOverrides(baseShortcuts, ui?.navOverrides?.shortcuts)
            });
            return;
        }

        // --- FALLBACK (Level 7) Synthesis for when server doesn't provide it ---
        const entityNavItems: NavItem[] = Object.entries(ents)
            .filter(([_, config]: [string, any]) => {
                const menuConfig = config.menuConfig || {};
                return menuConfig.showInMainMenu !== false;
            })
            .map(([id, config]: [string, any]) => {
                const menuConfig = config.menuConfig || {};
                const navId = id.startsWith('entity:') ? id : `entity:${id}`;
                return {
                    id: navId,
                    label: config.labelPlural || config.label,
                    path: `/${id}`,
                    icon: menuConfig.icon || config.icon || 'Box',
                    priority: menuConfig.priority ?? 50,
                    category: menuConfig.category || 'data_systems',
                    badge: menuConfig.badge,
                    hidden: config.archived === 1
                };
            });

        const existingIds = new Set([
            ...(baseMain || []).map((i: any) => i.id),
            ...(baseWorker || []).map((i: any) => i.id),
            ...(baseAdmin || []).map((i: any) => i.id)
        ]);

        const filteredEntities = entityNavItems.filter(item => !existingIds.has(item.id));

        const forCat = (cat: string) => filteredEntities.filter(i => {
            const normalizedItemCat = (i.category || '').toLowerCase().replace(/s$/, ''); // normalize plural
            const normalizedQueryCat = cat.toLowerCase().replace(/s$/, '');

            if (normalizedItemCat === normalizedQueryCat) return true;
            if (normalizedQueryCat === 'data_system' && (normalizedItemCat === 'core' || !i.category)) return true;
            if (normalizedQueryCat === 'administration' && normalizedItemCat === 'admin') return true;
            if (normalizedQueryCat === 'main' && (normalizedItemCat === 'main_menu' || normalizedItemCat === 'main')) return true;
            if (normalizedQueryCat === 'worker' && (normalizedItemCat === 'apps_worker' || normalizedItemCat === 'worker')) return true;
            return false;
        });

        setNavigation({
            main: applyNavOverrides([...(baseMain || []), ...forCat('main')], ui?.navOverrides?.main),
            worker: applyNavOverrides([...(baseWorker || []), ...forCat('worker')], ui?.navOverrides?.worker),
            admin: applyNavOverrides([...(baseAdmin || []), ...forCat('administration')], ui?.navOverrides?.admin),
            entity: applyNavOverrides([...(baseEntity || []), ...forCat('data_systems')], ui?.navOverrides?.entity).map(i => ({ ...i, path: i.path || `/${i.id}` })),
            user: applyNavOverrides(baseUser, ui?.navOverrides?.user),
            shortcuts: applyNavOverrides(baseShortcuts, ui?.navOverrides?.shortcuts)
        });
    };

    // Load from IndexedDB on mount and trigger initial refresh
    useEffect(() => {
        const initConfig = async () => {
            const initial = getInitialConfig();
            const db = await getBrowserDb();
            if (!db) {
                // If no local DB, still setup from initial
                setEntity(initial.entity);
                setConstants(STATIC_CONSTANTS);
                return;
            }
            try {
                const cachedEntities = await db.configs.get('all_entities');
                const cachedConstants = await db.configs.get('system_constants');
                const cachedUi = await db.configs.get('ui_config');
                
                if (cachedEntities || cachedConstants || cachedUi) {
                    const mergedConstants = { ...STATIC_CONSTANTS, ...(cachedConstants?.data || {}) };
                    const ui = { ...initial.uiConfig, ...(cachedUi?.data || {}), ...(mergedConstants.THEME || {}) };
                    const mergedEntities = mergeConstantsIntoEntities({ ...initial.entity, ...(cachedEntities?.data || {}) }, mergedConstants);
                    
                    setEntity(mergedEntities);
                    setConstants(mergedConstants);
                    syncI18n(mergedConstants.I18N);
                    setMarketplace(mergedConstants.MARKETPLACE_TEMPLATE || []);
                    setUiConfig(ui);
                    
                    syncNavigation(mergedEntities, mergedConstants.NAV, ui, initial);
                }
            } catch (e) {
                console.warn("[CONFIG] Failed to load from IndexedDB:", e);
            } finally {
                // Mark as initialized even if cache load failed - use static values
                setIsInitialized(true);
                // Keep loading false since we have static values
                setLoading(false);
                // Now trigger the remote refresh in background
                refreshConfig(true);
            }
        };
        initConfig();
    }, []);

    const refreshConfig = async (force = false) => {
        // Build list of constants from session to ensure we have the latest use_local_agent
        // For Enterprise Level 8, we bypass the short throttle (2000ms) if force=true
        if (isFetchingRef.current) {
            console.log('[CONFIG] Already fetching, skipping');
            return;
        }
        if (!force && Date.now() - lastFetchTimeRef.current < 2000) {
            return;
        }

        isFetchingRef.current = true;
        try {
            // Pages + Workers: Load from D1 via Worker endpoint
            // Add cache-buster to bypass any intermediate caching (Enterprise Level 8)
            const response = await api.brain.get(`config?t=${Date.now()}`);
            const result = response?.data || response;
            lastFetchTimeRef.current = Date.now();

            if (result && result.success !== false) {
                const initial = getInitialConfig();
                const mergedConstants = deepMerge(STATIC_CONSTANTS, result.constants || {});
                
                // CRITICAL: Ensure we merge the local storage/session state of uses_local_agent 
                // into mergedConstants so navigation filters react immediately
                if (result.constants?.SYSTEM_SETTING) {
                    mergedConstants.SYSTEM_SETTING = { ...mergedConstants.SYSTEM_SETTING, ...result.constants.SYSTEM_SETTING };
                }

                const ui = deepMerge(initial.uiConfig, deepMerge(result.uiConfig || {}, mergedConstants.THEME || {}));
                const mergedEntities = mergeConstantsIntoEntities(deepMerge(initial.entity, result.entity || {}), mergedConstants);

                // Add dynamic shortcuts from entities
                const entityShortcuts = Object.entries(mergedEntities)
                    .filter(([_, config]: [string, any]) => config.shortcut)
                    .map(([id, config]: [string, any]) => ({
                        ...(config as any).shortcut,
                        action: `nav:${id}`,
                        label: `Navigare ${config.labelPlural || config.label}`
                    }));

                const baseShortcuts = result.constants?.SHORTCUT || mergedConstants.SHORTCUT || [];
                ui.shortcuts = [...baseShortcuts, ...entityShortcuts];

                setEntity(mergedEntities);
                setConstants(mergedConstants);
                syncI18n(mergedConstants.I18N);
                setMarketplace(mergedConstants.MARKETPLACE_TEMPLATE || []);
                setUiConfig(ui);

                syncNavigation(mergedEntities, result.constants?.NAV || mergedConstants.NAV, ui, initial);

                // Cache to IndexedDB
                const db = await getBrowserDb();
                if (db) {
                    await db.configs.put({ id: 'all_entities', data: result.entity, updatedAt: Date.now() });
                    await db.configs.put({ id: 'system_constants', data: result.constants, updatedAt: Date.now() });
                    if (result.uiConfig) {
                        await db.configs.put({ id: 'ui_config', data: result.uiConfig, updatedAt: Date.now() });
                    }
                }
            }
        } catch (e: any) {
            console.warn("[CONFIG] Both Cloud and Local config reload failed:", e.message || e);
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    };

    const updateUiConfig = async (newUiConfig: any) => {
        const initial = getInitialConfig();
        const updated = { ...uiConfig, ...newUiConfig };
        setUiConfig(updated);
        
        syncNavigation(entity, constants.NAV, updated, initial);

        // 1. Save to Cloud (The Brain Registry - Enterprise Level 8)
        try {
            await api.brain.post('registry/save', { 
                namespace: 'ui',
                key: 'config',
                value: updated,
                dataType: 'json'
            });
            console.log("[CONFIG] UI Overrides synced to Cloud Registry");
        } catch (e) {
            console.warn("[CONFIG] Cloud sync failed, keeping local-only", e);
        }

        // 2. Save to IndexedDB (Offline cache)
        const db = await getBrowserDb();
        if (db) {
            await db.configs.put({ id: 'ui_config', data: updated, updatedAt: Date.now() });
        }

        // 3. Notify Local Agent (Socket)
        socket.emit('db:set', { 
            collection: 'SYSTEM_SETTING', 
            id: 'ui_config', 
            data: { namespace: 'ui', key: 'config', value: updated, dataType: 'json' } 
        });
        
        console.log("[CONFIG] UI Overrides saved locally");
    };

    useEffect(() => {
        // Don't call refreshConfig here - it's already called in initConfig effect
        // Just set up socket listeners for updates

        const handleUpdate = () => {
            if (autoRefreshEnabled && canAutoRefresh) {
                console.log("[CONFIG] Socket auto-refresh triggered (forcing refresh)");
                // Level 8: Always force refresh on socket events to bypass throttles
                // Also add a small delay to ensure DB sync is fully committed on backend isolates
                setTimeout(() => refreshConfig(true), 100);
            }
        };

        // Listen for updates (Real-time invalidation)
        socket.on('config:updated', handleUpdate);
        socket.on('system:constants-updated', handleUpdate);
        socket.on('system:settings-updated', handleUpdate);
        socket.on('ui:updated', handleUpdate);
        
        const handleInitialConnect = () => {
            if (Object.keys(entity).length === 0 || Object.keys(constants).length === 0) {
                handleUpdate();
            }
        };
        socket.on('connect', handleInitialConnect);

        return () => {
            socket.off('config:updated', handleUpdate);
            socket.off('system:constants-updated', handleUpdate);
            socket.off('system:settings-updated', handleUpdate);
            socket.off('ui:updated', handleUpdate);
            socket.off('connect', handleInitialConnect);
        };
    }, [autoRefreshEnabled, canAutoRefresh]);

    return (
        <ConfigContext.Provider value={{ entity, constants, marketplace, uiConfig, navigation, loading, isInitialized, buildInfo: buildInfo as any, refreshConfig, updateUiConfig }}>
            {children}
        </ConfigContext.Provider>
    );
};

export function useConfig() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}

