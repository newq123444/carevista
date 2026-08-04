// src/hooks/index.ts — All hooks for CareVista
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api, residentsApi, notesApi, emarApi, incidentsApi,
  scheduleApi, staffApi, complianceApi, familyApi,
  billingApi, aiApi, dashboardApi, auditApi, policiesApi,
  activitiesApi, wellbeingApi, predictiveApi, voiceApi, sbarApi,
  news2Api, woundsApi, infectionsApi, continenceApi,
  smartRotaApi, nlSearchApi, riskAssessmentsApi, medInteractionsApi,
  invoicingApi, occupancyApi, staffCostsApi, recruitmentApi,
  competencyApi, absenceApi, fireLogApi, visitorsApi,
  roomTurnoverApi, reportBuilderApi,
  offlineSyncApi, residentTabletApi, qrRoomApi, benchmarkingApi,
  boardPackApi, staffPerformanceApi, elearningApi, competencySignoffApi,
  diabetesApi, palliativeCareApi,
  musicTherapyApi, menuChoiceApi, friendshipMapperApi, purposePlannerApi,
  moodEnvironmentApi, photoFrameApi, sleepTrackerApi, intergenerationalApi,
  rehabGoalsApi, celebrationsApi, housekeepingApi, taskTemplatesApi,
  menuAdminApi, housekeepingAdminApi, homeApi,
  analyticsApi, familyAccessApi, portalApi,
} from '../services/api';
import { toast } from '../utils/toast';

export function useResidents(params?: object) {
  return useQuery({ queryKey: ['residents', params], queryFn: () => residentsApi.list(params).then(r => Array.isArray(r.data) ? r.data : (r.data?.residents ?? r.data)) });
}
export function useResident(id: string) {
  return useQuery({ queryKey: ['residents', id], queryFn: () => residentsApi.get(id).then(r => r.data), enabled: !!id });
}
export function useAdmitResident() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => residentsApi.create(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['residents'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Resident admitted successfully'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to admit resident') });
}
export function useUpdateResident() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => residentsApi.update(id, data).then(r => r.data), onSuccess: (_: any, vars: any) => { qc.invalidateQueries({ queryKey: ['residents', vars.id] }); qc.invalidateQueries({ queryKey: ['residents'] }); toast.success('Resident record updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update') });
}
export function useDischargeResident() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => residentsApi.discharge(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['residents'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Resident discharged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to discharge') });
}
export function useUpdateMobility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mobilityStatus }: { id: string; mobilityStatus: string }) => residentsApi.updateMobility(id, mobilityStatus).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['residents'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Mobility updated \u2014 tasks will adjust'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update mobility')
  });
}
export function useCareNotes(params?: object) {
  return useQuery({ queryKey: ['care-notes', params], queryFn: () => notesApi.list(params).then(r => Array.isArray(r.data) ? r.data : (r.data?.notes ?? r.data)) });
}
export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => notesApi.create(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['care-notes'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Care note saved'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save note') });
}
export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => notesApi.delete(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['care-notes'] }); toast.success('Note deleted'); } });
}
export function useResidentMedications(residentId: string) {
  return useQuery({
    queryKey: ['medications', residentId],
    queryFn: () => api.get('/medications', { params: { residentId, active: 'all' } }).then(r => r.data),
    enabled: !!residentId,
  });
}
export function useEmar(date?: string) {
  return useQuery({ queryKey: ['emar', date], queryFn: () => emarApi.get({ date }).then(r => r.data), refetchInterval: 60_000 });
}
export function useMedications(params?: object) {
  return useQuery({ queryKey: ['medications', params], queryFn: () => emarApi.listMedications(params).then(r => r.data) });
}
export function useCreateMedication() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => emarApi.createMedication(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['medications'] }); qc.invalidateQueries({ queryKey: ['emar'], exact: false }); toast.success('Medication added ✅'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add medication') });
}
export function useDiscontinueMedication() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data?: object }) => emarApi.discontinue(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['medications'] }); qc.invalidateQueries({ queryKey: ['emar'], exact: false }); toast.success('Medication discontinued'); } });
}
export function useRecordAdministration() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => emarApi.administer(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['emar'], exact: false }); qc.invalidateQueries({ queryKey: ['dashboard'], exact: false }); toast.success('Administration recorded ✅'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record') });
}
export function useMissedMedReport(params?: object) {
  return useQuery({ queryKey: ['emar-missed', params], queryFn: () => emarApi.missedReport(params).then(r => r.data) });
}
export function useIncidents(params?: object) {
  return useQuery({ queryKey: ['incidents', params], queryFn: () => incidentsApi.list(params).then(r => r.data) });
}
export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => incidentsApi.create(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['incidents'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Incident reported'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to report') });
}
export function useUpdateIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => incidentsApi.updateStatus(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['incidents'] }); toast.success('Incident updated'); } });
}
export function useWeekRota(startDate: string, endDate: string) {
  return useQuery({ queryKey: ['schedule', startDate, endDate], queryFn: () => scheduleApi.getWeek(startDate, endDate).then(r => r.data), enabled: !!startDate && !!endDate });
}
export function useUpsertShift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => scheduleApi.upsertShift(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); toast.success('Shift updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update shift') });
}
export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ staffId, date }: { staffId: string; date: string }) => scheduleApi.deleteShift(staffId, date).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); toast.success('Shift removed'); } });
}
export function useStaff() {
  return useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list().then(r => r.data) });
}
export function useTraining(params?: object) {
  return useQuery({ queryKey: ['training', params], queryFn: () => staffApi.listTraining(params).then(r => r.data) });
}
export function useAddTraining() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => staffApi.addTraining(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['training'] }); qc.invalidateQueries({ queryKey: ['staff'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Training record added'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add training') });
}
export function useComplianceActions(params?: object) {
  return useQuery({ queryKey: ['compliance-actions', params], queryFn: () => complianceApi.listActions(params).then(r => r.data) });
}
export function useCreateComplianceAction() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => complianceApi.createAction(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-actions'] }); toast.success('Compliance action created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed') });
}
export function useUpdateComplianceAction() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => complianceApi.updateAction(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-actions'] }); toast.success('Action updated'); } });
}
export function useFamilyMessages(params?: object) {
  return useQuery({ queryKey: ['family-messages', params], queryFn: () => familyApi.listMessages(params).then(r => r.data), refetchInterval: 30_000 });
}
export function useSendFamilyMessage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => familyApi.sendMessage(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-messages'] }); toast.success('Message sent'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to send') });
}
export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => familyApi.markRead(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-messages'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); } });
}
export function useInvoices(params?: object) {
  return useQuery({ queryKey: ['invoices', params], queryFn: () => billingApi.listInvoices(params).then(r => Array.isArray(r.data) ? r.data : (r.data?.invoices ?? r.data)) });
}
export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => billingApi.createInvoice(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed') });
}
export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => billingApi.updateInvoice(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice updated'); } });
}
export function useBillingSummary() {
  return useQuery({ queryKey: ['billing-summary'], queryFn: () => billingApi.summary().then(r => r.data) });
}
export function useAuditLog(params?: object) {
  return useQuery({ queryKey: ['audit-log', params], queryFn: () => auditApi.list(params).then(r => r.data) });
}
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get().then(r => r.data), refetchInterval: 120_000 });
}
export function useAiAnalyze() {
  return useMutation({ mutationFn: (data: object) => aiApi.analyze(data).then(r => r.data), onError: (err: any) => toast.error(err.response?.data?.error || 'AI analysis failed') });
}
export function useAiSuggest() {
  return useMutation({ mutationFn: (data: object) => aiApi.suggest(data).then(r => r.data), onError: (err: any) => toast.error(err.response?.data?.error || 'AI suggestion failed') });
}
export function usePolicies(params?: object) {
  return useQuery({ queryKey: ['policies', params], queryFn: () => policiesApi.list(params).then(r => r.data) });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => billingApi.updateInvoice(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed') });
}

// ── Care Tasks ────────────────────────────────────────────────────────────
export function useTasks(params?: object) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.get('/tasks', { params }).then(r => r.data),
    refetchInterval: 60_000, // auto-refresh every 60s for status changes
    staleTime: 30_000,
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/tasks/${id}/complete`, { notes }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'], exact: false }),
  });
}

export function useDeferTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/tasks/${id}/defer`, { reason }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'], exact: false }),
  });
}

export function useStartTask() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/tasks/${id}/start`).then(r => r.data),
  });
}

export function useReleaseTask() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/tasks/${id}/release`).then(r => r.data),
  });
}

export function useGenerateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => api.post('/tasks/generate', {}, { params: { date } }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'], exact: false }),
  });
}

