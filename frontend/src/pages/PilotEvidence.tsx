// ────────────────────────────────────────────────────────────────────────────
// Pilot evidence — before and after, from the records, printable.
//
// For the home's own governance, for a commissioner, and for anyone assessing
// whether CareVista makes a difference. Every figure shows what it was made
// from; every measure says what it means and which way is better; and the
// limits of a before-and-after comparison are printed with it, every time.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useHome, useUpdateHome } from '../hooks';
import { PrintHeader, PrintButton } from '../components/PrintHeader';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const VERDICT = {
  better:  { fg: '#15803d', bg: '#f0fdf4', text: 'Better' },
  worse:   { fg: '#b91c1c', bg: '#fef2f2', text: 'Worse' },
  same:    { fg: '#475569', bg: '#f1f5f9', text: 'About the same' },
  unknown: { fg: '#64748b', bg: '#f8fafc', text: 'Cannot compare' },
} as const;

export default function PilotEvidence() {
  const { data: home } = useHome();
  const update = useUpdateHome();
  const saved = home?.settings?.pilot || {};
  const today = new Date();
  const [f, setF] = useState({
    baselineFrom: '', baselineTo: '', pilotFrom: iso(addDays(today, -28)), pilotTo: iso(addDays(today, -1)),
  });
  const [manual, setManual] = useState<Record<string, { value: number; source: string }>>({});
  const [editManual, setEditManual] = useState(false);

  useEffect(() => {
    if (!home) return;
    setF(x => ({
      baselineFrom: saved.baselineFrom || x.baselineFrom, baselineTo: saved.baselineTo || x.baselineTo,
      pilotFrom: saved.pilotFrom || x.pilotFrom, pilotTo: saved.pilotTo || x.pilotTo,
    }));
    setManual(saved.manual || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home]);

  const params = useMemo(() => {
    const p: Record<string, string> = { pilotFrom: f.pilotFrom, pilotTo: f.pilotTo };
    if (f.baselineFrom && f.baselineTo) { p.baselineFrom = f.baselineFrom; p.baselineTo = f.baselineTo; }
    return p;
  }, [f]);

  const report = useQuery({
    queryKey: ['pilot-report', params, home?.settings?.pilot?.manual],
    queryFn: () => api.get('/reports/pilot', { params }).then(r => r.data),
    enabled: !!f.pilotFrom && !!f.pilotTo,
  });
  const d: any = report.data;

  const save = () => update.mutate({ settings: { pilot: { ...f, manual } } });
  const groups = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const r of d?.rows || []) { if (!g.has(r.group)) g.set(r.group, []); g.get(r.group)!.push(r); }
    return [...g.entries()];
  }, [d]);

  const fmt = (c: any, unit: string) => {
    if (!c || c.value == null) return <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c?.note || '—'}</span>;
    const main = unit === '%' ? `${c.value}%` : unit === 'min' ? `${c.value} min` : String(c.value);
    return (
      <span>
        <strong style={{ fontSize: 17 }}>{main}</strong>
        {c.denominator != null && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>{c.numerator} of {c.denominator}</span>}
        {c.manual && <span style={{ display: 'block', fontSize: 12, color: '#92400e' }}>Entered by hand: {c.manual}</span>}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '4px 4px 40px' }}>
      <PrintHeader title="Pilot evidence report" subject={d ? `${d.home} · pilot ${d.periods.pilot[0]} to ${d.periods.pilot[1]}` : undefined} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Pilot evidence</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', maxWidth: 640, lineHeight: 1.5 }}>
            The same measures for a baseline period and the pilot period, worked out from the records themselves.
            Each figure shows the numbers behind it. Nothing is shown as a percentage where there are fewer than
            {' '}{d?.minDenominator ?? 20} cases.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="card no-print" style={{ padding: 16, margin: '16px 0', display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <Range label="Baseline (optional)" from={f.baselineFrom} to={f.baselineTo}
            onChange={(a, b) => setF(x => ({ ...x, baselineFrom: a, baselineTo: b }))} />
          <Range label="Pilot" from={f.pilotFrom} to={f.pilotTo}
            onChange={(a, b) => setF(x => ({ ...x, pilotFrom: a, pilotTo: b }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={save} disabled={update.isPending}>Save these dates for next time</button>
          <button className="btn btn-ghost" style={{ minHeight: 44 }} onClick={() => setEditManual(e => !e)}>
            {editManual ? 'Done entering baseline' : 'Enter a baseline from a paper audit'}
          </button>
        </div>
        {editManual && d && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              If you audited paper records before CareVista, enter the result here. It replaces the computed baseline
              for that measure and is always shown as entered by hand, with the source you give. Leave blank to use the records.
            </p>
            {(d.rows as any[]).map(r => (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) 90px minmax(160px, 2fr)', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 14 }}>{r.label}{r.unit === '%' ? ' (%)' : r.unit === 'min' ? ' (min)' : ''}</span>
                <input className="form-input" type="number" value={manual[r.key]?.value ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setManual(m => { const n = { ...m }; if (v === '') delete n[r.key]; else n[r.key] = { value: Number(v), source: m[r.key]?.source || '' }; return n; });
                  }} />
                <input className="form-input" placeholder="Source, e.g. audit of 20 files, March" value={manual[r.key]?.source ?? ''}
                  disabled={manual[r.key] == null}
                  onChange={e => setManual(m => ({ ...m, [r.key]: { ...m[r.key], source: e.target.value } }))} />
              </div>
            ))}
            <button className="btn btn-primary" style={{ justifySelf: 'start', minHeight: 44 }} onClick={save} disabled={update.isPending}>Save baseline</button>
          </div>
        )}
      </div>

      {report.isLoading ? <p>Working it out from the records…</p>
        : report.isError ? <p style={{ color: '#b91c1c' }}>{(report.error as any)?.response?.data?.error || 'Could not build the report.'}</p>
        : d && (
          <>
            {groups.map(([group, rows]) => (
              <div key={group} className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden', breakInside: 'avoid' }}>
                <div style={{ padding: '10px 14px', fontWeight: 700, background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--border)' }}>{group}</div>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '42%' }}>Measure</th>
                      <th>Baseline{d.periods.baseline ? <span style={{ display: 'block', fontWeight: 400, fontSize: 11 }}>{d.periods.baseline[0]} – {d.periods.baseline[1]}</span> : null}</th>
                      <th>Pilot<span style={{ display: 'block', fontWeight: 400, fontSize: 11 }}>{d.periods.pilot[0]} – {d.periods.pilot[1]}</span></th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any) => {
                      const v = VERDICT[r.verdict as keyof typeof VERDICT];
                      return (
                        <tr key={r.key}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.label}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 2 }}>
                              {r.definition} <em>{r.better === 'higher' ? 'Higher is better.' : 'Lower is better.'}</em>
                            </div>
                          </td>
                          <td>{fmt(r.baseline, r.unit)}</td>
                          <td>{fmt(r.pilot, r.unit)}</td>
                          <td>
                            {r.change != null && <div style={{ fontWeight: 700 }}>{r.change > 0 ? '+' : ''}{r.change}{r.unit === '%' ? ' points' : r.unit === 'min' ? ' min' : ''}</div>}
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: v.bg, color: v.fg }}>{v.text}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            <div className="card" style={{ padding: 16, breakInside: 'avoid' }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>What this report cannot show</h3>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 14 }}>
                {(d.limits as string[]).map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Generated {new Date(d.generatedAt).toLocaleString('en-GB')} by {d.generatedBy}, from the live records.
                Days are UK days. Re-running it for the same dates gives the same figures unless records were added late.
              </p>
            </div>
          </>
        )}
    </div>
  );
}

function Range({ label, from, to, onChange }: { label: string; from: string; to: string; onChange: (a: string, b: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input className="form-input" type="date" value={from} onChange={e => onChange(e.target.value, to)} style={{ minHeight: 44 }} />
        <span>to</span>
        <input className="form-input" type="date" value={to} onChange={e => onChange(from, e.target.value)} style={{ minHeight: 44 }} />
      </div>
    </div>
  );
}
