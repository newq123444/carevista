// ============================================================
// src/schemas/index.ts — zod schemas for write endpoints
// Permissive-by-design: required identifiers + range-checked clinical
// values, with .passthrough() so additional fields flow to controllers.
// ============================================================
import { z } from 'zod';

const uuid = z.string().uuid({ message: 'must be a valid id' });
const isoDate = z.string().min(4, 'must be a date');

export const createResidentSchema = z.object({
  firstName: z.string().trim().min(1, 'firstName is required').max(100),
  lastName: z.string().trim().min(1, 'lastName is required').max(100),
  dateOfBirth: isoDate,
  roomNumber: z.string().trim().max(20).optional().nullable(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional().nullable(),
  weeklyFee: z.coerce.number().nonnegative().optional().nullable(),
  dnacpr: z.boolean().optional().nullable(),
}).passthrough();

export const createNoteSchema = z.object({
  residentId: uuid,
  noteType: z.enum([
    'personal_care', 'nursing_observation', 'nutrition', 'social_wellbeing',
    'incident_note', 'gp_visit', 'hospital_visit', 'family_update',
    'medication_note', 'behaviour', 'sleep', 'repositioning',
  ]),
  content: z.string().trim().min(1, 'content is required').max(10000),
  painScore: z.coerce.number().int().min(0).max(10).optional().nullable(),
  foodEatenPercent: z.coerce.number().int().min(0).max(100).optional().nullable(),
  vitalSpo2: z.coerce.number().int().min(0).max(100).optional().nullable(),
  vitalHeartRate: z.coerce.number().int().min(0).max(400).optional().nullable(),
  vitalTemp: z.coerce.number().min(20).max(45).optional().nullable(),
}).passthrough();

export const createIncidentSchema = z.object({
  residentId: uuid.optional().nullable(),
  incidentType: z.string().trim().min(1, 'incidentType is required').max(80),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().trim().min(1, 'description is required').max(10000),
  incidentDate: isoDate.optional().nullable(),
}).passthrough();

export const recordAdministrationSchema = z.object({
  medicationId: uuid,
  residentId: uuid,
  status: z.enum(['given', 'refused', 'missed', 'omitted', 'not_required']),
  administrationDate: isoDate.optional().nullable(),
}).passthrough();

export const createStaffSchema = z.object({
  email: z.string().trim().email('valid email required'),
  password: z.string().min(8, 'password must be at least 8 characters'),
  firstName: z.string().trim().min(1, 'firstName is required').max(100),
  lastName: z.string().trim().min(1, 'lastName is required').max(100),
  role: z.string().trim().max(40).optional().nullable(),
  contractHours: z.coerce.number().min(0).max(80).optional().nullable(),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
}).passthrough();

export const updateResidentSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']).optional().nullable(),
  roomNumber: z.string().trim().max(20).optional().nullable(),
  weeklyFee: z.coerce.number().nonnegative().optional().nullable(),
  dnacpr: z.boolean().optional().nullable(),
  gpPhone: z.string().trim().max(40).optional().nullable(),
}).passthrough();

export const createInvoiceSchema = z.object({
  residentId: uuid,
  amountPence: z.coerce.number().int().nonnegative('amount must be >= 0'),
  vatPence: z.coerce.number().int().nonnegative().optional().nullable(),
  periodStart: isoDate.optional().nullable(),
  periodEnd: isoDate.optional().nullable(),
  dueDate: isoDate.optional().nullable(),
  payerType: z.enum(['self_funded', 'local_authority', 'nhs_continuing', 'mixed']).optional().nullable(),
}).passthrough();

export const housekeepingLogSchema = z.object({
  category: z.enum(['daily_room', 'weekly_room', 'quarterly_room', 'daily_communal']),
  items: z.array(z.object({
    specification: z.string().trim().min(1).max(500),
    taskId: z.string().uuid().optional().nullable(),
  })).min(1, 'at least one checklist item is required'),
  periodDate: isoDate.optional().nullable(),
  roomNumber: z.string().trim().max(20).optional().nullable(),
  residentId: uuid.optional().nullable(),
  communalArea: z.string().trim().max(60).optional().nullable(),
  initials: z.string().trim().max(10).optional().nullable(),
  locationType: z.string().trim().max(20).optional().nullable(),
}).passthrough();

export const upsertShiftSchema = z.object({
  staffId: uuid,
  shiftDate: isoDate,
  shiftType: z.enum(['day', 'evening', 'night', 'off', 'annual_leave', 'sick']).default('day'),
}).passthrough();

export const updateIncidentStatusSchema = z.object({
  status: z.enum(['open', 'review', 'escalated', 'closed']),
}).passthrough();

export const taskTemplateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  icon: z.string().trim().max(8).optional().nullable(),
  category: z.string().trim().max(40).optional().nullable(),
  shift: z.enum(['day', 'evening', 'night', 'all']).optional().nullable(),
  due_time: z.string().trim().min(4, 'due time required').max(8),
  window_mins: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(999).optional().nullable(),
  applies_to: z.string().trim().max(80).optional().nullable(),
  frequency: z.enum(['daily', 'weekly']).optional().nullable(),
  day_of_week: z.coerce.number().int().min(0).max(6).optional().nullable(),
  active: z.boolean().optional().nullable(),
}).passthrough();