// ── Activities ────────────────────────────────────────────────────────────
export function useActivities(params?: object) {
  return useQuery({ queryKey: ['activities', params], queryFn: () => activitiesApi.list(params).then(r => r.data) });
}
export function useActivity(id: string) {
  return useQuery({ queryKey: ['activities', id], queryFn: () => activitiesApi.get(id).then(r => r.data), enabled: !!id });
}
export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => activitiesApi.create(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities'] }); toast.success('Activity created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create activity') });
}
export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => activitiesApi.update(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities'] }); toast.success('Activity updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update activity') });
}
export function useSessions(params?: object) {
  return useQuery({ queryKey: ['activity-sessions', params], queryFn: () => activitiesApi.listSessions(params).then(r => r.data) });
}
export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => activitiesApi.createSession(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['activity-sessions'] }); toast.success('Session scheduled'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create session') });
}
export function useSessionParticipants(sessionId: string) {
  return useQuery({ queryKey: ['session-participants', sessionId], queryFn: () => activitiesApi.getParticipants(sessionId).then(r => r.data), enabled: !!sessionId });
}
export function useAddParticipant() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ sessionId, data }: { sessionId: string; data: object }) => activitiesApi.addParticipant(sessionId, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['session-participants'] }); qc.invalidateQueries({ queryKey: ['activity-sessions'] }); toast.success('Participant added'); }, onError: (err: any) => toast.error(err.response?.data?.message || err.response?.data?.error || 'Cannot add participant') });
}
export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ sessionId, residentId, data }: { sessionId: string; residentId: string; data: object }) => activitiesApi.updateParticipant(sessionId, residentId, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['session-participants'] }); toast.success('Participant updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update') });
}
export function useEligibleResidents(activityId: string) {
  return useQuery({ queryKey: ['eligible-residents', activityId], queryFn: () => activitiesApi.eligibleResidents(activityId).then(r => r.data), enabled: !!activityId });
}
export function useResidentActivityHistory(residentId: string) {
  return useQuery({ queryKey: ['resident-activities', residentId], queryFn: () => activitiesApi.residentHistory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useWellbeingDashboard() {
  return useQuery({ queryKey: ['wellbeing-dashboard'], queryFn: () => activitiesApi.wellbeingDashboard().then(r => r.data) });
}

// ── Wellbeing Tracking ────────────────────────────────────────────────────
export function useLogWellbeing() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => wellbeingApi.log(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['wellbeing'] }); qc.invalidateQueries({ queryKey: ['wellbeing-overview'] }); toast.success('Wellbeing logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log wellbeing') });
}
export function useResidentWellbeing(residentId: string, days?: number) {
  return useQuery({ queryKey: ['wellbeing', residentId, days], queryFn: () => wellbeingApi.getResidentWellbeing(residentId, days).then(r => r.data), enabled: !!residentId });
}
export function useWellbeingOverview() {
  return useQuery({ queryKey: ['wellbeing-overview'], queryFn: () => wellbeingApi.getOverview().then(r => r.data), refetchInterval: 60_000 });
}
export function useResidentLifeStory(residentId: string) {
  return useQuery({ queryKey: ['life-story', residentId], queryFn: () => wellbeingApi.getLifeStory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useUpdateLifeStory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ residentId, data }: { residentId: string; data: object }) => wellbeingApi.updateLifeStory(residentId, data).then(r => r.data), onSuccess: (_: any, vars: any) => { qc.invalidateQueries({ queryKey: ['life-story', vars.residentId] }); toast.success('Life story updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update life story') });
}
export function useSocialIsolationAlerts(status?: string) {
  return useQuery({ queryKey: ['isolation-alerts', status], queryFn: () => wellbeingApi.getIsolationAlerts(status).then(r => r.data) });
}
export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => wellbeingApi.acknowledgeAlert(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['isolation-alerts'] }); toast.success('Alert updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update alert') });
}
export function useEnvironmentPreferences(residentId: string) {
  return useQuery({ queryKey: ['environment', residentId], queryFn: () => wellbeingApi.getEnvironment(residentId).then(r => r.data), enabled: !!residentId });
}
export function useUpdateEnvironmentPreferences() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ residentId, data }: { residentId: string; data: object }) => wellbeingApi.updateEnvironment(residentId, data).then(r => r.data), onSuccess: (_: any, vars: any) => { qc.invalidateQueries({ queryKey: ['environment', vars.residentId] }); toast.success('Environment preferences updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update') });
}

// ── Predictive Care ───────────────────────────────────────────────────────
export function usePredictiveRiskDashboard() {
  return useQuery({ queryKey: ['predictive-dashboard'], queryFn: () => predictiveApi.getDashboard().then(r => r.data) });
}
export function usePredictiveAlerts() {
  return useQuery({ queryKey: ['predictive-alerts'], queryFn: () => predictiveApi.getAlerts().then(r => r.data) });
}
export function useResidentRiskHistory(residentId: string) {
  return useQuery({ queryKey: ['predictive-history', residentId], queryFn: () => predictiveApi.getResidentHistory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useRunPredictiveAnalysis() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => predictiveApi.runAnalysis().then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['predictive-dashboard'] }); qc.invalidateQueries({ queryKey: ['predictive-alerts'] }); toast.success('Analysis complete'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Analysis failed') });
}
export function useAcknowledgePredictiveAlert() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => predictiveApi.acknowledgeAlert(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['predictive-alerts'] }); toast.success('Alert acknowledged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to acknowledge alert') });
}

// ── Family Portal (Enhanced) ──────────────────────────────────────────────
export function useFamilyDashboard(residentId: string) {
  return useQuery({ queryKey: ['family-dashboard', residentId], queryFn: () => familyApi.getDashboard(residentId).then(r => r.data), enabled: !!residentId });
}
export function useFamilyDailySummary(residentId: string, date?: string) {
  return useQuery({ queryKey: ['family-daily-summary', residentId, date], queryFn: () => familyApi.getDailySummary(residentId, date).then(r => r.data), enabled: !!residentId });
}
export function useGenerateDailySummary() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ residentId, date }: { residentId: string; date?: string }) => familyApi.generateDailySummary(residentId, date).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-daily-summary'] }); qc.invalidateQueries({ queryKey: ['family-dashboard'] }); toast.success('Daily summary generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate summary') });
}
export function useFamilyWeeklyReport(residentId: string, weekStart?: string) {
  return useQuery({ queryKey: ['family-weekly-report', residentId, weekStart], queryFn: () => familyApi.getWeeklyReport(residentId, weekStart).then(r => r.data), enabled: !!residentId });
}
export function useGenerateWeeklyReports() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => familyApi.generateWeeklyReports().then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-weekly-report'] }); toast.success('Weekly reports generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate reports') });
}
export function useFamilyPhotos(residentId: string) {
  return useQuery({ queryKey: ['family-photos', residentId], queryFn: () => familyApi.listPhotos(residentId).then(r => r.data), enabled: !!residentId });
}
export function useUploadFamilyPhoto() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ residentId, formData }: { residentId: string; formData: FormData }) => familyApi.uploadPhoto(residentId, formData).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-photos'] }); qc.invalidateQueries({ queryKey: ['family-dashboard'] }); toast.success('Photo uploaded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to upload photo') });
}

// ── CQC Compliance ────────────────────────────────────────────────────────
export function useCqcDomainScores() {
  return useQuery({ queryKey: ['cqc-scores'], queryFn: () => complianceApi.getCqcScores().then(r => r.data?.scores ?? r.data ?? []) });
}
export function useCalculateCqcScores() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => complianceApi.calculateCqcScores().then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cqc-scores'] }); qc.invalidateQueries({ queryKey: ['compliance-overview'] }); toast.success('CQC scores calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate scores') });
}
export function useGenerateEvidencePack() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => complianceApi.generateEvidencePack(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['evidence-packs'] }); toast.success('Evidence pack generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate evidence pack') });
}
export function useCqcEvidencePacks() {
  return useQuery({ queryKey: ['evidence-packs'], queryFn: () => complianceApi.getEvidencePacks().then(r => r.data?.packs ?? r.data ?? []) });
}
export function usePolicyReviews() {
  return useQuery({ queryKey: ['policy-reviews'], queryFn: () => complianceApi.getPolicyReviews().then(r => r.data?.policies ?? r.data ?? []) });
}
export function useCreatePolicyReview() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => complianceApi.createPolicyReview(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['policy-reviews'] }); toast.success('Policy review recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record review') });
}
export function useInspectionChecklist(domain: string) {
  return useQuery({ queryKey: ['inspection-checklist', domain], queryFn: () => complianceApi.getInspectionChecklist(domain).then(r => r.data), enabled: !!domain });
}
export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => complianceApi.updateChecklistItem(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection-checklist'] }); toast.success('Checklist updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update checklist') });
}
export function useComplianceOverview() {
  return useQuery({ queryKey: ['compliance-overview'], queryFn: () => complianceApi.getOverview().then(r => {
    const d = r.data;
    return {
      domain_scores: d.domainScores ?? d.domain_scores ?? [],
      overdue_policies_count: d.overduePolicies ?? d.overdue_policies_count ?? 0,
      expiring_training_count: d.expiringTraining ?? d.expiring_training_count ?? 0,
      open_actions_count: d.openComplianceActions ?? d.open_actions_count ?? 0,
      overall_readiness_score: d.overallReadiness ?? d.overall_readiness_score ?? 0,
    };
  }) });
}

