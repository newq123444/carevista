// src/components/BodyMap.tsx
import React, { useState } from 'react';

export type BodyMapMark = {
  id: string; x: number; y: number; side: 'front'|'back';
  type: 'pressure_ulcer'|'wound'|'bruising'|'skin_tear'|'redness'|'other';
  grade?: string; notes?: string;
};

const MARK_COLORS: Record<string,string> = {
  pressure_ulcer:'#dc2626', wound:'#7c3aed', bruising:'#0d9488',
  skin_tear:'#d97706', redness:'#f97316', other:'#6b7280',
};

const MARK_TYPES = [
  { value:'pressure_ulcer', label:'🔴 Pressure Ulcer' },
  { value:'wound',          label:'🟣 Wound' },
  { value:'bruising',       label:'🔵 Bruising' },
  { value:'skin_tear',      label:'🟠 Skin Tear' },
  { value:'redness',        label:'🟡 Redness' },
  { value:'other',          label:'⚫ Other' },
];

const GRADES = ['Grade 1 — Non-blanching redness','Grade 2 — Blister/shallow break','Grade 3 — Full thickness','Grade 4 — Deep/bone visible'];

interface Props { marks: BodyMapMark[]; onChange: (marks: BodyMapMark[]) => void; readonly?: boolean; }

