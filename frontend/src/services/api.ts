// src/services/api.ts — Axios API client with Bearer auth
import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Token injection — reads from localStorage every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('cv_access_token');
  if (token) { if (!cfg.headers) cfg.headers = {} as any; (cfg.headers as any)["Authorization"] = `Bearer ${token}`; }
  return cfg;
});

// ── Residents ──────────────────────────────────────────────────────────────
export const authApi = {
  changePassword: (data: object) => api.post('/auth/change-password', data),
};

export const residentsApi = {
  list:      (params?: object) => api.get('/residents', { params }),
  get:       (id: string) => api.get(`/residents/${id}`),
  create:    (data: object) => api.post('/residents', data),
  update:    (id: string, data: object) => api.patch(`/residents/${id}`, data),
  discharge: (id: string, data: object) => api.post(`/residents/${id}/discharge`, data),
  updateMobility: (id: string, mobilityStatus: string) => api.patch(`/residents/${id}/mobility`, { mobilityStatus }),
};

// ── Care Notes ─────────────────────────────────────────────────────────────
export const notesApi = {
  list:   (params?: object) => api.get('/care-notes', { params }),
  get:    (id: string) => api.get(`/care-notes/${id}`),
  create: (data: object) => api.post('/care-notes', data),
  update: (id: string, data: object) => api.patch(`/care-notes/${id}`, data),
  delete: (id: string) => api.delete(`/care-notes/${id}`),
};

// ── eMAR ───────────────────────────────────────────────────────────────────
export const emarApi = {
  get:              (params?: object) => api.get('/emar', { params }),
  listMedications:  (params?: object) => api.get('/medications', { params }),
  getMedication:    (id: string) => api.get(`/medications/${id}`),
  createMedication: (data: object) => api.post('/medications', data),
  discontinue:      (id: string, data?: object) => api.delete(`/medications/${id}`, { data }),
  administer:       (data: object) => api.post('/emar/administer', data),
  missedReport:     (params?: object) => api.get('/emar/missed-report', { params }),
};

// ── Incidents ──────────────────────────────────────────────────────────────
export const incidentsApi = {
  list:         (params?: object) => api.get('/incidents', { params }),
  get:          (id: string) => api.get(`/incidents/${id}`),
  create:       (data: object) => api.post('/incidents', data),
  updateStatus: (id: string, data: object) => api.patch(`/incidents/${id}/status`, data),
};

// ── Schedule ───────────────────────────────────────────────────────────────
export const scheduleApi = {
  getWeek:     (startDate: string, endDate: string) => api.get('/schedule', { params: { start_date: startDate, end_date: endDate } }),
  upsertShift: (data: object) => api.post('/schedule/shift', data),
  deleteShift: (staffId: string, date: string) => api.delete(`/schedule/${staffId}/${date}`),
};

// ── Staff ──────────────────────────────────────────────────────────────────
export const staffApi = {
  colleagues:    () => api.get('/staff/colleagues'),
  list:          () => api.get('/staff'),
  get:           (id: string) => api.get(`/staff/${id}`),
  create:        (data: object) => api.post('/staff', data),
  update:        (id: string, data: object) => api.patch(`/staff/${id}`, data),
  listTraining:  (params?: object) => api.get('/training', { params }),
  addTraining:   (data: object) => api.post('/training', data),
  updateTraining:(id: string, data: object) => api.patch(`/training/${id}`, data),
};

// ── Compliance ─────────────────────────────────────────────────────────────
export const complianceApi = {
  listActions:  (params?: object) => api.get('/compliance/actions', { params }),
  createAction: (data: object) => api.post('/compliance/actions', data),
  updateAction: (id: string, data: object) => api.patch(`/compliance/actions/${id}`, data),
  getFramework: () => api.get('/compliance/framework'),
  getCqcScores: () => api.get('/compliance/cqc-scores'),
  calculateCqcScores: () => api.post('/compliance/cqc-scores/calculate'),
  generateEvidencePack: (data: object) => api.post('/compliance/evidence-pack', data),
  getEvidencePacks: () => api.get('/compliance/evidence-packs'),
  getPolicyReviews: () => api.get('/compliance/policy-reviews'),
  createPolicyReview: (data: object) => api.post('/compliance/policy-reviews', data),
  getInspectionChecklist: (domain: string) => api.get(`/compliance/inspection-checklist/${domain}`),
  updateChecklistItem: (id: string, data: object) => api.patch(`/compliance/inspection-checklist/${id}/item`, data),
  getOverview: () => api.get('/compliance/overview'),
};

