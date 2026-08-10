// src/pages/ContinenceAssessment.tsx — Continence Care & Pattern Analysis
import React, { useState, useMemo } from 'react';
import { RecordView } from '../components/ui';
import { useResidents, useLogContinence, useContinenceLog, useContinencePatterns, useContinenceAssessment, useCreateContinenceAssessment, useContinenceOverview } from '../hooks';
import type { Resident, ContinenceLog, ContinencePattern, ContinenceAssessment as ContinenceAssessmentType } from '../types';

// Dignity-focused event type labels
const EVENT_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'continent', label: 'Continent - successful toileting', icon: '✓' },
  { value: 'toileted_successfully', label: 'Assisted toileting - successful', icon: '🙌' },
  { value: 'toileted_unsuccessfully', label: 'Assisted toileting - unsuccessful', icon: '🔄' },
  { value: 'pad_change', label: 'Personal care support - pad change', icon: '🔄' },
  { value: 'incontinent_urine', label: 'Incontinence - urine', icon: '💧' },
  { value: 'incontinent_faeces', label: 'Incontinence - faeces', icon: '⚠️' },
  { value: 'incontinent_both', label: 'Incontinence - both', icon: '⚠️' },
];

const PAD_STATUS_OPTIONS = [
  { value: 'dry', label: 'Dry' },
  { value: 'wet', label: 'Wet' },
  { value: 'soiled', label: 'Soiled' },
  { value: 'not_applicable', label: 'N/A' },
];

