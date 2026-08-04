// src/pages/AuditLog.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatDateTime } from '../utils/formatters';

const ACTION_COLORS: Record<string,string> = { CREATE:'#16a34a', UPDATE:'#0d9488', DELETE:'#dc2626', LOGIN:'#6366f1', LOGOUT:'#6b7280', VIEW:'#9ca3af', EXPORT:'#d97706' };

export default function AuditLog() {
  const [search, setSearch]     = useState('');
  const [entity, setEntity]     = useState('');
  const [action, setAction]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);
  const limit = 50;

  const { data: rawLogs, isLoading } = useQuery({
    queryKey: ['audit-log', search, entity, action, dateFrom, dateTo, page],
    queryFn: () => api.get('/audit-log', { params:{ search, entity, action, dateFrom, dateTo, page, limit } }).then(r=>r.data),
    staleTime: 30_000,
  });
  const logs: any[] = Array.isArray(rawLogs) ? rawLogs : rawLogs?.logs ?? [];
  const total: number = rawLogs?.total ?? logs.length;

  const exportCsv = () => {
    const rows = logs.map((l:any) => `"${formatDateTime(l.created_at)}","${l.user_name||''}","${l.action}","${l.entity_type}","${(l.details||'').replace(/"/g,'""')}"`).join('\n');
    const blob = new Blob(['Timestamp,User,Action,Entity,Details\n'+rows], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `audit-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">🔍 Audit Log</h1><p className="page-subtitle">{total} records</p></div>
        <button className="btn btn-secondary" onClick={exportCsv}>⬇️ Export CSV</button>
      </div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ marginBottom:0, flex:'1 1 180px' }}><label className="form-label">Search</label><input className="form-input" placeholder="User, details…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div>
          <div className="form-group" style={{ marginBottom:0, flex:'1 1 140px' }}><label className="form-label">Entity</label>
            <select className="form-input" value={entity} onChange={e=>{setEntity(e.target.value);setPage(1);}}>
              <option value="">All</option>
              {['residents','care_notes','medications','incidents','staff','tasks','billing','compliance'].map(e=><option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom:0, flex:'1 1 120px' }}><label className="form-label">Action</label>
            <select className="form-input" value={action} onChange={e=>{setAction(e.target.value);setPage(1);}}>
              <option value="">All</option>
              {['CREATE','UPDATE','DELETE','LOGIN','LOGOUT','VIEW','EXPORT'].map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom:0 }}><label className="form-label">From</label><input className="form-input" type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}} style={{ width:148 }}/></div>
          <div className="form-group" style={{ marginBottom:0 }}><label className="form-label">To</label><input className="form-input" type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}} style={{ width:148 }}/></div>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setSearch('');setEntity('');setAction('');setDateFrom('');setDateTo('');setPage(1);}}>Clear</button>
        </div>
      </div>
      <div className="card">
        <div className="table-container">
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, whiteSpace:'nowrap' }}>Timestamp</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>User</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>Action</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>Entity</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>Details</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading?(<tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</td></tr>)
               :logs.length===0?(<tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No records found</td></tr>)
               :logs.map((l:any)=>{
                const ac = ACTION_COLORS[l.action]||'#6b7280';
                return(
                  <tr key={l.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'9px 14px', color:'var(--text-muted)', whiteSpace:'nowrap', fontFamily:'monospace', fontSize:12 }}>{formatDateTime(l.created_at)}</td>
                    <td style={{ padding:'9px 14px', fontWeight:600 }}><div>{l.user_name||'—'}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{l.user_role?.replace(/_/g,' ')}</div></td>
                    <td style={{ padding:'9px 14px' }}><span style={{ padding:'2px 8px', borderRadius:6, background:ac+'15', color:ac, fontWeight:700, fontSize:11 }}>{l.action}</span></td>
                    <td style={{ padding:'9px 14px', color:'var(--text-secondary)', textTransform:'capitalize' }}>{l.entity_type?.replace(/_/g,' ')}</td>
                    <td style={{ padding:'9px 14px', color:'var(--text-secondary)', maxWidth:300 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.details||l.description||'—'}</div></td>
                    <td style={{ padding:'9px 14px', color:'var(--text-muted)', fontSize:11, fontFamily:'monospace' }}>{l.ip_address||'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total>limit&&(
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}>
            <span style={{ color:'var(--text-muted)' }}>Page {page} · {total} total</span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Prev</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setPage(p=>p+1)} disabled={page*limit>=total}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
