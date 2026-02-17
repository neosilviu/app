import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * MASTER PRODUCT ENTITY (v3 Modular GOLD STANDARD)
 * This file serves as the "Universal Reference" for the AI Architect.
 * It demonstrates Level 10 architecture patterns: Registry-Driven UI, Unified Action Protocol, and Structural Hooks.
 */
export const master_product: EntityV3<any> = {
  id: 'product',
  label: { ro: 'Produs (Master)', en: 'Product (Master)' },
  labelPlural: { ro: 'Produse', en: 'Products' },
  icon: 'Package',
  tableName: 'product',
  displayField: 'name',

  // Marketplace Solution Metadata
  solutionId: 'master-product-catalog',
  solutionTitle: { ro: 'Catalog Produse (Standard Aur)', en: 'Master Product Catalog (Gold Standard)' },
  description: { 
    ro: 'Model avansat de catalog produse cu management de stoc, prețuri și acțiuni automate.', 
    en: 'Advanced product catalog model with stock management, pricing, and automated actions.' 
  },
  category: 'inventory',
  priority: 10,

  // Business Schema (Logic + Validation + UI Metadata)
  schema: z.object({
    ...BaseSchema, // Inherits id, workspaceId, createdAt, updatedAt, deletedAt, archived

    name: z.string()
      .min(2, { ro: 'Numele trebuie să aibă minim 2 caractere', en: 'Name must be at least 2 characters' } as any)
      .describe('ui:width=12;searchable=true;icon=Type;label={"ro": "Nume Produs", "en": "Product Name"}'),
    
    sku: z.string().optional()
      .describe('ui:width=6;unique=true;icon=Hash;label={"ro": "SKU / Cod", "en": "SKU / Code"};placeholder=PROD-XXXX;hint={"ro": "Cod unic de identificare", "en": "Unique identifier code"}'),
    
    price: z.number().min(0).default(0)
      .describe('ui:width=6;type=currency;icon=DollarSign;label={"ro": "Preț Unitar", "en": "Unit Price"};section={"ro": "Financiar", "en": "Financial"}'),
    
    stock: z.number().int().default(0)
      .describe('ui:width=6;icon=Layers;label={"ro": "Stoc Curent", "en": "Current Stock"};hint={"ro": "Cantitatea disponibilă în depozit", "en": "Available quantity in warehouse"};section={"ro": "Inventar", "en": "Inventory"}'),
    
    minStock: z.number().int().default(5)
      .describe('ui:width=6;icon=AlertTriangle;label={"ro": "Stoc Minim Alertă", "en": "Min Stock Alert"};section={"ro": "Inventar", "en": "Inventory"}'),

    category: z.enum(['hardware', 'software', 'service', 'other']).default('other')
      .describe('ui:width=6;icon=Tag;label={"ro": "Categorie", "en": "Category"};section={"ro": "Detalii", "en": "Details"}'),
    
    tags: z.array(z.string()).optional()
      .describe('ui:width=6;type=relation-multiple;target=tag;label={"ro": "Etichete", "en": "Tags"};section={"ro": "Detalii", "en": "Details"}'),

    image: z.string().optional()
      .describe('ui:width=12;type=image;label={"ro": "Imagine Principală", "en": "Main Image"};section={"ro": "Media", "en": "Media"}'),
      
    description: z.string().optional()
      .describe('ui:width=12;type=richtext;label={"ro": "Descriere Detaliată", "en": "Detailed Description"};section={"ro": "Detalii", "en": "Details"}'),
  }),

  // Features enabling automatic logic
  features: ['audit', 'soft-delete', 'import', 'export', 'comments', 'timestamps'],

  // Unified Action Protocol (Level 9)
  actions: [
    {
      id: 'adjust-stock',
      label: { ro: 'Ajustează Stoc', en: 'Adjust Stock' },
      icon: 'PlusMinus',
      input: z.object({
        quantity: z.number().describe('ui:label={"ro": "Cantitate (+/-)", "en": "Quantity (+/-)"}'),
        reason: z.string().optional().describe('ui:label={"ro": "Motiv", "en": "Reason"}')
      }),
      handler: async (ctx: any, input: any) => {
        const { db, entityId } = ctx;
        const product = await db.get('product', entityId);
        if (!product) throw new Error("Product not found");

        const newStock = (product.stock || 0) + input.quantity;
        await db.update('product', entityId, { stock: newStock });

        return { success: true, newStock };
      }
    },
    {
      id: 'generate-label',
      label: { ro: 'Generează Etichetă', en: 'Generate Label' },
      icon: 'Printer',
      handler: async (ctx: any) => {
        // Logic for generating a PDF or Thermal Label
        return { message: "Label generated successfully" };
      }
    },
    {
      id: 'sync-external-catalog',
      label: { ro: 'Sincronizare Catalog Extern', en: 'Sync External Catalog' },
      icon: 'RefreshCw',
      description: 'Sync data with provider via API.',
      handler: async (ctx: any) => {
        // Demonstration of complex integration handler
        return { success: true, syncedItems: 42 };
      }
    }
  ],

  // Lifecycle Hooks (Enterprise Level 10)
  hooks: {
    beforeCreate: async (ctx: any, data: any) => {
      // Auto-generate SKU if missing
      if (!data.sku) {
        const prefix = data.category === 'hardware' ? 'HW' : 'SW';
        const random = Math.floor(1000 + Math.random() * 9000);
        data.sku = `${prefix}-${random}`;
      }
      return data;
    },
    afterUpdate: async (ctx: any, data: any, id: string) => {
      // Trigger notification if stock is low
      if (data.stock !== undefined && data.stock <= (data.minStock || 5)) {
        console.log(`[ALERT] Stock low for product ${id}: ${data.stock} units left.`);
        // ctx.services.notification.send(...)
      }
    }
  },

  // UI Navigation Settings
  menuConfig: {
    showInMainMenu: true,
    category: 'main_menu',
    icon: 'Package',
    priority: 60
  }
};

export default [master_product];
