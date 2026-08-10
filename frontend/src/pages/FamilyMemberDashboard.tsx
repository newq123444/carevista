// src/pages/FamilyMemberDashboard.tsx — the family member's own portal
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useAuthStore } from '../store/auth.store';
import { usePortalMe, usePortalFeed, usePortalPhotos, usePortalMessages, useSendPortalMessage, usePortalHighlights } from '../hooks';

type Tab = 'updates' | 'photos' | 'messages' | 'care';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

export default function FamilyMemberDashboard() {
  const { t } = useLang();
  const { user, logout } = useAuthStore();
  const { data: me } = usePortalMe();
  const residents = me?.residents || [];
  const [rid, setRid] = useState<string | undefined>(undefined);
  const activeRid = rid || residents[0]?.id;
  const [tab, setTab] = useState<Tab>('updates');
  const resident = residents.find((r: any) => r.id === activeRid) || residents[0];

  const teal = 'var(--primary, #0f766e)';
  const shell: React.CSSProperties = { minHeight: '100vh', background: '#f6f8f9' };
  const tabBtn = (t: Tab, icon: string, label: string) => (
    <button onClick={() => setTab(t)} style={{
      flex: 1, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer',
      color: tab === t ? teal : '#64748b', fontWeight: tab === t ? 700 : 500, fontSize: 12,
      borderTop: tab === t ? `2px solid ${teal}` : '2px solid transparent',
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>{label}
    </button>
  );

  return (
    <div style={shell}>
      <header style={{ background: teal, color: '#fff', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>{me?.careHomeName || 'Family portal'}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {resident ? `${resident.firstName} ${resident.lastName}` : 'Welcome'}
            {resident?.room ? <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.85 }}> · Room {resident.room}</span> : null}
          </div>
        </div>
        <button onClick={() => logout()} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>{t('Sign out')}</button>
      </header>

      {residents.length > 1 && (
        <div style={{ padding: '10px 18px 0' }}>
          <select value={activeRid} onChange={e => setRid(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #dbe2e6', width: '100%' }}>
            {residents.map((r: any) => <option key={r.id} value={r.id}>{r.firstName} {r.lastName}{r.relationship ? ` (${r.relationship})` : ''}</option>)}
          </select>
        </div>
      )}

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px 84px' }}>
        {!resident && <Card><p style={{ color: '#64748b' }}>Your account isn't linked to a resident yet. Please contact the care home.</p></Card>}
        {resident && tab === 'updates' && <Updates rid={activeRid} />}
        {resident && tab === 'photos' && <Photos rid={activeRid} />}
        {resident && tab === 'messages' && <Messages rid={activeRid} name={`${user?.firstName || ''}`} />}
        {resident && tab === 'care' && <Care rid={activeRid} />}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: '#fff', borderTop: '1px solid #e5eaed', maxWidth: 640, margin: '0 auto' }}>
        {tabBtn('updates', '📰', 'Updates')}
        {tabBtn('photos', '📷', 'Photos')}
        {tabBtn('messages', '💬', 'Messages')}
        {tabBtn('care', '💚', 'Care')}
      </nav>
    </div>
  );
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e9eef0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      {title && <div style={{ fontWeight: 700, marginBottom: 10, color: '#0f172a' }}>{title}</div>}
      {children}
    </div>
  );
}

function Updates({ rid }: { rid?: string }) {
  const { t } = useLang();
  const { data, isLoading } = usePortalFeed(rid);
  if (isLoading) return <Card><span style={{ color: '#94a3b8' }}>{t('Loading…')}</span></Card>;
  const summaries = data?.summaries || [];
  const wb = data?.wellbeing || [];
  return (
    <>
      {wb[0] && (
        <Card title="How they're doing">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Pill label={t('Mood')} value={wb[0].mood} />
            <Pill label={t('Appetite')} value={wb[0].appetite} />
            <Pill label={t('Energy')} value={wb[0].energy} />
            <Pill label={t('Social')} value={wb[0].social} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>As of {fmtDate(wb[0].date)}</div>
        </Card>
      )}
      {summaries.length === 0 && <Card><p style={{ color: '#64748b', margin: 0 }}>No daily updates have been shared yet. The care team posts these regularly.</p></Card>}
      {summaries.map((s: any, i: number) => (
        <Card key={i} title={fmtDate(s.summary_date)}>
          {s.activities_summary && <Line icon="🎨" text={s.activities_summary} />}
          {s.meals_summary && <Line icon="🍽️" text={s.meals_summary} />}
          {s.mood_summary && <Line icon="😊" text={s.mood_summary} />}
          {s.care_notes_summary && <Line icon="📝" text={s.care_notes_summary} />}
        </Card>
      ))}
    </>
  );
}
function Line({ icon, text }: { icon: string; text: string }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14, color: '#334155' }}><span>{icon}</span><span>{text}</span></div>;
}
function Pill({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div style={{ background: '#f0f5f4', borderRadius: 10, padding: '6px 10px', fontSize: 12 }}>
    <span style={{ color: '#94a3b8' }}>{label}: </span><span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{value}</span>
  </div>;
}

function Photos({ rid }: { rid?: string }) {
  const { t } = useLang();
  const { data, isLoading } = usePortalPhotos(rid);
  const photos = data?.photos || [];
  if (isLoading) return <Card><span style={{ color: '#94a3b8' }}>{t('Loading…')}</span></Card>;
  if (photos.length === 0) return <Card><p style={{ color: '#64748b', margin: 0 }}>No photos have been shared yet. The care team shares moments from activities and events here.</p></Card>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {photos.map((p: any) => (
        <div key={p.id} style={{ background: '#fff', border: '1px solid #e9eef0', borderRadius: 12, overflow: 'hidden' }}>
          <img src={p.photo_url} alt={p.caption || 'Photo'} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
          {p.caption && <div style={{ padding: '7px 9px', fontSize: 12, color: '#334155' }}>{p.caption}</div>}
        </div>
      ))}
    </div>
  );
}

