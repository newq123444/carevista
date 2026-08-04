// src/pages/FamilyAccessManager.tsx — managers provision family portal access
import React, { useState } from 'react';
import { useResidents, useFamilyAccess, useProvisionFamily, useInviteFamily, useRevokeFamily, useRevokeInvite } from '../hooks';
import { SectionCard, PageHeading } from '../components/ui';
import { toast } from '../utils/toast';

export default function FamilyAccessManager() {
  const { data: residents = [] } = useResidents({ active: true });
  const { data } = useFamilyAccess();
  const provision = useProvisionFamily();
  const invite = useInviteFamily();
  const revoke = useRevokeFamily();
  const revokeInv = useRevokeInvite();
  const [mode, setMode] = useState<'provision' | 'invite'>('provision');
  const [form, setForm] = useState<any>({ residentId: '', email: '', firstName: '', lastName: '', relationship: '' });
  const [result, setResult] = useState<any>(null);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const links = data?.links || [];
  const invites = data?.invites || [];
  const input: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)' };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

  const submit = () => {
    if (!form.residentId) return toast.error('Choose a resident');
    if (mode === 'provision') {
      provision.mutate(form, { onSuccess: (r: any) => { setResult({ type: 'provision', ...r }); setForm({ residentId: '', email: '', firstName: '', lastName: '', relationship: '' }); } });
    } else {
      invite.mutate({ residentId: form.residentId, email: form.email, relationship: form.relationship },
        { onSuccess: (r: any) => setResult({ type: 'invite', ...r }) });
    }
  };
  const residentName = (id: string) => { const r = residents.find((x: any) => x.id === id); return r ? `${r.first_name} ${r.last_name}` : ''; };

  return (
    <div style={{ padding: 4, maxWidth: 960, margin: '0 auto' }}>
      <PageHeading greeting="Family portal access" emoji="👨‍👩‍👧" subtitle="Give relatives secure access to see updates, photos and message the team" />

      <SectionCard>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['provision', 'invite'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setResult(null); }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (mode === m ? 'var(--primary)' : 'var(--border)'), background: mode === m ? 'var(--primary)' : 'var(--surface)', color: mode === m ? '#fff' : 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {m === 'provision' ? '➕ Create account' : '✉️ Send invite code'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Resident</label>
            <select style={input} value={form.residentId} onChange={e => set('residentId', e.target.value)}>
              <option value="">Select…</option>
              {residents.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>)}
            </select>
          </div>
          {mode === 'provision' && <>
            <div><label style={label}>Family first name</label><input style={input} value={form.firstName} onChange={e => set('firstName', e.target.value)} /></div>
            <div><label style={label}>Family last name</label><input style={input} value={form.lastName} onChange={e => set('lastName', e.target.value)} /></div>
          </>}
          <div><label style={label}>Email{mode === 'invite' ? ' (optional)' : ''}</label><input style={input} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label style={label}>Relationship</label><input style={input} placeholder="e.g. Daughter" value={form.relationship} onChange={e => set('relationship', e.target.value)} /></div>
        </div>
        <button onClick={submit} disabled={provision.isPending || invite.isPending} style={{ marginTop: 14, padding: '10px 18px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
          {mode === 'provision' ? 'Create family account' : 'Generate invite code'}
        </button>

        {result?.type === 'provision' && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: 'var(--success-light)', border: '1px solid var(--success)' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6 }}>Account ready</div>
            <div style={{ fontSize: 14 }}>Email: <strong>{result.email}</strong></div>
            {result.tempPassword && <div style={{ fontSize: 14 }}>Temporary password: <strong>{result.tempPassword}</strong></div>}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{result.note}</div>
          </div>
        )}
        {result?.type === 'invite' && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: 'var(--success-light)', border: '1px solid var(--success)' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6 }}>Invite created</div>
            <div style={{ fontSize: 14 }}>Share this code — the family registers at <strong>/family-register</strong>:</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, marginTop: 6 }}>{result.code}</div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Family members with access (${links.length})`}>
        {links.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No family accounts yet.</div>}
        {links.map((l: any) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{l.first_name} {l.last_name}{l.relationship ? ` · ${l.relationship}` : ''}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.email} → {l.resident_first} {l.resident_last} (Room {l.room_number}){!l.active ? ' · inactive' : ''}</div>
            </div>
            <button onClick={() => { if (confirm(`Revoke ${l.first_name}'s access?`)) revoke.mutate(l.id); }} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>Revoke</button>
          </div>
        ))}
      </SectionCard>

      {invites.length > 0 && (
        <SectionCard title={`Pending invites (${invites.length})`}>
          {invites.map((i: any) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{i.code}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{i.resident_first} {i.resident_last}{i.email ? ` · ${i.email}` : ''}{i.relationship ? ` · ${i.relationship}` : ''}</div>
              </div>
              <button onClick={() => revokeInv.mutate(i.id)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}