// ── Voice Notes ───────────────────────────────────────────────────────────
export function useVoiceHistory() {
  return useQuery({ queryKey: ['voice-history'], queryFn: () => voiceApi.getHistory().then(r => r.data) });
}
export function useCreateNoteFromVoice() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => voiceApi.createNote(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-history'] }); qc.invalidateQueries({ queryKey: ['care-notes'] }); toast.success('Care note created from voice'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create note from voice') });
}

// ── SBAR Handover ─────────────────────────────────────────────────────────
export function useSbarHandovers() {
  return useQuery({ queryKey: ['sbar-handovers'], queryFn: () => sbarApi.list().then(r => r.data) });
}
export function useGenerateSbar() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => sbarApi.generate(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sbar-handovers'] }); toast.success('SBAR handover generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate SBAR handover') });
}
export function useApproveSbar() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => sbarApi.approve(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sbar-handovers'] }); toast.success('Handover approved'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to approve handover') });
}

// ── NEWS2 ─────────────────────────────────────────────────────────────────
export function useNews2Calculate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => news2Api.calculate(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['news2'] }); toast.success('NEWS2 score calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate NEWS2') });
}
export function useNews2History(residentId: string) {
  return useQuery({ queryKey: ['news2', 'history', residentId], queryFn: () => news2Api.getHistory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useNews2Escalations(params?: object) {
  return useQuery({ queryKey: ['news2', 'escalations', params], queryFn: () => news2Api.getEscalations(params).then(r => r.data) });
}
export function useRespondToEscalation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => news2Api.respondToEscalation(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['news2'] }); toast.success('Escalation updated'); } });
}
export function useNews2Trend(residentId: string, days?: number) {
  return useQuery({ queryKey: ['news2', 'trend', residentId, days], queryFn: () => news2Api.getTrend(residentId, days).then(r => r.data), enabled: !!residentId });
}

// ── Wounds ────────────────────────────────────────────────────────────────
export function useCreateWound() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (formData: FormData) => woundsApi.create(formData).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['wounds'] }); toast.success('Wound assessment recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record wound') });
}
export function useActiveWounds() {
  return useQuery({ queryKey: ['wounds', 'active'], queryFn: () => woundsApi.listActive().then(r => r.data) });
}
export function useWoundTimeline(residentId: string, locationBodyArea?: string) {
  return useQuery({ queryKey: ['wounds', 'timeline', residentId, locationBodyArea], queryFn: () => woundsApi.getTimeline(residentId, locationBodyArea).then(r => r.data), enabled: !!residentId });
}
export function useWoundBodyMap(residentId: string) {
  return useQuery({ queryKey: ['wounds', 'bodymap', residentId], queryFn: () => woundsApi.getBodyMap(residentId).then(r => r.data), enabled: !!residentId });
}
export function useUpdateWound() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => woundsApi.update(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['wounds'] }); toast.success('Wound updated'); } });
}

// ── Infections ────────────────────────────────────────────────────────────
export function useCreateOutbreak() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => infectionsApi.createOutbreak(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['infections'] }); toast.success('Outbreak reported'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create outbreak') });
}
export function useOutbreaks(params?: object) {
  return useQuery({ queryKey: ['infections', 'outbreaks', params], queryFn: () => infectionsApi.listOutbreaks(params).then(r => r.data) });
}
export function useOutbreakDetails(id: string) {
  return useQuery({ queryKey: ['infections', 'outbreak', id], queryFn: () => infectionsApi.getOutbreak(id).then(r => r.data), enabled: !!id });
}
export function useAddInfectionCase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ outbreakId, data }: { outbreakId: string; data: object }) => infectionsApi.addCase(outbreakId, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['infections'] }); toast.success('Case added'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add case') });
}
export function useUpdateInfectionCase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => infectionsApi.updateCase(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['infections'] }); toast.success('Case updated'); } });
}
export function useUpdateOutbreakStatus() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => infectionsApi.updateOutbreakStatus(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['infections'] }); toast.success('Outbreak status updated'); } });
}

// ── Continence ────────────────────────────────────────────────────────────
export function useLogContinence() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => continenceApi.logEvent(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['continence'] }); toast.success('Continence event logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log event') });
}
export function useContinenceLog(residentId: string, days?: number) {
  return useQuery({ queryKey: ['continence', 'log', residentId, days], queryFn: () => continenceApi.getResidentLog(residentId, days).then(r => r.data), enabled: !!residentId });
}
export function useContinencePatterns(residentId: string) {
  return useQuery({ queryKey: ['continence', 'patterns', residentId], queryFn: () => continenceApi.getPatterns(residentId).then(r => r.data), enabled: !!residentId });
}
export function useContinenceAssessment(residentId: string) {
  return useQuery({ queryKey: ['continence', 'assessment', residentId], queryFn: () => continenceApi.getAssessment(residentId).then(r => r.data), enabled: !!residentId });
}
export function useCreateContinenceAssessment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => continenceApi.createAssessment(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['continence'] }); toast.success('Assessment saved'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save assessment') });
}
export function useContinenceOverview() {
  return useQuery({ queryKey: ['continence', 'overview'], queryFn: () => continenceApi.getOverview().then(r => r.data) });
}

// -- Smart Rota --
export function useGenerateRota() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => smartRotaApi.generate(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['smart-rota'] }); toast.success('Rota generated successfully'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate rota') });
}
export function useRotaTemplates() {
  return useQuery({ queryKey: ['smart-rota', 'templates'], queryFn: () => smartRotaApi.listTemplates().then(r => r.data) });
}
export function useRotaTemplate(id: string) {
  return useQuery({ queryKey: ['smart-rota', 'template', id], queryFn: () => smartRotaApi.getTemplate(id).then(r => r.data), enabled: !!id });
}
export function useUpdateRotaShift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => smartRotaApi.updateShift(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['smart-rota'] }); toast.success('Shift updated'); } });
}
export function usePublishRota() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => smartRotaApi.publish(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['smart-rota'] }); qc.invalidateQueries({ queryKey: ['schedule'] }); toast.success('Rota published'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to publish rota') });
}
export function useRotaConstraints() {
  return useQuery({ queryKey: ['smart-rota', 'constraints'], queryFn: () => smartRotaApi.getConstraints().then(r => r.data) });
}
export function useUploadRotaCsv() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (formData: FormData) => smartRotaApi.uploadCsv(formData).then(r => r.data), onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ['schedule'] }); qc.invalidateQueries({ queryKey: ['smart-rota'] }); toast.success(data?.message || 'CSV uploaded successfully'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to upload CSV') });
}

// -- Natural Language Search --
export function useNlSearch() {
  return useMutation({ mutationFn: (query: string) => nlSearchApi.search(query).then(r => r.data), onError: (err: any) => toast.error(err.response?.data?.error || 'Search failed') });
}
export function useSearchHistory() {
  return useQuery({ queryKey: ['search-history'], queryFn: () => nlSearchApi.getHistory().then(r => r.data) });
}

// -- Risk Assessments --
export function useCalculateWaterlow() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (residentId: string) => riskAssessmentsApi.calculateWaterlow(residentId).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk-assessments'] }); toast.success('Waterlow score calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate Waterlow') });
}
export function useCalculateMUST() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => riskAssessmentsApi.calculateMUST(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk-assessments'] }); toast.success('MUST score calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate MUST') });
}
export function useCalculateFallsRisk2() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (residentId: string) => riskAssessmentsApi.calculateFalls(residentId).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk-assessments'] }); toast.success('Falls risk calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate falls risk') });
}
export function useResidentRiskAssessments(residentId: string) {
  return useQuery({ queryKey: ['risk-assessments', residentId], queryFn: () => riskAssessmentsApi.getResidentAssessments(residentId).then(r => r.data), enabled: !!residentId });
}
export function useOverdueRiskReviews() {
  return useQuery({ queryKey: ['risk-assessments', 'overdue'], queryFn: () => riskAssessmentsApi.getOverdue().then(r => r.data) });
}
export function useRiskOverview() {
  return useQuery({ queryKey: ['risk-assessments', 'overview'], queryFn: () => riskAssessmentsApi.getOverview().then(r => r.data) });
}

