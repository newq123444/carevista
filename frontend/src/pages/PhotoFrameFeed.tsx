import React, { useState } from 'react';
import { useUploadPhoto, usePhotoFramePhotos, useApprovePhoto, useRejectPhoto, useSchedulePhoto, usePhotoViewingHistory, useResidents } from '../hooks';

export default function PhotoFrameFeed() {
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload' | 'approval' | 'schedule' | 'history'>('gallery');
  const [statusFilter, setStatusFilter] = useState('approved');

  const { data: residents } = useResidents();
  const { data: photos = [] } = usePhotoFramePhotos(selectedResident, { status: statusFilter });
  const { data: viewHistory = [] } = usePhotoViewingHistory(selectedResident);

  const uploadMutation = useUploadPhoto();
  const approveMutation = useApprovePhoto();
  const rejectMutation = useRejectPhoto();
  const scheduleMutation = useSchedulePhoto();

  const [scheduleForm, setScheduleForm] = useState({ photo_id: '', show_on_date: '', occasion: '' });

  const residentList = Array.isArray(residents) ? residents : [];
  const photoList = Array.isArray(photos) ? photos : [];
  const historyList = Array.isArray(viewHistory) ? viewHistory : [];

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const formEl = e.target as HTMLFormElement;
    const fileInput = formEl.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput?.files?.[0] || !selectedResident) return;
    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    formData.append('resident_id', selectedResident);
    const captionInput = formEl.querySelector('input[name="caption"]') as HTMLInputElement;
    if (captionInput?.value) formData.append('caption', captionInput.value);
    uploadMutation.mutate(formData, { onSuccess: () => formEl.reset() });
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleMutation.mutate({ id: scheduleForm.photo_id, data: { show_on_date: scheduleForm.show_on_date, occasion: scheduleForm.occasion } }, {
      onSuccess: () => setScheduleForm({ photo_id: '', show_on_date: '', occasion: '' })
    });
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return { bg: '#dcfce7', color: '#16a34a' };
    if (status === 'rejected') return { bg: '#fee2e2', color: '#dc2626' };
    return { bg: '#fef3c7', color: '#d97706' };
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Digital Photo Frame Feed</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Family photo uploads, approval workflow, and viewing history.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">All residents</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['gallery', 'upload', 'approval', 'schedule', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'approval') setStatusFilter('pending'); else if (tab === 'gallery') setStatusFilter('approved'); }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'gallery' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Approved Photos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {photoList.map((p: any) => (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: 140, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>📷</div>
                <div style={{ padding: 12 }}>
                  {p.caption && <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: 4 }}>{p.caption}</div>}
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.resident_name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
          {photoList.length === 0 && <p style={{ color: '#6b7280' }}>No approved photos to display.</p>}
        </div>
      )}

      {activeTab === 'upload' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Upload Photo</h2>
          {selectedResident ? (
            <form onSubmit={handleUpload} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Photo File</label>
                <input type="file" accept="image/*" required style={{ padding: '8px 0' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Caption</label>
                <input type="text" name="caption" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="Optional caption..." />
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Upload</button>
            </form>
          ) : <p style={{ color: '#6b7280' }}>Select a resident to upload photos for them.</p>}
        </div>
      )}

      {activeTab === 'approval' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Pending Approval</h2>
          {photoList.map((p: any) => (
            <div key={p.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 50, height: 50, background: '#f3f4f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>
                <div>
                  <div style={{ fontWeight: 500 }}>{p.caption || 'Untitled'}</div>
                  <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{p.resident_name} - {new Date(p.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => approveMutation.mutate(p.id)} style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }}>Approve</button>
                <button onClick={() => rejectMutation.mutate(p.id)} style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }}>Reject</button>
              </div>
            </div>
          ))}
          {photoList.length === 0 && <p style={{ color: '#6b7280' }}>No photos pending approval.</p>}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Schedule Display</h2>
          <form onSubmit={handleSchedule} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Photo ID</label>
                <input type="text" value={scheduleForm.photo_id} onChange={e => setScheduleForm(f => ({ ...f, photo_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="Photo ID" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Show On Date</label>
                <input type="date" value={scheduleForm.show_on_date} onChange={e => setScheduleForm(f => ({ ...f, show_on_date: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Occasion</label>
                <input type="text" value={scheduleForm.occasion} onChange={e => setScheduleForm(f => ({ ...f, occasion: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. Birthday" />
              </div>
            </div>
            <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Schedule</button>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Viewing History</h2>
          {historyList.map((h: any) => (
            <div key={h.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500 }}>Photo viewed</span>
              <div>
                {h.reaction && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', ...getStatusColor(h.reaction === 'positive' ? 'approved' : h.reaction === 'negative' ? 'rejected' : 'pending') }}>{h.reaction}</span>}
                <span style={{ marginLeft: 8, fontSize: '0.82rem', color: '#6b7280' }}>{new Date(h.viewed_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {historyList.length === 0 && <p style={{ color: '#6b7280' }}>No viewing history recorded yet.</p>}
        </div>
      )}
    </div>
  );
}
