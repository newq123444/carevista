// ────────────────────────────────────────────────────────────────────────────
// Record care — the resident-first way in.
//
// The round asks "what's due now?". This asks "who are you with?": tap their
// photo, tap what you did, answer two or three questions, save. Both write
// the same notes; whichever a carer reaches for first is the right one.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useResidents } from '../hooks';
import { useResidentStatus } from '../hooks/useResidentStatus';
import { useLang } from '../i18n';
import { Icon } from '../components/Icon';
import { Avatar, Badge, PageHead, SearchBox, Empty } from '../components/ds';
import { RecordPanel } from '../components/RecordPanel';
import { ResidentToday } from '../components/ResidentToday';

export default function RecordCare() {
  const { t: tr, tf } = useLang();
  const [params, setParams] = useSearchParams();
  const residentId = params.get('resident') || '';
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useResidents({ active: true });
  const status = useResidentStatus();
  const all: any[] = Array.isArray(data) ? data : [];
  const sorted = useMemo(() => [...all].sort((a, b) => String(a.room_number || '').localeCompare(String(b.room_number || ''), undefined, { numeric: true })), [all]);
  const resident = sorted.find(r => r.id === residentId);
  const choose = (id: string) => { setParams(id ? { resident: id } : {}); window.scrollTo({ top: 0 }); };

  if (resident) {
    const name = `${resident.first_name} ${resident.last_name}`;
    const s = status.get(resident.id);
    return (
      <div className="cv-page">
        <button className="cv-btn cv-btn-quiet" onClick={() => choose('')} style={{ marginBottom: 10, paddingLeft: 6 }}>
          <Icon name="arrow-left" size={18} />{tr('Choose someone else')}
        </button>
        <div className="cv-card cv-card-pad" style={{ marginBottom: 14 }}>
          <div className="cv-resident-head">
            <Avatar name={name} photo={resident.photo_url} size={64} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="cv-eyebrow">{tr('Room')} {resident.room_number || '—'}</div>
              <h1 className="cv-h1" style={{ fontSize: '1.45rem' }}>{name}</h1>
              {resident.preferred_name && <p className="cv-sub">{tf('Likes to be called {name}', { name: resident.preferred_name })}</p>}
              {!!s?.flags.length && <div className="cv-facts">{s.flags.slice(0, 3).map((f, i) => <Badge key={i} tone={f.tone} icon={f.icon}>{f.vars ? tf(f.label, f.vars) : f.count != null ? tf(f.label, { n: f.count }) : tr(f.label)}</Badge>)}</div>}
            </div>
            <Link to={`/residents/${resident.id}`} className="cv-btn cv-btn-secondary"><Icon name="user-round" size={18} />{tr('Full record')}</Link>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
          <div className="cv-card cv-card-pad"><RecordPanel resident={resident} /></div>
          <div className="cv-card cv-card-pad">
            <h2 className="cv-section-title"><Icon name="clock" size={18} />{tr('Today so far')}</h2>
            <ResidentToday residentId={resident.id} compact />
          </div>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const shown = sorted.filter(r => !q || `${r.first_name} ${r.last_name} ${r.preferred_name || ''} ${r.room_number || ''}`.toLowerCase().includes(q));
  return (
    <div className="cv-page">
      <PageHead title={tr('Record care')} sub={tr('Who are you with? Tap their photo.')} />
      <div style={{ marginBottom: 16 }}><SearchBox value={search} onChange={setSearch} placeholder={tr('Find a resident by name or room')} /></div>
      {isLoading ? <p style={{ color: 'var(--text-muted)' }}>{tr('Loading…')}</p> : shown.length === 0 ? (
        <div className="cv-card"><Empty icon="users" title={tr('Nobody matches that search')} /></div>
      ) : (
        <div className="cv-resident-grid">
          {shown.map(r => {
            const name = `${r.first_name} ${r.last_name}`;
            const s = status.get(r.id);
            return (
              <button key={r.id} className={`cv-resident-tile${s?.away ? ' away' : ''}`} onClick={() => choose(r.id)} style={{ font: 'inherit' }}>
                {s?.dot && <span className="cv-tile-dot" style={{ background: s.dot === 'red' ? 'var(--red-600)' : 'var(--amber-600)' }} />}
                <Avatar name={name} photo={r.photo_url} size={72} />
                <span className="cv-resident-name">{r.preferred_name ? `${r.preferred_name} ${r.last_name}` : name}</span>
                <span className="cv-resident-meta">{tr('Room')} {r.room_number || '—'}</span>
                <span className="cv-resident-flags">
                  {s?.dueNow ? <Badge tone="brand" icon="clock">{tf('{n} to do now', { n: s.dueNow })}</Badge> : null}
                  {s?.flags.slice(0, s?.dueNow ? 1 : 2).map((f, i) => <Badge key={i} tone={f.tone} icon={f.icon}>{f.vars ? tf(f.label, f.vars) : f.count != null ? tf(f.label, { n: f.count }) : tr(f.label)}</Badge>)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
