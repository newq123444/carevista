// src/pages/AiInsights.tsx — AI care quality monitoring and resident insights
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useResidents } from '../hooks';
import { formatDate } from '../utils/formatters';
import type { Resident } from '../types';

const SEVERITY_STYLE: Record<string,{bg:string;color:string;icon:string;label:string}> = {
  urgent:  { bg:'#fef2f2', color:'#dc2626', icon:'🚨', label:'Urgent' },
  concern: { bg:'#fffbeb', color:'#d97706', icon:'⚠️', label:'Concern' },
  warning: { bg:'#eff6ff', color:'#0d9488', icon:'💡', label:'Flagged' },
  info:    { bg:'#f0fdf4', color:'#16a34a', icon:'ℹ️', label:'Info' },
};

const ISSUE_ICONS: Record<string,string> = {
  copy_paste_suspected:  '📋',
  copy_paste_food:       '📋',
  low_fluid_intake:      '💧',
  high_fluid_intake:     '💧',
  very_low_food_intake:  '🍽',
  no_notes_24h:          '📝',
  persistent_high_pain:  '🩺',
  bowels_not_opened:     '⚕️',
  persistent_low_mood:   '😔',
};

export default function AiInsights() {
  const [tab, setTab] = useState<'quality'|'resident'|'validate'>('quality');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧠 AI Care Intelligence</h1>
          <p className="page-subtitle">Actively monitoring care data to improve resident outcomes</p>
        </div>
      </div>

      <div style={{ display:'flex', gap:2, borderBottom:'2px solid var(--border)', marginBottom:20 }}>
        {[
          ['quality',  '📊 Care Quality'],
          ['validate', '🔍 Data Validation'],
          ['resident', '👤 Resident Insights'],
        ].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{ padding:'10px 20px', border:'none', background:'none', borderBottom:`2px solid ${tab===k?'#0d9488':'transparent'}`, color:tab===k?'#0d9488':'var(--text-secondary)', fontWeight:tab===k?700:500, cursor:'pointer', fontSize:14, marginBottom:-2 }}>{l}</button>
        ))}
      </div>

      {tab === 'quality'   && <CareQualityTab />}
      {tab === 'validate'  && <DataValidationTab />}
      {tab === 'resident'  && <ResidentInsightsTab />}
    </div>
  );
}

