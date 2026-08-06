// src/pages/FamilyPortal.tsx
import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  useResidents,
  useFamilyDashboard,
  useFamilyDailySummary,
  useGenerateDailySummary,
  useFamilyWeeklyReport,
  useGenerateWeeklyReports,
  useFamilyPhotos,
  useUploadFamilyPhoto,
  useFamilyMessages,
  useSendFamilyMessage,
  useMarkMessageRead,
} from '../hooks';
import type { Resident, FamilyDailySummary, FamilyWeeklyReport, FamilyPhoto, FamilyDashboardData } from '../types';

type TabKey = 'dashboard' | 'daily' | 'weekly' | 'photos' | 'messages';

export default function FamilyPortal() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [selectedResident, setSelectedResident] = useState('');

  const { data: rawResidents = [] } = useResidents({ active: true });
  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : (rawResidents as any)?.residents ?? [];

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'daily', label: 'Daily Summaries', icon: '📋' },
    { key: 'weekly', label: 'Weekly Reports', icon: '📈' },
    { key: 'photos', label: 'Photos', icon: '📷' },
    { key: 'messages', label: 'Messages', icon: '💬' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👨‍👩‍👧 Family Portal</h1>
          <p className="page-subtitle">Daily summaries, weekly reports, photos, and messaging</p>
        </div>
      </div>

      {/* Resident Selector */}
      <div style={{ marginBottom: 16 }}>
        <select
          className="form-input"
          value={selectedResident}
          onChange={e => setSelectedResident(e.target.value)}
          style={{ maxWidth: 360 }}
        >
          <option value="">Select a resident...</option>
          {residents.map(r => (
            <option key={r.id} value={r.id}>
              {r.first_name} {r.last_name} - Rm {r.room_number}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px',
              borderRadius: 20,
              border: `1px solid ${tab === t.key ? '#0d9488' : 'var(--border)'}`,
              background: tab === t.key ? '#eff6ff' : 'white',
              color: tab === t.key ? '#0d9488' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 400,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'dashboard' && <DashboardTab residentId={selectedResident} />}
      {tab === 'daily' && <DailySummaryTab residentId={selectedResident} />}
      {tab === 'weekly' && <WeeklyReportTab residentId={selectedResident} />}
      {tab === 'photos' && <PhotosTab residentId={selectedResident} residents={residents} />}
      {tab === 'messages' && <MessagesTab residents={residents} />}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────
function DashboardTab({ residentId }: { residentId: string }) {
  const { data, isLoading } = useFamilyDashboard(residentId);
  const dashboard = data as FamilyDashboardData | undefined;

  if (!residentId) {
    return (
      <div className="card">
        <div className="card-body table-empty">Please select a resident to view their dashboard.</div>
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading dashboard...</div>;
  }

  if (!dashboard) {
    return <div className="card"><div className="card-body table-empty">No dashboard data available.</div></div>;
  }

  return (
    <div>
      {/* Resident Info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            {dashboard.resident.photo_url ? (
              <img src={dashboard.resident.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
            ) : '👤'}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{dashboard.resident.first_name} {dashboard.resident.last_name}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Room {dashboard.resident.room_number}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{dashboard.latestWellbeing?.mood || 'N/A'}</div>
              <div style={{ fontSize: 11, color: '#15803d' }}>Wellbeing</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0d9488' }}>{dashboard.unreadMessageCount}</div>
              <div style={{ fontSize: 11, color: '#0d9488' }}>Unread Messages</div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Summary */}
      {dashboard.todaySummary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3 style={{ margin: 0, fontSize: 14 }}>Today's Summary</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {dashboard.todaySummary.meals_summary && (
                <div style={{ padding: 12, borderRadius: 8, background: '#fefce8', border: '1px solid #fef08a' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#a16207', marginBottom: 4 }}>🍽 Meals</div>
                  <div style={{ fontSize: 13 }}>{dashboard.todaySummary.meals_summary}</div>
                </div>
              )}
              {dashboard.todaySummary.activities_summary && (
                <div style={{ padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d', marginBottom: 4 }}>🎨 Activities</div>
                  <div style={{ fontSize: 13 }}>{dashboard.todaySummary.activities_summary}</div>
                </div>
              )}
              {dashboard.todaySummary.mood_summary && (
                <div style={{ padding: 12, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', marginBottom: 4 }}>😊 Mood</div>
                  <div style={{ fontSize: 13 }}>{dashboard.todaySummary.mood_summary}</div>
                </div>
              )}
              {dashboard.todaySummary.care_notes_summary && (
                <div style={{ padding: 12, borderRadius: 8, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#7e22ce', marginBottom: 4 }}>📝 Care Notes</div>
                  <div style={{ fontSize: 13 }}>{dashboard.todaySummary.care_notes_summary}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Photos */}
      {dashboard.recentPhotos && dashboard.recentPhotos.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 style={{ margin: 0, fontSize: 14 }}>Recent Photos</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {dashboard.recentPhotos.slice(0, 6).map((photo: FamilyPhoto) => (
                <div key={photo.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', background: '#f1f5f9' }}>
                  <img src={photo.photo_url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {photo.caption && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11 }}>
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Daily Summary Tab ─────────────────────────────────────────────────────
function DailySummaryTab({ residentId }: { residentId: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const { data: summary, isLoading } = useFamilyDailySummary(residentId, date);
  const generateMutation = useGenerateDailySummary();
  const summaryData = summary as FamilyDailySummary | undefined;

  if (!residentId) {
    return (
      <div className="card">
        <div className="card-body table-empty">Please select a resident to view daily summaries.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <button
          className="btn btn-primary"
          onClick={() => generateMutation.mutate({ residentId, date })}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Generating...' : '🔄 Generate Summary'}
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading summary...</div>
      ) : !summaryData ? (
        <div className="card">
          <div className="card-body table-empty">No summary available for this date. Click "Generate Summary" to create one.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 14 }}>Summary for {summaryData.summary_date}</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generated: {new Date(summaryData.generated_at).toLocaleString()}</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {summaryData.meals_summary && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#a16207' }}>🍽 Meals</h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{summaryData.meals_summary}</p>
                </div>
              )}
              {summaryData.activities_summary && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#15803d' }}>🎨 Activities</h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{summaryData.activities_summary}</p>
                </div>
              )}
              {summaryData.mood_summary && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#0d9488' }}>😊 Mood</h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{summaryData.mood_summary}</p>
                </div>
              )}
              {summaryData.care_notes_summary && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#7e22ce' }}>📝 Care Notes</h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{summaryData.care_notes_summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Weekly Report Tab ─────────────────────────────────────────────────────
function WeeklyReportTab({ residentId }: { residentId: string }) {
  const { data: report, isLoading } = useFamilyWeeklyReport(residentId);
  const generateMutation = useGenerateWeeklyReports();
  const reportData = report as FamilyWeeklyReport | undefined;

  if (!residentId) {
    return (
      <div className="card">
        <div className="card-body table-empty">Please select a resident to view weekly reports.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Generating...' : '🔄 Generate All Reports'}
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading report...</div>
      ) : !reportData ? (
        <div className="card">
          <div className="card-body table-empty">No weekly report available. Click "Generate All Reports" to create one.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Week: {reportData.week_start} to {reportData.week_end}</h3>
            {reportData.wellbeing_score_avg !== null && (
              <span style={{ padding: '4px 12px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                Wellbeing: {reportData.wellbeing_score_avg.toFixed(1)}/10
              </span>
            )}
          </div>
          <div className="card-body">
            <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>{reportData.report_content}</div>

            {reportData.highlights && reportData.highlights.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#16a34a' }}>Highlights</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {reportData.highlights.map((h, i) => (
                    <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {reportData.concerns && reportData.concerns.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#dc2626' }}>Concerns</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {reportData.concerns.map((c, i) => (
                    <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Generated: {new Date(reportData.generated_at).toLocaleString()}
              {reportData.sent_at && ` | Sent: ${new Date(reportData.sent_at).toLocaleString()}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photos Tab ────────────────────────────────────────────────────────────
function PhotosTab({ residentId, residents }: { residentId: string; residents: Resident[] }) {
  const { data: photos, isLoading } = useFamilyPhotos(residentId);
  const uploadMutation = useUploadFamilyPhoto();
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const photoList: FamilyPhoto[] = Array.isArray(photos) ? photos : [];

  if (!residentId) {
    return (
      <div className="card">
        <div className="card-body table-empty">Please select a resident to view their photos.</div>
      </div>
    );
  }

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    if (caption) formData.append('caption', caption);
    uploadMutation.mutate({ residentId, formData }, {
      onSuccess: () => {
        setCaption('');
        if (fileRef.current) fileRef.current.value = '';
      },
    });
  };

  return (
    <div>
      {/* Upload Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 style={{ margin: 0, fontSize: 14 }}>Upload Photo</h3></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
              <label className="form-label">Photo File</label>
              <input type="file" ref={fileRef} accept="image/*" className="form-input" />
            </div>
            <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
              <label className="form-label">Caption (optional)</label>
              <input className="form-input" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption..." />
            </div>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Uploading...' : '📷 Upload'}
            </button>
          </div>
        </div>
      </div>

      {/* Photo Grid */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading photos...</div>
      ) : photoList.length === 0 ? (
        <div className="card"><div className="card-body table-empty">No photos yet. Upload one above!</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {photoList.map((photo: FamilyPhoto) => (
            <div key={photo.id} className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ aspectRatio: '1', background: '#f1f5f9' }}>
                <img src={photo.photo_url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: '8px 12px' }}>
                {photo.caption && <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500 }}>{photo.caption}</p>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {photo.uploaded_by_name && <span>{photo.uploaded_by_name} - </span>}
                  {new Date(photo.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────
function MessagesTab({ residents }: { residents: Resident[] }) {
  const qc = useQueryClient();
  const [msgTab, setMsgTab] = useState<'inbox' | 'sent'>('inbox');
  const [residentFilter, setFilter] = useState('');
  const [showCompose, setCompose] = useState(false);

  const { data: rawMessages = [], isLoading } = useFamilyMessages({ residentId: residentFilter || undefined });
  const messages: any[] = Array.isArray(rawMessages) ? rawMessages : [];
  const unread = messages.filter(m => !m.read_at && m.direction === 'inbound').length;

  const markRead = useMarkMessageRead();

  const filtered = messages.filter(m => msgTab === 'inbox' ? m.direction === 'inbound' : m.direction === 'outbound');

  return (
    <div>
      {unread > 0 && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span>💬</span>
          <span style={{ color: '#0d9488', fontWeight: 600 }}>{unread} unread message{unread !== 1 ? 's' : ''} from families</span>
          <button
            onClick={() => messages.filter(m => !m.read_at && m.direction === 'inbound').forEach(m => markRead.mutate(m.id))}
            style={{ marginLeft: 'auto', fontSize: 12, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Mark all read
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" value={residentFilter} onChange={e => setFilter(e.target.value)} style={{ flex: '1 1 200px', maxWidth: 280 }}>
          <option value="">All Residents</option>
          {residents.map(r => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Rm {r.room_number}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['inbox', 'sent'] as const).map(t => (
            <button
              key={t}
              onClick={() => setMsgTab(t)}
              style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: `1px solid ${msgTab === t ? '#0d9488' : 'var(--border)'}`,
                background: msgTab === t ? '#eff6ff' : 'white',
                color: msgTab === t ? '#0d9488' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: msgTab === t ? 700 : 400,
              }}
            >
              {t === 'inbox' ? '📥 Inbox' : '📤 Sent'}
              {t === 'inbox' && unread > 0 && <span style={{ marginLeft: 6, background: '#dc2626', color: 'white', borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>{unread}</span>}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setCompose(true)} style={{ marginLeft: 'auto' }}>✉️ Send Message</button>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="card-body table-empty">No messages found</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((m: any) => {
            const isUnread = !m.read_at && m.direction === 'inbound';
            return (
              <div key={m.id} className="card" style={{ borderLeft: `4px solid ${isUnread ? '#0d9488' : 'transparent'}`, cursor: isUnread ? 'pointer' : 'default' }}
                onClick={() => isUnread && markRead.mutate(m.id)}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {isUnread && <span className="badge badge-blue" style={{ fontSize: 10 }}>NEW</span>}
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{m.subject || 'No subject'}</span>
                      {m.resident_name && <span className="badge badge-neutral" style={{ fontSize: 11 }}>👤 {m.resident_name}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
                      <div>{m.direction === 'inbound' ? `From: ${m.sender_name || m.sender_email}` : `To: ${m.recipient_name}`}</div>
                      <div>{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{m.body?.slice(0, 300)}{m.body?.length > 300 ? '...' : ''}</p>
                  {m.direction === 'inbound' && (
                    <div style={{ marginTop: 10 }}>
                      <button onClick={e => { e.stopPropagation(); setCompose(true); }} style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#0d9488', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Reply</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCompose && <ComposeModal residents={residents} onClose={() => setCompose(false)} />}
    </div>
  );
}

// ── Compose Modal ─────────────────────────────────────────────────────────
function ComposeModal({ residents, onClose }: { residents: Resident[]; onClose: () => void }) {
  const [form, setForm] = useState({ residentId: '', recipientName: '', recipientEmail: '', subject: '', body: '' });
  const sendMessage = useSendFamilyMessage();
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage.mutate(form, { onSuccess: () => onClose() });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">✉️ Send Message to Family</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <form onSubmit={send}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Regarding Resident *</label>
              <select className="form-input" required value={form.residentId} onChange={e => set('residentId', e.target.value)}>
                <option value="">Select resident...</option>
                {residents.map((r: Resident) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Rm {r.room_number}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Recipient Name *</label>
                <input className="form-input" required value={form.recipientName} onChange={e => set('recipientName', e.target.value)} placeholder="e.g. John Smith (son)" />
              </div>
              <div className="form-group">
                <label className="form-label">Recipient Email *</label>
                <input className="form-input" required type="email" value={form.recipientEmail} onChange={e => set('recipientEmail', e.target.value)} placeholder="john@example.com" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input className="form-input" required value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Weekly update / Health update..." />
            </div>
            <div className="form-group">
              <label className="form-label">Message *</label>
              <textarea className="form-input" required rows={8} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Dear [Name], I am writing to update you..." style={{ resize: 'vertical' }} />
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-muted)' }}>
              This message will be logged in the care record.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={sendMessage.isPending}>{sendMessage.isPending ? 'Sending...' : '✉️ Send Message'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
