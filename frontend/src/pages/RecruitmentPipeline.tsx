import React, { useState } from 'react';
import {
  useJobPostings, useCreateJobPosting, useUpdateJobPosting,
  useJobApplications, useCreateJobApplication, useUpdateApplicationStage,
  useInterviews, useScheduleInterview, useUpdateInterviewOutcome,
  useCreateDbsCheck, useUpdateDbsCheck, useRecruitmentPipeline, useStaff,
} from '../hooks';
import type { JobPosting, JobApplication, Interview, DbsCheck } from '../types';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'] as const;
const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
};

const CONTRACT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'bank', label: 'Bank' },
  { value: 'agency', label: 'Agency' },
];

export default function RecruitmentPipeline() {
  const { data: postings } = useJobPostings();
  const { data: applications } = useJobApplications();
  const { data: interviews } = useInterviews();
  const { data: pipeline } = useRecruitmentPipeline();
  const { data: staffList } = useStaff();
  const createPosting = useCreateJobPosting();
  const updateApplicationStage = useUpdateApplicationStage();
  const scheduleInterview = useScheduleInterview();
  const createDbsCheck = useCreateDbsCheck();
  const updateDbsCheck = useUpdateDbsCheck();

  // Form states
  const [showPostingForm, setShowPostingForm] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [postingForm, setPostingForm] = useState({
    title: '', department: '', contract_type: 'full_time',
    hours_per_week: '', salary_range: '', description: '', requirements: '',
  });
  const [interviewForm, setInterviewForm] = useState({
    application_id: '', scheduled_at: '', interviewer_id: '',
    location: '', interview_type: 'in_person' as string,
  });

  const jobPostingsList: JobPosting[] = Array.isArray(postings) ? postings : [];
  const applicationsList: JobApplication[] = Array.isArray(applications) ? applications : [];
  const interviewsList: Interview[] = Array.isArray(interviews) ? interviews : [];
  const staffMembers: any[] = Array.isArray(staffList) ? staffList : [];

  // Pipeline stats
  const pipelineData = pipeline || {} as any;
  const totalApplicants = pipelineData.total_applicants || applicationsList.length;
  const inInterview = pipelineData.in_interview || applicationsList.filter(a => a.stage === 'interview').length;
  const offersMade = pipelineData.offers_made || applicationsList.filter(a => a.stage === 'offer').length;
  const positionsFilled = pipelineData.positions_filled || applicationsList.filter(a => a.stage === 'hired').length;

  // DBS checks from pipeline data
  const dbsChecks: DbsCheck[] = pipelineData.dbs_checks || [];

  const handleCreatePosting = (e: React.FormEvent) => {
    e.preventDefault();
    createPosting.mutate({
      ...postingForm,
      hours_per_week: postingForm.hours_per_week ? Number(postingForm.hours_per_week) : undefined,
      status: 'open',
    });
    setPostingForm({ title: '', department: '', contract_type: 'full_time', hours_per_week: '', salary_range: '', description: '', requirements: '' });
    setShowPostingForm(false);
  };

  const handleScheduleInterview = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleInterview.mutate({
      ...interviewForm,
      duration_minutes: 60,
    });
    setInterviewForm({ application_id: '', scheduled_at: '', interviewer_id: '', location: '', interview_type: 'in_person' });
    setShowInterviewModal(false);
  };

  const moveApplication = (appId: string, newStage: string) => {
    updateApplicationStage.mutate({ id: appId, data: { stage: newStage } });
  };

  const getStageIndex = (stage: string) => STAGES.indexOf(stage as any);

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruitment Pipeline</h1>
          <p className="page-subtitle">Manage job postings, applications, interviews, and DBS checks</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowPostingForm(true)}>+ New Job Posting</button>
          <button className="btn btn-secondary" onClick={() => setShowInterviewModal(true)}>Schedule Interview</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>{totalApplicants}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Applicants</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{inInterview}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>In Interview</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#8b5cf6' }}>{offersMade}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Offers Made</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>{positionsFilled}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Positions Filled</div>
          </div>
        </div>
      </div>

      {/* Job Posting Form Modal */}
      {showPostingForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Create Job Posting</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPostingForm(false)}>X</button>
              </div>
              <form onSubmit={handleCreatePosting}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Job Title *</label>
                    <input className="input" value={postingForm.title} onChange={e => setPostingForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Senior Carer" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Department</label>
                      <input className="input" value={postingForm.department} onChange={e => setPostingForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Nursing" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Contract Type</label>
                      <select className="input" value={postingForm.contract_type} onChange={e => setPostingForm(f => ({ ...f, contract_type: e.target.value }))}>
                        {CONTRACT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Hours per Week</label>
                      <input className="input" type="number" value={postingForm.hours_per_week} onChange={e => setPostingForm(f => ({ ...f, hours_per_week: e.target.value }))} placeholder="e.g. 37.5" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Salary Range</label>
                      <input className="input" value={postingForm.salary_range} onChange={e => setPostingForm(f => ({ ...f, salary_range: e.target.value }))} placeholder="e.g. 25000-30000" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Description</label>
                    <textarea className="input" rows={3} value={postingForm.description} onChange={e => setPostingForm(f => ({ ...f, description: e.target.value }))} placeholder="Job description..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Requirements</label>
                    <textarea className="input" rows={3} value={postingForm.requirements} onChange={e => setPostingForm(f => ({ ...f, requirements: e.target.value }))} placeholder="Required qualifications and experience..." />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowPostingForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={createPosting.isPending}>
                      {createPosting.isPending ? 'Creating...' : 'Create Posting'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Interview Scheduling Modal */}
      {showInterviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500 }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Schedule Interview</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowInterviewModal(false)}>X</button>
              </div>
              <form onSubmit={handleScheduleInterview}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Application *</label>
                    <select className="input" value={interviewForm.application_id} onChange={e => setInterviewForm(f => ({ ...f, application_id: e.target.value }))} required>
                      <option value="">Select application...</option>
                      {applicationsList.filter(a => a.stage !== 'hired' && a.stage !== 'rejected').map(app => (
                        <option key={app.id} value={app.id}>{app.applicant_name} - {app.posting_title || 'Unknown Role'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Date & Time *</label>
                    <input className="input" type="datetime-local" value={interviewForm.scheduled_at} onChange={e => setInterviewForm(f => ({ ...f, scheduled_at: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Interviewer</label>
                    <select className="input" value={interviewForm.interviewer_id} onChange={e => setInterviewForm(f => ({ ...f, interviewer_id: e.target.value }))}>
                      <option value="">Select interviewer...</option>
                      {staffMembers.filter((s: any) => ['home_manager', 'deputy_manager', 'admin'].includes(s.role)).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Location</label>
                    <input className="input" value={interviewForm.location} onChange={e => setInterviewForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Meeting Room 1" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Interview Type</label>
                    <select className="input" value={interviewForm.interview_type} onChange={e => setInterviewForm(f => ({ ...f, interview_type: e.target.value }))}>
                      <option value="in_person">In Person</option>
                      <option value="video">Video</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowInterviewModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={scheduleInterview.isPending}>
                      {scheduleInterview.isPending ? 'Scheduling...' : 'Schedule Interview'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Active Job Postings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>Active Job Postings</h3>
          {jobPostingsList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No job postings yet. Create one to get started.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Contract</th>
                    <th>Status</th>
                    <th>Applications</th>
                    <th>Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {jobPostingsList.map(posting => (
                    <tr key={posting.id}>
                      <td style={{ fontWeight: 600 }}>{posting.title}</td>
                      <td>{posting.department || '-'}</td>
                      <td>{CONTRACT_TYPES.find(ct => ct.value === posting.contract_type)?.label || posting.contract_type}</td>
                      <td>
                        <span className={`badge ${posting.status === 'open' ? 'badge-success' : posting.status === 'filled' ? 'badge-primary' : 'badge-neutral'}`}>
                          {posting.status}
                        </span>
                      </td>
                      <td>{posting.applications_count || 0}</td>
                      <td>{posting.posted_date ? new Date(posting.posted_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>Application Pipeline</h3>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {STAGES.map(stage => {
              const stageApps = applicationsList.filter(a => a.stage === stage);
              const stageIdx = getStageIndex(stage);
              return (
                <div key={stage} style={{ minWidth: 240, flex: '1 0 240px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{STAGE_LABELS[stage]}</h4>
                    <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>{stageApps.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stageApps.map(app => (
                      <div key={app.id} className="card" style={{ margin: 0 }}>
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>{app.applicant_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{app.posting_title || 'Unknown Role'}</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {stageIdx > 0 && (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => moveApplication(app.id, STAGES[stageIdx - 1])}>
                                ← Back
                              </button>
                            )}
                            {stageIdx < STAGES.length - 1 && (
                              <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => moveApplication(app.id, STAGES[stageIdx + 1])}>
                                Next →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {stageApps.length === 0 && (
                      <div style={{ padding: 16, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No applications</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DBS Check Status Panel */}
      <div className="card">
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>DBS Check Status</h3>
          {dbsChecks.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No DBS checks recorded yet.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Check Type</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Certificate No.</th>
                  </tr>
                </thead>
                <tbody>
                  {dbsChecks.map((dbs: DbsCheck) => (
                    <tr key={dbs.id}>
                      <td style={{ fontWeight: 600 }}>{dbs.applicant_name || '-'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{dbs.check_type}</td>
                      <td>
                        <span className={`badge ${dbs.status === 'clear' ? 'badge-success' : dbs.status === 'flagged' ? 'badge-danger' : dbs.status === 'pending' ? 'badge-warning' : 'badge-neutral'}`}>
                          {dbs.status}
                        </span>
                      </td>
                      <td>{dbs.submitted_date ? new Date(dbs.submitted_date).toLocaleDateString() : '-'}</td>
                      <td>{dbs.certificate_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
