import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * CONTACT ENTITY (v3 Modular)
 * Managed as a standalone business unit.
 */
export const contact: EntityV3<any> = {
  id: 'contact',
  label: { ro: 'Contact', en: 'Contact' },
  labelPlural: { ro: 'Contacte', en: 'Contacts' },
  icon: 'Users',
  tableName: 'contact',
  displayField: 'name',
  isSystem: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'core-crm-module',
  solutionTitle: { ro: 'Modul CRM Core', en: 'Core CRM Module' },
  description: { 
    ro: 'Gestionarea centralizată a utilizatorilor, membrilor și clienților.', 
    en: 'Centralized management of users, members, and customers.' 
  },
  category: 'crm',
  priority: 100,

  indexes: [
    'workspaceId, deletedAt, createdAt DESC',
    'email',
    'phone'
  ],
  
  // Business Schema (Logic + Validation)
  schema: z.object({
    ...BaseSchema, // Automatic inheritance
    
    avatar: z.string().optional()
      .describe('ui:width=12;type=image;label={"ro": "Poză Profil", "en": "Avatar"};section={"ro": "Informații de Bază", "en": "Basic Info"}'),

    name: z.string()
      .min(2, { ro: 'Numele este prea scurt', en: 'Name is too short' } as any)
      .describe('ui:width=6;searchable=true;icon=User;label={"ro": "Nume Complet", "en": "Full Name"};placeholder=Ion Popescu;section={"ro": "Informații de Bază", "en": "Basic Info"}'),
    
    email: z.string().email({ ro: 'Email invalid', en: 'Invalid email' } as any)
      .describe('ui:width=6;unique=true;icon=Mail;label={"ro": "Adresă Email", "en": "Email Address"};index=true;section={"ro": "Informații de Bază", "en": "Basic Info"}'),
    
    phone: z.string().optional()
      .describe('ui:width=6;icon=Phone;label={"ro": "Număr Telefon", "en": "Phone Number"};index=true;section={"ro": "Informații de Bază", "en": "Basic Info"}'),
    
    company: z.string().optional()
      .describe('ui:width=6;icon=Building;label={"ro": "Companie", "en": "Company"};section={"ro": "Profesional", "en": "Professional"}'),
      
    position: z.string().optional()
      .describe('ui:width=6;icon=Briefcase;label={"ro": "Funcție", "en": "Position"};section={"ro": "Profesional", "en": "Professional"}'),

    bio: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Note / Bio", "en": "Notes / Bio"};section={"ro": "Profesional", "en": "Professional"}'),

    status: z.enum(['active', 'archived', 'deleted']).default('active')
      .describe('ui:width=6;icon=Activity;label={"ro": "Status Contact", "en": "Contact Status"};index=true;section={"ro": "Setări Sistem", "en": "System Settings"}'),

    role: z.enum(['superadmin', 'workspace_owner', 'workspace_admin', 'member', 'agent', 'guest'])
      .default('guest')
      .describe('ui:width=6;icon=Shield;label={"ro": "Rol în Workspace", "en": "Workspace Role"};index=true;section={"ro": "Setări Sistem", "en": "System Settings"}'),

    tags: z.array(z.string()).optional()
      .describe('ui:width=12;type=relation-multiple;target=tag;icon=Tag;label={"ro": "Etichete", "en": "Tags"};section={"ro": "Organizare", "en": "Organization"}'),
  }),

  features: ['audit', 'soft-delete', 'import', 'export', 'comments', 'timestamps'],

  // Unified Action Protocol (Level 9)
  actions: [
    {
      id: 'send-wa',
      label: { ro: 'Trimite WhatsApp', en: 'Send WhatsApp' },
      icon: 'MessageSquare',
      input: z.object({
        message: z.string().describe('ui:type=textarea;label={"ro": "Mesaj", "en": "Message"}')
      }),
      handler: async (ctx: any, input: any) => {
        const { db, entityId } = ctx;
        const contact = await db.get('contact', entityId);
        if (!contact || !contact.phone) throw new Error("Contact does not have a phone number");
        
        // Integration placeholder
        console.log(`[WA] Sending to ${contact.phone}: ${input.message}`);
        return { success: true, status: 'queued' };
      }
    },
    {
      id: 'update-role',
      label: { ro: 'Schimbă Rolul', en: 'Update Role' },
      icon: 'ShieldCheck',
      input: z.object({
        role: z.enum(['superadmin', 'workspace_owner', 'workspace_admin', 'member', 'agent', 'guest'])
      }),
      handler: async (ctx: any, input: any) => {
        const { db, entityId, user } = ctx;
        if (user.role !== 'superadmin' && user.role !== 'workspace_owner') {
          throw new Error("Nu ai permisiunea pentru această acțiune.");
        }
        await db.update('contact', entityId, { role: input.role });
        return { success: true, newRole: input.role };
      }
    }
  ],


  hooks: {
    beforeCreate: async (ctx: any, data: any) => {
      // Enterprise Level 8: Default role for contacts (Guest = No Permissions)
      if (!data.role) {
        data.role = 'guest';
      }
      return data;
    },
    afterUpdate: async (ctx: any, data: any, id: string) => {
      // Invalidate perms cache when a contact (potential user) is updated
      if (ctx.env?.KV) {
        const workspaceId = data.workspaceId || ctx.user?.workspaceId || 'none';
        await ctx.env.KV.delete(`perms_bundle_${id}_${workspaceId}`);
        await ctx.env.KV.delete(`perms_bundle_${id}_none`); // Double clear for safety
        console.log(`[HOOK] Invalidated perms bundle for contact ${id}`);
      }
    },
    afterDelete: async (ctx: any, id: string) => {
      // If deleting a contact, we should deactivate the associated user
      // Note: In Studio App, contact ID usually matches user ID for simplicity in auth
      const { db, env } = ctx;
      
      // 1. Clear Perms Cache
      if (env?.KV) {
        const workspaceId = ctx.previousData?.workspaceId || ctx.user?.workspaceId || 'none';
        await env.KV.delete(`perms_bundle_${id}_${workspaceId}`);
        await env.KV.delete(`perms_bundle_${id}_none`);
        console.log(`[HOOK] Invalidated perms bundle for deleted contact ${id}`);
      }

      // 2. Clear Auth User (If soft-deleted, we deactivate; if hard-deleted, we delete)
      const isSoftDelete = !!ctx.previousData?.deletedAt || ctx.soft === true;
      if (isSoftDelete) {
        await db.query("UPDATE user SET active = 0 WHERE id = ?", [id]).catch(() => {});
      } else {
        await db.query("DELETE FROM user WHERE id = ?", [id]).catch(() => {});
      }
    }
  },

  // UI Navigation Settings
  menuConfig: {
    showInMainMenu: true,
    category: 'system',
    icon: 'Users',
    priority: 10
  }
};