// -- Medication Interactions --
export function useCheckMedInteractions() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (residentId: string) => medInteractionsApi.check(residentId).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['med-interactions'] }); toast.success('Interaction check complete'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to check interactions') });
}
export function useResidentMedInteractions(residentId: string) {
  return useQuery({ queryKey: ['med-interactions', residentId], queryFn: () => medInteractionsApi.getResidentInteractions(residentId).then(r => r.data), enabled: !!residentId });
}
export function useAcknowledgeMedInteraction() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => medInteractionsApi.acknowledge(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['med-interactions'] }); toast.success('Interaction acknowledged'); } });
}
export function useMedInteractionAlerts() {
  return useQuery({ queryKey: ['med-interactions', 'alerts'], queryFn: () => medInteractionsApi.getAlerts().then(r => r.data) });
}

// ── Enhanced Invoicing (Finance) ──────────────────────────────────────────
export function useRateUplifts(params?: object) {
  return useQuery({ queryKey: ['rate-uplifts', params], queryFn: () => invoicingApi.listRateUplifts(params).then(r => r.data) });
}
export function useCreateRateUplift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => invoicingApi.createRateUplift(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rate-uplifts'] }); toast.success('Rate uplift created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create rate uplift') });
}
export function useApproveRateUplift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => invoicingApi.approveRateUplift(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rate-uplifts'] }); toast.success('Rate uplift updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update rate uplift') });
}
export function usePaymentReminders(params?: object) {
  return useQuery({ queryKey: ['payment-reminders', params], queryFn: () => invoicingApi.listReminders(params).then(r => r.data) });
}
export function useRevenueDashboard() {
  return useQuery({ queryKey: ['revenue-dashboard'], queryFn: () => invoicingApi.getRevenueDashboard().then(r => r.data) });
}

// ── Occupancy Forecasting (Finance) ──────────────────────────────────────
export function useOccupancyHistory(params?: object) {
  return useQuery({ queryKey: ['occupancy', 'history', params], queryFn: () => occupancyApi.getHistory(params).then(r => r.data) });
}
export function useRecordOccupancy() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => occupancyApi.record(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['occupancy'] }); toast.success('Occupancy recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record occupancy') });
}
export function useOccupancyForecasts(params?: object) {
  return useQuery({ queryKey: ['occupancy', 'forecasts', params], queryFn: () => occupancyApi.getForecasts(params).then(r => r.data) });
}
export function useGenerateOccupancyForecast() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => occupancyApi.generateForecast(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['occupancy'] }); toast.success('Forecast generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate forecast') });
}
export function useOccupancyDashboard() {
  return useQuery({ queryKey: ['occupancy', 'dashboard'], queryFn: () => occupancyApi.getDashboard().then(r => r.data) });
}

// ── Staff Cost Analytics (Finance) ───────────────────────────────────────
export function useRecordStaffCost() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => staffCostsApi.record(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-costs'] }); toast.success('Staff cost recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record staff cost') });
}
export function useStaffCostsSummary(params?: object) {
  return useQuery({ queryKey: ['staff-costs', 'summary', params], queryFn: () => staffCostsApi.getSummary(params).then(r => r.data) });
}
export function useStaffCostsPerResident(params?: object) {
  return useQuery({ queryKey: ['staff-costs', 'per-resident', params], queryFn: () => staffCostsApi.getPerResident(params).then(r => r.data) });
}
export function useStaffCostsBudgetVsActual(params?: object) {
  return useQuery({ queryKey: ['staff-costs', 'budget-vs-actual', params], queryFn: () => staffCostsApi.getBudgetVsActual(params).then(r => r.data) });
}
export function useStaffCostsBudgets(params?: object) {
  return useQuery({ queryKey: ['staff-costs', 'budgets', params], queryFn: () => staffCostsApi.listBudgets(params).then(r => r.data) });
}
export function useCreateStaffCostBudget() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => staffCostsApi.createBudget(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-costs'] }); toast.success('Budget created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create budget') });
}

// ── Recruitment Pipeline (HR) ─────────────────────────────────────────────
export function useJobPostings(params?: object) {
  return useQuery({ queryKey: ['recruitment', 'postings', params], queryFn: () => recruitmentApi.listPostings(params).then(r => r.data) });
}
export function useCreateJobPosting() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => recruitmentApi.createPosting(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('Job posting created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create posting') });
}
export function useUpdateJobPosting() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => recruitmentApi.updatePosting(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('Job posting updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update posting') });
}
export function useJobApplications(params?: object) {
  return useQuery({ queryKey: ['recruitment', 'applications', params], queryFn: () => recruitmentApi.listApplications(params).then(r => r.data) });
}
export function useCreateJobApplication() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => recruitmentApi.createApplication(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('Application submitted'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to submit application') });
}
export function useUpdateApplicationStage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => recruitmentApi.updateApplicationStage(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('Application stage updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update stage') });
}
export function useInterviews(params?: object) {
  return useQuery({ queryKey: ['recruitment', 'interviews', params], queryFn: () => recruitmentApi.listInterviews(params).then(r => r.data) });
}
export function useScheduleInterview() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => recruitmentApi.scheduleInterview(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('Interview scheduled'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to schedule interview') });
}
export function useUpdateInterviewOutcome() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => recruitmentApi.updateInterviewOutcome(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('Interview outcome recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record outcome') });
}
export function useCreateDbsCheck() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => recruitmentApi.createDbsCheck(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('DBS check created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create DBS check') });
}
export function useUpdateDbsCheck() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => recruitmentApi.updateDbsCheck(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); toast.success('DBS check updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update DBS check') });
}
export function useRecruitmentPipeline() {
  return useQuery({ queryKey: ['recruitment', 'pipeline'], queryFn: () => recruitmentApi.getPipeline().then(r => r.data) });
}

// ── Competency Matrix (HR) ────────────────────────────────────────────────
export function useCompetencies(params?: object) {
  return useQuery({ queryKey: ['competencies', params], queryFn: () => competencyApi.listCompetencies(params).then(r => r.data) });
}
export function useCreateCompetency() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => competencyApi.createCompetency(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['competencies'] }); toast.success('Competency created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create competency') });
}
export function useStaffCompetencies(params?: object) {
  return useQuery({ queryKey: ['competencies', 'staff', params], queryFn: () => competencyApi.listStaffCompetencies(params).then(r => r.data) });
}
export function useAssignStaffCompetency() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => competencyApi.assignStaffCompetency(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['competencies'] }); toast.success('Competency assigned'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to assign competency') });
}
export function useUpdateStaffCompetency() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => competencyApi.updateStaffCompetency(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['competencies'] }); toast.success('Competency updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update competency') });
}
export function useCompetencyMatrix() {
  return useQuery({ queryKey: ['competencies', 'matrix'], queryFn: () => competencyApi.getMatrix().then(r => r.data) });
}
export function useExpiringCompetencies(params?: object) {
  return useQuery({ queryKey: ['competencies', 'expiring', params], queryFn: () => competencyApi.getExpiring(params).then(r => r.data) });
}

// ── Absence & Sickness (HR) ──────────────────────────────────────────────
export function useAbsences(params?: object) {
  return useQuery({ queryKey: ['absence', 'records', params], queryFn: () => absenceApi.list(params).then(r => r.data) });
}
export function useRecordAbsence() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => absenceApi.record(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['absence'] }); toast.success('Absence recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record absence') });
}
export function useCalculateBradfordScore() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => absenceApi.calculateBradford(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['absence'] }); toast.success('Bradford score calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate Bradford score') });
}
export function useBradfordScores(params?: object) {
  return useQuery({ queryKey: ['absence', 'bradford', params], queryFn: () => absenceApi.getBradfordScores(params).then(r => r.data) });
}
export function useAbsencePatterns(params?: object) {
  return useQuery({ queryKey: ['absence', 'patterns', params], queryFn: () => absenceApi.getPatterns(params).then(r => r.data) });
}
export function useReturnToWorkDue(params?: object) {
  return useQuery({ queryKey: ['absence', 'return-to-work', params], queryFn: () => absenceApi.getReturnToWorkDue(params).then(r => r.data) });
}
export function useCompleteReturnToWork() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => absenceApi.completeReturnToWork(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['absence'] }); toast.success('Return to work completed'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to complete return to work') });
}
export function useAbsenceDashboard() {
  return useQuery({ queryKey: ['absence', 'dashboard'], queryFn: () => absenceApi.getDashboard().then(r => r.data) });
}