function Messages({ rid, name }: { rid?: string; name: string }) {
  const { t } = useLang();
  const { data } = usePortalMessages(rid);
  const send = useSendPortalMessage(rid);
  const [text, setText] = useState('');
  const msgs = data?.messages || [];
  const submit = () => { if (!text.trim()) return; send.mutate(text.trim(), { onSuccess: () => setText('') }); };
  return (
    <Card title="Messages with the care team">
      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {msgs.length === 0 && <p style={{ color: '#64748b' }}>No messages yet. Say hello or ask the team anything.</p>}
        {msgs.map((m: any) => {
          const fromFamily = m.direction === 'inbound';
          return (
            <div key={m.id} style={{ alignSelf: fromFamily ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <div style={{ background: fromFamily ? 'var(--primary, #0f766e)' : '#eef2f4', color: fromFamily ? '#fff' : '#0f172a', padding: '8px 12px', borderRadius: 12, fontSize: 14 }}>{m.body}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: fromFamily ? 'right' : 'left' }}>{fromFamily ? 'You' : m.from_name} · {fmtDate(m.created_at)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Write a message…" style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #dbe2e6' }} />
        <button onClick={submit} disabled={!text.trim() || send.isPending} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--primary, #0f766e)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{t('Send')}</button>
      </div>
    </Card>
  );
}

function Care({ rid }: { rid?: string }) {
  const { t } = useLang();
  const { data, isLoading } = usePortalHighlights(rid);
  if (isLoading || !data) return <Card><span style={{ color: '#94a3b8' }}>{t('Loading…')}</span></Card>;
  const c = data.careThisWeek;
  return (
    <>
      <Card title={t('Wellbeing')}>
        <div style={{ fontSize: 15, color: '#0f766e', fontWeight: 600 }}>{data.wellbeingSummary}</div>
      </Card>
      <Card title="Care this week">
        {c.pct == null ? <p style={{ color: '#64748b', margin: 0 }}>No scheduled care recorded this week yet.</p> : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700 }}>{c.pct}%</span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{c.completed} of {c.total} care tasks completed</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: '#eef2f4', overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--primary, #0f766e)' }} />
            </div>
          </>
        )}
      </Card>
      <Card title="Weight & nutrition"><div style={{ fontSize: 14, color: '#334155' }}>{data.weightTrend}</div></Card>
      {data.recentNotes?.length > 0 && (
        <Card title="Recent care highlights">
          {data.recentNotes.map((n: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid #eef2f4' : 'none' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{String(n.type).replace(/_/g, ' ')} · {fmtDate(n.date)}</div>
              <div style={{ fontSize: 14, color: '#334155' }}>{n.content}</div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
