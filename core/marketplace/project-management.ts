import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * PROJECT 360 ENTERPRISE - Entities
 */
const project: EntityV3<any> = {
  id: 'project',
  label: { ro: 'Proiect', en: 'Project' },
  labelPlural: { ro: 'Proiecte', en: 'Projects' },
  icon: 'Briefcase',
  tableName: 'project',
  displayField: 'name',

  // Marketplace Metadata
  solutionId: 'project-management-enterprise',
  solutionTitle: { ro: 'Project 360 Enterprise', en: 'Project 360 Enterprise' },
  description: { ro: 'Management de proiect complex cu Proiecte, Etape, Task-uri și resurse.', en: 'Complex project management with Project, Milestones, task, and Resource tracking.' },
  category: 'management',

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Proiect", "en": "Project Name"}'),
    
    start_date: z.string().optional()
      .describe('ui:type=date;width=6;label={"ro": "Data Început", "en": "Start Date"}'),
    
    deadline: z.string().optional()
      .describe('ui:type=date;width=6;label={"ro": "Deadline", "en": "Deadline"}'),
    
    budget: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Buget Estimativ", "en": "Estimated Budget"}'),
    
    status: z.enum(['not_started', 'active', 'on_hold', 'completed'])
      .default('not_started')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

const project_task: EntityV3<any> = {
  id: 'project_task',
  label: { ro: 'Task Proiect', en: 'Project Task' },
  labelPlural: { ro: 'Task-uri Proiect', en: 'Project Tasks' },
  icon: 'CheckSquare',
  tableName: 'project_task',
  displayField: 'title',

  // Marketplace Metadata
  solutionId: 'project-management-enterprise',
  solutionTitle: { ro: 'Project 360 Enterprise', en: 'Project 360 Enterprise' },
  category: 'management',

  schema: z.object({
    ...BaseSchema,
    title: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Titlu Task", "en": "Task Title"}'),
    
    projectId: z.string()
      .describe('ui:type=relation;target=project;label={"ro": "Proiect", "en": "Project"}'),
    
    priority: z.enum(['low', 'medium', 'high'])
      .default('medium')
      .describe('ui:width=6;label={"ro": "Prioritate", "en": "Priority"}'),
    
    status: z.enum(['todo', 'in_progress', 'done'])
      .default('todo')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps'],
};

export default [project, project_task];