// ── Family Portal ──────────────────────────────────────────────────────────
export const familyApi = {
  listMessages: (params?: object) => api.get('/family/messages', { params }),
  sendMessage:  (data: object) => api.post('/family/messages', data),
  replyMessage: (id: string, body: string) => api.post(`/family/messages/${id}/reply`, { body }),
  markRead:     (id: string) => api.patch(`/family/messages/${id}/read`),
  listContacts: (residentId: string) => api.get(`/family/contacts/${residentId}`),
  getDashboard: (residentId: string) => api.get(`/family/dashboard/${residentId}`),
  getDailySummary: (residentId: string, date?: string) => api.get(`/family/daily-summary/${residentId}`, { params: { date } }),
  generateDailySummary: (residentId: string, date?: string) => api.post(`/family/daily-summary/${residentId}/generate`, { date }),
  getWeeklyReport: (residentId: string, weekStart?: string) => api.get(`/family/weekly-report/${residentId}`, { params: { weekStart } }),
  generateWeeklyReports: () => api.post('/family/weekly-reports/generate'),
  listPhotos: (residentId: string, params?: object) => api.get(`/family/photos/${residentId}`, { params }),
  uploadPhoto: (residentId: string, formData: FormData) => api.post(`/family/photos/${residentId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ── Billing ────────────────────────────────────────────────────────────────
export const billingApi = {
  listInvoices:  (params?: object) => api.get('/invoices', { params }),
  getInvoice:    (id: string) => api.get(`/invoices/${id}`),
  createInvoice: (data: object) => api.post('/invoices', data),
  updateInvoice: (id: string, data: object) => api.patch(`/invoices/${id}/status`, data),
  summary:       () => api.get('/invoices/summary'),
};

// ── AI Tools ───────────────────────────────────────────────────────────────
export const aiApi = {
  analyze:         (data: object) => api.post('/ai/family-summary', data),
  suggest:         (data: object) => api.post('/ai/scheduling', data),
  riskAssess:      (residentId: string) => api.post('/ai/medication-flags', {}),
  handoverSummary: (data: object) => api.post('/ai/compliance-scan', data),
};

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/reports/dashboard'),
};

// ── Policies ───────────────────────────────────────────────────────────────
export const policiesApi = {
  list:   (params?: object) => api.get('/policies', { params }),
  get:    (id: string) => api.get(`/policies/${id}`),
  create: (data: object) => api.post('/policies', data),
  update: (id: string, data: object) => api.patch(`/policies/${id}`, data),
};

// ── Audit Log ──────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: object) => api.get('/audit-log', { params }),
};

// ── Activities ─────────────────────────────────────────────────────────────
export const activitiesApi = {
  list:               (params?: object) => api.get('/activities', { params }),
  get:                (id: string) => api.get(`/activities/${id}`),
  create:             (data: object) => api.post('/activities', data),
  update:             (id: string, data: object) => api.patch(`/activities/${id}`, data),
  delete:             (id: string) => api.delete(`/activities/${id}`),
  listSessions:       (params?: object) => api.get('/activities/sessions', { params }),
  createSession:      (data: object) => api.post('/activities/sessions', data),
  getParticipants:    (sessionId: string) => api.get(`/activities/sessions/${sessionId}/participants`),
  addParticipant:     (sessionId: string, data: object) => api.post(`/activities/sessions/${sessionId}/participants`, data),
  updateParticipant:  (sessionId: string, residentId: string, data: object) => api.patch(`/activities/sessions/${sessionId}/participants/${residentId}`, data),
  removeParticipant:  (sessionId: string, residentId: string) => api.delete(`/activities/sessions/${sessionId}/participants/${residentId}`),
  eligibleResidents:  (activityId: string) => api.get(`/activities/${activityId}/eligible-residents`),
  residentHistory:    (residentId: string) => api.get(`/residents/${residentId}/activities`),
  wellbeingDashboard: () => api.get('/activities/wellbeing-dashboard'),
};

// ── Predictive Care ────────────────────────────────────────────────────────
export const predictiveApi = {
  getDashboard:     () => api.get('/predictive/dashboard'),
  calculateResidentRisk:  (residentId: string) => api.post(`/predictive/residents/${residentId}/risk`),
  getResidentHistory: (residentId: string) => api.get(`/predictive/residents/${residentId}/history`),
  getAlerts:        () => api.get('/predictive/alerts'),
  acknowledgeAlert: (id: string) => api.patch(`/predictive/alerts/${id}/acknowledge`),
  runAnalysis:      () => api.post('/predictive/analyze'),
};

// ── Wellbeing ──────────────────────────────────────────────────────────────
export const wellbeingApi = {
  log:                    (data: object) => api.post('/wellbeing/log', data),
  getResidentWellbeing:   (residentId: string, days?: number) => api.get(`/wellbeing/${residentId}`, { params: { days } }),
  getOverview:            () => api.get('/wellbeing/overview'),
  getIsolationAlerts:     (status?: string) => api.get('/wellbeing/isolation-alerts', { params: { status } }),
  acknowledgeAlert:       (id: string, data: object) => api.patch(`/wellbeing/isolation-alerts/${id}`, data),
  generateAlerts:         () => api.post('/wellbeing/generate-isolation-alerts'),
  getLifeStory:           (residentId: string) => api.get(`/residents/${residentId}/life-story`),
  updateLifeStory:        (residentId: string, data: object) => api.put(`/residents/${residentId}/life-story`, data),
  getEnvironment:         (residentId: string) => api.get(`/residents/${residentId}/environment`),
  updateEnvironment:      (residentId: string, data: object) => api.put(`/residents/${residentId}/environment`, data),
};

// ── Voice Notes ────────────────────────────────────────────────────────────
export const voiceApi = {
  transcribe: (data: FormData) => api.post('/voice/transcribe', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  createNote: (data: object) => api.post('/voice/create-note', data),
  getHistory: () => api.get('/voice/history'),
};

// ── SBAR Handover ──────────────────────────────────────────────────────────
export const sbarApi = {
  generate: (data: object) => api.post('/sbar/generate', data),
  list: () => api.get('/sbar/handovers'),
  get: (id: string) => api.get(`/sbar/handovers/${id}`),
  approve: (id: string) => api.patch(`/sbar/handovers/${id}/approve`),
};

// -- NEWS2 Auto-Calculator --
export const news2Api = {
  calculate: (data: object) => api.post('/news2/calculate', data),
  getHistory: (residentId: string) => api.get('/news2/history', { params: { residentId } }),
  getEscalations: (params?: object) => api.get('/news2/escalations', { params }),
  respondToEscalation: (id: string, data: object) => api.patch(`/news2/escalations/${id}`, data),
  getTrend: (residentId: string, days?: number) => api.get('/news2/trend', { params: { residentId, days } }),
};

// -- Wound Photography Timeline --
export const woundsApi = {
  create: (formData: FormData) => api.post('/wounds', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listActive: () => api.get('/wounds'),
  getTimeline: (residentId: string, locationBodyArea?: string) => api.get(`/wounds/${residentId}/timeline`, { params: { locationBodyArea } }),
  getBodyMap: (residentId: string) => api.get(`/wounds/${residentId}/body-map`),
  update: (id: string, data: object) => api.patch(`/wounds/${id}`, data),
};

// -- Infection Outbreak Tracker --
export const infectionsApi = {
  createOutbreak: (data: object) => api.post('/infections/outbreaks', data),
  listOutbreaks: (params?: object) => api.get('/infections/outbreaks', { params }),
  getOutbreak: (id: string) => api.get(`/infections/outbreaks/${id}`),
  addCase: (outbreakId: string, data: object) => api.post(`/infections/outbreaks/${outbreakId}/cases`, data),
  updateCase: (id: string, data: object) => api.patch(`/infections/cases/${id}`, data),
  updateOutbreakStatus: (id: string, data: object) => api.patch(`/infections/outbreaks/${id}/status`, data),
  getTimeline: (id: string) => api.get(`/infections/outbreaks/${id}/timeline`),
};

// -- Continence Assessment --
export const continenceApi = {
  logEvent: (data: object) => api.post('/continence/log', data),
  getResidentLog: (residentId: string, days?: number) => api.get(`/continence/${residentId}`, { params: { days } }),
  getPatterns: (residentId: string) => api.get(`/continence/${residentId}/patterns`),
  createAssessment: (data: object) => api.post('/continence/assessment', data),
  getAssessment: (residentId: string) => api.get(`/continence/${residentId}/assessment`),
  getOverview: () => api.get('/continence/overview'),
};

// -- Smart Rota Builder --
export const smartRotaApi = {
  generate: (data: object) => api.post('/smart-rota/generate', data),
  listTemplates: () => api.get('/smart-rota/templates'),
  getTemplate: (id: string) => api.get(`/smart-rota/templates/${id}`),
  updateShift: (id: string, data: object) => api.patch(`/smart-rota/shifts/${id}`, data),
  publish: (id: string) => api.post(`/smart-rota/templates/${id}/publish`),
  getConstraints: () => api.get('/smart-rota/constraints'),
  uploadCsv: (formData: FormData) => api.post('/smart-rota/upload-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// -- Natural Language Search --
export const nlSearchApi = {
  search: (query: string) => api.post('/search/nl', { query }),
  getHistory: () => api.get('/search/nl/history'),
};

// -- Automated Risk Assessments --
export const riskAssessmentsApi = {
  calculateWaterlow: (residentId: string) => api.post('/risk-assessments/waterlow', { residentId }),
  calculateMUST: (data: object) => api.post('/risk-assessments/must', data),
  calculateFalls: (residentId: string) => api.post('/risk-assessments/falls', { residentId }),
  getResidentAssessments: (residentId: string) => api.get(`/risk-assessments/${residentId}`),
  getOverdue: () => api.get('/risk-assessments/overdue'),
  getOverview: () => api.get('/risk-assessments/overview'),
};

// -- Medication Interaction Checker --
export const medInteractionsApi = {
  check: (residentId: string) => api.post('/med-interactions/check', { residentId }),
  getResidentInteractions: (residentId: string) => api.get(`/med-interactions/${residentId}`),
  acknowledge: (id: string) => api.patch(`/med-interactions/${id}/acknowledge`),
  getAlerts: () => api.get('/med-interactions/alerts'),
};

// ── Enhanced Invoicing (Finance) ──────────────────────────────────────────
export const invoicingApi = {
  listRateUplifts:    (params?: object) => api.get('/invoicing/rate-uplifts', { params }),
  createRateUplift:   (data: object) => api.post('/invoicing/rate-uplifts', data),
  approveRateUplift:  (id: string, data: object) => api.patch(`/invoicing/rate-uplifts/${id}`, data),
  listReminders:      (params?: object) => api.get('/invoicing/payment-reminders', { params }),
  sendReminder:       (data: object) => api.post('/invoicing/payment-reminders', data),
  getRevenueDashboard:() => api.get('/invoicing/revenue-dashboard'),
};

// ── Occupancy Forecasting (Finance) ──────────────────────────────────────
export const occupancyApi = {
  record:         (data: object) => api.post('/occupancy', data),
  getHistory:     (params?: object) => api.get('/occupancy/history', { params }),
  generateForecast: (data: object) => api.post('/occupancy/forecasts', data),
  getForecasts:   (params?: object) => api.get('/occupancy/forecasts', { params }),
  getDashboard:   () => api.get('/occupancy/dashboard'),
};

// ── Staff Cost Analytics (Finance) ───────────────────────────────────────
export const staffCostsApi = {
  record:         (data: object) => api.post('/staff-costs', data),
  getSummary:     (params?: object) => api.get('/staff-costs/summary', { params }),
  getPerResident: (params?: object) => api.get('/staff-costs/per-resident', { params }),
  getBudgetVsActual: (params?: object) => api.get('/staff-costs/budget-vs-actual', { params }),
  listBudgets:    (params?: object) => api.get('/staff-costs/budgets', { params }),
  createBudget:   (data: object) => api.post('/staff-costs/budgets', data),
};

// ── Recruitment Pipeline (HR) ─────────────────────────────────────────────
export const recruitmentApi = {
  listPostings:       (params?: object) => api.get('/recruitment/postings', { params }),
  createPosting:      (data: object) => api.post('/recruitment/postings', data),
  updatePosting:      (id: string, data: object) => api.patch(`/recruitment/postings/${id}`, data),
  listApplications:   (params?: object) => api.get('/recruitment/applications', { params }),
  createApplication:  (data: object) => api.post('/recruitment/applications', data),
  updateApplicationStage: (id: string, data: object) => api.patch(`/recruitment/applications/${id}/stage`, data),
  listInterviews:     (params?: object) => api.get('/recruitment/interviews', { params }),
  scheduleInterview:  (data: object) => api.post('/recruitment/interviews', data),
  updateInterviewOutcome: (id: string, data: object) => api.patch(`/recruitment/interviews/${id}/outcome`, data),
  createDbsCheck:     (data: object) => api.post('/recruitment/dbs-checks', data),
  updateDbsCheck:     (id: string, data: object) => api.patch(`/recruitment/dbs-checks/${id}`, data),
  getPipeline:        () => api.get('/recruitment/pipeline'),
};

// ── Competency Matrix (HR) ────────────────────────────────────────────────
export const competencyApi = {
  listCompetencies:   (params?: object) => api.get('/competencies', { params }),
  createCompetency:   (data: object) => api.post('/competencies', data),
  listStaffCompetencies: (params?: object) => api.get('/competencies/staff', { params }),
  assignStaffCompetency: (data: object) => api.post('/competencies/staff', data),
  updateStaffCompetency: (id: string, data: object) => api.patch(`/competencies/staff/${id}`, data),
  getMatrix:          () => api.get('/competencies/matrix'),
  getExpiring:        (params?: object) => api.get('/competencies/expiring', { params }),
};

// ── Absence & Sickness (HR) ──────────────────────────────────────────────
export const absenceApi = {
  record:             (data: object) => api.post('/absence', data),
  list:               (params?: object) => api.get('/absence', { params }),
  calculateBradford:  (data: object) => api.post('/absence/bradford-score', data),
  getBradfordScores:  (params?: object) => api.get('/absence/bradford-scores', { params }),
  getPatterns:        (params?: object) => api.get('/absence/patterns', { params }),
  getReturnToWorkDue: (params?: object) => api.get('/absence/return-to-work-due', { params }),
  completeReturnToWork: (id: string, data: object) => api.patch(`/absence/${id}/return-to-work`, data),
  getDashboard:       () => api.get('/absence/dashboard'),
};

// ── Fire Log Book (Facilities) ────────────────────────────────────────────
export const fireLogApi = {
  recordTest:         (data: object) => api.post('/fire-log/tests', data),
  listTests:          (params?: object) => api.get('/fire-log/tests', { params }),
  recordEquipmentCheck: (data: object) => api.post('/fire-log/equipment-checks', data),
  listEquipmentChecks: (params?: object) => api.get('/fire-log/equipment-checks', { params }),
  getOverdueChecks:   () => api.get('/fire-log/overdue-checks'),
  createPeep:         (data: object) => api.post('/fire-log/peeps', data),
  listPeeps:          (params?: object) => api.get('/fire-log/peeps', { params }),
  updatePeep:         (id: string, data: object) => api.patch(`/fire-log/peeps/${id}`, data),
  getDashboard:       () => api.get('/fire-log/dashboard'),
};

// ── Visitor Sign-In (Facilities) ─────────────────────────────────────────
export const visitorsApi = {
  signIn:             (data: object) => api.post('/visitors/sign-in', data),
  signOut:            (id: string) => api.patch(`/visitors/${id}/sign-out`),
  list:               (params?: object) => api.get('/visitors', { params }),
  getDashboard:       () => api.get('/visitors/dashboard'),
  getFireRoll:        () => api.get('/visitors/fire-roll'),
  getHistory:         (residentId: string, params?: object) => api.get(`/visitors/history/${residentId}`, { params }),
  addSafeguarding:    (data: object) => api.post('/visitors/safeguarding', data),
  listSafeguarding:   (params?: object) => api.get('/visitors/safeguarding', { params }),
};

// ── Room Turnover (Facilities) ────────────────────────────────────────────
export const roomTurnoverApi = {
  create:             (data: object) => api.post('/room-turnovers', data),
  list:               (params?: object) => api.get('/room-turnovers', { params }),
  updateStatus:       (id: string, data: object) => api.patch(`/room-turnovers/${id}/status`, data),
  addChecklistItem:   (data: object) => api.post('/room-turnovers/checklist', data),
  completeChecklistItem: (id: string) => api.patch(`/room-turnovers/checklist/${id}/complete`),
  getChecklist:       (turnoverId: string) => api.get(`/room-turnovers/${turnoverId}/checklist`),
  getDashboard:       () => api.get('/room-turnovers/dashboard'),
};

// ── Custom Report Builder ─────────────────────────────────────────────────
export const reportBuilderApi = {
  listTemplates:      (params?: object) => api.get('/reports/templates', { params }),
  getTemplate:        (id: string) => api.get(`/reports/templates/${id}`),
  createTemplate:     (data: object) => api.post('/reports/templates', data),
  updateTemplate:     (id: string, data: object) => api.patch(`/reports/templates/${id}`, data),
  deleteTemplate:     (id: string) => api.delete(`/reports/templates/${id}`),
  runReport:          (data: object) => api.post('/reports/run', data),
  listRuns:           (params?: object) => api.get('/reports/runs', { params }),
  getRun:             (id: string) => api.get(`/reports/runs/${id}`),
  getDataSources:     () => api.get('/reports/data-sources'),
};

// ── Offline Sync (Batch 3) ────────────────────────────────────────────────
export const offlineSyncApi = {
  queue:           (data: object) => api.post('/offline-sync/queue', data),
  sync:            (data: object) => api.post('/offline-sync/sync', data),
  getConflicts:    () => api.get('/offline-sync/conflicts'),
  resolveConflict: (id: string, data: object) => api.patch(`/offline-sync/conflicts/${id}`, data),
};

// ── Resident Tablet Interface (Batch 3) ───────────────────────────────────
export const residentTabletApi = {
  createRequest:      (data: object) => api.post('/tablet/requests', data),
  listRequests:       (params?: object) => api.get('/tablet/requests', { params }),
  acknowledgeRequest: (id: string) => api.patch(`/tablet/requests/${id}`),
  getResidentView:    (residentId: string) => api.get(`/tablet/residents/${residentId}`),
};

// ── QR Room Scanning (Batch 3) ────────────────────────────────────────────
export const qrRoomApi = {
  generate:   (data: object) => api.post('/qr-rooms', data),
  list:       (params?: object) => api.get('/qr-rooms', { params }),
  scan:       (code: string) => api.get(`/qr-rooms/scan/${code}`),
  deactivate: (id: string) => api.patch(`/qr-rooms/${id}/deactivate`),
};

// ── Benchmarking Dashboard (Batch 3) ─────────────────────────────────────
export const benchmarkingApi = {
  getDashboard:       () => api.get('/benchmarking/dashboard'),
  calculate:          (data: object) => api.post('/benchmarking/calculate', data),
  getMetricHistory:   (metricName: string) => api.get(`/benchmarking/metrics/${metricName}`),
  getNationalAverages:() => api.get('/benchmarking/national-averages'),
};

// ── Board Pack Generator (Batch 3) ───────────────────────────────────────
export const boardPackApi = {
  generate: (data: object) => api.post('/board-packs', data),
  list:     (params?: object) => api.get('/board-packs', { params }),
  get:      (id: string) => api.get(`/board-packs/${id}`),
  approve:  (id: string, data: object) => api.patch(`/board-packs/${id}/approve`, data),
};

// ── Staff Performance Insights (Batch 3) ─────────────────────────────────
export const staffPerformanceApi = {
  getTeamMetrics:       () => api.get('/staff-performance/team'),
  getIndividualMetrics: (staffId: string) => api.get(`/staff-performance/${staffId}`),
  calculateMetrics:     (data: object) => api.post('/staff-performance/calculate', data),
  getResponseTimes:     () => api.get('/staff-performance/response-times'),
};

// ── E-Learning Module (Batch 3) ──────────────────────────────────────────
export const elearningApi = {
  listModules:       (params?: object) => api.get('/elearning/modules', { params }),
  createModule:      (data: object) => api.post('/elearning/modules', data),
  getModule:         (id: string) => api.get(`/elearning/modules/${id}`),
  createQuiz:        (moduleId: string, data: object) => api.post(`/elearning/modules/${moduleId}/quiz`, data),
  submitQuiz:        (moduleId: string, data: object) => api.post(`/elearning/modules/${moduleId}/quiz/submit`, data),
  getCompletions:    (params?: object) => api.get('/elearning/completions', { params }),
  getStaffProgress:  (staffId: string) => api.get(`/elearning/progress/${staffId}`),
  getMandatoryStatus:() => api.get('/elearning/mandatory-status'),
};

// ── Competency Sign-Off (Batch 3) ────────────────────────────────────────
export const competencySignoffApi = {
  create:          (data: object) => api.post('/competency-signoffs', data),
  list:            (params?: object) => api.get('/competency-signoffs', { params }),
  get:             (id: string) => api.get(`/competency-signoffs/${id}`),
  update:          (id: string, data: object) => api.patch(`/competency-signoffs/${id}`, data),
  getStaffSignoffs:(staffId: string) => api.get(`/competency-signoffs/staff/${staffId}`),
};

// ── Diabetes Management (Batch 3) ────────────────────────────────────────
export const diabetesApi = {
  logGlucose:         (data: object) => api.post('/diabetes/glucose', data),
  getGlucoseReadings: (residentId: string) => api.get(`/diabetes/glucose/${residentId}`),
  logInsulinDose:     (data: object) => api.post('/diabetes/insulin', data),
  getInsulinDoses:    (residentId: string) => api.get(`/diabetes/insulin/${residentId}`),
  recordHba1c:        (data: object) => api.post('/diabetes/hba1c', data),
  getHba1cHistory:    (residentId: string) => api.get(`/diabetes/hba1c/${residentId}`),
  getAlerts:          () => api.get('/diabetes/alerts'),
  acknowledgeAlert:   (id: string, data: object) => api.patch(`/diabetes/alerts/${id}`, data),
  getGlucosePatterns: (residentId: string) => api.get(`/diabetes/patterns/${residentId}`),
};

// ── Palliative Care Pathway (Batch 3) ────────────────────────────────────
export const palliativeCareApi = {
  createCarePlan:            (data: object) => api.post('/palliative/care-plans', data),
  getCarePlan:               (residentId: string) => api.get(`/palliative/care-plans/${residentId}`),
  updateCarePlan:            (id: string, data: object) => api.patch(`/palliative/care-plans/${id}`, data),
  scheduleComfortRound:      (data: object) => api.post('/palliative/comfort-rounds', data),
  completeComfortRound:      (id: string, data: object) => api.patch(`/palliative/comfort-rounds/${id}`, data),
  getComfortRounds:          (residentId: string) => api.get(`/palliative/comfort-rounds/${residentId}`),
  addAnticipatoryMed:        (data: object) => api.post('/palliative/anticipatory-meds', data),
  getAnticipatoryMeds:       (residentId: string) => api.get(`/palliative/anticipatory-meds/${residentId}`),
  administerAnticipatoryMed: (id: string, data: object) => api.patch(`/palliative/anticipatory-meds/${id}`, data),
  logFamilyCommunication:    (data: object) => api.post('/palliative/family-communications', data),
  getFamilyCommunications:   (residentId: string) => api.get(`/palliative/family-communications/${residentId}`),
};

// ── Music Therapy (Quality of Life) ──────────────────────────────────────
export const musicTherapyApi = {
  getGenres:          () => api.get('/music-therapy/genres'),
  getPreferences:     (residentId: string) => api.get(`/music-therapy/preferences/${residentId}`),
  updatePreferences:  (data: object) => api.post('/music-therapy/preferences', data),
  startSession:       (data: object) => api.post('/music-therapy/sessions', data),
  endSession:         (id: string, data: object) => api.patch(`/music-therapy/sessions/${id}/end`, data),
  getHistory:         (residentId: string) => api.get(`/music-therapy/sessions/${residentId}`),
  getEffectiveness:   (residentId?: string) => api.get('/music-therapy/effectiveness', { params: { residentId } }),
};

// ── Menu Choice System (Quality of Life) ─────────────────────────────────
export const menuChoiceApi = {
  listOptions:           (params?: object) => api.get('/menu-choices/options', { params }),
  createOption:          (data: object) => api.post('/menu-choices/options', data),
  getDietaryProfile:     (residentId: string) => api.get(`/menu-choices/dietary-profile/${residentId}`),
  updateDietaryProfile:  (residentId: string, data: object) => api.put(`/menu-choices/dietary-profile/${residentId}`, data),
  submitChoice:          (data: object) => api.post('/menu-choices', data),
  getKitchenDashboard:   () => api.get('/menu-choices/kitchen-dashboard'),
  getResidentChoices:    (residentId: string) => api.get(`/menu-choices/residents/${residentId}`),
};

// ── Friendship Mapper (Quality of Life) ──────────────────────────────────
export const friendshipMapperApi = {
  recordObservation:   (data: object) => api.post('/friendship-mapper/observations', data),
  getConnections:      (residentId: string) => api.get(`/friendship-mapper/connections/${residentId}`),
  getNetwork:          () => api.get('/friendship-mapper/network'),
  getSeatingSuggestions: (tableSize?: number) => api.get('/friendship-mapper/seating-suggestions', { params: tableSize ? { tableSize } : {} }),
  getIsolatedResidents:  (minConnections?: number) => api.get('/friendship-mapper/isolated', { params: minConnections ? { minConnections } : {} }),
};

// ── Purpose Planner (Quality of Life) ────────────────────────────────────
export const purposePlannerApi = {
  listRoles:       () => api.get('/purpose-planner/roles'),
  createRole:      (data: object) => api.post('/purpose-planner/roles', data),
  assignRole:      (data: object) => api.post('/purpose-planner/assign', data),
  getResidentRoles:(residentId: string) => api.get(`/purpose-planner/residents/${residentId}`),
  logEngagement:   (data: object) => api.post('/purpose-planner/engagement', data),
  getReport:       () => api.get('/purpose-planner/report'),
  getSuggestions:  (residentId: string) => api.get(`/purpose-planner/suggestions/${residentId}`),
};

// ── Mood Environment (Quality of Life) ───────────────────────────────────
export const moodEnvironmentApi = {
  getSuggestions:       (residentId: string) => api.get(`/mood-environment/suggestions/${residentId}`),
  recordIntervention:   (data: object) => api.post('/mood-environment/interventions', data),
  getHistory:           (residentId: string) => api.get(`/mood-environment/history/${residentId}`),
  getEffectiveness:     (residentId?: string) => api.get('/mood-environment/effectiveness', { params: { residentId } }),
};

// ── Photo Frame Feed (Quality of Life) ───────────────────────────────────
export const photoFrameApi = {
  upload:        (formData: FormData) => api.post('/photo-frame/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listPhotos:    (residentId: string, params?: object) => api.get(`/photo-frame/photos/${residentId}`, { params }),
  approve:       (id: string) => api.patch(`/photo-frame/photos/${id}/approve`),
  reject:        (id: string) => api.patch(`/photo-frame/photos/${id}/reject`),
  schedule:      (id: string, data: object) => api.patch(`/photo-frame/photos/${id}/schedule`, data),
  getHistory:    (residentId: string) => api.get(`/photo-frame/viewing-history/${residentId}`),
  logView:       (data: object) => api.post('/photo-frame/views', data),
};

// ── Sleep Quality Tracker (Quality of Life) ──────────────────────────────
export const sleepTrackerApi = {
  logSleep:        (data: object) => api.post('/sleep-tracker/logs', data),
  getHistory:      (residentId: string) => api.get(`/sleep-tracker/history/${residentId}`),
  getProfile:      (residentId: string) => api.get(`/sleep-tracker/profile/${residentId}`),
  getDisturbances: (residentId: string) => api.get(`/sleep-tracker/disturbances/${residentId}`),
  getSuggestions:  (residentId: string) => api.get(`/sleep-tracker/suggestions/${residentId}`),
};

// ── Intergenerational Programme (Quality of Life) ────────────────────────
export const intergenerationalApi = {
  createProgramme:    (data: object) => api.post('/intergenerational/programmes', data),
  listProgrammes:     (params?: object) => api.get('/intergenerational/programmes', { params }),
  createVisit:        (data: object) => api.post('/intergenerational/visits', data),
  listVisits:         (params?: object) => api.get('/intergenerational/visits', { params }),
  addParticipant:     (data: object) => api.post('/intergenerational/participants', data),
  logOutcome:         (id: string, data: object) => api.patch(`/intergenerational/visits/${id}/outcome`, data),
  getSafeguarding:    (programmeId: string) => api.get(`/intergenerational/safeguarding/${programmeId}`),
  getWellbeingImpact: () => api.get('/intergenerational/wellbeing-impact'),
};

// ── Rehab Goal Tracker (Quality of Life) ─────────────────────────────────
export const rehabGoalsApi = {
  createGoal:         (data: object) => api.post('/rehab-goals', data),
  getResidentGoals:   (residentId: string) => api.get(`/rehab-goals/residents/${residentId}`),
  addMilestone:       (data: object) => api.post('/rehab-goals/milestones', data),
  updateProgress:     (id: string, data: object) => api.patch(`/rehab-goals/milestones/${id}`, data),
  logProgress:        (data: object) => api.post('/rehab-goals/progress', data),
  celebrate:          (id: string) => api.patch(`/rehab-goals/${id}/celebrate`),
  getReport:          (residentId: string) => api.get(`/rehab-goals/report/${residentId}`),
};

// ── Celebration Planner (Quality of Life) ────────────────────────────────
export const celebrationsApi = {
  getUpcoming:        () => api.get('/celebrations/upcoming'),
  create:             (data: object) => api.post('/celebrations', data),
  assignTask:         (data: object) => api.post('/celebrations/tasks', data),
  completeTask:       (id: string) => api.patch(`/celebrations/tasks/${id}/complete`),
  getCalendar:        () => api.get('/celebrations/calendar'),
  notifyFamily:       (id: string, data?: object) => api.post(`/celebrations/${id}/notify-family`, data),
};

// ── Housekeeping / Cleaning checklists ───────────────────────────────────
export const housekeepingApi = {
  tasks:         (category: string) => api.get('/housekeeping/tasks', { params: { category } }),
  rooms:         () => api.get('/housekeeping/rooms'),
  communalAreas: () => api.get('/housekeeping/communal-areas'),
  logs:          (params?: object) => api.get('/housekeeping/logs', { params }),
  submit:        (data: object) => api.post('/housekeeping/logs', data),
  summary:       () => api.get('/housekeeping/summary'),
};

// ── Care Task Templates (management) ─────────────────────────────────────
export const taskTemplatesApi = {
  list:   () => api.get('/tasks/templates'),
  create: (data: object) => api.post('/tasks/templates', data),
  update: (id: string, data: object) => api.patch(`/tasks/templates/${id}`, data),
  remove: (id: string) => api.delete(`/tasks/templates/${id}`),
  generate: (date?: string) => api.post('/tasks/generate', {}, { params: date ? { date } : {} }),
  carePlan: (rid: string) => api.get(`/residents/${rid}/care-plan`),
  setExclusion: (rid: string, data: object) => api.post(`/residents/${rid}/task-exclusion`, data),
};

// ── Configuration / management ───────────────────────────────────────────
export const menuAdminApi = {
  list:   () => api.get('/menu-choices/options'),
  create: (d: object) => api.post('/menu-choices/options', d),
  update: (id: string, d: object) => api.patch(`/menu-choices/options/${id}`, d),
  remove: (id: string) => api.delete(`/menu-choices/options/${id}`),
};
export const housekeepingAdminApi = {
  list:         () => api.get('/housekeeping/manage'),
  copyDefaults: () => api.post('/housekeeping/manage/copy-defaults', {}),
  create:       (d: object) => api.post('/housekeeping/manage', d),
  update:       (id: string, d: object) => api.patch(`/housekeeping/manage/${id}`, d),
  remove:       (id: string) => api.delete(`/housekeeping/manage/${id}`),
};
export const homeApi = {
  get:    () => api.get('/home'),
  update: (d: object) => api.patch('/home', d),
};

// ── Outcomes analytics ────────────────────────────────────────────────────
export const analyticsApi = {
  outcomes: (days?: number) => api.get('/analytics/outcomes', { params: days ? { days } : {} }),
};

// ── Family access management (manager) ────────────────────────────────────
export const familyAccessApi = {
  list:      () => api.get('/family-access'),
  provision: (d: object) => api.post('/family-access/provision', d),
  invite:    (d: object) => api.post('/family-access/invite', d),
  revoke:    (linkId: string) => api.post(`/family-access/${linkId}/revoke`, {}),
  revokeInvite: (id: string) => api.delete(`/family-access/invite/${id}`),
};

// ── Family member portal (role: family) ───────────────────────────────────
export const portalApi = {
  me:            () => api.get('/portal/me'),
  feed:          (rid?: string) => api.get('/portal/feed', { params: rid ? { residentId: rid } : {} }),
  photos:        (rid?: string) => api.get('/portal/photos', { params: rid ? { residentId: rid } : {} }),
  messages:      (rid?: string) => api.get('/portal/messages', { params: rid ? { residentId: rid } : {} }),
  sendMessage:   (body: string, rid?: string) => api.post('/portal/messages', { body }, { params: rid ? { residentId: rid } : {} }),
  careHighlights:(rid?: string) => api.get('/portal/care-highlights', { params: rid ? { residentId: rid } : {} }),
};

// Public — family invite registration
export const familyRegisterApi = {
  register: (d: object) => api.post('/auth/family-register', d),
};
