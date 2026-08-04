'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { validateBody, guardWriteBody } = require('../dist/middleware/validate');
const { createNoteSchema } = require('../dist/schemas');

function runMw(mw, req) {
  let nexted = false, statusCode = null, jsonBody = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b)   { jsonBody = b; return this; },
  };
  mw(req, res, () => { nexted = true; });
  return { nexted, statusCode, jsonBody };
}

test('validateBody: valid -> next()', () => {
  const r = runMw(validateBody(createNoteSchema),
    { body: { residentId: '11111111-1111-1111-1111-111111111111', noteType: 'personal_care', content: 'ok' } });
  assert.equal(r.nexted, true);
  assert.equal(r.statusCode, null);
});

test('validateBody: invalid -> 400 with issues', () => {
  const r = runMw(validateBody(createNoteSchema), { body: { noteType: 'general' } });
  assert.equal(r.nexted, false);
  assert.equal(r.statusCode, 400);
  assert.ok(Array.isArray(r.jsonBody.issues));
});

test('guardWriteBody: GET bypasses', () => {
  const r = runMw(guardWriteBody, { method: 'GET', body: { anything: 1 } });
  assert.equal(r.nexted, true);
});

test('guardWriteBody: rejects prototype-pollution key', () => {
  const r = runMw(guardWriteBody, { method: 'POST', body: JSON.parse('{"__proto__": {"admin": true}}') });
  assert.equal(r.statusCode, 400);
  assert.equal(r.nexted, false);
});

test('guardWriteBody: rejects array body', () => {
  const r = runMw(guardWriteBody, { method: 'POST', body: [1, 2, 3] });
  assert.equal(r.statusCode, 400);
});

test('guardWriteBody: rejects oversized string field', () => {
  const r = runMw(guardWriteBody, { method: 'PATCH', body: { note: 'x'.repeat(50001) } });
  assert.equal(r.statusCode, 400);
});

test('guardWriteBody: allows normal nested object', () => {
  const r = runMw(guardWriteBody, { method: 'POST', body: { a: 1, b: { c: 'ok', d: [1, 2] } } });
  assert.equal(r.nexted, true);
  assert.equal(r.statusCode, null);
});

test('guardWriteBody: empty body passes (action endpoints)', () => {
  const r = runMw(guardWriteBody, { method: 'POST', body: {} });
  assert.equal(r.nexted, true);
});
