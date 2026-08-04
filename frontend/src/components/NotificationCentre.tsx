// src/components/NotificationCentre.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const TYPE_CONFIG: Record<string,{icon:string;color:string}> = {
  dbs_expiring:       { icon:'🪪', color:'#d97706' },
  training_expired:   { icon:'🎓', color:'#d97706' },
  missed_medication:  { icon:'💊', color:'#dc2626' },
  weight_drop:        { icon:'⚖️', color:'#dc2626' },
  compliance_overdue: { icon:'✅', color:'#dc2626' },
  task_overdue:       { icon:'📋', color:'#f97316' },
  incident:           { icon:'🚨', color:'#dc2626' },
  family_message:     { icon:'💬', color:'#0d9488' },
  default:            { icon:'🔔', color:'#6366f1' },
};

export default function NotificationCentre() {
  const [open, setOpen]       = useState(false);
  const [notifs, setNotifs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const unread = notifs.filter(n => !n.read_at).length;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifs(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    api.post('/notifications/generate').catch(() => {});
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifs(prev => prev.map(n => n.id===id ? {...n, read_at: new Date().toISOString()} : n));
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    setNotifs(prev => prev.map(n => ({...n, read_at: new Date().toISOString()})));
  };

  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o=>!o)} style={{ position:'relative', width:38, height:38, borderRadius:10, background:open?'rgba(255,255,255,.12)':'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#c8d0db', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
        🔔
        {unread > 0 && (
          <span style={{ position:'absolute', top:3, right:3, minWidth:16, height:16, borderRadius:8, background:'#dc2626', color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', border:'1px solid #0f1623' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:400 }} />
          <div style={{ position:'fixed', top:58, right:16, width:380, maxWidth:'calc(100vw - 32px)', maxHeight:'70vh', background:'white', borderRadius:14, boxShadow:'0 20px 40px rgba(0,0,0,.2)', zIndex:401, display:'flex', flexDirection:'column', overflow:'hidden', border:'1px solid var(--border)' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface-2)' }}>
              <div>
                <span style={{ fontWeight:700, fontSize:14 }}>🔔 Notifications</span>
                {unread > 0 && <span style={{ marginLeft:8, fontSize:11, background:'#dc2626', color:'white', padding:'1px 7px', borderRadius:10, fontWeight:700 }}>{unread} new</span>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {unread > 0 && <button onClick={markAllRead} style={{ fontSize:11, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Mark all read</button>}
                <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:18 }}>×</button>
              </div>
            </div>

            <div style={{ overflowY:'auto', flex:1 }}>
              {loading ? (
                <div style={{ padding:30, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
              ) : notifs.length === 0 ? (
                <div style={{ padding:30, textAlign:'center', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                  <div style={{ fontWeight:600 }}>All clear!</div>
                </div>
              ) : notifs.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.default;
                const isNew = !n.read_at;
                return (
                  <div key={n.id} onClick={() => markRead(n.id)} style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', background:isNew?cfg.color+'08':'white', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontSize:20, flexShrink:0, marginTop:2 }}>{cfg.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                        <span style={{ fontWeight:isNew?700:600, fontSize:13, color:isNew?cfg.color:'var(--text-primary)' }}>{n.title}</span>
                        {isNew && <span style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, flexShrink:0, marginTop:4 }} />}
                      </div>
                      {n.body && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3, lineHeight:1.5 }}>{n.body}</div>}
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                        {new Date(n.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', background:'var(--surface-2)' }}>
              <button onClick={() => { load(); api.post('/notifications/generate').catch(()=>{}); }} style={{ fontSize:12, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>🔄 Refresh</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
