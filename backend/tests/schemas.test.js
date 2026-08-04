'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const s = require('../dist/schemas');

const ok  = (schema, val) => assert.ok(schema.safeParse(val).success,  'expected VALID: ' + JSON.stringify(val));
const bad = (schema, val) => assert.ok(!schema.safeParse(val).success, 'expected INVALID: ' + JSON.stringify(val));
const UUID = '11111111-1111-1111-1111-111111111111';

test('createResidentSchema', () => {
  ok(s.createResidentSchema,  { firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1950-01-01' });
  bad(s.createResidentSchema, { lastName: 'NoFirst', dateOfBirth: '1950-01-01' });
  bad(s.createResidentSchema, { firstName: 'X', lastName: 'Y', dateOfBirth: '1950-01-01', riskLevel: 'nuclear' });
});

test('createNoteSchema — clinical ranges enforced', () => {
  ok(s.createNoteSchema,  { residentId: UUID, noteType: 'personal_care', content: 'settled' });
  bad(s.createNoteSchema, { residentId: 'not-a-uuid', noteType: 'general', content: 'x' });
  bad(s.createNoteSchema, { residentId: UUID, noteType: 'personal_care', content: 'x', painScore: 11 }); // 0-10
  bad(s.createNoteSchema, { residentId: UUID, noteType: 'nursing_observation', content: 'x', vitalSpo2: 150 }); // 0-100
});

test('createNoteSchema — invalid note_type rejected', () => {
  bad(s.createNoteSchema, { residentId: UUID, noteType: 'general', content: 'x' });
});

test('createIncidentSchema — severity enum', () => {
  ok(s.createIncidentSchema,  { incidentType: 'fall', severity: 'high', description: 'slip' });
  bad(s.createIncidentSchema, { incidentType: 'fall', severity: 'apocalyptic', description: 'x' });
});

test('recordAdministrationSchema — status enum + ids', () => {
  ok(s.recordAdministrationSchema,  { medicationId: UUID, residentId: UUID, status: 'given' });
  bad(s.recordAdministrationSchema, { medicationId: UUID, residentId: UUID, status: 'maybe' });
});

test('createStaffSchema — password length + email', () => {
  ok(s.createStaffSchema,  { email: 'a@b.com', password: 'longenough1', firstName: 'A', lastName: 'B' });
  bad(s.createStaffSchema, { email: 'a@b.com', password: 'short', firstName: 'A', lastName: 'B' });
  bad(s.createStaffSchema, { email: 'not-email', password: 'longenough1', firstName: 'A', lastName: 'B' });
});

test('createInvoiceSchema — non-negative amount', () => {
  ok(s.createInvoiceSchema,  { residentId: UUID, amountPence: 12000 });
  bad(s.createInvoiceSchema, { residentId: UUID, amountPence: -5 });
});

test('updateResidentSchema — passthrough + enum guard', () => {
  ok(s.updateResidentSchema,  { roomNumber: '12B', extraFieldKept: true });
  bad(s.updateResidentSchema, { riskLevel: 'wrong' });
});

test('recordAdministrationSchema — med_status enum matches DB', () => {
  const UUID = '11111111-1111-1111-1111-111111111111';
  ok(s.recordAdministrationSchema,  { medicationId: UUID, residentId: UUID, status: 'not_required' }); // valid DB value
  bad(s.recordAdministrationSchema, { medicationId: UUID, residentId: UUID, status: 'not_available' }); // not a DB value
  bad(s.recordAdministrationSchema, { medicationId: UUID, residentId: UUID, status: 'prn' });           // not a DB value
});

test('housekeepingLogSchema — category + items', () => {
  ok(s.housekeepingLogSchema,  { category: 'daily_room', items: [{ specification: 'Empty bins' }] });
  bad(s.housekeepingLogSchema, { category: 'weekly_bathroom', items: [{ specification: 'x' }] }); // bad category
  bad(s.housekeepingLogSchema, { category: 'daily_room', items: [] });                            // no items
});

test('upsertShiftSchema — shift_type enum + default', () => {
  const UUID = '11111111-1111-1111-1111-111111111111';
  ok(s.upsertShiftSchema,  { staffId: UUID, shiftDate: '2026-05-01', shiftType: 'night' });
  ok(s.upsertShiftSchema,  { staffId: UUID, shiftDate: '2026-05-01' }); // defaults shiftType
  bad(s.upsertShiftSchema, { staffId: UUID, shiftDate: '2026-05-01', shiftType: 'graveyard' });
});

test('updateIncidentStatusSchema — incident_status enum', () => {
  ok(s.updateIncidentStatusSchema,  { status: 'escalated' });
  bad(s.updateIncidentStatusSchema, { status: 'reopened' });
});
