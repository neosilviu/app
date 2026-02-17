import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * FILE ENTITY (v3 Modular)
 * Management for uploaded documents and media.
 */
export const file: EntityV3<any> = {
  id: 'file',
  label: { ro: 'Fișier', en: 'File' },
  labelPlural: { ro: 'Fișiere', en: 'Files' },
  icon: 'FileText',
  tableName: 'file',
  displayField: 'filename',

  // Marketplace Solution Metadata
  solutionId: 'cloud-file-storage',
  solutionTitle: { ro: 'Stocare Fișiere Cloud', en: 'Cloud File Storage' },
  description: { 
    ro: 'Sistem avansat de management pentru documente și media.', 
    en: 'Advanced management system for documents and media.' 
  },
  category: 'storage',
  priority: 80,
  
  schema: z.object({
    ...BaseSchema,
    filename: z.string()
      .describe('ui:width=12;icon=Type;label={"ro": "Nume Fișier", "en": "Filename"};searchable=true;section={"ro": "General", "en": "General"}'),
    
    originalName: z.string().optional()
      .describe('ui:width=12;label={"ro": "Nume Original", "en": "Original Name"};section={"ro": "General", "en": "General"}'),
    
    mimeType: z.string().optional()
      .describe('ui:width=4;icon=Paperclip;label={"ro": "Tip MIME", "en": "MIME Type"};section={"ro": "Detalii Tehnice", "en": "Technical Details"}'),
    
    size: z.number().optional()
      .describe('ui:width=4;icon=Database;label={"ro": "Dimensiune (bytes)", "en": "Size (bytes)"};section={"ro": "Detalii Tehnice", "en": "Technical Details"}'),
    
    category: z.enum(['document', 'image', 'media', 'archive', 'other'])
      .default('document')
      .describe('ui:width=4;icon=Layers;label={"ro": "Categorie", "en": "Category"};section={"ro": "General", "en": "General"}'),
    
    url: z.string().url().optional()
      .describe('ui:width=12;type=url;icon=ExternalLink;label={"ro": "URL Acces", "en": "Access URL"};section={"ro": "Locație", "en": "Location"}'),
    
    storagePath: z.string().optional().describe('ui:hidden=true'),
    
    uploadedBy: z.string().optional()
      .describe('ui:width=6;type=relation;target=contact;icon=User;label={"ro": "Încărcat de", "en": "Uploaded By"};section={"ro": "Audit", "en": "Audit"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Note / Descriere", "en": "Notes / Description"};section={"ro": "General", "en": "General"}'),
    
    metadata: z.any().optional().describe('ui:width=12;label=Metadate (Raw);type=json;section={"ro": "Detalii Tehnice", "en": "Technical Details"}'),
  }),


  features: ['audit', 'soft-delete'],

  actions: [
    {
      id: 'upload',
      label: 'Încarcă Fișier',
      handler: async (ctx: any, input: any) => {
        const { db, user, env, registry } = ctx;
        const { storage = 'local-inbox', file } = input;
        
        if (!file) throw new Error("No file provided");

        // 1. Audit Log 
        await db.create('audit_log', {
            id: crypto.randomUUID(),
            action: 'upload',
            entityType: 'file',
            details: JSON.stringify({ name: (file as any).name || 'unknown', size: (file as any).size || 0, storage }),
            user: user?.email || user?.id || 'system',
            workspaceId: user?.workspaceId || 'system',
            createdAt: new Date().toISOString()
        });

        // 2. Route based on storage type
        if (storage === 'r2' || (env.STORAGE && storage === 'auto')) {
            if (!env.STORAGE) throw new Error("R2 Storage not configured on this environment");
            
            const fileObj = file as any;
            const key = `${user?.workspaceId || 'system'}/${crypto.randomUUID()}-${fileObj.name}`;
            
            await env.STORAGE.put(key, await fileObj.arrayBuffer(), {
                httpMetadata: { contentType: fileObj.type },
                customMetadata: {
                    originalName: fileObj.name,
                    userId: user?.id || 'system',
                    workspaceId: user?.workspaceId || 'system'
                }
            });

            const encodedKey = key.split('/').map((part: string) => encodeURIComponent(part)).join('/');
            const url = `/api/file/raw/${encodedKey}`;
            
            return {
                key,
                url,
                name: fileObj.name,
                size: fileObj.size,
                type: fileObj.type,
                provider: 'r2'
            };
        }

        if (storage === 'local-inbox') {
            const localAgentUrl = env.VITE_SOCKET_URL || registry.CONSTANTS?.directories?.apiUrl || 'http://localhost:4001';
            
            const formData = new FormData();
            if (file && typeof (file as any).name === 'string') {
                formData.append('file', file as any, (file as any).name);
            } else {
                formData.append('file', file as any);
            }
            
            formData.append('workspaceId', user?.workspaceId || 'system');
            formData.append('userId', user?.id || 'system');

            const response = await fetch(`${localAgentUrl}/api/file/upload`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${env.API_KEY || 'dev-token'}`,
                    'Accept': 'application/json'
                },
                body: formData
            });

            if (!response.ok) {
                let errorMsg = 'Local agent upload failed';
                try {
                    const err: any = await response.json();
                    errorMsg = err.error || errorMsg;
                } catch (e) {}
                throw new Error(errorMsg);
            }

            return await response.json();
        }

        throw new Error(`Storage provider '${storage}' not implemented.`);
      }
    }
  ]
};