// ── Fire Log Book (Facilities) ────────────────────────────────────────────
export function useFireTests(params?: object) {
  return useQuery({ queryKey: ['fire-log', 'tests', params], queryFn: () => fireLogApi.listTests(params).then(r => r.data) });
}
export function useRecordFireTest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => fireLogApi.recordTest(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire-log'] }); toast.success('Fire test recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record fire test') });
}
export function useFireEquipmentChecks(params?: object) {
  return useQuery({ queryKey: ['fire-log', 'equipment', params], queryFn: () => fireLogApi.listEquipmentChecks(params).then(r => r.data) });
}
export function useRecordFireEquipmentCheck() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => fireLogApi.recordEquipmentCheck(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire-log'] }); toast.success('Equipment check recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record equipment check') });
}
export function useFireOverdueChecks() {
  return useQuery({ queryKey: ['fire-log', 'overdue'], queryFn: () => fireLogApi.getOverdueChecks().then(r => r.data) });
}
export function usePeeps(params?: object) {
  return useQuery({ queryKey: ['fire-log', 'peeps', params], queryFn: () => fireLogApi.listPeeps(params).then(r => r.data) });
}
export function useCreatePeep() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => fireLogApi.createPeep(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire-log'] }); toast.success('PEEP created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create PEEP') });
}
export function useUpdatePeep() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => fireLogApi.updatePeep(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire-log'] }); toast.success('PEEP updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update PEEP') });
}
export function useFireDashboard() {
  return useQuery({ queryKey: ['fire-log', 'dashboard'], queryFn: () => fireLogApi.getDashboard().then(r => r.data) });
}

// ── Visitor Sign-In (Facilities) ─────────────────────────────────────────
export function useVisitors(params?: object) {
  return useQuery({ queryKey: ['visitors', params], queryFn: () => visitorsApi.list(params).then(r => r.data) });
}
export function useSignInVisitor() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => visitorsApi.signIn(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Visitor signed in'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to sign in visitor') });
}
export function useSignOutVisitor() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => visitorsApi.signOut(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Visitor signed out'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to sign out visitor') });
}
export function useVisitorDashboard() {
  return useQuery({ queryKey: ['visitors', 'dashboard'], queryFn: () => visitorsApi.getDashboard().then(r => r.data) });
}
export function useVisitorFireRoll() {
  return useQuery({ queryKey: ['visitors', 'fire-roll'], queryFn: () => visitorsApi.getFireRoll().then(r => r.data) });
}
export function useVisitorHistory(residentId: string, params?: object) {
  return useQuery({ queryKey: ['visitors', 'history', residentId, params], queryFn: () => visitorsApi.getHistory(residentId, params).then(r => r.data), enabled: !!residentId });
}
export function useAddVisitorSafeguarding() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => visitorsApi.addSafeguarding(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Safeguarding flag added'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add safeguarding flag') });
}
export function useVisitorSafeguarding(params?: object) {
  return useQuery({ queryKey: ['visitors', 'safeguarding', params], queryFn: () => visitorsApi.listSafeguarding(params).then(r => r.data) });
}

// ── Room Turnover (Facilities) ────────────────────────────────────────────
export function useRoomTurnovers(params?: object) {
  return useQuery({ queryKey: ['room-turnovers', params], queryFn: () => roomTurnoverApi.list(params).then(r => r.data) });
}
export function useCreateRoomTurnover() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => roomTurnoverApi.create(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-turnovers'] }); toast.success('Room turnover created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create room turnover') });
}
export function useUpdateRoomTurnoverStatus() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => roomTurnoverApi.updateStatus(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-turnovers'] }); toast.success('Turnover status updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update status') });
}
export function useAddTurnoverChecklistItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => roomTurnoverApi.addChecklistItem(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-turnovers'] }); toast.success('Checklist item added'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add checklist item') });
}
export function useCompleteTurnoverChecklistItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => roomTurnoverApi.completeChecklistItem(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-turnovers'] }); toast.success('Checklist item completed'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to complete item') });
}
export function useTurnoverChecklist(turnoverId: string) {
  return useQuery({ queryKey: ['room-turnovers', 'checklist', turnoverId], queryFn: () => roomTurnoverApi.getChecklist(turnoverId).then(r => r.data), enabled: !!turnoverId });
}
export function useRoomTurnoverDashboard() {
  return useQuery({ queryKey: ['room-turnovers', 'dashboard'], queryFn: () => roomTurnoverApi.getDashboard().then(r => r.data) });
}

// ── Custom Report Builder ─────────────────────────────────────────────────
export function useReportTemplates(params?: object) {
  return useQuery({ queryKey: ['reports', 'templates', params], queryFn: () => reportBuilderApi.listTemplates(params).then(r => r.data) });
}
export function useReportTemplate(id: string) {
  return useQuery({ queryKey: ['reports', 'template', id], queryFn: () => reportBuilderApi.getTemplate(id).then(r => r.data), enabled: !!id });
}
export function useCreateReportTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => reportBuilderApi.createTemplate(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report template created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create template') });
}
export function useUpdateReportTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => reportBuilderApi.updateTemplate(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report template updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update template') });
}
export function useDeleteReportTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => reportBuilderApi.deleteTemplate(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report template deleted'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete template') });
}
export function useRunReport() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => reportBuilderApi.runReport(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports', 'runs'] }); toast.success('Report generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to run report') });
}
export function useReportRuns(params?: object) {
  return useQuery({ queryKey: ['reports', 'runs', params], queryFn: () => reportBuilderApi.listRuns(params).then(r => r.data) });
}
export function useReportRun(id: string) {
  return useQuery({ queryKey: ['reports', 'run', id], queryFn: () => reportBuilderApi.getRun(id).then(r => r.data), enabled: !!id });
}
export function useReportDataSources() {
  return useQuery({ queryKey: ['reports', 'data-sources'], queryFn: () => reportBuilderApi.getDataSources().then(r => r.data) });
}

// ── Offline Sync (Batch 3) ────────────────────────────────────────────────
export function useOfflineSyncQueue() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => offlineSyncApi.queue(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['offline-sync'] }); toast.success('Action queued for sync'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to queue action') });
}
export function useOfflineSync() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => offlineSyncApi.sync(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['offline-sync'] }); toast.success('Sync completed'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Sync failed') });
}
export function useOfflineSyncConflicts() {
  return useQuery({ queryKey: ['offline-sync', 'conflicts'], queryFn: () => offlineSyncApi.getConflicts().then(r => r.data) });
}
export function useResolveOfflineConflict() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => offlineSyncApi.resolveConflict(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['offline-sync'] }); toast.success('Conflict resolved'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to resolve conflict') });
}

// ── Resident Tablet (Batch 3) ─────────────────────────────────────────────
export function useCreateTabletRequest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => residentTabletApi.createRequest(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tablet-requests'] }); toast.success('Request sent'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to send request') });
}
export function useTabletRequests(params?: object) {
  return useQuery({ queryKey: ['tablet-requests', params], queryFn: () => residentTabletApi.listRequests(params).then(r => r.data) });
}
export function useAcknowledgeTabletRequest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => residentTabletApi.acknowledgeRequest(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tablet-requests'] }); toast.success('Request acknowledged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to acknowledge request') });
}
export function useResidentTabletView(residentId: string) {
  return useQuery({ queryKey: ['tablet-view', residentId], queryFn: () => residentTabletApi.getResidentView(residentId).then(r => r.data), enabled: !!residentId });
}

// ── QR Room Scanning (Batch 3) ────────────────────────────────────────────
export function useGenerateQrCode() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => qrRoomApi.generate(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['qr-rooms'] }); toast.success('QR code generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate QR code') });
}
export function useQrRoomCodes(params?: object) {
  return useQuery({ queryKey: ['qr-rooms', params], queryFn: () => qrRoomApi.list(params).then(r => r.data) });
}
export function useScanQrCode() {
  return useMutation({ mutationFn: (code: string) => qrRoomApi.scan(code).then(r => r.data), onError: (err: any) => toast.error(err.response?.data?.error || 'Invalid QR code') });
}
export function useDeactivateQrCode() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => qrRoomApi.deactivate(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['qr-rooms'] }); toast.success('QR code deactivated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to deactivate QR code') });
}

// ── Benchmarking Dashboard (Batch 3) ─────────────────────────────────────
export function useBenchmarkingDashboard() {
  return useQuery({ queryKey: ['benchmarking'], queryFn: () => benchmarkingApi.getDashboard().then(r => r.data) });
}
export function useCalculateBenchmarks() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => benchmarkingApi.calculate(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['benchmarking'] }); toast.success('Benchmarks calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate benchmarks') });
}
export function useBenchmarkMetricHistory(metricName: string) {
  return useQuery({ queryKey: ['benchmarking', 'metric', metricName], queryFn: () => benchmarkingApi.getMetricHistory(metricName).then(r => r.data), enabled: !!metricName });
}
export function useNationalAverages() {
  return useQuery({ queryKey: ['benchmarking', 'national-averages'], queryFn: () => benchmarkingApi.getNationalAverages().then(r => r.data) });
}

