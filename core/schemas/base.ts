import { z } from 'zod';

/**
 * BASE SYSTEM FIELDS
 * All entities automatically inherit these via v3 Normalizer
 */
export const BaseSchema = {
  id: z.string().describe('ui:hidden=true;primaryKey=true'),
  workspaceId: z.string().describe('ui:hidden=true;index=true'),
  createdAt: z.date().optional().describe('ui:hidden=true;label=Data Creării;index=true'),
  updatedAt: z.date().optional().describe('ui:hidden=true;label=Ultima Update;index=true'),
  deletedAt: z.date().optional().describe('ui:hidden=true;index=true'),
  archived: z.boolean().default(false).describe('ui:hidden=true;index=true'),
};

/**
 * ACTION PROTOCOL
 * Universal interface for all operations
 */
export interface Action<TInput = any, TOutput = any> {
  id: string; // Machine name: 'send-wa'
  label?: string | { ro: string; en: string }; // Display name
  name?: string; // Legacy display name
  description?: string;
  icon?: string;
  input?: z.ZodSchema<TInput>;
  handler: (context: any, input: TInput) => Promise<TOutput>;
  isGlobal?: boolean;
}

/**
 * ENTITY SPECIFICATION
 * The new modular format for v3 Core
 */
export interface EntityV3<T extends z.ZodRawShape> {
  id: string;
  label: { ro: string; en: string };
  labelPlural: { ro: string; en: string };
  icon: string;
  colorTheme?: string;
  schema: z.ZodObject<T>;
  features: string[];
  indexes?: string[]; // E.g. ["workspaceId, createdAt DESC", "email"]
  dependencies?: string[];
  actions?: Action[];
  isSystem?: boolean;
  isGlobal?: boolean;
  menuConfig?: {
    showInMainMenu: boolean;
    showInUserMenu?: boolean;
    showInActionMenu?: boolean;
    category?: string;
    priority?: number;
    badge?: string;
    label?: { ro: string; en: string };
    icon?: string;
  };
  hooks?: {
    beforeCreate?: (ctx: any, data: any) => Promise<any>;
    afterCreate?: (ctx: any, data: any) => Promise<any>;
    beforeUpdate?: (ctx: any, data: any, id: string) => Promise<any>;
    afterUpdate?: (ctx: any, data: any, id: string) => Promise<any>;
    beforeDelete?: (ctx: any, id: string) => Promise<any>;
    afterDelete?: (ctx: any, id: string) => Promise<any>;
  };
  // Legacy bridge metadata
  tableName?: string;
  displayField?: string;
  baseline?: boolean; // Is this part of core baseline
  isCore?: boolean; // Is this a core system entity
  priority?: number; // Priority for sorting
  excludeBaseFields?: string[]; // Fields to exclude from BaseSchema inheritance
  
  // Workflow & Rules
  flowRules?: Record<string, any>; // Status workflow rules
  
  // Marketplace / Solution Metadata
  solutionId?: string;
  solutionTitle?: { ro: string; en: string };
  description?: { ro: string; en: string } | string;
  category?: string;
  
  // Enterprise Level 10: Extension Protocol
  extensions?: Record<string, {
    schema?: any; // Partial Zod shape to merge
    flowRules?: any;
    actions?: Action[];
    menuConfig?: any;
  }>;
}