export default function ContinenceAssessment() {
  const { data: residents = [] } = useResidents();
  const [selectedResident, setSelectedResident] = useState('');
  const { data: logs } = useContinenceLog(selectedResident, 14);
  const { data: patterns } = useContinencePatterns(selectedResident);
  const { data: assessment } = useContinenceAssessment(selectedResident);
  const { data: overview } = useContinenceOverview();
  const logMutation = useLogContinence();
  const assessMutation = useCreateContinenceAssessment();

  // Log form state
  const [eventType, setEventType] = useState('');
  const [eventTime, setEventTime] = useState(new Date().toTimeString().slice(0, 5));
  const [padStatus, setPadStatus] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident || !eventType) return;
    const eventDateTime = new Date();
    const [hours, minutes] = eventTime.split(':').map(Number);
    eventDateTime.setHours(hours, minutes, 0, 0);
    logMutation.mutate({
      resident_id: selectedResident,
      event_type: eventType,
      event_time: eventDateTime.toISOString(),
      pad_status: padStatus || undefined,
      location: location || undefined,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setEventType(''); setNotes(''); setPadStatus(''); setLocation('');
      }
    });
  };

  const patternData: ContinencePattern[] = Array.isArray(patterns) ? patterns : [];
  const logList: ContinenceLog[] = Array.isArray(logs) ? logs : [];
  const currentAssessment: ContinenceAssessmentType | null = assessment || null;

  // Calculate max for pattern chart
  const maxEvents = useMemo(() => {
    if (patternData.length === 0) return 1;
    return Math.max(1, ...patternData.map(p => p.total_events));
  }, [patternData]);

  // Determine peak incontinence hours
  const peakHours = useMemo(() => {
    return patternData
      .filter(p => p.incontinent_count > p.continent_count)
      .map(p => p.hour);
  }, [patternData]);

  // Suggested toileting times (hours where continent events are high)
  const suggestedHours = useMemo(() => {
    return patternData
      .filter(p => p.continent_count > 0 && p.continent_count >= p.incontinent_count)
      .map(p => p.hour);
  }, [patternData]);

  const overviewData: any = overview || {};

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}>Continence Care</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Dignified personal care support - pattern recognition and scheduled assistance</p>

      {/* Overview Section */}
      {overviewData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0d9488' }}>{overviewData.residents_tracked || 0}</div>
            <div style={{ fontSize: '0.8rem', color: '#0d9488', fontWeight: 500 }}>Residents Supported</div>
          </div>
          <div style={{ background: '#d1fae5', borderRadius: 12, padding: 16, border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{overviewData.continence_rate ? `${overviewData.continence_rate}%` : 'N/A'}</div>
            <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 500 }}>Continence Rate</div>
          </div>
          <div style={{ background: '#fef3c7', borderRadius: 12, padding: 16, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>{overviewData.daily_pad_usage || 0}</div>
            <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 500 }}>Daily Pad Usage</div>
          </div>
          <div style={{ background: '#f3e8ff', borderRadius: 12, padding: 16, border: '1px solid #e9d5ff' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed' }}>{overviewData.events_today || 0}</div>
            <div style={{ fontSize: '0.8rem', color: '#5b21b6', fontWeight: 500 }}>Events Today</div>
          </div>
        </div>
      )}

      {/* Resident Selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Resident</label>
        <select
          value={selectedResident}
          onChange={e => setSelectedResident(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', maxWidth: 400, fontSize: '0.95rem' }}
        >
          <option value="">-- Choose resident --</option>
          {(residents as Resident[]).map(r => (
            <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Event Logging Form */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Log Personal Care Event</h2>
          <form onSubmit={handleLogSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Event Type *</label>
              <select value={eventType} onChange={e => setEventType(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                <option value="">-- Select --</option>
                {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.icon} {et.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Time</label>
                <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Pad Status</label>
                <select value={padStatus} onChange={e => setPadStatus(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                  <option value="">-- Select --</option>
                  {PAD_STATUS_OPTIONS.map(ps => <option key={ps.value} value={ps.value}>{ps.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Bedroom, bathroom, lounge" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Dignity-focused observations..." style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }} />
            </div>

            <button
              type="submit"
              disabled={!selectedResident || !eventType || logMutation.isPending}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#0d9488', color: '#fff', fontWeight: 600, border: 'none', cursor: selectedResident ? 'pointer' : 'not-allowed', opacity: selectedResident ? 1 : 0.5 }}
            >
              {logMutation.isPending ? 'Logging...' : 'Log Event'}
            </button>
          </form>
        </div>

        {/* Pattern Visualization */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Hourly Pattern (Last 14 Days)</h2>
          {!selectedResident && <p style={{ color: '#9ca3af' }}>Select a resident to view patterns</p>}
          {selectedResident && patternData.length === 0 && <p style={{ color: '#9ca3af' }}>No pattern data available yet.</p>}
          {selectedResident && patternData.length > 0 && (
            <div>
              {/* SVG Bar Chart */}
              <svg viewBox="0 0 500 200" style={{ width: '100%', height: 200 }}>
                {/* Y-axis label */}
                <text x="5" y="15" fontSize="9" fill="#6b7280">Events</text>
                {/* X-axis label */}
                <text x="250" y="198" fontSize="9" fill="#6b7280" textAnchor="middle">Hour of Day</text>
                {/* Bars */}
                {patternData.map((p: ContinencePattern, idx: number) => {
                  const barWidth = 16;
                  const gap = (500 - 24 * barWidth) / 25;
                  const x = gap + idx * (barWidth + gap);
                  const barHeight = (p.total_events / maxEvents) * 150;
                  const continentHeight = (p.continent_count / maxEvents) * 150;
                  const isPeak = peakHours.includes(p.hour);
                  const isSuggested = suggestedHours.includes(p.hour);
                  return (
                    <g key={idx}>
                      {/* Background highlight for peak/suggested hours */}
                      {isPeak && <rect x={x - 2} y={20} width={barWidth + 4} height={160} fill="#dc262610" rx={3} />}
                      {isSuggested && !isPeak && <rect x={x - 2} y={20} width={barWidth + 4} height={160} fill="#10b98110" rx={3} />}
                      {/* Incontinent portion (top) */}
                      <rect
                        x={x}
                        y={170 - barHeight}
                        width={barWidth}
                        height={barHeight - continentHeight}
                        fill={isPeak ? '#dc2626' : '#f59e0b'}
                        rx={2}
                      />
                      {/* Continent portion (bottom) */}
                      <rect
                        x={x}
                        y={170 - continentHeight}
                        width={barWidth}
                        height={continentHeight}
                        fill={isSuggested ? '#10b981' : '#6ee7b7'}
                        rx={2}
                      />
                      {/* Hour label */}
                      <text x={x + barWidth / 2} y={185} fontSize="7" fill="#6b7280" textAnchor="middle">
                        {p.hour.toString().padStart(2, '0')}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
                  Continent events
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#dc2626', display: 'inline-block' }} />
                  Peak incontinence hours
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b', display: 'inline-block' }} />
                  Other incontinence events
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#10b98120', border: '1px solid #10b981', display: 'inline-block' }} />
                  Suggested toileting times
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Assessment */}
      {selectedResident && currentAssessment && (
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Current Personal Care Plan</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {currentAssessment.recommended_schedule && (
              <div style={{ padding: 16, background: '#d1fae5', borderRadius: 10, border: '1px solid #a7f3d0' }}>
                <h4 style={{ fontWeight: 600, color: '#065f46', marginBottom: 8 }}>Recommended Toileting Schedule</h4>
                <div style={{ fontSize: '0.9rem', color: '#047857' }}>
                  {typeof currentAssessment.recommended_schedule === 'string'
                    ? currentAssessment.recommended_schedule
                    : <RecordView data={currentAssessment.recommended_schedule} empty="No schedule generated yet." columns={2} />}
                </div>
              </div>
            )}
            <div style={{ padding: 16, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
              <h4 style={{ fontWeight: 600, color: '#0d9488', marginBottom: 8 }}>Pad Usage</h4>
              <div style={{ fontSize: '0.9rem' }}>
                {currentAssessment.pad_type && <div>Type: {currentAssessment.pad_type}</div>}
                <div>Current daily usage: {currentAssessment.current_pad_usage || 'N/A'}</div>
                {currentAssessment.target_pad_usage && <div>Target: {currentAssessment.target_pad_usage}</div>}
              </div>
            </div>
            {currentAssessment.dignity_notes && (
              <div style={{ padding: 16, background: '#f3e8ff', borderRadius: 10, border: '1px solid #e9d5ff' }}>
                <h4 style={{ fontWeight: 600, color: '#5b21b6', marginBottom: 8 }}>Dignity & Preferences</h4>
                <div style={{ fontSize: '0.9rem', color: '#6b21a8' }}>{currentAssessment.dignity_notes}</div>
              </div>
            )}
          </div>
          {currentAssessment.review_date && (
            <div style={{ marginTop: 12, fontSize: '0.85rem', color: '#6b7280' }}>
              Next review: {new Date(currentAssessment.review_date).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Recent Logs */}
      {selectedResident && logList.length > 0 && (
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Recent Events (Last 14 Days)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Date/Time</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Event</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Pad Status</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Location</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Staff</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logList.slice(0, 20).map((log: ContinenceLog) => {
                  const evType = EVENT_TYPES.find(et => et.value === log.event_type);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>{new Date(log.event_time).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>
                        <span>{evType?.icon || ''} {evType?.label || log.event_type}</span>
                      </td>
                      <td style={{ padding: '8px', textTransform: 'capitalize' }}>{log.pad_status || '-'}</td>
                      <td style={{ padding: '8px' }}>{log.location || '-'}</td>
                      <td style={{ padding: '8px' }}>{log.logged_by_name || 'Staff'}</td>
                      <td style={{ padding: '8px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
