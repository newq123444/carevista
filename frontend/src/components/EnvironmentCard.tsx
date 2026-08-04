// src/components/EnvironmentCard.tsx — Environment preferences display/edit card
import React, { useState, useEffect } from 'react';
import { useEnvironmentPreferences, useUpdateEnvironmentPreferences } from '../hooks';
import type { EnvironmentPreferences } from '../types';

interface Props {
  residentId: string;
  canEdit?: boolean;
}

const LIGHTING_OPTIONS = ['Bright natural light', 'Soft warm light', 'Dim ambient', 'Night light only', 'Curtains open during day'];
const TEMP_OPTIONS = ['Warm (22-24C)', 'Comfortable (20-22C)', 'Cool (18-20C)', 'Extra warm blankets needed'];
const MUSIC_VOL_OPTIONS = ['Background (quiet)', 'Moderate', 'Loud (hard of hearing)', 'No music preferred'];
const NOISE_OPTIONS = ['low', 'moderate', 'high'] as const;
const CALMING_SOUNDS = ['Classical music', 'Nature sounds', 'Birdsong', 'Rainfall', 'Ocean waves', 'White noise', 'Hymns', 'Radio 2', 'Radio 4'];
const AROMATHERAPY = ['Lavender', 'Chamomile', 'Vanilla', 'Rose', 'Eucalyptus', 'Peppermint', 'None preferred'];

