// ────────────────────────────────────────────────────────────────────────────
// Fire grab sheet: every resident's PEEP on one printable page, by floor.
//
// What the fire service and the person in charge need at the door: who is
// where, their category, how many staff and what equipment, how to alert
// them, and anyone who is out of the building. Print it after any change and
// keep it in the fire grab pack. Residents with no PEEP are listed first.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/ds';
import { usePeepRegister } from '../hooks';
import { formatDate, formatDateTime } from '../utils/formatters';

const FLOOR: Record<string, string> = { ground: 'Ground floor', first: 'First floor', second: 'Second floor', higher: 'Higher floors' };
const HEARS: Record<string, string> = { yes: 'Hears alarm', alert: 'Alert in person', no: 'Will not hear — alert in person' };
const UNDERSTANDS: Record<string, string> = { yes: 'Follows instructions', reassure: 'Needs reassurance', may_refuse: 'May refuse or go back' };

export default function FireGrabSheet() {
  const { data, isLoading } = usePeepRegister();
  if (isLoading || !data) return <div className="page">Loading…</div>;
  const residents: any[] = data.residents || [];
  const missing = residents.filter(r => !r.hasPeep);
  const groups = new Map<string, any[]>();
  for (const r of residents.filter(x => x.hasPeep)) {
    const k = r.floor || 'unknown';
    groups.set(k, [...(groups.get(k) || []), r]);
  }
  const order = ['ground', 'first', 'second', 'higher', 'unknown'];
  const totals = { red: 0, amber: 0, green: 0 } as Record<string, number>;
  for (const r of residents) if (r.category && !r.away) totals[r.category] = (totals[r.category] || 0) + 1;

  return (
    <div className="page" style={{ display: 'grid', gap: 14 }}>
      <div className="no-print">
        <PageHead eyebrow={<Link to="/risk-assessments" style={{ color: 'inherit' }}>Assessments</Link>} title="Fire grab sheet"
          sub="Every resident's evacuation plan on one page. Print it after any change and keep it in the fire grab pack."
          actions={<button className="cv-btn cv-btn-primary" onClick={() => window.print()}><Icon name="printer" size={17} />Print</button>} />
      </div>
      <div>
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>{data.homeName} — Personal emergency evacuation plans</h1>
        <div style={{ fontSize: '.86rem', color: 'var(--text-secondary)' }}>
          Printed {formatDateTime(data.printedAt)} · In the building: <strong>{totals.red || 0} red</strong>, <strong>{totals.amber || 0} amber</strong>, <strong>{totals.green || 0} green</strong>
          {residents.some(r => r.away) && <> · {residents.filter(r => r.away).length} away (not in the building)</>}
        </div>
        <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Red: 3 or more staff, or evacuation equipment. Amber: 1–2 staff, no equipment. Green: leaves unaided. Check against the signing-in book.
        </div>
      </div>

      {missing.length > 0 && (
        <div className="cv-note cv-note-red"><Icon name="triangle-alert" size={16} />
          <span><strong>No PEEP:</strong> {missing.map(r => `${r.name} (room ${r.room})`).join(', ')}. Treat as needing help until assessed.</span></div>
      )}

      {order.filter(k => groups.has(k)).map(k => (
        <section key={k}>
          <h2 style={{ fontSize: '1.05rem', margin: '6px 0' }}>{FLOOR[k] || 'Floor not recorded'}</h2>
          <div className="table-container">
            <table className="cv-grab">
              <thead><tr><th>Room</th><th>Name</th><th>PEEP</th><th>Staff day / night</th><th>Equipment</th><th>Alarm and understanding</th><th>Route and notes</th></tr></thead>
              <tbody>
                {groups.get(k)!.map(r => (
                  <tr key={r.residentId} style={r.away ? { opacity: .55 } : undefined}>
                    <td style={{ fontWeight: 700 }}>{r.room}</td>
                    <td>{r.name}{r.preferredName ? ` ("${r.preferredName}")` : ''}{r.away && <div style={{ fontWeight: 700 }}>AWAY — not in building</div>}</td>
                    <td><span className={`cv-peep cv-peep-${r.category || 'none'}`}>{(r.category || '—').toUpperCase()}</span>
                      {r.overdue && <div style={{ fontSize: '.72rem', color: 'var(--red-700)' }}>review overdue</div>}</td>
                    <td>{r.staffDay ?? '—'} / {r.staffNight ?? '—'}</td>
                    <td>{(r.equipment || []).join(', ') || 'None'}{(r.medical || []).includes('oxygen') && <div style={{ fontWeight: 700 }}>OXYGEN</div>}</td>
                    <td>{HEARS[r.hears] || '—'}<br />{UNDERSTANDS[r.understands] || ''}</td>
                    <td>{r.route}{r.notes && <div style={{ color: 'var(--text-secondary)' }}>{r.notes}</div>}
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Assessed {formatDate(r.assessedAt)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
