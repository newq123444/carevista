import React, { useState, useMemo } from 'react';
import {
  useCompetencies, useCreateCompetency, useStaffCompetencies,
  useUpdateStaffCompetency, useCompetencyMatrix, useExpiringCompetencies, useStaff,
} from '../hooks';
import type { Competency, StaffCompetency } from '../types';

const CATEGORIES = [
  'PEG feeds', 'Insulin administration', 'Syringe drivers', 'Wound care',
  'Moving & handling', 'Medication management', 'Catheter care',
];

export default function CompetencyMatrix() {
  const { data: competencies } = useCompetencies();
  const { data: staffCompetencies } = useStaffCompetencies();
  const { data: matrix } = useCompetencyMatrix();
  const { data: expiring } = useExpiringCompetencies();
  const { data: staffList } = useStaff();
  const createCompetency = useCreateCompetency();
  const updateStaffCompetency = useUpdateStaffCompetency();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showSignOff, setShowSignOff] = useState<{ staffId: string; staffName: string; competencyId: string; competencyName: string } | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [competencyForm, setCompetencyForm] = useState({
    name: '', category: '', description: '', requires_renewal: false, renewal_months: '',
  });
  const [signOffDate, setSignOffDate] = useState(new Date().toISOString().slice(0, 10));
  const [signOffNotes, setSignOffNotes] = useState('');

  const competencyList: Competency[] = Array.isArray(competencies) ? competencies : [];
  const staffCompList: StaffCompetency[] = Array.isArray(staffCompetencies) ? staffCompetencies : [];
  const staffMembers: any[] = Array.isArray(staffList) ? staffList : [];
  const expiringList: any[] = Array.isArray(expiring) ? expiring : [];

  // Filter staff
  const filteredStaff = useMemo(() => {
    if (!filterRole) return staffMembers;
    return staffMembers.filter((s: any) => s.role === filterRole);
  }, [staffMembers, filterRole]);

  // Filter competencies by category
  const filteredCompetencies = useMemo(() => {
    if (!filterCategory) return competencyList;
    return competencyList.filter(c => c.category === filterCategory);
  }, [competencyList, filterCategory]);

  // Build a lookup map for staff competency status
  const getCompetencyStatus = (staffId: string, competencyId: string): { status: string; expiryDate?: string } => {
    // First check matrix data
    if (matrix && Array.isArray(matrix)) {
      const entry = (matrix as any[]).find((m: any) => m.staff_id === staffId && m.competency_id === competencyId);
      if (entry) return { status: entry.status, expiryDate: entry.expiry_date };
    }
    // Fallback to staffCompetencies
    const sc = staffCompList.find(s => s.staff_id === staffId && s.competency_id === competencyId);
    if (sc) {
      // Check if expiring within 30 days
      if (sc.status === 'achieved' && sc.expiry_date) {
        const daysUntil = (new Date(sc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntil < 0) return { status: 'expired', expiryDate: sc.expiry_date };
        if (daysUntil <= 30) return { status: 'expiring', expiryDate: sc.expiry_date };
      }
      return { status: sc.status, expiryDate: sc.expiry_date };
    }
    return { status: 'not_started' };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'achieved': return '#10b981';
      case 'expiring': return '#f59e0b';
      case 'expired': return '#ef4444';
      case 'in_progress': return '#3b82f6';
      default: return '#9ca3af';
    }
  };

  const handleCreateCompetency = (e: React.FormEvent) => {
    e.preventDefault();
    createCompetency.mutate({
      name: competencyForm.name,
      category: competencyForm.category,
      description: competencyForm.description,
      renewal_months: competencyForm.requires_renewal && competencyForm.renewal_months ? Number(competencyForm.renewal_months) : null,
    });
    setCompetencyForm({ name: '', category: '', description: '', requires_renewal: false, renewal_months: '' });
    setShowAddForm(false);
  };

  const handleSignOff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSignOff) return;
    // Find existing staff competency to update
    const existing = staffCompList.find(sc => sc.staff_id === showSignOff.staffId && sc.competency_id === showSignOff.competencyId);
    if (existing) {
      updateStaffCompetency.mutate({
        id: existing.id,
        data: { status: 'achieved', achieved_date: signOffDate, notes: signOffNotes },
      });
    }
    setShowSignOff(null);
    setSignOffNotes('');
  };

  // Get unique roles from staff
  const roles = useMemo(() => {
    const roleSet = new Set(staffMembers.map((s: any) => s.role));
    return Array.from(roleSet).sort();
  }, [staffMembers]);

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Competency Matrix</h1>
          <p className="page-subtitle">Track staff competencies, sign-offs, and expiry alerts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add Competency</button>
      </div>

      {/* Add Competency Form Modal */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500 }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Add New Competency</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>X</button>
              </div>
              <form onSubmit={handleCreateCompetency}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Name *</label>
                    <input className="input" value={competencyForm.name} onChange={e => setCompetencyForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. PEG Feeding" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Category</label>
                    <select className="input" value={competencyForm.category} onChange={e => setCompetencyForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">Select category...</option>
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Description</label>
                    <textarea className="input" rows={3} value={competencyForm.description} onChange={e => setCompetencyForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the competency requirements..." />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="requires_renewal" checked={competencyForm.requires_renewal} onChange={e => setCompetencyForm(f => ({ ...f, requires_renewal: e.target.checked }))} />
                    <label htmlFor="requires_renewal" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Requires Renewal</label>
                  </div>
                  {competencyForm.requires_renewal && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Renewal Period (months)</label>
                      <input className="input" type="number" value={competencyForm.renewal_months} onChange={e => setCompetencyForm(f => ({ ...f, renewal_months: e.target.value }))} placeholder="e.g. 12" />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={createCompetency.isPending}>
                      {createCompetency.isPending ? 'Creating...' : 'Create Competency'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Sign Off Modal */}
      {showSignOff && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Sign Off Competency</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSignOff(null)}>X</button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                <strong>{showSignOff.staffName}</strong> - {showSignOff.competencyName}
              </p>
              <form onSubmit={handleSignOff}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Date Achieved</label>
                    <input className="input" type="date" value={signOffDate} onChange={e => setSignOffDate(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Evidence / Notes</label>
                    <textarea className="input" rows={3} value={signOffNotes} onChange={e => setSignOffNotes(e.target.value)} placeholder="Add evidence notes..." />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowSignOff(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={updateStaffCompetency.isPending}>
                      {updateStaffCompetency.isPending ? 'Saving...' : 'Sign Off'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: 8 }}>Filter by Role:</label>
            <select className="input" style={{ width: 'auto', display: 'inline-block' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: 8 }}>Filter by Category:</label>
            <select className="input" style={{ width: 'auto', display: 'inline-block' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Competent</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Expiring</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Expired</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }} /> Not Started</span>
          </div>
        </div>
      </div>

      {/* Competency Matrix Grid */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>Competency Matrix</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg-primary, #fff)', zIndex: 1, minWidth: 160 }}>Staff Member</th>
                  {filteredCompetencies.map(comp => (
                    <th key={comp.id} style={{ textAlign: 'center', fontSize: '0.75rem', minWidth: 80, whiteSpace: 'nowrap' }}>{comp.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff: any) => (
                  <tr key={staff.id}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--bg-primary, #fff)', zIndex: 1, fontWeight: 600, fontSize: '0.85rem' }}>
                      {staff.first_name} {staff.last_name}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{staff.role?.replace(/_/g, ' ')}</div>
                    </td>
                    {filteredCompetencies.map(comp => {
                      const { status } = getCompetencyStatus(staff.id, comp.id);
                      const color = getStatusColor(status);
                      return (
                        <td key={comp.id} style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setShowSignOff({ staffId: staff.id, staffName: `${staff.first_name} ${staff.last_name}`, competencyId: comp.id, competencyName: comp.name })}
                            style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: 'none', cursor: 'pointer', transition: 'transform 0.15s' }}
                            title={`${staff.first_name} ${staff.last_name} - ${comp.name}: ${status.replace(/_/g, ' ')}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr><td colSpan={filteredCompetencies.length + 1} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No staff members to display</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expiring Competencies Alert Panel */}
      <div className="card">
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#f59e0b' }}>&#9888;</span> Expiring Competencies (Next 30 Days)
          </h3>
          {expiringList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No competencies expiring in the next 30 days.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Competency</th>
                    <th>Expiry Date</th>
                    <th>Days Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringList.sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()).map((item: any, idx: number) => {
                    const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.staff_name || '-'}</td>
                        <td>{item.competency_name || '-'}</td>
                        <td>{new Date(item.expiry_date).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${daysLeft <= 7 ? 'badge-danger' : daysLeft <= 14 ? 'badge-warning' : 'badge-neutral'}`}>
                            {daysLeft <= 0 ? 'Expired' : `${daysLeft} days`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
