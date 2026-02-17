import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * PROJECT TASKS MODULE - Marketplace V3
 * Gestiune activități și productivitate.
 */
export const task: EntityV3<any> = {
  id: 'task',
  label: { ro: 'Task', en: 'Task' },
  labelPlural: { ro: 'Task-uri', en: 'Tasks' },
  icon: 'CheckSquare',
  tableName: 'task',
  displayField: 'title',

  // Marketplace Metadata
  solutionTitle: { ro: 'Productivitate (Task-uri)', en: 'Productivity (Tasks)' },
  description: { ro: 'Fluxuri de lucru simple pentru echipe, cu statusuri și priorități.', en: 'Simple workflows for teams with statuses and priorities.' },
  category: 'operations',

  schema: z.object({
    ...BaseSchema,
    
    title: z.string()
      .min(1, 'Titlul este obligatoriu')
      .describe('ui:width=12;searchable=true;label={"ro": "Titlu Task", "en": "Task Title"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere", "en": "Description"}'),

    contactId: z.string().optional()
      .describe('ui:type=relation;target=contact;label={"ro": "Responsabil", "en": "Responsible"}'),
    
    status: z.enum(['todo', 'in_progress', 'done', 'blocked', 'cancelled'])
      .default('todo')
      .describe('ui:width=4;label={"ro": "Status", "en": "Status"}'),
    
    priority: z.enum(['low', 'medium', 'high', 'critical'])
      .default('medium')
      .describe('ui:width=4;label={"ro": "Prioritate", "en": "Priority"}'),

    dueDate: z.date().optional()
      .describe('ui:width=4;label={"ro": "Data Limită", "en": "Due Date"}'),
  }),

  features: ['audit', 'soft-delete', 'timestamps'],

  flowRules: {
    todo: {
      nextStates: ['in_progress'],
      label: { ro: 'De făcut → În lucru', en: 'To Do → In Progress' },
      requiresFields: ['title'],
      action: 'start_task',
      icon: 'Play'
    },
    in_progress: {
      nextStates: ['done', 'blocked'],
      label: { ro: 'În lucru → Finalizat/Blocat', en: 'In Progress → Done/Blocked' },
      requiresFields: [],
      action: 'complete_or_block',
      icon: 'CheckCircle'
    },
    done: {
      nextStates: ['todo'],
      label: { ro: 'Gata → Reînnoire', en: 'Done → Renew' },
      requiresFields: [],
      action: 'renew_task',
      icon: 'RotateCcw'
    },
    blocked: {
      nextStates: ['in_progress', 'todo'],
      label: { ro: 'Blocat → Reluare', en: 'Blocked → Resume' },
      requiresFields: [],
      action: 'unblock_task',
      icon: 'Play'
    }
  },

  actions: [
    {
      id: 'complete-task',
      label: { ro: 'Finalizează', en: 'Complete' },
      icon: 'CheckCircle',
      handler: async (ctx: any) => {
        const { db, id } = ctx;
        await db.update('task', id, { status: 'done', updatedAt: new Date().toISOString() });
        return { success: true };
      }
    }
  ],
  
  menuConfig: {
    showInMainMenu: true,
    category: 'operations',
    icon: 'CheckSquare',
    priority: 40
  }
};

export default task;
