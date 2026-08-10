// src/pages/AiTools.tsx
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useResidents } from '../hooks';
import { api } from '../services/api';
import type { Resident } from '../types';

export default function AiTools() {
  const [tab, setTab] = useState<'handover'|'careplan'|'flags'>('handover');
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">🤖 AI Tools</h1><p className="page-subtitle">AI-powered reports — powered by Claude</p></div>
      </div>
      <div style={{ display:'flex', gap:2, borderBottom:'2px solid var(--border)', marginBottom:20 }}>
        {[['handover','🔁 Handover'],['careplan','📋 Care Plan'],['flags','💊 Med Flags']] .map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as any)} style={{ padding:'10px 20px', border:'none', background:'none', borderBottom:`2px solid ${tab===k?'#0d9488':'transparent'}`, color:tab===k?'#0d9488':'var(--text-secondary)', fontWeight:tab===k?700:500, cursor:'pointer', fontSize:14, marginBottom:-2 }}>{l}</button>
        ))}
      </div>
      {tab==='handover'&&<HandoverTool/>}
      {tab==='careplan'&&<CarePlanTool/>}
      {tab==='flags'&&<MedFlagsTool/>}
    </div>
  );
}

function HandoverTool() {
  const { t } = useLang();
  const [hours, setHours]     = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setResult(null);
    try { const { data } = await api.get(`/ai/handover?hours=${hours}`); setResult(data); }
    catch (e:any) { setError(e?.response?.data?.error||'Failed to generate. Check AI service is configured.'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span className="card-title">🔁 AI Shift Handover Report</span></div>
        <div className="card-body">
          <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.6 }}>Generate a professional shift handover report based on the last N hours of care notes, incidents, missed medications and outstanding tasks.</p>
          <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">{t('Hours to cover')}</label>
              <select className="form-input" value={hours} onChange={e=>setHours(parseInt(e.target.value))} style={{ width:200 }}>
                <option value={4}>Last 4 hours</option>
                <option value={8}>Last 8 hours (day shift)</option>
                <option value={12}>Last 12 hours</option>
                <option value={24}>Last 24 hours</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading?'⏳ Generating…':'⚡ Generate Handover'}</button>
          </div>
        </div>
      </div>
      {error&&<div style={{ padding:'12px 16px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', marginBottom:16 }}>{error}</div>}
      {loading&&(
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚙️</div>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Generating handover report…</div>
          <div style={{ color:'var(--text-muted)', fontSize:13 }}>Analysing care notes, incidents, medications and tasks. About 15-20 seconds.</div>
        </div></div>
      )}
      {result&&(
        <div className="card">
          <div className="card-header">
            <div><span className="card-title">📄 Handover Report</span><div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{new Date(result.generatedAt).toLocaleString('en-GB')}</div></div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={()=>{ const b=new Blob([result.report],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`handover-${new Date().toISOString().slice(0,10)}.txt`; a.click(); }}>⬇️ Download</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>window.print()}>🖨️ Print</button>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              {[['Notes',result.stats?.notes,'#6366f1'],['Incidents',result.stats?.incidents,'#dc2626'],['Missed Meds',result.stats?.missedMeds,'#dc2626'],['Tasks',result.stats?.tasks,'#d97706']].map(([l,v,c])=>(
                <div key={l as string} style={{ padding:'6px 12px', borderRadius:8, background:(v as number)>0?(c as string)+'12':'var(--surface-2)', border:`1px solid ${(v as number)>0?c:'var(--border)'}20`, fontSize:13 }}>
                  <span style={{ fontWeight:700, color:(v as number)>0?c as string:'var(--text-muted)' }}>{v}</span>
                  <span style={{ color:'var(--text-muted)', marginLeft:5 }}>{l}</span>
                </div>
              ))}
            </div>
            <pre style={{ fontFamily:'inherit', fontSize:14, lineHeight:1.8, whiteSpace:'pre-wrap', color:'var(--text-primary)' }}>{result.report}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function CarePlanTool() {
  const { t } = useLang();
  const { data: rawResidents=[] } = useResidents({ active:true });
  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : (rawResidents as any)?.residents ?? [];
  const [residentId, setResidentId] = useState('');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [error, setError]           = useState('');

  const generate = async () => {
    if (!residentId) return;
    setLoading(true); setError(''); setResult(null);
    try { const { data } = await api.get(`/ai/care-plan/${residentId}`); setResult(data); }
    catch (e:any) { setError(e?.response?.data?.error||'Failed to generate care plan.'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span className="card-title">📋 AI Care Plan Generator</span></div>
        <div className="card-body">
          <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.6 }}>Generate a comprehensive person-centred care plan using the resident's profile, recent notes, medications and incidents.</p>
          <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="form-group" style={{ marginBottom:0, flex:'1 1 280px' }}>
              <label className="form-label">{t('Select Resident')}</label>
              <select className="form-input" value={residentId} onChange={e=>setResidentId(e.target.value)}>
                <option value="">Choose resident…</option>
                {residents.map(r=><option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Rm {r.room_number}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={loading||!residentId}>{loading?'⏳ Generating…':'⚡ Generate Care Plan'}</button>
          </div>
        </div>
      </div>
      {error&&<div style={{ padding:'12px 16px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', marginBottom:16 }}>{error}</div>}
      {loading&&<div className="card"><div className="card-body" style={{ textAlign:'center', padding:60 }}><div style={{ fontSize:40, marginBottom:12 }}>📋</div><div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Generating care plan…</div><div style={{ color:'var(--text-muted)', fontSize:13 }}>About 20-30 seconds.</div></div></div>}
      {result&&(
        <div className="card">
          <div className="card-header">
            <div><span className="card-title">📋 {result.resident?.first_name} {result.resident?.last_name} — Care Plan</span><div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Generated {new Date(result.generatedAt).toLocaleString('en-GB')} · Review before use</div></div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={()=>{ const b=new Blob([result.plan],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`care-plan-${result.resident?.first_name}.txt`; a.click(); }}>⬇️ Download</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>window.print()}>🖨️ Print</button>
            </div>
          </div>
          <div className="card-body">
            <div style={{ padding:'10px 14px', borderRadius:8, background:'#fffbeb', border:'1px solid #fcd34d', marginBottom:16, fontSize:13, color:'#92400e' }}>⚠️ AI-generated. Always review and personalise with family/resident input before using as an official care plan.</div>
            <pre style={{ fontFamily:'inherit', fontSize:14, lineHeight:1.9, whiteSpace:'pre-wrap', color:'var(--text-primary)' }}>{result.plan}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function MedFlagsTool() {
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState('');

  const analyse = async () => {
    setLoading(true); setError(''); setResult(null);
    try { const { data } = await api.post('/ai/medication-flags'); setResult(data); }
    catch (e:any) { setError(e?.response?.data?.error||'Failed to analyse medications.'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span className="card-title">💊 AI Medication Flags</span></div>
        <div className="card-body">
          <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.6 }}>AI analysis of all current medications for potential interactions, duplications and age-related concerns. Not a substitute for pharmacist review.</p>
          <button className="btn btn-primary" onClick={analyse} disabled={loading}>{loading?'⏳ Analysing…':'⚡ Analyse Medications'}</button>
        </div>
      </div>
      {error&&<div style={{ padding:'12px 16px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626' }}>{error}</div>}
      {result&&(
        <div className="card">
          <div className="card-header"><span className="card-title">💊 Medication Analysis</span></div>
          <div className="card-body">
            <div style={{ padding:'10px 14px', borderRadius:8, background:'#fffbeb', border:'1px solid #fcd34d', marginBottom:16, fontSize:13, color:'#92400e' }}>⚠️ AI analysis only — always consult a pharmacist before making medication changes.</div>
            <pre style={{ fontFamily:'inherit', fontSize:14, lineHeight:1.8, whiteSpace:'pre-wrap', color:'var(--text-primary)' }}>{typeof result==='string'?result:JSON.stringify(result,null,2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
