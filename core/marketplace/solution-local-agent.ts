import { z } from 'zod';
import { type EntityV3 } from '../schemas/base';

/**
 * LOCAL AGENT SOLUTION - Marketplace V3
 * Integrates local communication channels (WhatsApp, SMS, Calls).
 */
export const local_agent_solution: EntityV3<any> = {
  id: 'local-agent',
  label: { ro: 'Agent Local Comunicații', en: 'Local Agent Comms' },
  labelPlural: { ro: 'Agenți Locali Comunicații', en: 'Local Agent Comms' },
  icon: 'HardDrive',
  tableName: 'local_agent_config', 
  displayField: 'id',
  
  // Marketplace Metadata
  solutionId: 'local-agent',
  solutionTitle: { ro: 'Agent Local (Comunicații)', en: 'Local Agent (Communications)' },
  description: { ro: 'Integrează WhatsApp, SMS și Apeluri prin agentul local instalat.', en: 'Integrates WhatsApp, SMS and Calls via the installed local agent.' },
  category: 'integration',

  schema: z.object({
    agentId: z.string().describe('ui:label={"ro": "{", "en": "{"}"ro": "{", "en": "{"}"ro": "{", "en": "{"}"ro": "Agent ID", "en": "Agent ID"}'),
    status: z.enum(['online', 'offline']).default('offline'),
    lastSeen: z.string().optional()
  }),
  
  features: ['audit'],

  // Enterprise Level 10: Extension Protocol
  extensions: {
    interaction: {
      schema: {
        // Extending the base 'channel' with local-agent specific types
        channel: z.enum(['system', 'internal', 'whatsapp', 'email', 'sms', 'call', 'other'])
          .describe('ui:width=4;label={"ro": "Canal (Agent Local", "en": "Channel (Agent Local"}'),
        
        remoteId: z.string().optional()
          .describe('ui:label={"ro": "{", "en": "{"}"ro": "{", "en": "{"}"ro": "{", "en": "{"}"ro": "Remote Service ID", "en": "Remote Service ID"};hint=ID-ul din serviciul extern (WA/Gmail)'),
      },
      actions: [
        {
          id: 'send-wa',
          label: { ro: 'Trimite WhatsApp', en: 'Send WhatsApp' },
          description: 'Trimite mesaj WhatsApp prin Local Agent',
          input: z.object({
            message: z.string().min(1)
          }),
          handler: async (ctx: any, input: any) => {
            // Logic handled by local agent bridge
            return { success: true };
          }
        }
      ]
    }
  }
};
