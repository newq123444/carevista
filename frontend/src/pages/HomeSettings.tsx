// src/pages/HomeSettings.tsx — care home profile & settings (manager)
import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { useHome, useUpdateHome } from '../hooks';
import { SectionCard, PageHeading } from '../components/ui';

export default function HomeSettings() {
  const { t: tr } = useLang();
  const { data: home, isLoading } = useHome();
  const update = useUpdateHome();
  const [f, setF] = useState<any>({});
  useEffect(() => { if (home) setF({
    name: home.name || '', address: home.address || '', postcode: home.postcode || '', phone: home.phone || '',
    email: home.email || '', cqc_location_id: home.cqc_location_id || '',
    brand: home.settings?.brand_color || '#0f766e',
    day_start: home.settings?.day_start || '07:00', evening_start: home.settings?.evening_start || '15:00', night_start: home.settings?.night_start || '22:00',
    isolation_days: home.settings?.isolation_days ?? 7,
  }); }, [home]);
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const save = () => update.mutate({
    name: f.name, address: f.address, postcode: f.postcode, phone: f.phone, email: f.email, cqc_location_id: f.cqc_location_id,
    settings: { brand_color: f.brand, day_start: f.day_start, evening_start: f.evening_start, night_start: f.night_start, isolation_days: Number(f.isolation_days) },
  });

  const input: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)' };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 };
  if (isLoading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>{tr('Loading…')}</div>;

  return (
    <div style={{ padding: 4, maxWidth: 760, margin: '0 auto' }}>
      <PageHeading greeting="Home settings" emoji="⚙️" subtitle="Your care home profile and preferences" />
      <SectionCard title="Home profile">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Home name</label><input style={input} value={f.name} onChange={e => set('name', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Address</label><input style={input} value={f.address} onChange={e => set('address', e.target.value)} /></div>
          <div><label style={label}>Postcode</label><input style={input} value={f.postcode} onChange={e => set('postcode', e.target.value)} /></div>
          <div><label style={label}>Phone</label><input style={input} value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label style={label}>Email</label><input style={input} value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label style={label}>CQC location ID</label><input style={input} value={f.cqc_location_id} onChange={e => set('cqc_location_id', e.target.value)} /></div>
        </div>
      </SectionCard>
      <SectionCard title="Shift times">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div><label style={label}>Day starts</label><input type="time" style={input} value={f.day_start} onChange={e => set('day_start', e.target.value)} /></div>
          <div><label style={label}>Evening starts</label><input type="time" style={input} value={f.evening_start} onChange={e => set('evening_start', e.target.value)} /></div>
          <div><label style={label}>Night starts</label><input type="time" style={input} value={f.night_start} onChange={e => set('night_start', e.target.value)} /></div>
        </div>
      </SectionCard>
      <SectionCard title="Preferences">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={label}>Brand colour</label><input type="color" style={{ ...input, height: 42, padding: 4 }} value={f.brand} onChange={e => set('brand', e.target.value)} /></div>
          <div><label style={label}>Social-isolation alert after (days)</label><input type="number" min={1} max={60} style={input} value={f.isolation_days} onChange={e => set('isolation_days', e.target.value)} /></div>
        </div>
      </SectionCard>
      <button onClick={save} disabled={update.isPending} style={{ padding: '11px 24px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{update.isPending ? 'Saving…' : 'Save settings'}</button>
    </div>
  );
}