// ── Care Quality Dashboard ────────────────────────────────────────────────
function CareQualityTab() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['care-quality'],
    queryFn: () => api.get('/ai/care-quality').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <LoadingCard text="Analysing care quality across all residents…" />;
  if (error) return <ErrorCard error={error} onRetry={refetch} />;
  if (!data) return null;

  const { noteStats=[], fluidStats=[], painStats=[], documentationGaps=[] } = data;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Documentation gaps - most urgent */}
      {documentationGaps.length > 0 && (
        <div className="card" style={{ border:'2px solid #fca5a5' }}>
          <div className="card-header" style={{ background:'#fef2f2' }}>
            <span className="card-title" style={{ color:'#dc2626' }}>🚨 Documentation Gaps — Action Needed</span>
            <span style={{ fontSize:12, color:'#dc2626', fontWeight:700 }}>{documentationGaps.length} residents</span>
          </div>
          <div className="card-body" style={{ padding:0 }}>
            <p style={{ padding:'10px 16px', fontSize:13, color:'#991b1b', margin:0, borderBottom:'1px solid #fecaca' }}>
              These residents have fewer than 2 care notes in the last 48 hours. CQC requires daily documentation for all residents.
            </p>
            {documentationGaps.map((r: any) => (
              <div key={r.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:20 }}>{r.risk_level==='high'?'🔴':r.risk_level==='medium'?'🟡':'🟢'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{r.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Room {r.room_number} · {r.risk_level} risk</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700, color:'#dc2626', fontSize:16 }}>{r.notes_last_48h}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>notes (48h)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Fluid intake */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">💧 Fluid Intake (7 days avg)</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Min 1500ml/day recommended</span>
          </div>
          <div style={{ overflowY:'auto', maxHeight:300 }}>
            {fluidStats.length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No fluid data recorded this week</div>
            ) : fluidStats.map((r: any) => {
              const pct = Math.min((r.avg_fluid_ml / 1500) * 100, 100);
              const color = r.avg_fluid_ml < 800 ? '#dc2626' : r.avg_fluid_ml < 1200 ? '#d97706' : '#16a34a';
              return (
                <div key={r.name} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                    <span style={{ fontWeight:600 }}>{r.name} <span style={{ color:'var(--text-muted)', fontWeight:400 }}>Rm {r.room_number}</span></span>
                    <span style={{ fontWeight:700, color }}>{r.avg_fluid_ml}ml</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:'#e5e7eb', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.8s ease' }} />
                  </div>
                  {r.avg_fluid_ml < 1000 && (
                    <div style={{ fontSize:11, color:'#dc2626', marginTop:3, fontWeight:600 }}>⚠ Below safe minimum — review urgently</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pain management */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🩺 Pain Management (7 days)</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Residents with avg pain ≥4</span>
          </div>
          <div style={{ overflowY:'auto', maxHeight:300 }}>
            {painStats.length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No residents with significant pain scores this week</div>
            ) : painStats.map((r: any) => {
              const color = r.avg_pain >= 7 ? '#dc2626' : r.avg_pain >= 5 ? '#d97706' : '#f59e0b';
              return (
                <div key={r.name} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:color+'15', border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color, flexShrink:0 }}>
                    {r.avg_pain}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Room {r.room_number} · Max: {r.max_pain}/10 · {r.high_pain_count}× above 7</div>
                    {r.avg_pain >= 7 && <div style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>Requires GP review and pain management plan</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes per resident */}
        <div className="card" style={{ gridColumn:'1/-1' }}>
          <div className="card-header">
            <span className="card-title">📝 Documentation Rate (7 days)</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Target: 3+ notes per resident per day</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                  <th style={{ padding:'8px 14px', textAlign:'left', fontWeight:600 }}>Resident</th>
                  <th style={{ padding:'8px 14px', textAlign:'center', fontWeight:600 }}>Risk</th>
                  <th style={{ padding:'8px 14px', textAlign:'center', fontWeight:600 }}>Total Notes</th>
                  <th style={{ padding:'8px 14px', textAlign:'center', fontWeight:600 }}>Per Day</th>
                  <th style={{ padding:'8px 14px', textAlign:'left', fontWeight:600, width:'40%' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {noteStats.map((r: any) => {
                  const ppd = parseFloat(r.notes_per_day).toFixed(1);
                  const color = r.notes_per_day < 1 ? '#dc2626' : r.notes_per_day < 2 ? '#d97706' : '#16a34a';
                  const pct = Math.min((r.notes_per_day / 4) * 100, 100);
                  return (
                    <tr key={r.name} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'8px 14px', fontWeight:600 }}>{r.name} <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400 }}>Rm {r.room_number}</span></td>
                      <td style={{ padding:'8px 14px', textAlign:'center' }}>
                        <span style={{ fontSize:12, padding:'2px 6px', borderRadius:8, background:r.risk_level==='high'?'#fef2f2':r.risk_level==='medium'?'#fffbeb':'#f0fdf4', color:r.risk_level==='high'?'#dc2626':r.risk_level==='medium'?'#d97706':'#16a34a', fontWeight:700 }}>{r.risk_level}</span>
                      </td>
                      <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:700 }}>{r.total_notes}</td>
                      <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:700, color }}>{ppd}</td>
                      <td style={{ padding:'8px 14px' }}>
                        <div style={{ height:8, borderRadius:4, background:'#e5e7eb', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4 }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Data Validation Tab ───────────────────────────────────────────────────
function DataValidationTab() {
  const [days, setDays] = useState(7);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['validate-data', days],
    queryFn: () => api.get(`/ai/validate-data?days=${days}`).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <LoadingCard text="Scanning care records for data quality issues…" />;
  if (error) return <ErrorCard error={error} onRetry={refetch} />;

  const issues: any[] = data?.issues || [];
  const urgent  = issues.filter(i => i.severity === 'urgent');
  const concern = issues.filter(i => i.severity === 'concern');
  const warning = issues.filter(i => i.severity === 'warning');

  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header">
          <span className="card-title">🔍 Data Quality Validation</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select className="form-input" value={days} onChange={e=>setDays(parseInt(e.target.value))} style={{ width:160 }}>
              <option value={3}>Last 3 days</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={()=>refetch()}>🔄 Re-scan</button>
          </div>
        </div>
        <div className="card-body">
          <p style={{ fontSize:14, color:'var(--text-secondary)', margin:0, lineHeight:1.6 }}>
            AI checks for copy-paste entries, unusually consistent values, missing records, and data that doesn't reflect real care. Good documentation protects residents and staff.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'Urgent', count:urgent.length,  color:'#dc2626', icon:'🚨' },
          { label:'Concern', count:concern.length, color:'#d97706', icon:'⚠️' },
          { label:'Flagged', count:warning.length, color:'#0d9488', icon:'💡' },
        ].map(k => (
          <div key={k.label} style={{ padding:'14px 16px', borderRadius:12, background:'white', border:`1px solid ${k.color}30`, borderLeft:`4px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:28, fontWeight:900, color:k.color }}>{k.count}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{k.label} issues</div>
              </div>
              <span style={{ fontSize:24 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {issues.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign:'center', padding:40 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>No data quality issues found</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>All care records checked for the last {days} days look consistent and complete.</div>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {['urgent','concern','warning'].map(sev => {
            const sevIssues = issues.filter(i => i.severity === sev);
            if (sevIssues.length === 0) return null;
            const ss = SEVERITY_STYLE[sev];
            return (
              <div key={sev}>
                <div style={{ fontSize:12, fontWeight:700, color:ss.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <span>{ss.icon}</span> {ss.label} ({sevIssues.length})
                </div>
                {sevIssues.map((issue, i) => (
                  <div key={i} className="card" style={{ marginBottom:8, borderLeft:`4px solid ${ss.color}` }}>
                    <div className="card-body">
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <span style={{ fontSize:24, flexShrink:0 }}>{ISSUE_ICONS[issue.type] || ss.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, flexWrap:'wrap', gap:8 }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <span style={{ fontWeight:700, fontSize:14 }}>{issue.resident}</span>
                              <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:'var(--surface-2)', color:'var(--text-muted)' }}>Room {issue.room}</span>
                              <span style={{ fontSize:11, padding:'1px 7px', borderRadius:8, background:ss.bg, color:ss.color, fontWeight:700 }}>{issue.type.replace(/_/g,' ')}</span>
                            </div>
                          </div>
                          <p style={{ fontSize:13, lineHeight:1.6, color:'var(--text-primary)', margin:0 }}>{issue.message}</p>
                          {issue.type.includes('copy_paste') && (
                            <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'#eff6ff', border:'1px solid #bfdbfe', fontSize:12, color:'#0d9488' }}>
                              💡 <strong>Why this matters:</strong> Copy-pasted data hides real changes in a resident's condition. A drop in fluid intake or appetite can signal illness days before other symptoms appear.
                            </div>
                          )}
                          {issue.type === 'no_notes_24h' && (
                            <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca', fontSize:12, color:'#dc2626' }}>
                              ⚖️ <strong>Legal requirement:</strong> Daily care notes are required for all residents. Missing documentation can put residents at risk and leave staff unprotected.
                            </div>
                          )}
                          {issue.type === 'persistent_high_pain' && (
                            <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca', fontSize:12, color:'#dc2626' }}>
                              🩺 <strong>Action required:</strong> Persistent high pain is preventable suffering. Contact the GP today to review pain management.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Resident Insights Tab ─────────────────────────────────────────────────
function ResidentInsightsTab() {
  const { data: rawResidents = [] } = useResidents({ active: true });
  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : (rawResidents as any)?.residents ?? [];
  const [residentId, setResidentId]   = useState('');
  const [days, setDays]               = useState(30);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<any>(null);
  const [error, setError]             = useState('');

  const generate = async () => {
    if (!residentId) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const { data } = await api.get(`/ai/insights/${residentId}?days=${days}`);
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to generate insights.');
    } finally { setLoading(false); }
  };

  const resident = residents.find(r => r.id === residentId);

  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span className="card-title">👤 AI Resident Insights</span></div>
        <div className="card-body">
          <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.6 }}>
            Deep AI analysis of a resident's complete care record — nutrition patterns, mood trends, pain levels, and specific recommendations to improve their daily life. This is not a report — it's an advocate for the resident.
          </p>
          <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="form-group" style={{ marginBottom:0, flex:'1 1 260px' }}>
              <label className="form-label">Select Resident</label>
              <select className="form-input" value={residentId} onChange={e=>setResidentId(e.target.value)}>
                <option value="">Choose resident…</option>
                {residents.map(r=><option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Analysis Period</label>
              <select className="form-input" value={days} onChange={e=>setDays(parseInt(e.target.value))} style={{ width:180 }}>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 3 months</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={loading||!residentId} style={{ alignSelf:'flex-end' }}>
              {loading ? '⏳ Analysing…' : '🧠 Generate Insights'}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ padding:'12px 16px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', marginBottom:16 }}>{error}</div>}

      {loading && <LoadingCard text={`Analysing ${resident?.first_name}'s care records, nutrition, mood and wellbeing… About 20 seconds.`} />}

      {result && (
        <>
          {/* Stats strip */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            {[
              { label:'Care Notes', value:result.stats.notes, icon:'📝', color:'#6366f1' },
              { label:'Avg Fluid', value:result.stats.avgFluid ? result.stats.avgFluid+'ml' : 'N/A', icon:'💧', color:result.stats.avgFluid<1200?'#dc2626':'#16a34a' },
              { label:'Avg Food', value:result.stats.avgFood!=null ? result.stats.avgFood+'%' : 'N/A', icon:'🍽', color:result.stats.avgFood<50?'#dc2626':'#16a34a' },
              { label:'Avg Pain', value:result.stats.avgPain ? result.stats.avgPain+'/10' : 'N/A', icon:'🩺', color:parseFloat(result.stats.avgPain)>=5?'#dc2626':'#16a34a' },
              { label:'Mood', value:result.stats.dominantMood || 'N/A', icon:'😊', color:'#8b5cf6' },
            ].map(k => (
              <div key={k.label} style={{ padding:'10px 14px', borderRadius:10, background:'white', border:`1px solid ${k.color}30`, borderLeft:`3px solid ${k.color}`, flex:'1 1 100px' }}>
                <div style={{ fontSize:18 }}>{k.icon}</div>
                <div style={{ fontSize:17, fontWeight:800, color:k.color, marginTop:2 }}>{k.value}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">🧠 AI Insights — {result.resident?.first_name} {result.resident?.last_name}</span>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                  {days}-day analysis · {new Date(result.generatedAt).toLocaleString('en-GB')}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const blob = new Blob([result.insights], { type:'text/plain' });
                  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
                  a.download=`insights-${result.resident?.first_name}-${new Date().toISOString().slice(0,10)}.txt`; a.click();
                }}>⬇️ Save</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>window.print()}>🖨️ Print</button>
              </div>
            </div>
            <div className="card-body">
              <div style={{ padding:'10px 14px', borderRadius:8, background:'#f0fdf4', border:'1px solid #86efac', marginBottom:16, fontSize:13, color:'#15803d' }}>
                ✅ This analysis uses real care data from the last {days} days. Recommendations are specific to {result.resident?.first_name}, not generic advice.
              </div>
              <div style={{ fontSize:14, lineHeight:1.9, color:'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: result.insights
                  .replace(/## (.*)/g, '<h3 style="font-size:15px;font-weight:800;margin:20px 0 8px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:6px">$1</h3>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>')
                }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="card">
      <div className="card-body" style={{ textAlign:'center', padding:50 }}>
        <div style={{ fontSize:40, marginBottom:12, animation:'spin 2s linear infinite', display:'inline-block' }}>🔄</div>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>Analysing care data…</div>
        <div style={{ fontSize:13, color:'var(--text-muted)', maxWidth:400, margin:'0 auto' }}>{text}</div>
      </div>
    </div>
  );
}

function ErrorCard({ error, onRetry }: { error: any; onRetry: () => void }) {
  return (
    <div className="card" style={{ border:'1px solid #fecaca' }}>
      <div className="card-body" style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
        <div style={{ fontWeight:700, marginBottom:8, color:'#dc2626' }}>Analysis failed</div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>{(error as any)?.message || 'Check that the AI service is configured'}</div>
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>Try Again</button>
      </div>
    </div>
  );
}
