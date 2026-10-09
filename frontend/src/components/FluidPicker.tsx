// ────────────────────────────────────────────────────────────────────────────
// Exact fluid amount.
//
// A slider on its own is the wrong control for this job: it is fiddly with
// nitrile gloves, and landing on exactly 120 by dragging is hard for anyone.
// So the slider is one of three ways in:
//
//   • one-tap cup sizes for the common amounts
//   • big −50 / −10 / +10 / +50 buttons for the exact figure
//   • the slider, for a quick rough amount
//
// The number is shown large, because it is what goes on the fluid chart and the
// carer should be able to read it back at arm's length before saving.
//
// "Not set" and "drank nothing" are different answers and stay different —
// see fluidSelection() in quickOptions.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { clampFluid, FLUID_MAX_ML, FLUID_STEP_ML } from '../utils/quickOptions';

interface Props {
  /** null = not set yet. 0 = drank nothing. */
  value: number | null;
  onChange: (ml: number | null) => void;
}

const QUICK = [50, 100, 150, 200, 250, 300];

export default function FluidPicker({ value, onChange }: Props) {
  const set = (n: number) => onChange(clampFluid(n));
  const bump = (d: number) => set((value ?? 0) + d);
  const pct = value === null ? 0 : Math.round((value / FLUID_MAX_ML) * 100);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6,
        margin: '4px 0 12px', minHeight: 56,
      }}>
        {value === null ? (
          <span style={{ fontSize: 17, color: 'var(--text-secondary)' }}>Slide, or tap an amount</span>
        ) : value === 0 ? (
          <span style={{ fontSize: 30, fontWeight: 800, color: '#b91c1c' }}>Nothing</span>
        ) : (
          <>
            <span style={{ fontSize: 46, fontWeight: 800, color: '#0e7490', lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#0e7490' }}>ml</span>
          </>
        )}
      </div>

      <input
        type="range"
        className="cv-fluid-range"
        min={0} max={FLUID_MAX_ML} step={FLUID_STEP_ML}
        value={value ?? 0}
        onChange={e => set(Number(e.target.value))}
        aria-label="Amount drunk in millilitres"
        aria-valuetext={value === null ? 'not set' : `${value} millilitres`}
        style={{ ['--pct' as any]: `${pct}%` }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', margin: '4px 2px 14px' }}>
        <span>0</span><span>500</span><span>{FLUID_MAX_ML} ml</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
        {[-50, -10, 10, 50].map(d => (
          <button key={d} onClick={() => bump(d)}
            aria-label={`${d > 0 ? 'Add' : 'Take off'} ${Math.abs(d)} millilitres`}
            style={{
              minHeight: 64, borderRadius: 14, cursor: 'pointer', fontSize: 19, fontWeight: 700,
              border: '2px solid #a5f3fc', background: '#ecfeff', color: '#0e7490',
            }}>
            {d > 0 ? `+${d}` : `−${Math.abs(d)}`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {QUICK.map(ml => {
          const active = value === ml;
          return (
            <button key={ml} onClick={() => set(ml)} aria-pressed={active} style={{
              minHeight: 64, padding: '0 16px', borderRadius: 14, cursor: 'pointer',
              border: `2px solid ${active ? '#0891b2' : 'var(--border)'}`,
              background: active ? '#cffafe' : '#fff',
              fontSize: 16, fontWeight: active ? 700 : 500,
            }}>{ml} ml</button>
          );
        })}
        <button onClick={() => onChange(value === 0 ? null : 0)} aria-pressed={value === 0} style={{
          minHeight: 64, padding: '0 16px', borderRadius: 14, cursor: 'pointer',
          border: `2px solid ${value === 0 ? '#dc2626' : 'var(--border)'}`,
          background: value === 0 ? '#fef2f2' : '#fff', color: value === 0 ? '#b91c1c' : undefined,
          fontSize: 16, fontWeight: value === 0 ? 700 : 500,
        }}>🚫 Drank nothing</button>
        {value !== null && (
          <button onClick={() => onChange(null)} style={{
            minHeight: 64, padding: '0 16px', borderRadius: 14, cursor: 'pointer',
            border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 15,
          }}>Clear</button>
        )}
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '10px 0 0', lineHeight: 1.45 }}>
        Record what they actually drank, not what was offered. Half of a 200 ml cup is 100 ml.
      </p>
    </div>
  );
}
