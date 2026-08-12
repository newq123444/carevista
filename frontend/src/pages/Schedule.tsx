import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useWeekRota, useColleagues } from '../hooks';
import { formatDate } from '../utils/formatters';

function getWeekDates(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

const SHIFT_COLORS: Record<string, string> = { day: '#f59e0b', evening: '#8b5cf6', night: '#0f766e', 'sleep-in': '#0891b2' };

export default function Schedule() {
  const { t: tr } = useLang();
  const [weekOffset, setWeekOffset] = useState(0);
  const days = getWeekDates(weekOffset);
  const start = days[0], end = days[6];
  const { data: rota = [], isLoading } = useWeekRota(start, end);
  const { data: staff = [] } = useColleagues();
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">📅 Rota / Schedule</h1><p className="page-subtitle">{formatDate(start)} — {formatDate(end)}</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>← Prev Week</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>{tr('Today')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Next Week →</button>
        </div>
      </div>
      {isLoading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading rota…</div> : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>Staff Member</th>
                {days.map((d, i) => {
                  const isToday = d === new Date().toISOString().slice(0, 10);
                  return <th key={d} style={{ padding: '12px 10px', textAlign: 'center', fontSize: 13, fontWeight: 700, borderBottom: '2px solid var(--border)', background: isToday ? '#eff6ff' : undefined, color: isToday ? '#0d9488' : undefined, minWidth: 90 }}>
                    <div>{DAY_NAMES[i]}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                  </th>;
                })}
              </tr>
            </thead>
            <tbody>
              {(staff as any[]).length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No staff loaded</td></tr>
              ) : (staff as any[]).map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.first_name} {s.last_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.job_title || s.role}</div>
                  </td>
                  {days.map(d => {
                    const shift = Array.isArray(rota) ? rota.find((r: any) => r.staff_id === s.id && r.shift_date === d) : undefined;
                    const sc = shift ? SHIFT_COLORS[shift.shift_type] || '#6b7280' : undefined;
                    return <td key={d} style={{ padding: '8px 6px', textAlign: 'center', background: d === new Date().toISOString().slice(0, 10) ? '#f8fbff' : undefined }}>
                      {shift ? (
                        <div style={{ padding: '4px 8px', borderRadius: 6, background: sc + '18', border: `1px solid ${sc}30`, fontSize: 12, fontWeight: 700, color: sc }}>
                          {shift.shift_type}<div style={{ fontSize: 10, fontWeight: 400, color: sc + 'cc' }}>{shift.start_time?.slice(0,5)}–{shift.end_time?.slice(0,5)}</div>
                        </div>
                      ) : <span style={{ color: '#d1d5db', fontSize: 18 }}>–</span>}
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
