import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * EDUCATION & ACADEMY LMS - Entities
 */
const course: EntityV3<any> = {
  id: 'course',
  label: { ro: 'Curs', en: 'Course' },
  labelPlural: { ro: 'Cursuri', en: 'Courses' },
  icon: 'GraduationCap',
  tableName: 'edu_course',
  displayField: 'title',

  // Marketplace Metadata
  solutionId: 'education-academy-lms',
  solutionTitle: { ro: 'Educație & Academie LMS', en: 'Education & Academy LMS' },
  description: { ro: 'Gestiune cursuri, studenți, înscrieri și progres.', en: 'Course management, students, enrollments and progress tracking.' },
  category: 'education',

  schema: z.object({
    ...BaseSchema,
    title: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Titlu Curs", "en": "Title Curs"}'),
    
    instructorId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Instructor", "en": "Instructor"}'),
    
    price: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Preț", "en": "Price"}'),
  }),

  features: ['audit', 'timestamps'],
};

const enrollment: EntityV3<any> = {
  id: 'enrollment',
  label: { ro: 'Înscriere', en: 'Enrollment' },
  labelPlural: { ro: 'Înscrieri', en: 'Enrollments' },
  icon: 'UserPlus',
  tableName: 'edu_enrollment',
  displayField: 'enrolled_at',

  // Marketplace Metadata
  solutionId: 'education-academy-lms',
  solutionTitle: { ro: 'Educație & Academie LMS', en: 'Education & Academy LMS' },
  category: 'education',

  schema: z.object({
    ...BaseSchema,
    studentId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Student", "en": "Student"}'),
    
    courseId: z.string()
      .describe('ui:type=relation;target=course;label={"ro": "Curs", "en": "Curs"}'),
    
    enrolled_at: z.string().optional()
      .describe('ui:type=date;width=12;label={"ro": "Data Înscrierii", "en": "Data Înscrierii"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        studentLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe('ui:width=6;label={"ro": "Nivel Student", "en": "Nivel Student"}'),
        graduationYear: z.number().optional().describe('ui:width=6;label={"ro": "An Absolvire", "en": "An Absolvire"}'),
      }
    }
  }
};

export default [course, enrollment];