// ── Board Pack Generator (Batch 3) ───────────────────────────────────────
export function useGenerateBoardPack() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => boardPackApi.generate(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['board-packs'] }); toast.success('Board pack generated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate board pack') });
}
export function useBoardPacks(params?: object) {
  return useQuery({ queryKey: ['board-packs', params], queryFn: () => boardPackApi.list(params).then(r => r.data) });
}
export function useBoardPack(id: string) {
  return useQuery({ queryKey: ['board-packs', id], queryFn: () => boardPackApi.get(id).then(r => r.data), enabled: !!id });
}
export function useApproveBoardPack() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => boardPackApi.approve(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['board-packs'] }); toast.success('Board pack approved'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to approve board pack') });
}

// ── Staff Performance Insights (Batch 3) ─────────────────────────────────
export function useStaffPerformanceTeam() {
  return useQuery({ queryKey: ['staff-performance', 'team'], queryFn: () => staffPerformanceApi.getTeamMetrics().then(r => r.data) });
}
export function useStaffPerformanceIndividual(staffId: string) {
  return useQuery({ queryKey: ['staff-performance', staffId], queryFn: () => staffPerformanceApi.getIndividualMetrics(staffId).then(r => r.data), enabled: !!staffId });
}
export function useCalculateStaffPerformance() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => staffPerformanceApi.calculateMetrics(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-performance'] }); toast.success('Performance metrics calculated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to calculate metrics') });
}
export function useStaffResponseTimes() {
  return useQuery({ queryKey: ['staff-performance', 'response-times'], queryFn: () => staffPerformanceApi.getResponseTimes().then(r => r.data) });
}

// ── E-Learning Module (Batch 3) ──────────────────────────────────────────
export function useElearningModules(params?: object) {
  return useQuery({ queryKey: ['elearning', 'modules', params], queryFn: () => elearningApi.listModules(params).then(r => r.data) });
}
export function useElearningModule(id: string) {
  return useQuery({ queryKey: ['elearning', 'module', id], queryFn: () => elearningApi.getModule(id).then(r => r.data), enabled: !!id });
}
export function useCreateElearningModule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => elearningApi.createModule(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['elearning'] }); toast.success('Module created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create module') });
}
export function useCreateElearningQuiz() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ moduleId, data }: { moduleId: string; data: object }) => elearningApi.createQuiz(moduleId, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['elearning'] }); toast.success('Quiz created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create quiz') });
}
export function useSubmitElearningQuiz() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ moduleId, data }: { moduleId: string; data: object }) => elearningApi.submitQuiz(moduleId, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['elearning'] }); toast.success('Quiz submitted'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to submit quiz') });
}
export function useElearningCompletions(params?: object) {
  return useQuery({ queryKey: ['elearning', 'completions', params], queryFn: () => elearningApi.getCompletions(params).then(r => r.data) });
}
export function useElearningStaffProgress(staffId: string) {
  return useQuery({ queryKey: ['elearning', 'staff', staffId], queryFn: () => elearningApi.getStaffProgress(staffId).then(r => r.data), enabled: !!staffId });
}
export function useElearningMandatoryStatus() {
  return useQuery({ queryKey: ['elearning', 'mandatory'], queryFn: () => elearningApi.getMandatoryStatus().then(r => r.data) });
}

// ── Competency Sign-Off (Batch 3) ────────────────────────────────────────
export function useCreateCompetencySignoff() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => competencySignoffApi.create(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['competency-signoffs'] }); toast.success('Competency sign-off recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record sign-off') });
}
export function useCompetencySignoffs(params?: object) {
  return useQuery({ queryKey: ['competency-signoffs', params], queryFn: () => competencySignoffApi.list(params).then(r => r.data) });
}
export function useCompetencySignoff(id: string) {
  return useQuery({ queryKey: ['competency-signoffs', id], queryFn: () => competencySignoffApi.get(id).then(r => r.data), enabled: !!id });
}
export function useUpdateCompetencySignoff() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => competencySignoffApi.update(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['competency-signoffs'] }); toast.success('Sign-off updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update sign-off') });
}
export function useStaffCompetencySignoffs(staffId: string) {
  return useQuery({ queryKey: ['competency-signoffs', 'staff', staffId], queryFn: () => competencySignoffApi.getStaffSignoffs(staffId).then(r => r.data), enabled: !!staffId });
}