export function BodyMap({ marks, onChange, readonly=false }: Props) {
  const [side, setSide]           = useState<'front'|'back'>('front');
  const [pending, setPending]     = useState<{x:number;y:number}|null>(null);
  const [form, setForm]           = useState({ type:'pressure_ulcer', grade:'', notes:'' });
  const [hovered, setHovered]     = useState<string|null>(null);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readonly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX-rect.left)/rect.width)*200;
    const y = ((e.clientY-rect.top)/rect.height)*340;
    setPending({ x, y });
    setForm({ type:'pressure_ulcer', grade:'', notes:'' });
  };

  const addMark = () => {
    if (!pending) return;
    onChange([...marks, { id:Date.now().toString(), x:pending.x, y:pending.y, side, type:form.type as any, grade:form.grade||undefined, notes:form.notes||undefined }]);
    setPending(null);
  };

  const sideMarks = marks.filter(m => m.side===side);

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12, justifyContent:'center' }}>
        {(['front','back'] as const).map(s=>(
          <button key={s} onClick={()=>setSide(s)} style={{ padding:'6px 20px', borderRadius:20, border:`2px solid ${side===s?'#0d9488':'var(--border)'}`, background:side===s?'#eff6ff':'white', color:side===s?'#0d9488':'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:side===s?700:400, textTransform:'capitalize' }}>
            {s==='front'?'👁 Front':'🔙 Back'}
          </button>
        ))}
      </div>
      {!readonly&&<p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', marginBottom:8 }}>Click on the body to mark a wound or skin concern</p>}

      <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start' }}>
        <div style={{ flex:'0 0 200px' }}>
          <svg viewBox="0 0 200 340" style={{ width:'100%', maxWidth:200, cursor:readonly?'default':'crosshair', border:'1px solid var(--border)', borderRadius:10, background:'#fafafa' }} onClick={handleClick}>
            <circle cx="100" cy="22" r="20" fill="#f0e6d3" stroke="#c9a96e" strokeWidth="2"/>
            <path d="M82,42 L75,50 C72,70 72,100 72,120 L128,120 C128,100 128,70 125,50 Z" fill="#f0e6d3" stroke="#c9a96e" strokeWidth="2"/>
            <path d="M75,55 L55,70 L48,110 L48,130 L60,130 L65,105 L75,80" fill="#f0e6d3" stroke="#c9a96e" strokeWidth="2"/>
            <path d="M125,55 L145,70 L152,110 L152,130 L140,130 L135,105 L125,80" fill="#f0e6d3" stroke="#c9a96e" strokeWidth="2"/>
            <path d="M82,120 L80,200 L78,240 L78,300 L92,300 L95,240 L100,220" fill="#f0e6d3" stroke="#c9a96e" strokeWidth="2"/>
            <path d="M118,120 L120,200 L122,240 L122,300 L108,300 L105,240 L100,220" fill="#f0e6d3" stroke="#c9a96e" strokeWidth="2"/>
            <line x1="100" y1="0" x2="100" y2="340" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4,4"/>
            {pending&&<circle cx={pending.x} cy={pending.y} r={8} fill="#0d9488" fillOpacity={0.3} stroke="#0d9488" strokeWidth={2} strokeDasharray="3,2"/>}
            {sideMarks.map(m=>(
              <g key={m.id}>
                <circle cx={m.x} cy={m.y} r={7} fill={MARK_COLORS[m.type]} fillOpacity={0.85} stroke="white" strokeWidth={2}
                  style={{ cursor:readonly?'default':'pointer' }}
                  onMouseEnter={()=>setHovered(m.id)} onMouseLeave={()=>setHovered(null)}
                  onClick={e=>{e.stopPropagation();if(!readonly)onChange(marks.filter(x=>x.id!==m.id));}}/>
                {hovered===m.id&&(
                  <foreignObject x={Math.min(m.x+8,100)} y={m.y-20} width={150} height={70}>
                    <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', fontSize:11, boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
                      <div style={{ fontWeight:700, color:MARK_COLORS[m.type], textTransform:'capitalize' }}>{m.type.replace(/_/g,' ')}</div>
                      {m.grade&&<div style={{ color:'var(--text-muted)' }}>{m.grade.slice(0,30)}</div>}
                      {m.notes&&<div style={{ color:'var(--text-secondary)' }}>{m.notes}</div>}
                      {!readonly&&<div style={{ color:'#dc2626', marginTop:2 }}>Click to remove</div>}
                    </div>
                  </foreignObject>
                )}
              </g>
            ))}
          </svg>
        </div>

        <div style={{ flex:1, minWidth:180 }}>
          {pending&&!readonly&&(
            <div className="card" style={{ marginBottom:12 }}>
              <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>📍 Add Mark</div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    {MARK_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {(form.type==='pressure_ulcer'||form.type==='wound')&&(
                  <div className="form-group">
                    <label className="form-label">Grade</label>
                    <select className="form-input" value={form.grade} onChange={e=>setForm(f=>({...f,grade:e.target.value}))}>
                      <option value="">Not graded</option>
                      {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Size, colour, treatment…"/>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={addMark}>✅ Add</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setPending(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Legend</div>
            {MARK_TYPES.map(t=>(
              <div key={t.value} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, fontSize:12 }}>
                <div style={{ width:12, height:12, borderRadius:'50%', background:MARK_COLORS[t.value], flexShrink:0 }}/>
                <span style={{ color:'var(--text-secondary)' }}>{t.label}</span>
              </div>
            ))}
          </div>

          {sideMarks.length>0&&(
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                {sideMarks.length} mark{sideMarks.length!==1?'s':''} ({side})
              </div>
              {sideMarks.map(m=>(
                <div key={m.id} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:8, padding:'8px 10px', borderRadius:8, background:MARK_COLORS[m.type]+'10', border:`1px solid ${MARK_COLORS[m.type]}30` }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:MARK_COLORS[m.type], flexShrink:0, marginTop:3 }}/>
                  <div style={{ flex:1, fontSize:12 }}>
                    <div style={{ fontWeight:700, color:MARK_COLORS[m.type], textTransform:'capitalize' }}>{m.type.replace(/_/g,' ')}</div>
                    {m.grade&&<div style={{ color:'var(--text-muted)' }}>{m.grade}</div>}
                    {m.notes&&<div style={{ color:'var(--text-secondary)' }}>{m.notes}</div>}
                  </div>
                  {!readonly&&<button onClick={()=>onChange(marks.filter(x=>x.id!==m.id))} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:16 }}>×</button>}
                </div>
              ))}
            </div>
          )}
          {sideMarks.length===0&&!pending&&(
            <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:20 }}>
              {readonly?'No marks recorded':'Click the diagram to add marks'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
