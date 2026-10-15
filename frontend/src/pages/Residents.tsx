// ────────────────────────────────────────────────────────────────────────────
// Residents — faces first.
//
// A carer looks for a person, not a row. The grid shows every resident's photo
// (or their initials, in a colour that is always theirs), their room, and at
// most a couple of flags that matter now: not themselves, behind on fluids,
// care not recorded, away. Tap the person to record care or see their plan.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n';
import { useResidents, useResidentAbsences, useStartAbsence, useEndAbsence } from '../hooks';
import { useResidentStatus, type Flag } from '../hooks/useResidentStatus';
import { formatAge } from '../utils/formatters';
import { Icon } from '../components/Icon';
import { Avatar, Badge, PageHead, Empty, SearchBox } from '../components/ds';
import { useAuthStore } from '../store/auth.store';

const CAN_ADMIT = ['home_manager', 'deputy_manager', 'registered_nurse', 'admin', 'super_admin', 'group_admin'];
type View = 'photos' | 'list';
type Filter = 'all' | 'attention' | 'away';

export default function Residents() {
  const { t: tr, tf } = useLang();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>(() => (localStorage.getItem('cv-residents-view') as View) || 'photos');
  const [filter, setFilter] = useState<Filter>('all');
  const { data: residents = [], isLoading } = useResidents({ active: true });
  const { data: absences = [] } = useResidentAbsences(true);
  const status = useResidentStatus();
  const startAbsence = useStartAbsence();
  const endAbsence = useEndAbsence();
  const [awayFor, setAwayFor] = useState<any>(null);
  const [awayForm, setAwayForm] = useState({ absence_type: 'hospital', reason: '', expected_return: '', planned: false });
  const awayMap = new Map((Array.isArray(absences) ? absences : []).map((a: any) => [a.resident_id, a]));

  const setViewSaved = (v: View) => { setView(v); try { localStorage.setItem('cv-residents-view', v); } catch { /* private mode */ } };

  const all: any[] = Array.isArray(residents) ? residents : [];
  const sorted = useMemo(() => [...all].sort((a, b) =>
    String(a.room_number || '').localeCompare(String(b.room_number || ''), undefined, { numeric: true })), [all]);
  const attention = sorted.filter(r => status.get(r.id)?.dot);
  const away = sorted.filter(r => awayMap.has(r.id));
  const shown = (filter === 'attention' ? attention : filter === 'away' ? away : sorted).filter(r => {
    const q = search.trim().toLowerCase();
    return !q || `${r.first_name} ${r.last_name} ${r.preferred_name || ''} ${r.room_number || ''}`.toLowerCase().includes(q);
  });

  const flagLabel = (f: Flag) => (f.vars ? tf(f.label, f.vars) : f.count != null ? tf(f.label, { n: f.count }) : tr(f.label));
  const flagsFor = (r: any): Flag[] => {
    const s = status.get(r.id);
    const f = [...(s?.flags || [])];
    if (r.dnacpr) f.push({ tone: 'grey', label: 'DNACPR' });
    return f;
  };

  return (
    <div className="cv-page">
      <PageHead
        eyebrow={user?.careHomeName}
        title={tr('Residents')}
        sub={<>{tf('{n} living here', { n: sorted.length })}{away.length > 0 && <> · {tf('{n} away', { n: away.length })}</>}{attention.length > 0 && <> · <b style={{ color: 'var(--red-700)' }}>{tf('{n} need something now', { n: attention.length })}</b></>}</>}
        actions={<>
          <div className="cv-seg" role="group" aria-label={tr('View')}>
            <button className={view === 'photos' ? 'active' : ''} onClick={() => setViewSaved('photos')}><Icon name="layout-dashboard" size={16} />{tr('Photos')}</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setViewSaved('list')}><Icon name="list-checks" size={16} />{tr('List')}</button>
          </div>
          {CAN_ADMIT.includes(user?.role || '') && (
            <Link to="/residents/new" className="cv-btn cv-btn-primary"><Icon name="plus" size={18} />{tr('Admit resident')}</Link>
          )}
        </>}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ flex: '1 1 280px' }}><SearchBox value={search} onChange={setSearch} placeholder={tr('Find a resident by name or room')} /></div>
        <div className="cv-seg" role="group" aria-label={tr('Filter')}>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{tr('Everyone')}</button>
          <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>
            {tr('Needs something')}{attention.length > 0 && <span className="cv-badge cv-badge-red" style={{ height: 20 }}>{attention.length}</span>}
          </button>
          <button className={filter === 'away' ? 'active' : ''} onClick={() => setFilter('away')}>{tr('Away')}</button>
        </div>
      </div>

      {isLoading ? (
        <div className="cv-resident-grid" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="cv-resident-tile" style={{ background: 'var(--surface-2)' }} />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="cv-card"><Empty icon="users" title={search ? tr('Nobody matches that search') : filter === 'attention' ? tr('Nobody needs anything right now') : tr('No residents yet')}>
          {!search && filter === 'all' && tr('Admit your first resident to start recording their care.')}
        </Empty></div>
      ) : view === 'photos' ? (
        <div className="cv-resident-grid">
          {shown.map(r => {
            const s = status.get(r.id);
            const flags = flagsFor(r).slice(0, 2);
            const name = `${r.first_name} ${r.last_name}`;
            return (
              <Link key={r.id} to={`/residents/${r.id}`} className={`cv-resident-tile${s?.away ? ' away' : ''}`} aria-label={`${name}, ${tr('Room')} ${r.room_number || ''}`}>
                {s?.dot && <span className="cv-tile-dot" style={{ background: s.dot === 'red' ? 'var(--red-600)' : 'var(--amber-600)' }} />}
                <Avatar name={name} photo={r.photo_url} size={76} />
                <div className="cv-resident-name">{r.preferred_name ? `${r.preferred_name} ${r.last_name}` : name}</div>
                <div className="cv-resident-meta">{tr('Room')} {r.room_number || '—'}{r.date_of_birth ? ` · ${formatAge(r.date_of_birth)}` : ''}</div>
                <div className="cv-resident-flags">
                  {flags.map((f, i) => <Badge key={i} tone={f.tone} icon={f.icon}>{flagLabel(f)}</Badge>)}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="cv-card" style={{ overflow: 'hidden' }}>
          {shown.map((r, i) => {
            const s = status.get(r.id);
            const name = `${r.first_name} ${r.last_name}`;
            const a: any = awayMap.get(r.id);
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
                <Avatar name={name} photo={r.photo_url} size={44} />
                <button onClick={() => nav(`/residents/${r.id}`)} style={{ flex: '1 1 220px', minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, minHeight: 44 }}>
                  <div style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{name}{r.preferred_name && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · “{r.preferred_name}”</span>}</div>
                  <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    {tr('Room')} {r.room_number || '—'}{r.date_of_birth ? ` · ${formatAge(r.date_of_birth)}` : ''}{r.nhs_number ? ` · NHS ${r.nhs_number}` : ''}
                  </div>
                </button>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {flagsFor(r).slice(0, 3).map((f, j) => <Badge key={j} tone={f.tone} icon={f.icon}>{flagLabel(f)}</Badge>)}
                  {a ? (
                    <button className="cv-btn cv-btn-secondary" style={{ minHeight: 36, padding: '6px 12px', fontSize: '.85rem' }}
                      onClick={() => endAbsence.mutate({ id: a.id, data: {} })}>{tr('Mark returned')}</button>
                  ) : (
                    <button className="cv-btn cv-btn-quiet" style={{ minHeight: 36, padding: '6px 12px', fontSize: '.85rem' }}
                      onClick={() => { setAwayFor(r); setAwayForm({ absence_type: 'hospital', reason: '', expected_return: '', planned: false }); }}>{tr('Mark away')}</button>
                  )}
                  <Icon name="chevron-right" size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
                {s?.dueNow ? <span className="cv-badge cv-badge-brand" style={{ marginLeft: 58 }}>{tf('{n} to do now', { n: s.dueNow })}</span> : null}
              </div>
            );
          })}
        </div>
      )}

      {awayFor && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAwayFor(null); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{tr('Record as away')}</h2>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{awayFor.first_name} {awayFor.last_name} · {tr('Room')} {awayFor.room_number}</div>
              </div>
              <button className="modal-close" onClick={() => setAwayFor(null)} aria-label="Close"><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div style={{ padding: 11, background: 'var(--blue-50)', borderRadius: 10, fontSize: 13.5, color: 'var(--blue-700)' }}>
                {tr("Their bed and record are kept. Care tasks and meals pause while they are away, and these days won't count against care-completion.")}
              </div>
              <label className="form-label">{tr('Reason for absence')}
                <select className="form-input" style={{ width: '100%', marginTop: 4 }} value={awayForm.absence_type} onChange={e => setAwayForm(f => ({ ...f, absence_type: e.target.value }))}>
                  <option value="hospital">{tr('Hospital admission')}</option>
                  <option value="home_leave">{tr('Home leave with family')}</option>
                  <option value="respite_elsewhere">{tr('Respite elsewhere')}</option>
                  <option value="other">{tr('Other')}</option>
                </select>
              </label>
              <label className="form-label">{tr('Details (optional)')}
                <input className="form-input" style={{ width: '100%', marginTop: 4 }} value={awayForm.reason} onChange={e => setAwayForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder={tr('e.g. Admitted after a fall — suspected fracture')} />
              </label>
              <label className="form-label">{tr('Expected return (optional)')}
                <input className="form-input" type="date" style={{ width: '100%', marginTop: 4 }} value={awayForm.expected_return} onChange={e => setAwayForm(f => ({ ...f, expected_return: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={awayForm.planned} onChange={e => setAwayForm(f => ({ ...f, planned: e.target.checked }))} />
                {tr('This was planned (not an emergency admission)')}
              </label>
            </div>
            <div className="modal-footer">
              <button className="cv-btn cv-btn-secondary" onClick={() => setAwayFor(null)}>{tr('Cancel')}</button>
              <button className="cv-btn cv-btn-primary" disabled={startAbsence.isPending}
                onClick={() => startAbsence.mutate(
                  { resident_id: awayFor.id, absence_type: awayForm.absence_type, reason: awayForm.reason || null,
                    expected_return: awayForm.expected_return || null, planned: awayForm.planned },
                  { onSuccess: () => setAwayFor(null) })}>
                {startAbsence.isPending ? tr('Saving…') : tr('Record as away')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
