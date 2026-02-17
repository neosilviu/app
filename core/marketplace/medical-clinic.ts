import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * MEDICAL CLINIC - Entities
 */
const patient: EntityV3<any> = {
  id: 'patient',
  label: { ro: 'Pacient', en: 'Patient' },
  labelPlural: { ro: 'Pacienți', en: 'Patients' },
  icon: 'User',
  tableName: 'med_patient',
  displayField: 'full_name',

  // Marketplace Metadata
  solutionId: 'medical-clinic',
  solutionTitle: { ro: 'Clinică Medicală & Pacienți', en: 'Medical Clinic & Patients' },
  description: { ro: 'Gestiune pacienți, programări, consultații și fișe medicale.', en: 'Patient management, appointments, consultations and medical records.' },
  category: 'medical',

  schema: z.object({
    ...BaseSchema,
    full_name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Complet", "en": "Name Complet"}'),
    
    phone: z.string().optional()
      .describe('ui:type=phone;width=6;label={"ro": "Telefon", "en": "Phone"}'),
    
    cnp: z.string().optional()
      .describe('ui:width=6;label={"ro": "CNP", "en": "CNP"}'),
  }),

  features: ['audit', 'timestamps'],
};

const medical_appointment: EntityV3<any> = {
  id: 'medical_appointment',
  label: { ro: 'Programare Medicală', en: 'Medical Appointment' },
  labelPlural: { ro: 'Programări Medicale', en: 'Medical Appointments' },
  icon: 'Clock',
  tableName: 'med_appointment',
  displayField: 'date_time',

  // Marketplace Metadata
  solutionId: 'medical-clinic',
  solutionTitle: { ro: 'Clinică Medicală & Pacienți', en: 'Medical Clinic & Patients' },
  category: 'medical',

  schema: z.object({
    ...BaseSchema,
    patientId: z.string()
      .describe('ui:type=relation;target=patient;label={"ro": "Pacient", "en": "Pacient"}'),
    
    date_time: z.string()
      .describe('ui:type=datetime;width=12;label={"ro": "Data & Ora", "en": "Data & Ora"}'),
    
    status: z.enum(['scheduled', 'confirmed', 'cancelled', 'completed'])
      .default('scheduled')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional().describe('ui:width=6;label={"ro": "Grupă Sânge", "en": "Grupă Sânge"}'),
        isDoctor: z.boolean().default(false).describe('ui:width=6;label={"ro": "Este Medic", "en": "Este Medic"}'),
        specialization: z.string().optional().describe('ui:width=12;label={"ro": "Specializare", "en": "Specializare"}'),
      }
    }
  }
};

export default [patient, medical_appointment];
