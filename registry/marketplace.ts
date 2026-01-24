/**
 * REGISTRY MARKETPLACE - Predefined Industry Templates
 * Enterprise Level 8
 */
import { COMMON_STATUS, COMMON_PRIORITY } from './core';

export const MARKETPLACE_TEMPLATE = [
  {
    id: 'project-management-enterprise',
    name: { ro: 'Project 360 Enterprise', en: 'Project 360 Enterprise' },
    description: { ro: 'Management de proiect complex cu Proiecte, Etape, Task-uri și resurse.', en: 'Complex project management with Project, Milestones, task, and Resource tracking.' },
    icon: 'Briefcase',
    entity: [
      { 
        id: 'project', 
        label: { ro: 'Proiect', en: 'Project' }, 
        labelPlural: { ro: 'Proiecte', en: 'Projects' },
        fields: {
          name: { type: 'text', label: { ro: 'Nume Proiect', en: 'Project Name' }, required: true, searchable: true },
          status: { 
            type: 'enum', 
            label: { ro: 'Status', en: 'Status' }, 
            options: [
              COMMON_STATUS.planning,
              COMMON_STATUS.active,
              COMMON_STATUS.blocked,
              COMMON_STATUS.completed
            ]
          },
          client_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' } },
          start_date: { type: 'date', label: { ro: 'Data Început', en: 'Start Date' } },
          deadline: { type: 'date', label: { ro: 'Deadline', en: 'Deadline' } },
          budget: { type: 'currency', label: { ro: 'Buget Estimativ', en: 'Estimated Budget' } }
        }
      },
      {
        id: 'task',
        label: { ro: 'Task', en: 'Task' },
        labelPlural: { ro: 'Task-uri', en: 'Tasks' },
        fields: {
          title: { type: 'text', label: { ro: 'Titlu Task', en: 'Task Title' }, required: true },
          project_id: { type: 'relation', label: { ro: 'Proiect', en: 'Project' }, relation: { target: 'project', field: 'name' }, required: true },
          assignee_id: { type: 'relation', label: { ro: 'Responsabil', en: 'Assignee' }, relation: { target: 'contact', field: 'name' } },
          priority: { type: 'enum', label: { ro: 'Prioritate', en: 'Priority' }, options: [COMMON_PRIORITY.low, COMMON_PRIORITY.medium, COMMON_PRIORITY.high] },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: [COMMON_STATUS.todo, COMMON_STATUS.in_progress, COMMON_STATUS.done] }
        }
      }
    ]
  },
  {
    id: 'medical-clinic',
    name: { ro: 'Clinică Medicală & Pacienți', en: 'Medical Clinic & Patients' },
    description: { ro: 'Gestiune pacienți, programări, consultații și fișe medicale.', en: 'Patient management, appointments, consultations and medical records.' },
    icon: 'HeartPulse',
    entity: [
      {
        id: 'patient',
        label: { ro: 'Pacient', en: 'Patient' },
        labelPlural: { ro: 'Pacienți', en: 'Patients' },
        fields: {
          full_name: { type: 'text', label: { ro: 'Nume Complet', en: 'Full Name' }, required: true },
          phone: { type: 'phone', label: { ro: 'Telefon', en: 'Phone' } },
          email: { type: 'email', label: { ro: 'Email', en: 'Email' } },
          cnp: { type: 'text', label: { ro: 'CNP', en: 'CNP' }, unique: true }
        }
      },
      {
        id: 'appointment',
        label: { ro: 'Programare', en: 'Appointment' },
        labelPlural: { ro: 'Programări', en: 'Appointments' },
        fields: {
          patient_id: { type: 'relation', label: { ro: 'Pacient', en: 'Patient' }, relation: { target: 'patient', field: 'full_name' }, required: true },
          doctor_id: { type: 'relation', label: { ro: 'Medic', en: 'Doctor' }, relation: { target: 'contact', field: 'name' } },
          date_time: { type: 'datetime', label: { ro: 'Data & Ora', en: 'Date & Time' }, required: true },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['scheduled', 'confirmed', 'cancelled', 'completed'] }
        }
      }
    ]
  },
  {
    id: 'real-estate-pro',
    name: { ro: 'Imobiliare Pro', en: 'Real Estate Pro' },
    description: { ro: 'Gestiune proprietăți, vizionări, agenți și contracte.', en: 'Property management, viewings, agents and contracts.' },
    icon: 'Home',
    entity: [
      {
        id: 'property',
        label: { ro: 'Proprietate', en: 'Property' },
        labelPlural: { ro: 'Proprietăți', en: 'Properties' },
        fields: {
          title: { type: 'text', label: { ro: 'Titlu', en: 'Title' }, required: true },
          address: { type: 'text', label: { ro: 'Adresă', en: 'Address' } },
          type: { type: 'enum', label: { ro: 'Tip', en: 'Type' }, options: ['apartment', 'house', 'land', 'commercial'] },
          price: { type: 'currency', label: { ro: 'Preț', en: 'Price' } },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['available', 'reserved', 'sold', 'rented'] }
        }
      }
    ]
  }
] as const;
