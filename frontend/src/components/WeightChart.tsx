// src/components/WeightChart.tsx
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatDate } from '../utils/formatters';

const MUST_LABELS: Record<number,{label:string;color:string;action:string}> = {
  0: { label:'Low Risk',    color:'#16a34a', action:'Routine re-screening: monthly in care home' },
  1: { label:'Medium Risk', color:'#d97706', action:'Observe & document dietary intake for 3 days. If inadequate, follow local policy.' },
  2: { label:'High Risk',   color:'#dc2626', action:'Refer to dietitian. Improve and increase overall nutritional intake immediately.' },
};

export function WeightChart({ residentId, residentName }: { residentId: string; residentName: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ weightKg:'', mustScore:'', notes:'' });
  const [saving, setSaving]   = useState(false);

  const { data: rawWeights = [] } = useQuery({
    queryKey: ['weights', residentId],
    queryFn: () => api.get(`/residents/${residentId}/weights`).then(r => r.data),
  });
  const weights: any[] = Array.isArray(rawWeights) ? rawWeights : [];
  const latest = weights[0];
  const prev   = weights[1];
  const weightChange = latest && prev ? (latest.weight_kg - prev.weight_kg).toFixed(1) : null;
  const pctChange    = latest && prev ? (((latest.weight_kg - prev.weight_kg)/prev.weight_kg)*100).toFixed(1) : null;
  const mustInfo     = latest?.must_score != null ? MUST_LABELS[Math.min(latest.must_score,2)] : null;

  // SVG chart
  const chartW = [...weights].reverse().slice(-12);
  const W=400, H=120, P=20;
  const minW = Math.min(...chartW.map((w:any)=>w.weight_kg))-2;
  const maxW = Math.max(...chartW.map((w:any)=>w.weight_kg))+2;
  const tx = (i:number) => P+(i/Math.max(chartW.length-1,1))*(W-P*2);
  const ty = (w:number) => H-P-((w-minW)/(maxW-minW||1))*(H-P*2);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/residents/${residentId}/weights`, { weightKg:parseFloat(form.weightKg), mustScore:form.mustScore?parseInt(form.mustScore):null, notes:form.notes||null });
      qc.invalidateQueries({ queryKey:['weights', residentId] });
      setShowAdd(false); setForm({ weightKg:'', mustScore:'', notes:'' });
    } catch (err:any) { alert(err?.response?.data?.error||'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:16 }}>
        <div style={{ padding:'12px 14px', borderRadius:10, background:'white', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>Current Weight</div>
          <div style={{ fontSize:22, fontWeight:800 }}>{latest?`${latest.weight_kg}kg`:'—'}</div>
          {latest?.bmi&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>BMI {latest.bmi}</div>}
        </div>
        {weightChange&&(
          <div style={{ padding:'12px 14px', borderRadius:10, background:'white', border:`1px solid ${parseFloat(weightChange)<0?'#fecaca':'#bbf7d0'}` }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>Change</div>
            <div style={{ fontSize:22, fontWeight:800, color:parseFloat(weightChange)<-2?'#dc2626':parseFloat(weightChange)>0?'#16a34a':'var(--text-primary)' }}>
              {parseFloat(weightChange)>0?'+':''}{weightChange}kg
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{pctChange}% vs prev</div>
          </div>
        )}
        {mustInfo&&(
          <div style={{ padding:'12px 14px', borderRadius:10, background:mustInfo.color+'10', border:`1px solid ${mustInfo.color}30` }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>MUST Score</div>
            <div style={{ fontSize:22, fontWeight:800, color:mustInfo.color }}>{latest.must_score}</div>
            <div style={{ fontSize:11, color:mustInfo.color, fontWeight:600 }}>{mustInfo.label}</div>
          </div>
        )}
        <div style={{ padding:'12px 14px', borderRadius:10, background:'white', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>Readings</div>
          <div style={{ fontSize:22, fontWeight:800 }}>{weights.length}</div>
          {latest&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>Last: {formatDate(latest.created_at)}</div>}
        </div>
      </div>

      {mustInfo&&latest?.must_score>=1&&(
        <div style={{ padding:'10px 14px', borderRadius:8, background:mustInfo.color+'10', border:`1px solid ${mustInfo.color}30`, marginBottom:16, fontSize:13 }}>
          <strong style={{ color:mustInfo.color }}>MUST Action ({mustInfo.label}):</strong> {mustInfo.action}
        </div>
      )}

      {chartW.length>=2&&(
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header"><span className="card-title">📈 Weight Trend</span></div>
          <div className="card-body">
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:120 }}>
              {[0,.25,.5,.75,1].map(t=><line key={t} x1={P} y1={P+(1-t)*(H-P*2)} x2={W-P} y2={P+(1-t)*(H-P*2)} stroke="#e5e7eb" strokeWidth={1}/>)}
              <polygon fill="#0d9488" fillOpacity={0.08} points={`${tx(0)},${H-P} ${chartW.map((w:any,i:number)=>`${tx(i)},${ty(w.weight_kg)}`).join(' ')} ${tx(chartW.length-1)},${H-P}`}/>
              <polyline fill="none" stroke="#0d9488" strokeWidth={2.5} strokeLinejoin="round" points={chartW.map((w:any,i:number)=>`${tx(i)},${ty(w.weight_kg)}`).join(' ')}/>
              {chartW.map((w:any,i:number)=><circle key={i} cx={tx(i)} cy={ty(w.weight_kg)} r={4} fill="#0d9488" stroke="white" strokeWidth={2}><title>{formatDate(w.created_at)}: {w.weight_kg}kg</title></circle>)}
            </svg>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(s=>!s)} style={{ marginBottom:12 }}>
        {showAdd?'▲ Close':'+ Record Weight'}
      </button>

      {showAdd&&(
        <form onSubmit={save} className="card" style={{ marginBottom:16 }}>
          <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>📊 Record Weight for {residentName}</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Weight (kg) *</label>
                <input className="form-input" type="number" step="0.1" required value={form.weightKg} onChange={e=>setForm(f=>({...f,weightKg:e.target.value}))} placeholder="e.g. 65.4"/>
              </div>
              <div className="form-group">
                <label className="form-label">MUST Score</label>
                <select className="form-input" value={form.mustScore} onChange={e=>setForm(f=>({...f,mustScore:e.target.value}))}>
                  <option value="">Not assessed</option>
                  <option value="0">0 — Low Risk</option>
                  <option value="1">1 — Medium Risk</option>
                  <option value="2">2 — High Risk</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any observations…"/>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving?'Saving…':'✅ Save Weight'}</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      {weights.length>0&&(
        <div className="table-container">
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>Date</th>
                <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>Weight</th>
                <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>BMI</th>
                <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>MUST</th>
                <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {weights.map((w:any,i:number)=>{
                const prev2=weights[i+1];
                const diff=prev2?(w.weight_kg-prev2.weight_kg).toFixed(1):null;
                return(
                  <tr key={w.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 12px' }}>{formatDate(w.created_at)}</td>
                    <td style={{ padding:'8px 12px', fontWeight:700 }}>
                      {w.weight_kg}kg
                      {diff&&<span style={{ marginLeft:6, fontSize:11, color:parseFloat(diff)<0?'#dc2626':'#16a34a', fontWeight:700 }}>{parseFloat(diff)>0?'+':''}{diff}kg</span>}
                    </td>
                    <td style={{ padding:'8px 12px', color:'var(--text-secondary)' }}>{w.bmi||'—'}</td>
                    <td style={{ padding:'8px 12px' }}>
                      {w.must_score!=null?<span style={{ padding:'2px 8px', borderRadius:10, background:MUST_LABELS[Math.min(w.must_score,2)]?.color+'15', color:MUST_LABELS[Math.min(w.must_score,2)]?.color, fontWeight:700, fontSize:11 }}>{w.must_score}</span>:'—'}
                    </td>
                    <td style={{ padding:'8px 12px', color:'var(--text-secondary)' }}>{w.recorded_by_name||'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
