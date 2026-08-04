// src/pages/EnvironmentalIntelligence.tsx - Environmental Intelligence
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const metricIcons: Record<string, string> = { noise: '🔊', light: '💡', temperature: '🌡️', humidity: '💧', air: '🌬️' };

export default function EnvironmentalIntelligence() {
  const [tab, setTab] = useState<'dashboard' | 'log' | 'recommendations'>('dashboard');
  const [form, setForm] = useState({ zone: '', noiseLevel: '', lightLevel: '', temperature: '', humidity: '', airQuality: '' });
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({ queryKey: ['env-dashboard'], queryFn: () => api.get('/environment/dashboard').then(r => r.data) });
  const { data: recommendations } = useQuery({ queryKey: ['env-recommendations'], queryFn: () => api.get('/environment/recommendations').then(r => r.data) });

  const logMutation = useMutation({
    mutationFn: (data: any) => api.post('/environment/readings', data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['env-dashboard'] }); setForm({ zone: '', noiseLevel: '', lightLevel: '', temperature: '', humidity: '', airQuality: '' }); },
  });

  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    logMutation.mutate({
      zone: form.zone,
      noiseLevel: form.noiseLevel ? parseFloat(form.noiseLevel) : null,
      lightLevel: form.lightLevel ? parseFloat(form.lightLevel) : null,
      temperature: form.temperature ? parseFloat(form.temperature) : null,
      humidity: form.humidity ? parseFloat(form.humidity) : null,
      airQuality: form.airQuality ? parseFloat(form.airQuality) : null,
    });
  };

  const getMetricColor = (metric: string, value: number | null): string => {
    if (value === null) return '#6b7280';
    if (metric === 'temperature') return value > 24 || value < 18 ? '#dc2626' : value > 22 || value < 19 ? '#d97706' : '#16a34a';
    if (metric === 'noise') return value > 55 ? '#dc2626' : value > 40 ? '#d97706' : '#16a34a';
    if (metric === 'humidity') return value > 70 || value < 30 ? '#dc2626' : value > 60 || value < 40 ? '#d97706' : '#16a34a';
    return '#16a34a';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🌍 Environmental Intelligence</h1>
          <p className="page-subtitle">Track and optimize noise, lighting, temperature, air quality - correlate with wellbeing</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([['dashboard', '📊 Dashboard'], ['recommendations', '💡 Recommendations'], ['log', '➕ Log Reading']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#059669' : 'transparent'}`, color: tab === k ? '#059669' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div>
          {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading environmental data...</div>}
          
          {dashboard?.current?.length > 0 ? (
            <div style={{ display: 'grid', gap: 16 }}>
              {dashboard.current.map((zone: any) => (
                <div key={zone.zone} className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>📍 {zone.zone}</h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updated: {zone.recorded_at ? new Date(zone.recorded_at).toLocaleString('en-GB') : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                    {zone.temperature != null && (
                      <div style={{ padding: 10, borderRadius: 8, background: `${getMetricColor('temperature', zone.temperature)}10`, border: `1px solid ${getMetricColor('temperature', zone.temperature)}30` }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🌡️ Temperature</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: getMetricColor('temperature', zone.temperature) }}>{zone.temperature}°C</div>
                      </div>
                    )}
                    {zone.noise_level != null && (
                      <div style={{ padding: 10, borderRadius: 8, background: `${getMetricColor('noise', zone.noise_level)}10`, border: `1px solid ${getMetricColor('noise', zone.noise_level)}30` }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔊 Noise</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: getMetricColor('noise', zone.noise_level) }}>{zone.noise_level} dB</div>
                      </div>
                    )}
                    {zone.light_level != null && (
                      <div style={{ padding: 10, borderRadius: 8, background: '#16a34a10', border: '1px solid #16a34a30' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>💡 Light</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{zone.light_level} lux</div>
                      </div>
                    )}
                    {zone.humidity != null && (
                      <div style={{ padding: 10, borderRadius: 8, background: `${getMetricColor('humidity', zone.humidity)}10`, border: `1px solid ${getMetricColor('humidity', zone.humidity)}30` }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>💧 Humidity</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: getMetricColor('humidity', zone.humidity) }}>{zone.humidity}%</div>
                      </div>
                    )}
                    {zone.air_quality != null && (
                      <div style={{ padding: 10, borderRadius: 8, background: '#16a34a10', border: '1px solid #16a34a30' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🌬️ Air Quality</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{zone.air_quality}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌍</div>
              <div>No environmental data recorded yet. Use the Log Reading tab to add readings.</div>
            </div>
          )}
        </div>
      )}

      {tab === 'recommendations' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {recommendations?.map((zone: any) => (
            <div key={zone.zone}>
              {zone.recommendations?.map((rec: any, i: number) => (
                <div key={i} className="card" style={{ padding: 14, marginBottom: 8, borderLeft: `4px solid ${rec.priority === 'high' ? '#dc2626' : rec.priority === 'medium' ? '#d97706' : '#0d9488'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{metricIcons[rec.type] || '📊'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{rec.message}</div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: rec.priority === 'high' ? '#fef2f2' : rec.priority === 'medium' ? '#fffbeb' : '#eff6ff', color: rec.priority === 'high' ? '#dc2626' : rec.priority === 'medium' ? '#d97706' : '#0d9488' }}>{rec.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {(!recommendations || recommendations.length === 0) && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No recommendations available yet. Log more environmental data for insights.</div>}
        </div>
      )}

      {tab === 'log' && (
        <form onSubmit={handleLog} style={{ maxWidth: 500 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px' }}>Log Environmental Reading</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Zone / Room *</label>
                <input value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} required placeholder="e.g. Room 1, Lounge, Dining Room" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>🌡️ Temperature (C)</label>
                  <input type="number" step="0.1" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} placeholder="e.g. 21.5" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>🔊 Noise (dB)</label>
                  <input type="number" step="1" value={form.noiseLevel} onChange={e => setForm({ ...form, noiseLevel: e.target.value })} placeholder="e.g. 45" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>💡 Light (lux)</label>
                  <input type="number" step="1" value={form.lightLevel} onChange={e => setForm({ ...form, lightLevel: e.target.value })} placeholder="e.g. 300" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>💧 Humidity (%)</label>
                  <input type="number" step="1" value={form.humidity} onChange={e => setForm({ ...form, humidity: e.target.value })} placeholder="e.g. 55" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>🌬️ Air Quality Index</label>
                <input type="number" step="1" value={form.airQuality} onChange={e => setForm({ ...form, airQuality: e.target.value })} placeholder="e.g. 50 (0-500 scale)" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
              </div>
            </div>
            <button type="submit" disabled={!form.zone || logMutation.isPending} style={{ marginTop: 16, padding: '12px 24px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {logMutation.isPending ? 'Saving...' : 'Log Reading'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
