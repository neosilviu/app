import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ENTITY DEFINITION (v3 Modular)
 * Metadata for custom entities created via Builder.
 */
export const entity_definition: EntityV3<any> = {
  id: 'entity_definition',
  label: { ro: 'Definiție Entitate', en: 'Entity Definition' },
  labelPlural: { ro: 'Builder Entități', en: 'Entity Builder' },
  icon: 'Database',
  tableName: 'entity_definition',
  displayField: 'label',
  isSystem: true,
  isGlobal: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'entity-builder-core',
  solutionTitle: { ro: 'Arhitect Entități', en: 'Entity Architect' },
  description: { 
    ro: 'Inima sistemului modular. Permite definirea dinamică a noilor tipuri de date.', 
    en: 'Core of the modular system. Allows dynamic definition of new data types.' 
  },
  category: 'system',
  priority: 0,
  
  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .describe('ui:width=6;icon=Fingerprint;label={"ro": "Nume Sistem", "en": "System Name"};index=true'),
    
    label: z.string()
      .describe('ui:width=6;icon=Tag;label={"ro": "Etichetă", "en": "Label"}'),
    
    labelPlural: z.string().optional()
      .describe('ui:width=6;icon=Tags;label={"ro": "Etichetă Plural", "en": "Plural Label"}'),
    
    description: z.string().optional()
      .describe('ui:width=6;icon=FileText;label={"ro": "Descriere", "en": "Description"}'),
    
    icon: z.string().optional()
      .describe('ui:width=6;icon=Smile;label={"ro": "Pictogramă", "en": "Icon"};type=icon'),
    
    colorTheme: z.string().optional()
      .describe('ui:width=6;icon=Palette;label={"ro": "Temă Culoare", "en": "Color Theme"}'),
    
    tableName: z.string().optional()
      .describe('ui:width=6;icon=Table;label={"ro": "Nume Tabel DB", "en": "DB Table Name"}'),
    
    displayField: z.string().optional()
      .describe('ui:width=6;icon=Eye;label={"ro": "Câmp Afișare", "en": "Display Field"}'),
    
    fields: z.any().optional()
      .describe('ui:width=12;section={"ro": "Structură & Logică", "en": "Structure & Logic"};label={"ro": "Câmpuri Zod", "en": "Zod Fields"};type=json'),
    
    validations: z.any().optional()
      .describe('ui:width=12;label={"ro": "Validări", "en": "Validations"};type=json'),
    
    relationships: z.any().optional()
      .describe('ui:width=12;label={"ro": "Relații (Foreign Keys)", "en": "Relationships"};type=json'),
    
    dependencies: z.any().optional()
      .describe('ui:width=12;label={"ro": "Dependențe", "en": "Dependencies"};type=json'),
    
    uiConfig: z.any().optional()
      .describe('ui:width=12;section={"ro": "Prezentare UI", "en": "UI Presentation"};label={"ro": "Configurație UI", "en": "UI Configuration"};type=json'),
    
    menuConfig: z.any().optional()
      .describe('ui:width=12;label={"ro": "Configurație Meniu", "en": "Menu Configuration"};type=json'),
    
    permission: z.any().optional()
      .describe('ui:width=12;label={"ro": "Permisiuni", "en": "Permissions"};type=json'),
    
    features: z.any().optional()
      .describe('ui:width=12;label={"ro": "Funcționalități (Audit/Tags)", "en": "Features"};type=json'),
    
    actions: z.any().optional()
      .describe('ui:width=12;section={"ro": "Acciuni", "en": "Actions"};label={"ro": "Acțiuni Entity", "en": "Entity Actions"};type=json'),
    
    layout: z.any().optional()
      .describe('ui:width=12;label={"ro": "Layout Pagini", "en": "Page Layouts"};type=json'),
    
    dashboardConfig: z.any().optional()
      .describe('ui:width=12;label={"ro": "Configurație Dashboard", "en": "Dashboard Config"};type=json'),
    
    flowRules: z.any().optional()
      .describe('ui:hidden=true;label={"ro": "Reguli Status", "en": "Status Rules"};type=json'),
    
    baseline: z.boolean().optional().default(false)
      .describe('ui:hidden=true;label={"ro": "Part of Core", "en": "Part of Core"}'),
    
    isCore: z.boolean().optional().default(false)
      .describe('ui:hidden=true;label={"ro": "Entitate Sistem", "en": "System Entity"}'),
    
    priority: z.number().optional().default(0)
      .describe('ui:hidden=true;label={"ro": "Prioritate", "en": "Priority"}'),
    
    excludeBaseFields: z.array(z.string()).optional()
      .describe('ui:hidden=true;label={"ro": "Exclude Fields", "en": "Exclude Fields"};type=json'),

    isSystem: z.boolean().default(false).describe('ui:hidden=true'),
  }),


  features: ['audit'],

  actions: [
    {
      id: 'heal-db',
      label: 'Sincronizează Toate Tabelele',
      icon: 'Zap',
      handler: async (ctx: any, input: any) => {
        const { db, registry, syncEntityTable, v3Entities } = ctx;
        const results: any[] = [];
        const isDryRun = input.dryRun === true;

        // Collect all entities from both Legacy Registry and V3 Modular
        const legacyEntities = registry?.ENTITY_CONFIG || {};
        const allEntities: Record<string, any> = { ...legacyEntities };
        
        // V3 entities take precedence if they have the same name
        if (v3Entities) {
          for (const [id, entity] of Object.entries(v3Entities)) {
            allEntities[id] = entity;
          }
        }

        const keys = Object.keys(allEntities);
        console.log(`[HEAL-DB] Starting sync for ${keys.length} entities...`);

        for (const name of keys) {
          try {
            const config = allEntities[name];
            const syncResult = await syncEntityTable(db, { name, ...config }, registry, isDryRun);
            results.push({ 
              name, 
              status: 'success', 
              changes: Array.isArray(syncResult) ? syncResult : [] 
            });
          } catch (e: any) {
            results.push({ name, status: 'error', error: e.message });
          }
        }

        return {
          message: isDryRun ? 'Simulare finalizată' : 'Sincronizare completă',
          total: keys.length,
          results
        };
      }
    },
    {
      id: 'save',
      label: 'Salvează Definiție',
      handler: async (ctx: any, input: any) => {
        const { db, user, registry, normalizeEntity, syncEntityTable, clearColumnCache } = ctx;
        
        // Helper: Map Zod type to SQL type (for incremental DDL)
        const mapZodTypeToSQL = (zodType: string): string => {
          const typeMap: Record<string, string> = {
            'string': 'TEXT',
            'number': 'REAL',
            'integer': 'INTEGER',
            'boolean': 'INTEGER',
            'date': 'TEXT',
            'datetime': 'TEXT',
            'json': 'TEXT',
            'array': 'TEXT',
            'object': 'TEXT'
          };
          return typeMap[zodType?.toLowerCase()] || 'TEXT';
        };
        
        // Invalidate Global Cache
        (globalThis as any).CACHED_CONFIGS = {};
        (globalThis as any).PENDING_CONFIG_FETCHES = {};

        const entitiesToProcess = input.entity || input.template?.entity || (input.name || input.id ? [input] : []);
        const isDryRun = input.dryRun === true;
        
        if (!entitiesToProcess || !Array.isArray(entitiesToProcess)) {
          throw new Error("No entities provided to save");
        }

        const results = [];
        const syncErrors = [];
        const dryRunResults: Record<string, string[]> = {};
        const staticBaselineEntities = registry.ENTITY_CONFIG || {};

        for (const entity of entitiesToProcess) {
          try {
            const norm = normalizeEntity(entity);
            const name = norm.name.toLowerCase();
            if (!name) continue;

            const baselineEntry = (staticBaselineEntities[name] || {});
            const coreList = (registry.CONSTANT?.coreEntity || []).map((e: string) => e.toLowerCase());
            
            const isCore = coreList.includes(name);
            const isSystem = isCore || !!baselineEntry.isSystem;
            const entityWorkspaceId = isSystem ? 'system' : (user?.workspaceId || 'system');

            const existingList = await db.list('entity_definition', { name, workspaceId: entityWorkspaceId, archived: 0 });
            const existing = existingList.length > 0 ? existingList[0] : null;

            if (isSystem && existing && isCore) {
              if (norm.name && norm.name !== existing.name) {
                throw new Error(`Cannot change system identifier for '${name}'`);
              }
            }

            let tableName = norm.tableName || name;
            if (!isSystem && entityWorkspaceId !== 'system') {
              const prefix = entityWorkspaceId.length > 8 ? entityWorkspaceId.substring(0, 8) : entityWorkspaceId;
              tableName = `ws_${prefix}_${name}`;
            }

            if (isDryRun) {
              const sqls = await syncEntityTable(db, { ...norm, tableName }, registry, true);
              dryRunResults[name] = sqls as string[];
              results.push({ name, status: 'simulated' });
              continue;
            }

            const stringifyIfObj = (v: any) => typeof v === 'object' ? JSON.stringify(v) : v;

            const definition = {
              name,
              label: stringifyIfObj(norm.labelRaw || norm.label || name),
              labelPlural: stringifyIfObj(norm.labelPluralRaw || norm.labelPlural || norm.labelRaw || name),
              description: stringifyIfObj(norm.descriptionRaw || norm.description || ''),
              icon: norm.icon || 'Box',
              colorTheme: norm.colorTheme || 'blue',
              tableName,
              displayField: norm.displayField || '',
              isSystem: isSystem ? 1 : 0,
              fields: JSON.stringify(norm.fields || []).includes('labelRaw') ? 
                JSON.stringify((norm.fields || []).map((f: any) => ({ ...f, label: f.labelRaw || f.label, labelRaw: undefined }))) : 
                JSON.stringify(norm.fields || []),
              validations: JSON.stringify(norm.validations || {}),
              relationships: JSON.stringify(norm.relationships || []),
              dependencies: JSON.stringify(norm.dependencies || []),
              uiConfig: JSON.stringify(norm.uiConfig || {}),
              menuConfig: JSON.stringify(norm.menuConfig || {}),
              permission: JSON.stringify(norm.permission || {}),
              features: JSON.stringify(norm.features || {}),
              layout: JSON.stringify(norm.layout || {}),
              dashboardConfig: JSON.stringify(norm.dashboardConfig || {}),
              workspaceId: entityWorkspaceId,
              updatedAt: new Date().toISOString()
            };

            if (existing) {
              await db.update('entity_definition', existing.id, definition);
            } else {
              await db.create('entity_definition', {
                id: crypto.randomUUID(),
                archived: 0,
                createdAt: new Date().toISOString(),
                ...definition
              });
            }

            // --- ENTERPRISE LEVEL 11: Incremental Field Sync (Field-Level DDL) ---
            // When ONLY fields change (not validations/relationships), apply targeted ALTER TABLE instead of full sync
            const fieldsChanged = existing && existing.fields !== definition.fields;
            const otherStructureChanged = !existing || 
              (existing.validations !== definition.validations) ||
              (existing.relationships !== definition.relationships) ||
              (existing.displayField !== definition.displayField);
            
            if (fieldsChanged && !otherStructureChanged) {
              // OPTIMIZED PATH: Only fields changed - apply incremental DDL
              try {
                const oldFields = existing.fields ? JSON.parse(existing.fields) : [];
                const newFields = JSON.parse(definition.fields);
                
                // Field diffing: detect added, removed, modified fields
                const oldFieldMap = new Map(oldFields.map((f: any) => [f.name, f]));
                const newFieldMap = new Map(newFields.map((f: any) => [f.name, f]));
                
                const addedFields = newFields.filter((f: any) => !oldFieldMap.has(f.name));
                const removedFields = oldFields.filter((f: any) => !newFieldMap.has(f.name));
                const modifiedFields = newFields.filter((f: any) => {
                  const old = oldFieldMap.get(f.name);
                  return old && JSON.stringify(old) !== JSON.stringify(f);
                });
                
                // Generate targeted ALTER TABLE statements (without PRAGMA overhead)
                const alterStatements: string[] = [];
                
                // Add new columns
                for (const field of addedFields) {
                  const sqlType = mapZodTypeToSQL(field.type);
                  const nullable = field.required === false ? '' : ' NOT NULL';
                  alterStatements.push(`ALTER TABLE "${tableName}" ADD COLUMN "${field.name}" ${sqlType}${nullable};`);
                }
                
                // Note: SQLite doesn't support column removal or modification easily (no ALTER COLUMN)
                // For removed/modified fields, fall back to full sync
                if (removedFields.length > 0 || modifiedFields.length > 0) {
                  // Too complex - use full syncEntityTable
                  await syncEntityTable(db, { ...norm, tableName }, registry);
                  results.push({ name, status: 'synced', level: 'full', reason: 'field_removal_or_modification' });
                } else if (alterStatements.length > 0) {
                  // Apply incremental statements
                  for (const sql of alterStatements) {
                    try {
                      await db.query(sql);
                    } catch (e: any) {
                      // Column might already exist, skip silently
                      if (!e.message.includes('already exists')) throw e;
                    }
                  }
                  results.push({ name, status: 'synced', level: 'incremental', changesApplied: alterStatements.length });
                } else {
                  // Fields reordered but structurally identical
                  results.push({ name, status: 'synced', level: 'cached' });
                }
              } catch (e: any) {
                // Fall back to full sync on diff error
                console.warn(`[ENTITY-SAVE] Field diff failed for ${name}, falling back to full sync:`, e.message);
                await syncEntityTable(db, { ...norm, tableName }, registry);
                results.push({ name, status: 'synced', level: 'full', reason: 'fallback_from_error' });
              }
            } else if (!existing || !fieldsChanged && !otherStructureChanged) {
              // Schema completely unchanged: skip PRAGMA calls
              results.push({ name, status: 'synced', level: 'cached' });
            } else {
              // Structural changes beyond just fields: run full sync
              await syncEntityTable(db, { ...norm, tableName }, registry);
              results.push({ name, status: 'synced', level: 'full', reason: 'structural_changes' });
            }

            clearColumnCache(name);
          } catch (e: any) {
            syncErrors.push(`${entity?.name || 'unknown'}: ${e.message}`);
          }
        }

        return { results, dryRun: dryRunResults, errors: syncErrors.length > 0 ? syncErrors : null };
      }
    },
    {
      id: 'ai-migration',
      label: { ro: 'Migrare SQL Inteligentă (AI)', en: 'AI SQL Migration' },
      description: 'Folosește AI pentru a genera scripturi SQL de migrare pentru schimbări distructive (redenumire coloane, schimbare tipuri).',
      icon: 'Spline',
      input: z.object({
        entityName: z.string().describe('Numele entității de migrat'),
        instruction: z.string().describe('Instrucțiuni (ex: Redenumește coloana "nume" în "titlu")')
      }),
      handler: async (ctx: any, input: any) => {
        const { db, registry, AiService, env, v3Entities } = ctx;
        const { entityName, instruction } = input;
        
        // 1. Get Entity Spec
        const entity = (v3Entities && v3Entities[entityName]) || registry?.ENTITY_CONFIG?.[entityName];
        if (!entity) throw new Error(`Entitatea '${entityName}' nu a fost găsită.`);

        // 2. Get Current SQL Schema
        const currentCols = await db.query(`PRAGMA table_info(${entity.tableName || entityName})`).catch(() => []);
        
        // 3. AI Analysis & SQL Generation
        const ai = new AiService(env, { ai_config: registry.AI_CONFIG, registry, db });
        const prompt = `Ești un specialist DBA. Generază DOAR codul SQL necesar pentru a aplica următoarea schimbare în SQLite pentru tabelul '${entity.tableName || entityName}': ${instruction}. 
        Structura curentă: ${JSON.stringify(currentCols)}. 
        Zod Schema dorită: ${JSON.stringify(entity.schema || {})}.
        Returnează rezultatul sub formă de obiect JSON: { \"sql\": \"-- array de comenzi SQL\", \"explanation\": \"...\", \"isDestructive\": true/false }`;

        const res = await ai.chat(prompt, [], { response_mime_type: 'application/json' });
        const migration = ai.engine.extractJson(res);

        return {
          entityName,
          migration,
          status: 'generated',
          nextStep: 'Rulați SQL-ul generat în consola D1 sau folosiți o acțiune de execuție.'
        };
      }
    },
    {
      id: 'list-all',
      label: 'List All (Merged)',
      handler: async (ctx: any) => {
        const { registry } = ctx;
        const allConfigs = registry.ENTITY_CONFIG || {};
        return Object.entries(allConfigs).map(([name, config]: [string, any]) => ({
          name,
          ...config
        }));
      }
    },
    {
      id: 'preview-sync',
      label: 'Previzualizează Migrare',
      handler: async (ctx: any, input: any) => {
        const { db, registry, normalizeEntity, syncEntityTable } = ctx;
        const norm = normalizeEntity(input);
        const name = norm.name?.toLowerCase();
        if (!name) throw new Error("Entity name is required");

        const baselineEntry = (registry.ENTITY_CONFIG?.[name] || {});
        const isCore = (registry.CONSTANT?.coreEntity || []).map((e: string) => e.toLowerCase()).includes(name);
        const isSystem = isCore || !!baselineEntry.isSystem;
        const entityWorkspaceId = isSystem ? 'system' : (ctx.user?.workspaceId || 'system');

        let tableName = norm.tableName || name;
        if (!isSystem && entityWorkspaceId !== 'system') {
          const prefix = entityWorkspaceId.length > 8 ? entityWorkspaceId.substring(0, 8) : entityWorkspaceId;
          tableName = `ws_${prefix}_${name}`;
        }

        const sqlStatements = await syncEntityTable(db, { ...norm, tableName }, registry, true);
        return { 
            tableName,
            sql: sqlStatements,
            impact: sqlStatements.length > 0 ? 'SCHEMA_CHANGE' : 'NO_CHANGE'
        };
      }
    },
    {
      id: 'garbage-collect',
      label: 'Garbage Collect',
      handler: async (ctx: any) => {
        const { db, registry } = ctx;
        const activeEntities = Object.values(registry.ENTITY_CONFIG || {});
        
        const tablesResult = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE '_metadata'");
        const allDatabaseTables = (tablesResult || []).map((r: any) => (r as any).name);
        
        const immortalTables = [
          'entity_definition', 'system_setting', 'system_settings', 'audit_log', 
          'workspace', 'user', 'session', 'entity_relation_many',
          'd1_migrations', 'activity', 'notification', 'whatsapp_message',
          'contact_group', 'contact_tag', 'entity_attachments', 'automation_flow',
          'automation_log', 'config_version'
        ];
        
        const definedTables = new Set(activeEntities.map((e: any) => (e as any).tableName || (e as any).name));
        
        const orphans = allDatabaseTables.filter((tableName: string) => {
          const lower = tableName.toLowerCase();
          if (immortalTables.includes(lower)) return false;
          if (definedTables.has(lower)) return false;
          if (definedTables.has(tableName)) return false;
          return true;
        });
        
        const orphanDetails = [];
        for (const table of orphans) {
          try {
            const count = await db.count(table, {});
            orphanDetails.push({ name: table, rowCount: count });
          } catch (e) {
            orphanDetails.push({ name: table, rowCount: -1, error: 'Could not count' });
          }
        }
        
        return { orphans: orphanDetails };
      }
    },
    {
      id: 'delete',
      label: 'Șterge Definiție',
      handler: async (ctx: any, input: any) => {
        const { db, user, registry } = ctx;
        const { id, name, dropDatabase } = input;
        
        let targetEntity = id ? await db.get('entity_definition', id) : null;
        
        if (!targetEntity && name) {
          const results = await db.list('entity_definition', { 
            name, 
            workspaceId: user?.workspaceId || 'system',
            archived: 0 
          });
          if (results && results.length > 0) targetEntity = results[0];
        }

        if (!targetEntity) throw new Error("Entity definition not found");

        const entityName = targetEntity.name.toLowerCase();
        const coreList = (registry.CONSTANT?.coreEntity || []).map((e: string) => e.toLowerCase());
        const isCore = coreList.includes(entityName);
        const isProtected = isCore || !!targetEntity.isSystem;

        if (isProtected) throw new Error(`'${entityName}' este o entitate protejată.`);

        if (dropDatabase) {
          const tableName = targetEntity.tableName || targetEntity.name;
          await db.query(`DROP TABLE IF EXISTS "${tableName}"`).catch(() => {});
        }

        await db.update('entity_definition', targetEntity.id, { 
          archived: 1, 
          updatedAt: new Date().toISOString() 
        });

        return { success: true };
      }
    }
  ]
};