// ── Diabetes Management (Batch 3) ────────────────────────────────────────
export function useLogGlucose() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => diabetesApi.logGlucose(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['diabetes'] }); toast.success('Glucose reading logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log glucose') });
}
export function useGlucoseReadings(residentId: string) {
  return useQuery({ queryKey: ['diabetes', 'glucose', residentId], queryFn: () => diabetesApi.getGlucoseReadings(residentId).then(r => r.data), enabled: !!residentId });
}
export function useLogInsulinDose() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => diabetesApi.logInsulinDose(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['diabetes'] }); toast.success('Insulin dose logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log insulin dose') });
}
export function useInsulinDoses(residentId: string) {
  return useQuery({ queryKey: ['diabetes', 'insulin', residentId], queryFn: () => diabetesApi.getInsulinDoses(residentId).then(r => r.data), enabled: !!residentId });
}
export function useRecordHba1c() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => diabetesApi.recordHba1c(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['diabetes'] }); toast.success('HbA1c recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record HbA1c') });
}
export function useHba1cHistory(residentId: string) {
  return useQuery({ queryKey: ['diabetes', 'hba1c', residentId], queryFn: () => diabetesApi.getHba1cHistory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useDiabetesAlerts() {
  return useQuery({ queryKey: ['diabetes', 'alerts'], queryFn: () => diabetesApi.getAlerts().then(r => r.data) });
}
export function useAcknowledgeDiabetesAlert() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => diabetesApi.acknowledgeAlert(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['diabetes'] }); toast.success('Alert acknowledged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to acknowledge alert') });
}
export function useGlucosePatterns(residentId: string) {
  return useQuery({ queryKey: ['diabetes', 'patterns', residentId], queryFn: () => diabetesApi.getGlucosePatterns(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Palliative Care Pathway (Batch 3) ────────────────────────────────────
export function useCreatePalliativeCarePlan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => palliativeCareApi.createCarePlan(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['palliative'] }); toast.success('Care plan created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create care plan') });
}
export function usePalliativeCarePlan(residentId: string) {
  return useQuery({ queryKey: ['palliative', 'care-plan', residentId], queryFn: () => palliativeCareApi.getCarePlan(residentId).then(r => r.data), enabled: !!residentId });
}
export function useUpdatePalliativeCarePlan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => palliativeCareApi.updateCarePlan(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['palliative'] }); toast.success('Care plan updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update care plan') });
}
export function useScheduleComfortRound() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => palliativeCareApi.scheduleComfortRound(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['palliative'] }); toast.success('Comfort round scheduled'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to schedule comfort round') });
}
export function useCompleteComfortRound() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => palliativeCareApi.completeComfortRound(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['palliative'] }); toast.success('Comfort round completed'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to complete comfort round') });
}
export function useComfortRounds(residentId: string) {
  return useQuery({ queryKey: ['palliative', 'comfort-rounds', residentId], queryFn: () => palliativeCareApi.getComfortRounds(residentId).then(r => r.data), enabled: !!residentId });
}
export function useAddAnticipatoryMed() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => palliativeCareApi.addAnticipatoryMed(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['palliative'] }); toast.success('Anticipatory medication added'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add medication') });
}
export function useAnticipatoryMeds(residentId: string) {
  return useQuery({ queryKey: ['palliative', 'anticipatory-meds', residentId], queryFn: () => palliativeCareApi.getAnticipatoryMeds(residentId).then(r => r.data), enabled: !!residentId });
}
export function useAdministerAnticipatoryMed() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => palliativeCareApi.administerAnticipatoryMed(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['palliative'] }); toast.success('Medication administered'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to administer medication') });
}
export function useLogFamilyCommunication() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => palliativeCareApi.logFamilyCommunication(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['palliative'] }); toast.success('Communication logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log communication') });
}
export function useFamilyCommunications(residentId: string) {
  return useQuery({ queryKey: ['palliative', 'family-comms', residentId], queryFn: () => palliativeCareApi.getFamilyCommunications(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Music Therapy (Quality of Life) ──────────────────────────────────────
export function useMusicGenres() {
  return useQuery({ queryKey: ['music-therapy', 'genres'], queryFn: () => musicTherapyApi.getGenres().then(r => r.data) });
}
export function useMusicPreferences(residentId: string) {
  return useQuery({ queryKey: ['music-therapy', 'preferences', residentId], queryFn: () => musicTherapyApi.getPreferences(residentId).then(r => r.data), enabled: !!residentId });
}
export function useUpdateMusicPreferences() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ residentId, data }: { residentId: string; data: object }) => musicTherapyApi.updatePreferences({ residentId, ...data as Record<string, unknown> }).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['music-therapy'] }); toast.success('Music preferences updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update preferences') });
}
export function useStartMusicSession() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => musicTherapyApi.startSession(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['music-therapy'] }); toast.success('Music session started'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to start session') });
}
export function useEndMusicSession() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => musicTherapyApi.endSession(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['music-therapy'] }); toast.success('Music session ended'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to end session') });
}
export function useMusicSessionHistory(residentId: string) {
  return useQuery({ queryKey: ['music-therapy', 'sessions', residentId], queryFn: () => musicTherapyApi.getHistory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useMusicEffectiveness(residentId: string) {
  return useQuery({ queryKey: ['music-therapy', 'effectiveness', residentId], queryFn: () => musicTherapyApi.getEffectiveness(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Menu Choice System (Quality of Life) ─────────────────────────────────
export function useMenuOptions(params?: object) {
  return useQuery({ queryKey: ['menu-choices', 'options', params], queryFn: () => menuChoiceApi.listOptions(params).then(r => r.data) });
}
export function useCreateMenuOption() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => menuChoiceApi.createOption(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-choices'] }); toast.success('Menu option created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create option') });
}
export function useMenuDietaryProfile(residentId: string) {
  return useQuery({ queryKey: ['menu-choices', 'dietary', residentId], queryFn: () => menuChoiceApi.getDietaryProfile(residentId).then(r => r.data), enabled: !!residentId });
}
export function useUpdateMenuDietaryProfile() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ residentId, data }: { residentId: string; data: object }) => menuChoiceApi.updateDietaryProfile(residentId, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-choices'] }); toast.success('Dietary profile updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update profile') });
}
export function useSubmitMenuChoice() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => menuChoiceApi.submitChoice(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-choices'] }); toast.success('Menu choice submitted'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to submit choice') });
}
export function useKitchenDashboard() {
  return useQuery({ queryKey: ['menu-choices', 'kitchen-dashboard'], queryFn: () => menuChoiceApi.getKitchenDashboard().then(r => r.data) });
}
export function useResidentMenuChoices(residentId: string) {
  return useQuery({ queryKey: ['menu-choices', 'resident', residentId], queryFn: () => menuChoiceApi.getResidentChoices(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Friendship Mapper (Quality of Life) ──────────────────────────────────
export function useRecordFriendshipObservation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => friendshipMapperApi.recordObservation(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['friendship-mapper'] }); toast.success('Observation recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record observation') });
}
export function useFriendshipConnections(residentId: string) {
  return useQuery({ queryKey: ['friendship-mapper', 'connections', residentId], queryFn: () => friendshipMapperApi.getConnections(residentId).then(r => r.data), enabled: !!residentId });
}
export function useFriendshipNetwork() {
  return useQuery({ queryKey: ['friendship-mapper', 'network'], queryFn: () => friendshipMapperApi.getNetwork().then(r => r.data) });
}
export function useSeatingSuggestions() {
  return useQuery({ queryKey: ['friendship-mapper', 'seating'], queryFn: () => friendshipMapperApi.getSeatingSuggestions().then(r => r.data) });
}
export function useIsolatedResidents() {
  return useQuery({ queryKey: ['friendship-mapper', 'isolated'], queryFn: () => friendshipMapperApi.getIsolatedResidents().then(r => r.data) });
}

// ── Purpose Planner (Quality of Life) ────────────────────────────────────
export function usePurposeRoles() {
  return useQuery({ queryKey: ['purpose-planner', 'roles'], queryFn: () => purposePlannerApi.listRoles().then(r => r.data) });
}
export function useCreatePurposeRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => purposePlannerApi.createRole(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['purpose-planner'] }); toast.success('Role created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create role') });
}
export function useAssignPurposeRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => purposePlannerApi.assignRole(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['purpose-planner'] }); toast.success('Role assigned'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to assign role') });
}
export function useResidentPurposeRoles(residentId: string) {
  return useQuery({ queryKey: ['purpose-planner', 'resident', residentId], queryFn: () => purposePlannerApi.getResidentRoles(residentId).then(r => r.data), enabled: !!residentId });
}
export function useLogPurposeEngagement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => purposePlannerApi.logEngagement(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['purpose-planner'] }); toast.success('Engagement logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log engagement') });
}
export function usePurposeReport() {
  return useQuery({ queryKey: ['purpose-planner', 'report'], queryFn: () => purposePlannerApi.getReport().then(r => r.data) });
}
export function usePurposeSuggestions(residentId: string) {
  return useQuery({ queryKey: ['purpose-planner', 'suggestions', residentId], queryFn: () => purposePlannerApi.getSuggestions(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Mood Environment (Quality of Life) ───────────────────────────────────
export function useMoodSuggestions(residentId: string) {
  return useQuery({ queryKey: ['mood-environment', 'suggestions', residentId], queryFn: () => moodEnvironmentApi.getSuggestions(residentId).then(r => r.data), enabled: !!residentId });
}
export function useRecordMoodIntervention() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => moodEnvironmentApi.recordIntervention(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mood-environment'] }); toast.success('Intervention recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record intervention') });
}
export function useMoodInterventionHistory(residentId: string) {
  return useQuery({ queryKey: ['mood-environment', 'history', residentId], queryFn: () => moodEnvironmentApi.getHistory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useMoodEffectiveness(residentId: string) {
  return useQuery({ queryKey: ['mood-environment', 'effectiveness', residentId], queryFn: () => moodEnvironmentApi.getEffectiveness(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Photo Frame Feed (Quality of Life) ───────────────────────────────────
export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (formData: FormData) => photoFrameApi.upload(formData).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['photo-frames'] }); toast.success('Photo uploaded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to upload photo') });
}
export function usePhotoFramePhotos(residentId: string, params?: object) {
  return useQuery({ queryKey: ['photo-frames', 'photos', residentId, params], queryFn: () => photoFrameApi.listPhotos(residentId, params).then(r => r.data), enabled: !!residentId });
}
export function useApprovePhoto() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => photoFrameApi.approve(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['photo-frames'] }); toast.success('Photo approved'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to approve photo') });
}
export function useRejectPhoto() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => photoFrameApi.reject(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['photo-frames'] }); toast.success('Photo rejected'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to reject photo') });
}
export function useSchedulePhoto() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => photoFrameApi.schedule(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['photo-frames'] }); toast.success('Photo scheduled'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to schedule photo') });
}
export function usePhotoViewingHistory(residentId: string) {
  return useQuery({ queryKey: ['photo-frames', 'history', residentId], queryFn: () => photoFrameApi.getHistory(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Sleep Quality Tracker (Quality of Life) ──────────────────────────────
export function useLogSleep() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => sleepTrackerApi.logSleep(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sleep-tracker'] }); toast.success('Sleep log recorded'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log sleep') });
}
export function useSleepHistory(residentId: string) {
  return useQuery({ queryKey: ['sleep-tracker', 'history', residentId], queryFn: () => sleepTrackerApi.getHistory(residentId).then(r => r.data), enabled: !!residentId });
}
export function useSleepProfile(residentId: string) {
  return useQuery({ queryKey: ['sleep-tracker', 'profile', residentId], queryFn: () => sleepTrackerApi.getProfile(residentId).then(r => r.data), enabled: !!residentId });
}
export function useSleepDisturbances(residentId: string) {
  return useQuery({ queryKey: ['sleep-tracker', 'disturbances', residentId], queryFn: () => sleepTrackerApi.getDisturbances(residentId).then(r => r.data), enabled: !!residentId });
}
export function useSleepSuggestions(residentId: string) {
  return useQuery({ queryKey: ['sleep-tracker', 'suggestions', residentId], queryFn: () => sleepTrackerApi.getSuggestions(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Intergenerational Programme (Quality of Life) ────────────────────────
export function useIntergenerationalProgrammes(params?: object) {
  return useQuery({ queryKey: ['intergenerational', 'programmes', params], queryFn: () => intergenerationalApi.listProgrammes(params).then(r => r.data) });
}
export function useCreateIntergenerationalProgramme() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => intergenerationalApi.createProgramme(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['intergenerational'] }); toast.success('Programme created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create programme') });
}
export function useIntergenerationalVisits(params?: object) {
  return useQuery({ queryKey: ['intergenerational', 'visits', params], queryFn: () => intergenerationalApi.listVisits(params).then(r => r.data) });
}
export function useCreateIntergenerationalVisit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => intergenerationalApi.createVisit(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['intergenerational'] }); toast.success('Visit scheduled'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to schedule visit') });
}
export function useAddIntergenerationalParticipant() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => intergenerationalApi.addParticipant(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['intergenerational'] }); toast.success('Participant added'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add participant') });
}
export function useLogIntergenerationalOutcome() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => intergenerationalApi.logOutcome(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['intergenerational'] }); toast.success('Outcome logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log outcome') });
}
export function useIntergenerationalSafeguarding(programmeId: string) {
  return useQuery({ queryKey: ['intergenerational', 'safeguarding', programmeId], queryFn: () => intergenerationalApi.getSafeguarding(programmeId).then(r => r.data), enabled: !!programmeId });
}
export function useIntergenerationalWellbeingImpact() {
  return useQuery({ queryKey: ['intergenerational', 'wellbeing-impact'], queryFn: () => intergenerationalApi.getWellbeingImpact().then(r => r.data) });
}

