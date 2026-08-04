// src/pages/WoundTracker.tsx — Wound Photography Timeline & Body Map
import React, { useState } from 'react';
import { useResidents, useActiveWounds, useCreateWound, useWoundTimeline, useWoundBodyMap, useUpdateWound } from '../hooks';
import type { Resident, WoundAssessment } from '../types';

const WOUND_TYPES = ['Pressure Ulcer', 'Surgical', 'Leg Ulcer', 'Skin Tear', 'Burn', 'Laceration', 'Other'];
const BODY_AREAS = ['Head', 'Chest', 'Abdomen', 'Back', 'Sacrum/Buttocks', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg', 'Left Foot', 'Right Foot'];
const WOUND_BED_OPTIONS = ['Granulating', 'Epithelialising', 'Sloughy', 'Necrotic', 'Mixed'];
const EXUDATE_LEVELS = ['None', 'Low', 'Moderate', 'High'];
const STATUS_COLORS: Record<string, string> = { active: '#dc2626', healing: '#f59e0b', healed: '#10b981', worsening: '#7c3aed' };

// SVG Body Map regions (front view simplified)
const BODY_REGIONS: { id: string; label: string; path: string }[] = [
  { id: 'Head', label: 'Head', path: 'M 140,10 C 140,10 130,15 125,30 C 120,45 120,60 130,65 C 140,70 160,70 170,65 C 180,60 180,45 175,30 C 170,15 160,10 160,10 Z' },
  { id: 'Chest', label: 'Chest', path: 'M 120,80 L 120,140 L 180,140 L 180,80 C 170,75 130,75 120,80 Z' },
  { id: 'Abdomen', label: 'Abdomen', path: 'M 120,140 L 120,190 C 125,195 175,195 180,190 L 180,140 Z' },
  { id: 'Left Arm', label: 'Left Arm', path: 'M 95,80 L 80,140 L 75,190 L 90,190 L 100,140 L 118,85 Z' },
  { id: 'Right Arm', label: 'Right Arm', path: 'M 205,80 L 220,140 L 225,190 L 210,190 L 200,140 L 182,85 Z' },
  { id: 'Left Leg', label: 'Left Leg', path: 'M 120,195 L 115,260 L 110,330 L 130,330 L 140,260 L 148,195 Z' },
  { id: 'Right Leg', label: 'Right Leg', path: 'M 180,195 L 185,260 L 190,330 L 170,330 L 160,260 L 152,195 Z' },
  { id: 'Sacrum/Buttocks', label: 'Sacrum', path: 'M 135,185 L 135,200 L 165,200 L 165,185 Z' },
  { id: 'Left Foot', label: 'Left Foot', path: 'M 110,330 L 105,350 L 130,350 L 130,330 Z' },
  { id: 'Right Foot', label: 'Right Foot', path: 'M 190,330 L 195,350 L 170,350 L 170,330 Z' },
  { id: 'Back', label: 'Back', path: 'M 130,70 L 125,75 L 120,80 L 118,85 L 120,80 L 120,80 Z' }, // hidden region
];

export default function WoundTracker() {
  const [tab, setTab] = useState<'active' | 'bodymap' | 'new'>('active');
  const { data: residents = [] } = useResidents();
  const { data: activeWounds } = useActiveWounds();
  const createMutation = useCreateWound();
  const updateMutation = useUpdateWound();

  // Body map state
  const [bodyMapResident, setBodyMapResident] = useState('');
  const { data: bodyMapData } = useWoundBodyMap(bodyMapResident);
  const [selectedArea, setSelectedArea] = useState('');
  const { data: timeline } = useWoundTimeline(bodyMapResident, selectedArea || undefined);

  // Form state
  const [formResident, setFormResident] = useState('');
  const [woundType, setWoundType] = useState('');
  const [bodyArea, setBodyArea] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [woundBed, setWoundBed] = useState('');
  const [exudateLevel, setExudateLevel] = useState('');
  const [surroundingSkin, setSurroundingSkin] = useState('');
  const [painLevel, setPainLevel] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [formNotes, setFormNotes] = useState('');

  const handleSubmitWound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formResident || !woundType || !bodyArea) return;
    const formData = new FormData();
    formData.append('resident_id', formResident);
    formData.append('wound_type', woundType);
    formData.append('location_body_area', bodyArea);
    if (width) formData.append('width_mm', width);
    if (height) formData.append('height_mm', height);
    if (depth) formData.append('depth_mm', depth);
    if (woundBed) formData.append('wound_bed', woundBed);
    if (exudateLevel) formData.append('exudate_level', exudateLevel);
    if (surroundingSkin) formData.append('surrounding_skin', surroundingSkin);
    formData.append('pain_level', String(painLevel));
    if (photoFile) formData.append('photo', photoFile);
    if (formNotes) formData.append('notes', formNotes);
    createMutation.mutate(formData, {
      onSuccess: () => {
        setWoundType(''); setBodyArea(''); setWidth(''); setHeight(''); setDepth('');
        setWoundBed(''); setExudateLevel(''); setSurroundingSkin(''); setPainLevel(0);
        setPhotoFile(null); setFormNotes('');
      }
    });
  };

  const woundsList: WoundAssessment[] = Array.isArray(activeWounds) ? activeWounds : [];
  const bodyWounds: any[] = Array.isArray(bodyMapData) ? bodyMapData : [];
  const timelineItems: WoundAssessment[] = Array.isArray(timeline) ? timeline : [];
  const woundAreas = bodyWounds.map((w: any) => w.location_body_area);

  const tabStyle = (active: boolean) => ({
    padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none',
    background: active ? '#0d9488' : '#f3f4f6', color: active ? '#fff' : '#374151',
    fontWeight: 600 as const, cursor: 'pointer' as const, fontSize: '0.9rem',
  });

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}>Wound Tracker</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Photography timeline, body mapping, and healing progress</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
        <button onClick={() => setTab('active')} style={tabStyle(tab === 'active')}>Active Wounds</button>
        <button onClick={() => setTab('bodymap')} style={tabStyle(tab === 'bodymap')}>Body Map</button>
        <button onClick={() => setTab('new')} style={tabStyle(tab === 'new')}>New Assessment</button>
      </div>

      <div style={{ background: '#fff', borderRadius: '0 12px 12px 12px', padding: 24, border: '1px solid #e5e7eb', minHeight: 400 }}>
        {/* Active Wounds Tab */}
        {tab === 'active' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>All Active Wounds</h2>
            {woundsList.length === 0 && <p style={{ color: '#9ca3af' }}>No active wounds recorded.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {woundsList.map((w: WoundAssessment) => (
                <div key={w.id} style={{ padding: 16, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{w.resident_name || 'Resident'}</div>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{w.room_number ? `Room ${w.room_number}` : ''}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 12, background: (STATUS_COLORS[w.status] || '#6b7280') + '20', color: STATUS_COLORS[w.status] || '#6b7280', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
                      {w.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.9rem' }}>
                    <div><strong>Type:</strong> {w.wound_type}</div>
                    <div><strong>Location:</strong> {w.location_body_area}</div>
                    {w.width_mm && <div><strong>Size:</strong> {w.width_mm}x{w.height_mm || '?'}x{w.depth_mm || '?'} mm</div>}
                    <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 6 }}>
                      Last assessed: {new Date(w.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  {w.status !== 'healed' && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                      <button onClick={() => updateMutation.mutate({ id: w.id, data: { status: 'healing' } })} style={{ padding: '4px 10px', borderRadius: 6, background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', cursor: 'pointer', fontSize: '0.8rem' }}>Mark Healing</button>
                      <button onClick={() => updateMutation.mutate({ id: w.id, data: { status: 'healed' } })} style={{ padding: '4px 10px', borderRadius: 6, background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', cursor: 'pointer', fontSize: '0.8rem' }}>Mark Healed</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body Map Tab */}
        {tab === 'bodymap' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Resident</label>
              <select value={bodyMapResident} onChange={e => { setBodyMapResident(e.target.value); setSelectedArea(''); }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', maxWidth: 400 }}>
                <option value="">-- Choose resident --</option>
                {(residents as Resident[]).map(r => (
                  <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>
                ))}
              </select>
            </div>

            {bodyMapResident && (
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
                {/* Body SVG */}
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Click body area to view wounds</h3>
                  <svg viewBox="60 0 180 360" style={{ width: 220, height: 360, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
                    {BODY_REGIONS.filter(r => r.id !== 'Back').map(region => {
                      const hasWound = woundAreas.includes(region.id);
                      const isSelected = selectedArea === region.id;
                      return (
                        <path
                          key={region.id}
                          d={region.path}
                          fill={isSelected ? '#0d948830' : hasWound ? '#dc262620' : '#e5e7eb50'}
                          stroke={isSelected ? '#0d9488' : hasWound ? '#dc2626' : '#9ca3af'}
                          strokeWidth={isSelected ? 2 : 1}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedArea(region.id)}
                        >
                          <title>{region.label}{hasWound ? ' (wound present)' : ''}</title>
                        </path>
                      );
                    })}
                    {/* Wound indicators */}
                    {bodyWounds.map((w: any, i: number) => {
                      const region = BODY_REGIONS.find(r => r.id === w.location_body_area);
                      if (!region) return null;
                      // Place dot approximately at center of region
                      return (
                        <circle
                          key={i}
                          cx={w.location_x || 150}
                          cy={w.location_y || 150}
                          r={6}
                          fill="#dc2626"
                          stroke="#fff"
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedArea(w.location_body_area)}
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Timeline for selected area */}
                <div>
                  {selectedArea ? (
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
                        Timeline: {selectedArea}
                      </h3>
                      {timelineItems.length === 0 && <p style={{ color: '#9ca3af' }}>No assessments for this area.</p>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {timelineItems.map((item: WoundAssessment) => (
                          <div key={item.id} style={{ padding: 14, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                              <span style={{ padding: '2px 8px', borderRadius: 12, background: (STATUS_COLORS[item.status] || '#6b7280') + '20', color: STATUS_COLORS[item.status] || '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>{item.status}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                              <div><strong>Size:</strong> {item.width_mm || '?'}x{item.height_mm || '?'}x{item.depth_mm || '?'} mm</div>
                              <div><strong>Bed:</strong> {item.wound_bed || 'N/A'}</div>
                              <div><strong>Exudate:</strong> {item.exudate_level || 'N/A'}</div>
                              <div><strong>Pain:</strong> {item.pain_level != null ? `${item.pain_level}/10` : 'N/A'}</div>
                            </div>
                            {item.photo_url && (
                              <div style={{ marginTop: 8 }}>
                                <img src={item.photo_url} alt="Wound" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                              </div>
                            )}
                            {item.notes && <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#6b7280' }}>{item.notes}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#9ca3af', textAlign: 'center', paddingTop: 60 }}>
                      <p style={{ fontSize: '1.1rem' }}>Click a body area to view wound timeline</p>
                      <p style={{ fontSize: '0.85rem' }}>Red regions indicate active wounds</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* New Assessment Tab */}
        {tab === 'new' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>New Wound Assessment</h2>
            <form onSubmit={handleSubmitWound} style={{ maxWidth: 600 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>Resident *</label>
                <select value={formResident} onChange={e => setFormResident(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }} required>
                  <option value="">-- Select --</option>
                  {(residents as Resident[]).map(r => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>Wound Type *</label>
                <select value={woundType} onChange={e => setWoundType(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }} required>
                  <option value="">-- Select --</option>
                  {WOUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>Body Area *</label>
                <select value={bodyArea} onChange={e => setBodyArea(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }} required>
                  <option value="">-- Select --</option>
                  {BODY_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Width (mm)</label>
                  <input type="number" value={width} onChange={e => setWidth(e.target.value)} min={0} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Height (mm)</label>
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)} min={0} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Depth (mm)</label>
                  <input type="number" value={depth} onChange={e => setDepth(e.target.value)} min={0} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Wound Bed</label>
                  <select value={woundBed} onChange={e => setWoundBed(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                    <option value="">-- Select --</option>
                    {WOUND_BED_OPTIONS.map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Exudate Level</label>
                  <select value={exudateLevel} onChange={e => setExudateLevel(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                    <option value="">-- Select --</option>
                    {EXUDATE_LEVELS.map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Surrounding Skin</label>
                <input type="text" value={surroundingSkin} onChange={e => setSurroundingSkin(e.target.value)} placeholder="e.g. Intact, macerated, erythema" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Pain Level: {painLevel}/10</label>
                <input type="range" min={0} max={10} value={painLevel} onChange={e => setPainLevel(Number(e.target.value))} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af' }}>
                  <span>No pain</span><span>Severe</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Photo Upload</label>
                <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} style={{ fontSize: '0.9rem' }} />
                {photoFile && <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>Selected: {photoFile.name}</p>}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }} />
              </div>

              <button
                type="submit"
                disabled={!formResident || !woundType || !bodyArea || createMutation.isPending}
                style={{ padding: '12px 24px', borderRadius: 8, background: '#0d9488', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                {createMutation.isPending ? 'Saving...' : 'Save Wound Assessment'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
