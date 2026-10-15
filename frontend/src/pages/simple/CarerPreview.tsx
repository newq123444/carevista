// ────────────────────────────────────────────────────────────────────────────
// What carers see — for managers and nurses, without switching their own app.
//
// Simple view is only for carers and senior carers. A manager still needs to
// see it: to check it, to train on it, and to show it to someone. This shows
// the carer's home screen inside the manager's normal app, clearly labelled.
// The round and handover behind it are real, so anything recorded from here is
// recorded in the manager's own name.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import SimpleHome from './SimpleHome';

export default function CarerPreview() {
  return (
    <div>
      <div style={{
        maxWidth: 560, margin: '0 auto 6px', padding: '10px 14px', borderRadius: 12,
        background: '#eef2ff', border: '1px solid #c7d2fe', color: '#3730a3', fontSize: 14, lineHeight: 1.5,
      }}>
        <strong>Preview — this is what carers and senior carers see.</strong> It uses real tasks:
        anything you record from here is recorded in your name.
      </div>
      <SimpleHome />
    </div>
  );
}