// ── Rehab Goal Tracker (Quality of Life) ─────────────────────────────────
export function useCreateRehabGoal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => rehabGoalsApi.createGoal(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rehab-goals'] }); toast.success('Goal created'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create goal') });
}
export function useResidentRehabGoals(residentId: string) {
  return useQuery({ queryKey: ['rehab-goals', 'resident', residentId], queryFn: () => rehabGoalsApi.getResidentGoals(residentId).then(r => r.data), enabled: !!residentId });
}
export function useAddRehabMilestone() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => rehabGoalsApi.addMilestone(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rehab-goals'] }); toast.success('Milestone added'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add milestone') });
}
export function useUpdateRehabMilestoneProgress() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => rehabGoalsApi.updateProgress(id, data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rehab-goals'] }); toast.success('Progress updated'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update progress') });
}
export function useLogRehabProgress() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => rehabGoalsApi.logProgress(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rehab-goals'] }); toast.success('Progress logged'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to log progress') });
}
export function useCelebrateRehabMilestone() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => rehabGoalsApi.celebrate(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rehab-goals'] }); toast.success('Achievement celebrated!'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to celebrate') });
}
export function useRehabReport(residentId: string) {
  return useQuery({ queryKey: ['rehab-goals', 'report', residentId], queryFn: () => rehabGoalsApi.getReport(residentId).then(r => r.data), enabled: !!residentId });
}

// ── Celebration Planner (Quality of Life) ────────────────────────────────
export function useUpcomingCelebrations() {
  return useQuery({ queryKey: ['celebrations', 'upcoming'], queryFn: () => celebrationsApi.getUpcoming().then(r => r.data) });
}
export function useCreateCelebration() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => celebrationsApi.create(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['celebrations'] }); toast.success('Celebration planned'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to plan celebration') });
}
export function useAssignCelebrationTask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => celebrationsApi.assignTask(data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['celebrations'] }); toast.success('Task assigned'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to assign task') });
}
export function useCompleteCelebrationTask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => celebrationsApi.completeTask(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['celebrations'] }); toast.success('Task completed'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to complete task') });
}
export function useCelebrationCalendar() {
  return useQuery({ queryKey: ['celebrations', 'calendar'], queryFn: () => celebrationsApi.getCalendar().then(r => r.data) });
}
export function useNotifyCelebrationFamily() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => celebrationsApi.notifyFamily(id).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['celebrations'] }); toast.success('Family notified'); }, onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to notify family') });
}
// ── Housekeeping ─────────────────────────────────────────────────────────
export function useHousekeepingTasks(category: string) {
  return useQuery({ queryKey: ['hk-tasks', category], queryFn: () => housekeepingApi.tasks(category).then(r => r.data), enabled: !!category });
}
export function useHousekeepingRooms() {
  return useQuery({ queryKey: ['hk-rooms'], queryFn: () => housekeepingApi.rooms().then(r => r.data) });
}
export function useHousekeepingCommunalAreas() {
  return useQuery({ queryKey: ['hk-areas'], queryFn: () => housekeepingApi.communalAreas().then(r => r.data) });
}
export function useHousekeepingLogs(params?: object) {
  return useQuery({ queryKey: ['hk-logs', params], queryFn: () => housekeepingApi.logs(params).then(r => r.data) });
}
export function useSubmitHousekeeping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => housekeepingApi.submit(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hk-logs'] }); toast.success('Checklist saved'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save checklist'),
  });
}

export function useColleagues() {
  return useQuery({ queryKey: ['colleagues'], queryFn: () => staffApi.colleagues().then(r => r.data) });
}

export function useHousekeepingSummary() {
  return useQuery({ queryKey: ['hk-summary'], queryFn: () => housekeepingApi.summary().then(r => r.data), refetchInterval: 60_000 });
}

// ── Care Task Templates ──────────────────────────────────────────────────
export function useTaskTemplates() {
  return useQuery({ queryKey: ['task-templates'], queryFn: () => taskTemplatesApi.list().then(r => r.data) });
}
export function useCreateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => taskTemplatesApi.create(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-templates'] }); toast.success('Task added'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to add task') });
}
export function useUpdateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => taskTemplatesApi.update(id, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-templates'] }); toast.success('Task updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update task') });
}
export function useDeleteTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => taskTemplatesApi.remove(id).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-templates'] }); toast.success('Task removed'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to remove task') });
}

// ── Configuration hooks ──────────────────────────────────────────────────
function crud(key: string, apiObj: any, labels: { add: string; edit: string; remove: string }) {
  return {
    list: () => useQuery({ queryKey: [key], queryFn: () => apiObj.list().then((r: any) => r.data) }),
    create: () => { const qc = useQueryClient(); return useMutation({ mutationFn: (d: object) => apiObj.create(d).then((r: any) => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); toast.success(labels.add); }, onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') }); },
    update: () => { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, data }: { id: string; data: object }) => apiObj.update(id, data).then((r: any) => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); toast.success(labels.edit); }, onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') }); },
    remove: () => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => apiObj.remove(id).then((r: any) => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); toast.success(labels.remove); }, onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') }); },
  };
}
const menuCrud = crud('menu-admin', menuAdminApi, { add: 'Menu item added', edit: 'Menu item updated', remove: 'Menu item removed' });
export const useMenuAdmin = menuCrud.list; export const useCreateMenu = menuCrud.create; export const useUpdateMenu = menuCrud.update; export const useDeleteMenu = menuCrud.remove;
const hkCrud = crud('hk-admin', housekeepingAdminApi, { add: 'Task added', edit: 'Task updated', remove: 'Task removed' });
export const useHkAdmin = hkCrud.list; export const useCreateHk = hkCrud.create; export const useUpdateHk = hkCrud.update; export const useDeleteHk = hkCrud.remove;
export function useCopyHkDefaults() { const qc = useQueryClient(); return useMutation({ mutationFn: () => housekeepingAdminApi.copyDefaults().then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['hk-admin'] }); toast.success('Standard checklist copied'); }, onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') }); }
export function useHome() { return useQuery({ queryKey: ['home'], queryFn: () => homeApi.get().then(r => r.data) }); }
export function useUpdateHome() { const qc = useQueryClient(); return useMutation({ mutationFn: (d: object) => homeApi.update(d).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['home'] }); toast.success('Settings saved'); }, onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save') }); }

export function useResidentCarePlan(rid: string) {
  return useQuery({ queryKey: ['care-plan', rid], queryFn: () => taskTemplatesApi.carePlan(rid).then(r => r.data), enabled: !!rid });
}
export function useSetTaskExclusion(rid: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: object) => taskTemplatesApi.setExclusion(rid, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['care-plan', rid] }),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') });
}

// ── Outcomes ──────────────────────────────────────────────────────────────
export function useOutcomes(days?: number) {
  return useQuery({ queryKey: ['outcomes', days], queryFn: () => analyticsApi.outcomes(days).then(r => r.data) });
}

// ── Family access (manager) ───────────────────────────────────────────────
export function useFamilyAccess() {
  return useQuery({ queryKey: ['family-access'], queryFn: () => familyAccessApi.list().then(r => r.data) });
}
export function useProvisionFamily() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: object) => familyAccessApi.provision(d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-access'] }),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') });
}
export function useInviteFamily() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: object) => familyAccessApi.invite(d).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-access'] }),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') });
}
export function useRevokeFamily() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (linkId: string) => familyAccessApi.revoke(linkId).then(r => r.data),
    onSuccess: () => { toast.success('Access revoked'); qc.invalidateQueries({ queryKey: ['family-access'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') });
}
export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => familyAccessApi.revokeInvite(id).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-access'] }) });
}

// ── Family member portal ──────────────────────────────────────────────────
export function usePortalMe() {
  return useQuery({ queryKey: ['portal-me'], queryFn: () => portalApi.me().then(r => r.data) });
}
export function usePortalFeed(rid?: string) {
  return useQuery({ queryKey: ['portal-feed', rid], queryFn: () => portalApi.feed(rid).then(r => r.data) });
}
export function usePortalPhotos(rid?: string) {
  return useQuery({ queryKey: ['portal-photos', rid], queryFn: () => portalApi.photos(rid).then(r => r.data) });
}
export function usePortalMessages(rid?: string) {
  return useQuery({ queryKey: ['portal-messages', rid], queryFn: () => portalApi.messages(rid).then(r => r.data), refetchInterval: 30000 });
}
export function useSendPortalMessage(rid?: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: string) => portalApi.sendMessage(body, rid).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-messages', rid] }),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') });
}
export function usePortalHighlights(rid?: string) {
  return useQuery({ queryKey: ['portal-highlights', rid], queryFn: () => portalApi.careHighlights(rid).then(r => r.data) });
}