export function EnvironmentCard({ residentId, canEdit = false }: Props) {
  const { data: prefs, isLoading } = useEnvironmentPreferences(residentId);
  const updateMut = useUpdateEnvironmentPreferences();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<EnvironmentPreferences>>({});

  useEffect(() => { if (prefs) setForm(prefs); }, [prefs]);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (field: string, val: string) => {
    setForm(f => {
      const arr: string[] = (f as any)[field] || [];
      return { ...f, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  const handleSave = async () => {
    await updateMut.mutateAsync({
      residentId,
      data: {
        preferredLighting: form.preferred_lighting,
        preferredTemperature: form.preferred_temperature,
        preferredMusicVolume: form.preferred_music_volume,
        calmingSounds: form.calming_sounds,
        aromatherapy: form.aromatherapy,
        roomDecorations: form.room_decorations,
        photoDisplayPreference: form.photo_display_preference,
        tvVolume: form.tv_volume,
        noiseSensitivity: form.noise_sensitivity,
        notes: form.notes,
      },
    });
    setEditing(false);
  };

  if (isLoading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>;

  // Empty state
  if (!prefs && !editing) {
    return (
      <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>Environment Preferences</h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>No preferences recorded yet</p>
        {canEdit && (
          <button onClick={() => setEditing(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Add Preferences
          </button>
        )}
      </div>
    );
  }

  // Edit mode
  if (editing) {
    return (
      <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>🌿 Edit Environment</h4>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={handleSave} disabled={updateMut.isPending} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {updateMut.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Lighting */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Lighting</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {LIGHTING_OPTIONS.map(o => (
              <button key={o} onClick={() => set('preferred_lighting', o)} style={{ padding: '4px 10px', borderRadius: 12, border: form.preferred_lighting === o ? '1.5px solid #f59e0b' : '1px solid var(--border)', background: form.preferred_lighting === o ? '#f59e0b10' : 'transparent', fontSize: 11, cursor: 'pointer', color: form.preferred_lighting === o ? '#f59e0b' : 'var(--text-secondary)', fontWeight: form.preferred_lighting === o ? 600 : 400 }}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Temperature */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Temperature</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TEMP_OPTIONS.map(o => (
              <button key={o} onClick={() => set('preferred_temperature', o)} style={{ padding: '4px 10px', borderRadius: 12, border: form.preferred_temperature === o ? '1.5px solid #ef4444' : '1px solid var(--border)', background: form.preferred_temperature === o ? '#ef444410' : 'transparent', fontSize: 11, cursor: 'pointer', color: form.preferred_temperature === o ? '#ef4444' : 'var(--text-secondary)', fontWeight: form.preferred_temperature === o ? 600 : 400 }}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Music Volume */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Music Volume</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {MUSIC_VOL_OPTIONS.map(o => (
              <button key={o} onClick={() => set('preferred_music_volume', o)} style={{ padding: '4px 10px', borderRadius: 12, border: form.preferred_music_volume === o ? '1.5px solid #8b5cf6' : '1px solid var(--border)', background: form.preferred_music_volume === o ? '#8b5cf610' : 'transparent', fontSize: 11, cursor: 'pointer', color: form.preferred_music_volume === o ? '#8b5cf6' : 'var(--text-secondary)', fontWeight: form.preferred_music_volume === o ? 600 : 400 }}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Calming Sounds */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Calming Sounds</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {CALMING_SOUNDS.map(o => (
              <button key={o} onClick={() => toggleArr('calming_sounds', o)} style={{ padding: '4px 10px', borderRadius: 12, border: (form.calming_sounds || []).includes(o) ? '1.5px solid #06b6d4' : '1px solid var(--border)', background: (form.calming_sounds || []).includes(o) ? '#06b6d410' : 'transparent', fontSize: 11, cursor: 'pointer', color: (form.calming_sounds || []).includes(o) ? '#06b6d4' : 'var(--text-secondary)', fontWeight: (form.calming_sounds || []).includes(o) ? 600 : 400 }}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Aromatherapy */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aromatherapy</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {AROMATHERAPY.map(o => (
              <button key={o} onClick={() => toggleArr('aromatherapy', o)} style={{ padding: '4px 10px', borderRadius: 12, border: (form.aromatherapy || []).includes(o) ? '1.5px solid #ec4899' : '1px solid var(--border)', background: (form.aromatherapy || []).includes(o) ? '#ec489910' : 'transparent', fontSize: 11, cursor: 'pointer', color: (form.aromatherapy || []).includes(o) ? '#ec4899' : 'var(--text-secondary)', fontWeight: (form.aromatherapy || []).includes(o) ? 600 : 400 }}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Noise Sensitivity */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Noise Sensitivity</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {NOISE_OPTIONS.map(o => (
              <button key={o} onClick={() => set('noise_sensitivity', o)} style={{ padding: '4px 12px', borderRadius: 12, border: form.noise_sensitivity === o ? '1.5px solid #64748b' : '1px solid var(--border)', background: form.noise_sensitivity === o ? '#64748b10' : 'transparent', fontSize: 11, cursor: 'pointer', color: form.noise_sensitivity === o ? '#64748b' : 'var(--text-secondary)', fontWeight: form.noise_sensitivity === o ? 600 : 400, textTransform: 'capitalize' }}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Additional Notes</label>
          <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Any other environment preferences..." style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, resize: 'vertical', minHeight: 50, background: 'var(--surface)', color: 'var(--text-primary)' }} />
        </div>
      </div>
    );
  }

  // Display mode
  const p = prefs as EnvironmentPreferences;
  return (
    <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          🌿 Environment Preferences
        </h4>
        {canEdit && (
          <button onClick={() => setEditing(true)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            ✏️ Edit
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {p.preferred_lighting && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: '#f59e0b08', border: '1px solid #f59e0b20' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>💡 Lighting</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.preferred_lighting}</div>
          </div>
        )}
        {p.preferred_temperature && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: '#ef444408', border: '1px solid #ef444420' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>🌡️ Temperature</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.preferred_temperature}</div>
          </div>
        )}
        {p.preferred_music_volume && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: '#8b5cf608', border: '1px solid #8b5cf620' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>🎵 Music</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.preferred_music_volume}</div>
          </div>
        )}
        {p.noise_sensitivity && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: '#64748b08', border: '1px solid #64748b20' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>🔊 Noise Sensitivity</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{p.noise_sensitivity}</div>
          </div>
        )}
      </div>

      {(p.calming_sounds?.length || p.aromatherapy?.length) && (
        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {p.calming_sounds && p.calming_sounds.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Calming Sounds</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.calming_sounds.map(s => (
                  <span key={s} style={{ padding: '2px 8px', borderRadius: 10, background: '#06b6d410', border: '1px solid #06b6d425', fontSize: 11, color: '#06b6d4' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {p.aromatherapy && p.aromatherapy.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Aromatherapy</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.aromatherapy.map(a => (
                  <span key={a} style={{ padding: '2px 8px', borderRadius: 10, background: '#ec489910', border: '1px solid #ec489925', fontSize: 11, color: '#ec4899' }}>{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {p.notes && (
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-secondary)' }}>
          {p.notes}
        </div>
      )}
    </div>
  );
}
