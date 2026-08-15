// src/components/LiveActivityFeed.tsx — real activity, drawn from actual records.
// Every entry corresponds to something a member of staff genuinely recorded:
// care notes, completed tasks, medication administrations, incidents,
// housekeeping, meals served, kitchen temperature checks, visitors and
// resident absences. Nothing is simulated — a quiet home shows a quiet feed.
import React, { useState } from 'react';
import { useActivityFeed } from '../hooks';

const DEPARTMENTS = ['all', 'Care', 'Nursing', 'Kitchen', 'Cleaning', 'Reception', 'Admin'] as const;

function timeAgo(ts: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LiveActivityFeed() {
  const [filter, setFilter] = useState<string>('all');
  const [hours, setHours] = useState(24);
  const { data, isLoading, isError, refetch, isFetching } = useActivityFeed(hours, 80);

  const entries: any[] = data?.entries || [];
  const shown = filter === 'all' ? entries : entries.filter(e => e.department === filter);

  return (
    <div className="card">
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Activity feed</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Live from care records{isFetching ? ' · refreshing…' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={hours} onChange={e => setHours(parseInt(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, background: 'var(--surface)', color: 'var(--text-primary)' }}>
              <option value={8}>Last 8 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={72}>Last 3 days</option>
            </select>
            <button onClick={() => refetch()} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2, #f8fafc)', fontSize: 12.5, cursor: 'pointer', color: 'var(--text-primary)' }}>
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {DEPARTMENTS.map(d => {
            const n = d === 'all' ? entries.length : entries.filter(e => e.department === d).length;
            return (
              <button key={d} onClick={() => setFilter(d)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (filter === d ? 'var(--primary)' : 'var(--border)'),
                  background: filter === d ? 'var(--primary)' : 'var(--surface)',
                  color: filter === d ? '#fff' : 'var(--text-secondary)' }}>
                {d === 'all' ? 'All' : d}{n > 0 ? ` (${n})` : ''}
              </button>
            );
          })}
        </div>

        {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>Loading activity…</div>}

        {isError && (
          <div style={{ padding: 16, borderRadius: 8, background: 'var(--danger-light, #fef2f2)', border: '1px solid var(--danger, #fecaca)', fontSize: 13 }}>
            Could not load the activity feed. Please try again.
          </div>
        )}

        {!isLoading && !isError && shown.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-2, #f8fafc)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            {entries.length === 0
              ? `Nothing recorded in the last ${hours} hours. Activity appears here as staff log care, medications, cleaning and meals.`
              : `No ${filter} activity in this period.`}
          </div>
        )}

        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {shown.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: e.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                {e.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{e.message}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {e.user} · {e.department}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(e.timestamp)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
