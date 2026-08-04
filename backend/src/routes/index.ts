// ============================================================
// src/routes/index.ts — All API routes
// ============================================================
import { Router } from 'express';
import { authenticate, isManager, isClinical, isStaff, isFinance, isAllStaff, isFacilities, isFamily, tenantGuard } from '../middleware/auth';
import * as authCtrl from '../controllers/auth.controller';
import * as analyticsCtrl from '../controllers/analytics.controller';
import * as familyAccessCtrl from '../controllers/familyAccess.controller';
import * as portalCtrl from '../controllers/portal.controller';
import * as residentsCtrl from '../controllers/residents.controller';
import * as notesCtrl from '../controllers/careNotes.controller';
import * as emarCtrl from '../controllers/emar.controller';
import * as incidentsCtrl from '../controllers/incidents.controller';
import * as scheduleCtrl from '../controllers/schedule.controller';
import * as billingCtrl from '../controllers/billing.controller';
import * as tasksCtrl from '../controllers/tasks.controller';
import * as notificationsCtrl from '../controllers/notifications.controller';
import * as aiHandoverCtrl from '../controllers/aiHandover.controller';
import * as aiInsightsCtrl from '../controllers/aiInsights.controller';
import * as weightCtrl from '../controllers/weight.controller';
import * as photosCtrl from '../controllers/photos.controller';
import * as activitiesCtrl from '../controllers/activities.controller';
import * as wellbeingCtrl from '../controllers/wellbeing.controller';
import * as predictiveCareCtrl from '../controllers/predictiveCare.controller';
import * as familyPortalCtrl from '../controllers/familyPortal.controller';
import * as cqcComplianceCtrl from '../controllers/cqcCompliance.controller';
import * as voiceSbarCtrl from '../controllers/voiceSbar.controller';
import * as news2Ctrl from '../controllers/news2.controller';
import * as woundsCtrl from '../controllers/wounds.controller';
import * as infectionsCtrl from '../controllers/infections.controller';
import * as continenceCtrl from '../controllers/continence.controller';
import * as smartRotaCtrl from '../controllers/smartRota.controller';
import * as nlSearchCtrl from '../controllers/nlSearch.controller';
import * as riskAssessmentsCtrl from '../controllers/riskAssessments.controller';
import * as medInteractionsCtrl from '../controllers/medInteractions.controller';
import * as invoicingCtrl from '../controllers/invoicing.controller';
import * as occupancyCtrl from '../controllers/occupancy.controller';
import * as staffCostsCtrl from '../controllers/staffCosts.controller';
import * as recruitmentCtrl from '../controllers/recruitment.controller';
import * as competencyMatrixCtrl from '../controllers/competencyMatrix.controller';
import * as absenceCtrl from '../controllers/absence.controller';
import * as fireLogCtrl from '../controllers/fireLog.controller';
import * as visitorsCtrl from '../controllers/visitors.controller';
import * as roomTurnoverCtrl from '../controllers/roomTurnover.controller';
import * as reportBuilderCtrl from '../controllers/reportBuilder.controller';
import * as offlineSyncCtrl from '../controllers/offlineSync.controller';
import * as residentTabletCtrl from '../controllers/residentTablet.controller';
import * as qrRoomCtrl from '../controllers/qrRoom.controller';
import * as benchmarkingCtrl from '../controllers/benchmarking.controller';
import * as boardPackCtrl from '../controllers/boardPack.controller';
import * as staffPerformanceCtrl from '../controllers/staffPerformance.controller';
import * as elearningCtrl from '../controllers/elearning.controller';
import * as competencySignoffCtrl from '../controllers/competencySignoff.controller';
import * as diabetesCtrl from '../controllers/diabetes.controller';
import * as palliativeCareCtrl from '../controllers/palliativeCare.controller';
import * as musicTherapyCtrl from '../controllers/musicTherapy.controller';
import * as menuChoiceCtrl from '../controllers/menuChoice.controller';
import * as friendshipMapperCtrl from '../controllers/friendshipMapper.controller';
import * as purposePlannerCtrl from '../controllers/purposePlanner.controller';
import * as moodEnvironmentCtrl from '../controllers/moodEnvironment.controller';
import * as photoFrameCtrl from '../controllers/photoFrame.controller';
import * as sleepTrackerCtrl from '../controllers/sleepTracker.controller';
import * as intergenerationalCtrl from '../controllers/intergenerational.controller';
import * as rehabGoalsCtrl from '../controllers/rehabGoals.controller';
import * as celebrationsCtrl from '../controllers/celebrations.controller';
import * as aiCarePlanCtrl from '../controllers/aiCarePlan.controller';
import * as admissionMatchingCtrl from '../controllers/admissionMatching.controller';
import * as wellbeingHeatmapCtrl from '../controllers/wellbeingHeatmap.controller';
import * as regulatoryReportingCtrl from '../controllers/regulatoryReporting.controller';
import * as smartHandoverCtrl from '../controllers/smartHandover.controller';
import * as consentManagerCtrl from '../controllers/consentManager.controller';
import * as digitalTwinCtrl from '../controllers/digitalTwin.controller';
import * as environmentalIntelCtrl from '../controllers/environmentalIntel.controller';
import * as housekeepingCtrl from '../controllers/housekeeping.controller';
import * as homeCtrl from '../controllers/home.controller';
import { upload, csvUpload } from '../middleware/upload'; // getBillingSummary added
import { validateBody, guardWriteBody } from '../middleware/validate';
import * as schemas from '../schemas';
import * as aiService from '../services/ai.service';
import { query, withTransaction } from '../models/db';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errors';

const router = Router();

// Baseline write-body validation on every POST/PUT/PATCH (defence-in-depth)
router.use(guardWriteBody);

// ── Auth (public) ─────────────────────────────────────────────────────────
router.post('/auth/login', authCtrl.login);
router.post('/auth/refresh', authCtrl.refreshToken);
router.post('/auth/family-register', authCtrl.familyRegister);
router.post('/auth/logout', authenticate, authCtrl.logout);
router.post('/auth/change-password', authenticate, authCtrl.changePassword);
router.get('/auth/me', authenticate, (req, res) => res.json(req.user));

// All routes below require authentication + tenant guard
router.use(authenticate, tenantGuard);

// ── Outcomes / impact analytics ───────────────────────────────────────────
router.get('/analytics/outcomes', isManager, analyticsCtrl.getOutcomes);

// ── Family access management (manager) ────────────────────────────────────
router.get('/family-access',                 isManager, familyAccessCtrl.listFamilyAccess);
router.post('/family-access/provision',      isManager, familyAccessCtrl.provisionFamily);
router.post('/family-access/invite',         isManager, familyAccessCtrl.createFamilyInvite);
router.post('/family-access/:linkId/revoke', isManager, familyAccessCtrl.revokeFamilyLink);
router.delete('/family-access/invite/:id',   isManager, familyAccessCtrl.revokeInvite);

// ── Family member portal (role: family) ───────────────────────────────────
router.get('/portal/me',              isFamily, portalCtrl.me);
router.get('/portal/feed',            isFamily, portalCtrl.feed);
router.get('/portal/photos',          isFamily, portalCtrl.photos);
router.get('/portal/messages',        isFamily, portalCtrl.messages);
router.post('/portal/messages',       isFamily, portalCtrl.sendMessage);
router.get('/portal/care-highlights', isFamily, portalCtrl.careHighlights);

// ── Residents ─────────────────────────────────────────────────────────────
router.get('/residents',            isAllStaff, residentsCtrl.listResidents);
router.patch('/residents/:id/mobility', isStaff, residentsCtrl.updateMobilityStatus);
router.get('/residents/:id',        isAllStaff, residentsCtrl.getResident);
router.post('/residents',           isManager, validateBody(schemas.createResidentSchema), residentsCtrl.createResident);
router.patch('/residents/:id',      isManager, validateBody(schemas.updateResidentSchema), residentsCtrl.updateResident);
router.post('/residents/:id/discharge', isManager, residentsCtrl.dischargeResident);

// ── Care Notes ────────────────────────────────────────────────────────────
router.get('/care-notes',           isStaff, notesCtrl.listNotes);
router.post('/care-notes',          isStaff, validateBody(schemas.createNoteSchema), notesCtrl.createNote);
router.patch('/care-notes/:id',     isStaff, notesCtrl.updateNote);
router.delete('/care-notes/:id',    isManager, notesCtrl.deleteNote);

// ── eMAR ──────────────────────────────────────────────────────────────────
router.get('/emar',                 isStaff, emarCtrl.getEmar);
router.post('/emar/administer',     isClinical, validateBody(schemas.recordAdministrationSchema), emarCtrl.recordAdministration);
router.get('/emar/missed-report',   isManager, emarCtrl.getMissedDosesReport);
router.get('/medications',          isStaff, emarCtrl.listMedications);
router.post('/medications',         isClinical, emarCtrl.createMedication);
router.delete('/medications/:id',   isClinical, emarCtrl.discontinueMedication);

// ── Incidents ─────────────────────────────────────────────────────────────
router.get('/incidents',            isStaff, incidentsCtrl.listIncidents);
router.post('/incidents',           isStaff, validateBody(schemas.createIncidentSchema), incidentsCtrl.createIncident);
router.patch('/incidents/:id/status', isStaff, validateBody(schemas.updateIncidentStatusSchema), incidentsCtrl.updateIncidentStatus);

// ── Scheduling ────────────────────────────────────────────────────────────
router.get('/schedule',             isStaff, scheduleCtrl.getWeekRota);
router.post('/schedule/shift',      isManager, validateBody(schemas.upsertShiftSchema), scheduleCtrl.upsertShift);
router.delete('/schedule/:staffId/:date', isManager, scheduleCtrl.deleteShift);

// ── Staff ─────────────────────────────────────────────────────────────────
// Lightweight colleague directory (no HR/pay data) — for note co-authors etc.
router.get('/staff/colleagues', isAllStaff, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sp.id, u.first_name, u.last_name, u.role, sp.job_title
         FROM staff_profiles sp
         JOIN users u ON u.id = sp.user_id
        WHERE sp.care_home_id = $1 AND u.active = TRUE AND u.deleted_at IS NULL
        ORDER BY u.last_name, u.first_name`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});
router.get('/staff/:id', isManager, async (req, res, next) => {
  try {
    const { rows: [staff] } = await query(
      `SELECT sp.*, u.first_name, u.last_name, u.email, u.role
       FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND sp.care_home_id = $2`,
      [req.params.id, req.user!.care_home_id]
    );
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    res.json(staff);
  } catch (err) { next(err); }
});
router.patch('/staff/:id', isManager, async (req, res, next) => {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { jobTitle, contractHours, hourlyRate, dbsNumber, dbsExpires } = req.body;
    const { rows: [sp] } = await query(
      `UPDATE staff_profiles SET
         job_title = COALESCE($1, job_title),
         contract_hours = COALESCE($2, contract_hours),
         hourly_rate = COALESCE($3, hourly_rate),
         dbs_number = COALESCE($4, dbs_number),
         dbs_expires = COALESCE($5, dbs_expires)
       WHERE id = $6 AND care_home_id = $7 RETURNING *`,
      [jobTitle, contractHours, hourlyRate, dbsNumber, dbsExpires, id, careHomeId]
    );
    if (!sp) return res.status(404).json({ error: 'Staff not found' });
    res.json(sp);
  } catch (err) { next(err); }
});
router.get('/staff', isManager, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sp.*, u.first_name, u.last_name, u.email, u.role, u.phone, u.last_login,
        JSON_AGG(jsonb_build_object(
          'id', tr.id, 'course', tr.course_name,
          'expires', tr.expiry_date, 'status', tr.status
        )) FILTER (WHERE tr.id IS NOT NULL) AS training
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN training_records tr ON tr.staff_id = sp.id
       WHERE sp.care_home_id = $1 AND u.active = TRUE AND u.deleted_at IS NULL
       GROUP BY sp.id, u.first_name, u.last_name, u.email, u.role, u.phone, u.last_login
       ORDER BY u.last_name, u.first_name`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Create a staff member (user account + staff profile) in one transaction
router.post('/staff', isManager, validateBody(schemas.createStaffSchema), async (req, res, next) => {
  try {
    const careHomeId = req.user!.care_home_id;
    const {
      email, password, firstName, lastName, role, phone,
      jobTitle, department, contractHours, hourlyRate,
      dbsNumber, dbsExpires, employeeNumber, startDate,
    } = req.body;

    const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) return res.status(409).json({ error: 'A user with that email already exists' });

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));

    const created = await withTransaction(async (client) => {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (care_home_id, email, password_hash, role, first_name, last_name, phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, email, role, first_name, last_name, phone`,
        [careHomeId, email, passwordHash, role || 'carer', firstName, lastName, phone || null]
      );
      const { rows: [profile] } = await client.query(
        `INSERT INTO staff_profiles
           (user_id, care_home_id, employee_number, job_title, department,
            start_date, contract_hours, hourly_rate, dbs_number, dbs_expires)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [user.id, careHomeId, employeeNumber || null, jobTitle || null, department || null,
         startDate || null, contractHours ?? null, hourlyRate ?? null, dbsNumber || null, dbsExpires || null]
      );
      return { ...profile, ...user };
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// ── Training ──────────────────────────────────────────────────────────────
router.get('/training', isManager, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT tr.*, sp.id AS staff_profile_id,
        u.first_name || ' ' || u.last_name AS staff_name, u.role
       FROM training_records tr
       JOIN staff_profiles sp ON sp.id = tr.staff_id
       JOIN users u ON u.id = sp.user_id
       WHERE tr.care_home_id = $1
       ORDER BY tr.expiry_date ASC`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/training/:id', isManager, async (req, res, next) => {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { completedDate, expiryDate, status, provider, notes } = req.body;
    const { rows: [tr] } = await query(
      `UPDATE training_records SET
         completed_date = COALESCE($1, completed_date),
         expiry_date = COALESCE($2, expiry_date),
         status = COALESCE($3, status),
         provider = COALESCE($4, provider),
         notes = COALESCE($5, notes)
       WHERE id = $6 AND care_home_id = $7 RETURNING *`,
      [completedDate, expiryDate, status, provider, notes, id, careHomeId]
    );
    if (!tr) return res.status(404).json({ error: 'Training record not found' });
    res.json(tr);
  } catch (err) { next(err); }
});
router.post('/training', isManager, async (req, res, next) => {
  try {
    const { staffId, courseName, provider, completedDate, expiryDate, notes } = req.body;
    const { rows: [tr] } = await query(
      `INSERT INTO training_records (care_home_id, staff_id, course_name, provider, completed_date, expiry_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user!.care_home_id, staffId, courseName, provider, completedDate, expiryDate, notes, req.user!.id]
    );
    res.status(201).json(tr);
  } catch (err) { next(err); }
});

// ── Compliance ────────────────────────────────────────────────────────────




// ── AI Insights ───────────────────────────────────────────────────────────
router.get('/ai/validate-data',                    isManager,  aiInsightsCtrl.validateCareData);
router.get('/ai/insights/:residentId',             isClinical, aiInsightsCtrl.generateResidentInsights);
router.get('/ai/care-quality',                     isManager,  aiInsightsCtrl.careQualityDashboard);

// ── Notifications ─────────────────────────────────────────────────────────
router.get('/notifications',              isStaff,   notificationsCtrl.listNotifications);
router.post('/notifications/read-all',    isStaff,   notificationsCtrl.markAllRead);
router.patch('/notifications/:id/read',   isStaff,   notificationsCtrl.markRead);
router.post('/notifications/generate',    isStaff,   notificationsCtrl.generateAlerts);

// ── AI Handover & Care Plan ───────────────────────────────────────────────
router.get('/ai/handover',                isClinical, aiHandoverCtrl.generateHandover);
router.get('/ai/care-plan/:residentId',   isManager,  aiHandoverCtrl.generateCarePlan);

// ── Weight Tracking ───────────────────────────────────────────────────────
router.get('/weights',                                isStaff,   weightCtrl.getAllWeights);
router.get('/residents/:residentId/weights',          isStaff,   weightCtrl.getWeightHistory);
router.post('/residents/:residentId/weights',         isClinical, weightCtrl.recordWeight);

// ── Activities ────────────────────────────────────────────────────────────
router.get('/activities',                             isStaff, activitiesCtrl.listActivities);
router.get('/activities/sessions',                    isStaff, activitiesCtrl.listSessions);
router.get('/activities/wellbeing-dashboard',         isStaff, activitiesCtrl.getWellbeingDashboard);
router.get('/activities/:id',                         isStaff, activitiesCtrl.getActivity);
router.get('/activities/:id/eligible-residents',      isStaff, activitiesCtrl.getEligibleResidents);
router.post('/activities',                            isStaff, activitiesCtrl.createActivity);
router.patch('/activities/:id',                       isStaff, activitiesCtrl.updateActivity);
router.delete('/activities/:id',                      isManager, activitiesCtrl.deleteActivity);
router.post('/activities/sessions',                   isStaff, activitiesCtrl.createSession);
router.get('/activities/sessions/:id/participants',   isStaff, activitiesCtrl.getSessionParticipants);
router.post('/activities/sessions/:id/participants',  isStaff, activitiesCtrl.addParticipant);
router.patch('/activities/sessions/:sessionId/participants/:residentId', isStaff, activitiesCtrl.updateParticipant);
router.delete('/activities/sessions/:sessionId/participants/:residentId', isStaff, activitiesCtrl.removeParticipant);
router.get('/residents/:id/activities',               isStaff, activitiesCtrl.getResidentActivityHistory);

// ── Wellbeing ─────────────────────────────────────────────────────────────
router.post('/wellbeing/log',                             isStaff, wellbeingCtrl.logWellbeing);
router.get('/wellbeing/overview',                         isStaff, wellbeingCtrl.getWellbeingOverview);
router.get('/wellbeing/isolation-alerts',                 isStaff, wellbeingCtrl.getSocialIsolationAlerts);
router.patch('/wellbeing/isolation-alerts/:id',           isStaff, wellbeingCtrl.acknowledgeSocialAlert);
router.post('/wellbeing/generate-isolation-alerts',       isManager, wellbeingCtrl.generateIsolationAlerts);
// ── Real-time Wellbeing Heatmap (must be before :residentId param route) ──
router.get('/wellbeing/heatmap',               isStaff, wellbeingHeatmapCtrl.getHeatmap);
router.get('/wellbeing/heatmap/history',       isStaff, wellbeingHeatmapCtrl.getHeatmapHistory);
router.get('/wellbeing/heatmap/room/:roomNumber', isStaff, wellbeingHeatmapCtrl.getRoomDetail);
router.get('/wellbeing/:residentId',                      isStaff, wellbeingCtrl.getResidentWellbeing);
router.get('/residents/:id/life-story',                   isStaff, wellbeingCtrl.getResidentLifeStory);
router.put('/residents/:id/life-story',                   isStaff, wellbeingCtrl.updateResidentLifeStory);
router.get('/residents/:id/environment',                  isStaff, wellbeingCtrl.getEnvironmentPreferences);
router.put('/residents/:id/environment',                  isStaff, wellbeingCtrl.updateEnvironmentPreferences);


// -- Predictive Care
router.get('/predictive/dashboard',                           isClinical,  predictiveCareCtrl.getRiskDashboard);
router.post('/predictive/residents/:residentId/risk',          isClinical, predictiveCareCtrl.calculateFallsRisk);
router.get('/predictive/residents/:residentId/history',       isClinical, predictiveCareCtrl.getRiskHistory);
router.get('/predictive/alerts',                              isClinical,  predictiveCareCtrl.getAlerts);
router.patch('/predictive/alerts/:id/acknowledge',            isClinical,  predictiveCareCtrl.acknowledgeAlert);
router.post('/predictive/analyze',                            isClinical,  predictiveCareCtrl.runPredictiveAnalysis);


// ── Controlled Drug Register ─────────────────────────────────────────────
router.get('/medications/cd-register',    isClinical, async (req, res, next) => {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.query;
    const where = residentId
      ? 'WHERE cdr.care_home_id=$1 AND cdr.resident_id=$2'
      : 'WHERE cdr.care_home_id=$1';
    const params = residentId ? [careHomeId, residentId] : [careHomeId];
    const { rows } = await query(
      `SELECT cdr.*,
         r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
         u1.first_name || ' ' || u1.last_name AS administered_by_name, u1.role AS administered_by_role,
         u2.first_name || ' ' || u2.last_name AS witnessed_by_name
       FROM cd_register cdr
       JOIN residents r ON r.id=cdr.resident_id
       JOIN users u1 ON u1.id=cdr.administered_by
       LEFT JOIN users u2 ON u2.id=cdr.witnessed_by
       ${where}
       ORDER BY cdr.administration_time DESC LIMIT 200`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/medications/cd-register',   isClinical, async (req, res, next) => {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, medicationName, dose, quantity, administeredBy, witnessedBy, balance, notes, administrationTime } = req.body;
    const { rows: [entry] } = await query(
      `INSERT INTO cd_register (care_home_id, resident_id, medication_name, dose, quantity, administered_by, witnessed_by, balance, notes, administration_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [careHomeId, residentId, medicationName, dose, quantity, administeredBy, witnessedBy||null, balance, notes||null, administrationTime||new Date()]
    );
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// ── Photos & Belongings ───────────────────────────────────────────────────
router.post('/residents/:id/photo',           isStaff,   upload.single('photo'), photosCtrl.uploadResidentPhoto);
router.delete('/residents/:id/photo',         isStaff,   photosCtrl.removeResidentPhoto);
router.get('/residents/:residentId/belongings',    isStaff,   photosCtrl.listBelongings);
router.post('/residents/:residentId/belongings',   isStaff,   upload.single('photo'), photosCtrl.uploadBelongingPhoto);
router.delete('/belongings/:id',              isStaff,   photosCtrl.deleteBelonging);
router.post('/staff/avatar',                  isStaff,   upload.single('photo'), photosCtrl.uploadStaffAvatar);

// ── Care Tasks ────────────────────────────────────────────────────────────
router.get('/tasks',                  isStaff,   tasksCtrl.listTasks);
router.post('/tasks/generate',        isStaff,   tasksCtrl.generateDailyTasks);
router.post('/tasks/seed-templates',  isStaff,   tasksCtrl.seedTemplates);
router.get('/tasks/templates',        isStaff,   tasksCtrl.listTemplates);
router.post('/tasks/templates',       isManager, validateBody(schemas.taskTemplateSchema), tasksCtrl.createTemplate);
router.patch('/tasks/templates/:id',  isManager, tasksCtrl.updateTemplate);
router.delete('/tasks/templates/:id', isManager, tasksCtrl.deleteTemplate);
router.get('/residents/:id/care-plan',   isStaff,   tasksCtrl.getResidentCarePlan);
router.post('/residents/:id/task-exclusion', isManager, tasksCtrl.setTaskExclusion);
router.post('/tasks/:id/complete',    isStaff,   tasksCtrl.completeTask);
router.post('/tasks/:id/defer',       isStaff,   tasksCtrl.deferTask);
router.post('/tasks/:id/start',       isStaff,   tasksCtrl.startTask);
router.post('/tasks/:id/release',     isStaff,   tasksCtrl.releaseTask);
router.get('/tasks/stream',           isStaff,   tasksCtrl.sseStream);

router.get('/compliance/actions', isManager, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ca.*, u.first_name||' '||u.last_name AS assigned_name
       FROM compliance_actions ca
       LEFT JOIN users u ON u.id = ca.assigned_to
       WHERE ca.care_home_id = $1 ORDER BY ca.due_date ASC NULLS LAST`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/compliance/actions', isManager, async (req, res, next) => {
  try {
    const { title, description, kloeDomain, priority, dueDate, assignedTo } = req.body;
    const { rows: [action] } = await query(
      `INSERT INTO compliance_actions (care_home_id, title, description, kloe_domain, priority, due_date, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user!.care_home_id, title, description, kloeDomain, priority, dueDate, assignedTo, req.user!.id]
    );
    res.status(201).json(action);
  } catch (err) { next(err); }
});

router.patch('/compliance/actions/:id', isManager, async (req, res, next) => {
  try {
    const { status, evidenceNotes } = req.body;
    const { rows: [action] } = await query(
      `UPDATE compliance_actions SET status = $1, evidence_notes = $2,
        completed_by = $3, completed_at = $4
       WHERE id = $5 AND care_home_id = $6 RETURNING *`,
      [status, evidenceNotes, status==='closed'?req.user!.id:null, status==='closed'?new Date():null,
       req.params.id, req.user!.care_home_id]
    );
    res.json(action);
  } catch (err) { next(err); }
});

// -- CQC Compliance
router.get('/compliance/cqc-scores',                 isManager, cqcComplianceCtrl.getDomainScores);
router.post('/compliance/cqc-scores/calculate',      isManager, cqcComplianceCtrl.calculateDomainScores);
router.post('/compliance/evidence-pack',             isManager, cqcComplianceCtrl.generateEvidencePack);
router.get('/compliance/evidence-packs',             isManager, cqcComplianceCtrl.getEvidencePacks);
router.get('/compliance/policy-reviews',             isManager, cqcComplianceCtrl.getPolicyReviewStatus);
router.post('/compliance/policy-reviews',            isManager, cqcComplianceCtrl.createPolicyReview);
router.get('/compliance/inspection-checklist/:domain', isManager, cqcComplianceCtrl.getInspectionChecklist);
router.patch('/compliance/inspection-checklist/:id/item', isManager, cqcComplianceCtrl.updateChecklistItem);
router.get('/compliance/overview',                   isManager, cqcComplianceCtrl.getComplianceOverview);

router.post('/policies', isManager, async (req, res, next) => {
  try {
    const careHomeId = req.user!.care_home_id;
    const { title, category, content, reviewDate } = req.body;
    const { rows: [policy] } = await query(
      `INSERT INTO policies (care_home_id, title, category, content, review_date, created_by, version)
       VALUES ($1,$2,$3,$4,$5,$6,1) RETURNING *`,
      [careHomeId, title, category, content, reviewDate, req.user!.id]
    );
    res.status(201).json(policy);
  } catch (err) { next(err); }
});
router.get('/policies', isStaff, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM policies WHERE care_home_id = $1 ORDER BY title',
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Family Portal ─────────────────────────────────────────────────────────
router.get('/family/messages', isStaff, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT fm.*, r.first_name||' '||r.last_name AS resident_name
       FROM family_messages fm
       JOIN residents r ON r.id = fm.resident_id
       WHERE fm.care_home_id = $1 ORDER BY fm.created_at DESC`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/family/messages', isStaff, async (req, res, next) => {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, recipientName, recipientEmail, subject, body } = req.body;
    const fromName = `${req.user!.first_name} ${req.user!.last_name}`;
    const { rows: [msg] } = await query(
      `INSERT INTO family_messages (care_home_id, resident_id, sender_id, from_user_id, from_name, recipient_name, recipient_email, subject, body, direction, read)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,'outbound',FALSE) RETURNING *`,
      [careHomeId, residentId, req.user!.id, fromName, recipientName, recipientEmail, subject, body]
    );
    res.status(201).json(msg);
  } catch (err) { next(err); }
});
router.patch('/family/messages/:id/read', isStaff, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [msg] } = await query(
      `UPDATE family_messages SET read_at = NOW() WHERE id = $1 AND care_home_id = $2 RETURNING *`,
      [id, req.user!.care_home_id]
    );
    res.json(msg || { id, read: true });
  } catch (err) { next(err); }
});
router.get('/family/contacts/:residentId', isStaff, async (req, res, next) => {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT DISTINCT recipient_name, recipient_email FROM family_messages
       WHERE care_home_id = $1 AND resident_id = $2 ORDER BY recipient_name`,
      [careHomeId, residentId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});
router.post('/family/messages/:id/reply', isStaff, async (req, res, next) => {
  try {
    const { body } = req.body;
    const careHomeId = req.user!.care_home_id;
    const { rows: [parent] } = await query(
      'SELECT * FROM family_messages WHERE id = $1 AND care_home_id = $2',
      [req.params.id, careHomeId]
    );
    if (!parent) return next(new AppError(404, 'Message not found'));

    await query(
      'UPDATE family_messages SET read = TRUE, read_at = NOW() WHERE id = $1', [parent.id]
    );
    const { rows: [reply] } = await query(
      `INSERT INTO family_messages (care_home_id, resident_id, from_user_id, from_name, body, parent_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [careHomeId, parent.resident_id, req.user!.id,
       `${req.user!.first_name} ${req.user!.last_name}`, body, parent.id]
    );
    res.status(201).json(reply);
  } catch (err) { next(err); }
});

// ── Family Portal (Enhanced) ──────────────────────────────────────────────
router.get('/family/dashboard/:residentId',                isStaff,   familyPortalCtrl.getFamilyDashboard);
router.get('/family/daily-summary/:residentId',            isStaff,   familyPortalCtrl.getDailySummary);
router.post('/family/daily-summary/:residentId/generate',  isStaff,   familyPortalCtrl.generateDailySummary);
router.get('/family/weekly-report/:residentId',            isStaff,   familyPortalCtrl.getWeeklyReport);
router.post('/family/weekly-reports/generate',             isManager, familyPortalCtrl.generateWeeklyReports);
router.get('/family/photos/:residentId',                   isStaff,   familyPortalCtrl.listPhotos);
router.post('/family/photos/:residentId',                  isStaff,   upload.single('photo'), familyPortalCtrl.uploadFamilyPhoto);

// -- Voice & SBAR
router.post('/voice/transcribe',              isStaff, upload.single('audio'), voiceSbarCtrl.transcribeAudio);
router.post('/voice/create-note',             isStaff, voiceSbarCtrl.createNoteFromVoice);
router.get('/voice/history',                  isStaff, voiceSbarCtrl.getVoiceHistory);
router.post('/sbar/generate',                 isClinical, voiceSbarCtrl.generateSbarHandover);
router.get('/sbar/handovers',                 isClinical, voiceSbarCtrl.listSbarHandovers);
router.get('/sbar/handovers/:id',             isClinical, voiceSbarCtrl.getSbarHandover);
router.patch('/sbar/handovers/:id/approve',   isClinical, voiceSbarCtrl.approveSbarHandover);

// -- NEWS2 Auto-Calculator
router.post('/news2/calculate', isStaff, news2Ctrl.calculateNews2Score);
router.get('/news2/history', isStaff, news2Ctrl.getAssessmentHistory);
router.get('/news2/escalations', isStaff, news2Ctrl.getEscalationHistory);
router.patch('/news2/escalations/:id', isClinical, news2Ctrl.respondToEscalation);
router.get('/news2/trend', isStaff, news2Ctrl.getResidentTrend);

// -- Wound Photography Timeline
router.post('/wounds', isClinical, upload.single('photo'), woundsCtrl.createWoundAssessment);
router.get('/wounds', isClinical, woundsCtrl.listActiveWounds);
router.get('/wounds/:residentId/timeline', isClinical, woundsCtrl.getWoundTimeline);
router.get('/wounds/:residentId/body-map', isClinical, woundsCtrl.getBodyMapOverview);
router.patch('/wounds/:id', isClinical, woundsCtrl.updateWoundAssessment);

// -- Infection Outbreak Tracker
router.post('/infections/outbreaks', isClinical, infectionsCtrl.createOutbreak);
router.get('/infections/outbreaks', isClinical, infectionsCtrl.listOutbreaks);
router.get('/infections/outbreaks/:id', isStaff, infectionsCtrl.getOutbreakDetails);
router.post('/infections/outbreaks/:outbreakId/cases', isClinical, infectionsCtrl.addInfectionCase);
router.patch('/infections/cases/:id', isClinical, infectionsCtrl.updateCaseStatus);
router.patch('/infections/outbreaks/:id/status', isClinical, infectionsCtrl.updateOutbreakStatus);
router.get('/infections/outbreaks/:id/timeline', isStaff, infectionsCtrl.getOutbreakTimeline);

// -- Continence Assessment
router.post('/continence/log', isStaff, continenceCtrl.logContinenceEvent);
router.post('/continence/assessment', isClinical, continenceCtrl.createAssessment);
router.get('/continence/overview', isStaff, continenceCtrl.getHomeOverview);
router.get('/continence/:residentId', isStaff, continenceCtrl.getResidentLog);
router.get('/continence/:residentId/patterns', isStaff, continenceCtrl.getPatternAnalysis);
router.get('/continence/:residentId/assessment', isStaff, continenceCtrl.getAssessment);

// -- Smart Rota Builder
router.post('/smart-rota/generate', isManager, smartRotaCtrl.generateRota);
router.get('/smart-rota/templates', isManager, smartRotaCtrl.listRotaTemplates);
router.get('/smart-rota/templates/:id', isManager, smartRotaCtrl.getRotaTemplate);
router.patch('/smart-rota/shifts/:id', isManager, smartRotaCtrl.updateRotaShift);
router.post('/smart-rota/templates/:id/publish', isManager, smartRotaCtrl.publishRota);
router.get('/smart-rota/constraints', isManager, smartRotaCtrl.getStaffConstraints);
router.post('/smart-rota/upload-csv', isManager, csvUpload.single('file'), smartRotaCtrl.uploadRotaCsv);

// -- Natural Language Search
router.post('/search/nl', isStaff, nlSearchCtrl.search);
router.get('/search/nl/history', isStaff, nlSearchCtrl.getSearchHistory);

// -- Automated Risk Assessments
router.post('/risk-assessments/waterlow', isClinical, riskAssessmentsCtrl.calculateWaterlow);
router.post('/risk-assessments/must', isClinical, riskAssessmentsCtrl.calculateMUST);
router.post('/risk-assessments/falls', isClinical, riskAssessmentsCtrl.calculateFallsRisk);
router.get('/risk-assessments/overdue', isClinical, riskAssessmentsCtrl.getOverdueReviews);
router.get('/risk-assessments/overview', isClinical, riskAssessmentsCtrl.getHomeRiskOverview);
router.get('/risk-assessments/:residentId', isClinical, riskAssessmentsCtrl.getResidentAssessments);

// -- Medication Interaction Checker
router.post('/med-interactions/check', isClinical, medInteractionsCtrl.checkInteractions);
router.get('/med-interactions/alerts', isClinical, medInteractionsCtrl.getInteractionAlerts);
router.get('/med-interactions/:residentId', isClinical, medInteractionsCtrl.getResidentInteractions);
router.patch('/med-interactions/:id/acknowledge', isClinical, medInteractionsCtrl.acknowledgeInteraction);

// ── Billing ───────────────────────────────────────────────────────────────
router.get('/invoices/summary',     isFinance, billingCtrl.getBillingSummary);
router.get('/invoices',             isFinance, billingCtrl.listInvoices);
router.post('/invoices',            isFinance, validateBody(schemas.createInvoiceSchema), billingCtrl.createInvoice);
router.patch('/invoices/:id/status', isFinance, billingCtrl.updateInvoiceStatus);

// ── Enhanced Invoicing (Finance) ──────────────────────────────────────────
router.get('/invoicing/rate-uplifts',           isFinance, invoicingCtrl.listRateUplifts);
router.post('/invoicing/rate-uplifts',          isFinance, invoicingCtrl.createRateUplift);
router.patch('/invoicing/rate-uplifts/:id',     isFinance, invoicingCtrl.approveRateUplift);
router.post('/invoicing/payment-reminders',     isFinance, invoicingCtrl.sendPaymentReminder);
router.get('/invoicing/payment-reminders',      isFinance, invoicingCtrl.listPaymentReminders);
router.get('/invoicing/revenue-dashboard',      isFinance, invoicingCtrl.getRevenueDashboard);

// ── Occupancy Forecasting (Finance) ──────────────────────────────────────
router.post('/occupancy',                       isFinance, occupancyCtrl.recordOccupancy);
router.get('/occupancy/history',                isFinance, occupancyCtrl.getOccupancyHistory);
router.post('/occupancy/forecasts',             isFinance, occupancyCtrl.generateForecast);
router.get('/occupancy/forecasts',              isFinance, occupancyCtrl.getForecasts);
router.get('/occupancy/dashboard',              isFinance, occupancyCtrl.getOccupancyDashboard);

// ── Staff Cost Analytics (Finance) ───────────────────────────────────────
router.post('/staff-costs',                     isFinance, staffCostsCtrl.recordStaffCost);
router.get('/staff-costs/summary',              isFinance, staffCostsCtrl.getStaffCostsSummary);
router.get('/staff-costs/per-resident',         isFinance, staffCostsCtrl.getCostPerResident);
router.get('/staff-costs/budget-vs-actual',     isFinance, staffCostsCtrl.getBudgetVsActual);
router.get('/staff-costs/budgets',              isFinance, staffCostsCtrl.listBudgets);
router.post('/staff-costs/budgets',             isFinance, staffCostsCtrl.createBudget);

// ── Recruitment Pipeline (HR) ─────────────────────────────────────────────
router.get('/recruitment/postings',             isManager, recruitmentCtrl.listJobPostings);
router.post('/recruitment/postings',            isManager, recruitmentCtrl.createJobPosting);
router.patch('/recruitment/postings/:id',       isManager, recruitmentCtrl.updateJobPosting);
router.get('/recruitment/applications',         isManager, recruitmentCtrl.listApplications);
router.post('/recruitment/applications',        isManager, recruitmentCtrl.createApplication);
router.patch('/recruitment/applications/:id/stage', isManager, recruitmentCtrl.updateApplicationStage);
router.get('/recruitment/interviews',           isManager, recruitmentCtrl.listInterviews);
router.post('/recruitment/interviews',          isManager, recruitmentCtrl.scheduleInterview);
router.patch('/recruitment/interviews/:id/outcome', isManager, recruitmentCtrl.updateInterviewOutcome);
router.post('/recruitment/dbs-checks',          isManager, recruitmentCtrl.createDbsCheck);
router.patch('/recruitment/dbs-checks/:id',     isManager, recruitmentCtrl.updateDbsCheck);
router.get('/recruitment/pipeline',             isManager, recruitmentCtrl.getPipelineOverview);

// ── Competency Matrix (HR) ────────────────────────────────────────────────
router.get('/competencies',                     isManager, competencyMatrixCtrl.listCompetencies);
router.post('/competencies',                    isManager, competencyMatrixCtrl.createCompetency);
router.get('/competencies/staff',               isManager, competencyMatrixCtrl.listStaffCompetencies);
router.post('/competencies/staff',              isManager, competencyMatrixCtrl.assignStaffCompetency);
router.patch('/competencies/staff/:id',         isManager, competencyMatrixCtrl.updateStaffCompetency);
router.get('/competencies/matrix',              isManager, competencyMatrixCtrl.getCompetencyMatrix);
router.get('/competencies/expiring',            isManager, competencyMatrixCtrl.getExpiringCompetencies);

// ── Absence & Sickness (HR) ──────────────────────────────────────────────
router.post('/absence',                         isManager, absenceCtrl.recordAbsence);
router.get('/absence',                          isManager, absenceCtrl.listAbsences);
router.post('/absence/bradford-score',          isManager, absenceCtrl.calculateBradfordScore);
router.get('/absence/bradford-scores',          isManager, absenceCtrl.getBradfordScores);
router.get('/absence/patterns',                 isManager, absenceCtrl.getAbsencePatterns);
router.get('/absence/return-to-work-due',       isManager, absenceCtrl.getReturnToWorkDue);
router.patch('/absence/:id/return-to-work',     isManager, absenceCtrl.completeReturnToWork);
router.get('/absence/dashboard',                isManager, absenceCtrl.getAbsenceDashboard);

// ── Fire Log Book (Facilities) ────────────────────────────────────────────
router.post('/fire-log/tests',                  isManager, fireLogCtrl.recordFireTest);
router.get('/fire-log/tests',                   isManager, fireLogCtrl.listFireTests);
router.post('/fire-log/equipment-checks',       isManager, fireLogCtrl.recordEquipmentCheck);
router.get('/fire-log/equipment-checks',        isManager, fireLogCtrl.listEquipmentChecks);
router.get('/fire-log/overdue-checks',          isManager, fireLogCtrl.getOverdueChecks);
router.post('/fire-log/peeps',                  isManager, fireLogCtrl.createPeep);
router.get('/fire-log/peeps',                   isManager, fireLogCtrl.listPeeps);
router.patch('/fire-log/peeps/:id',             isManager, fireLogCtrl.updatePeep);
router.get('/fire-log/dashboard',               isManager, fireLogCtrl.getFireDashboard);

// ── Visitor Sign-In (Facilities) ─────────────────────────────────────────
router.post('/visitors/sign-in',                isStaff, visitorsCtrl.signInVisitor);
router.patch('/visitors/:id/sign-out',          isStaff, visitorsCtrl.signOutVisitor);
router.get('/visitors',                         isStaff, visitorsCtrl.listVisitors);
router.get('/visitors/dashboard',               isStaff, visitorsCtrl.getVisitorDashboard);
router.get('/visitors/fire-roll',               isStaff, visitorsCtrl.getFireRoll);
router.get('/visitors/history/:residentId',     isStaff, visitorsCtrl.getVisitorHistory);
router.post('/visitors/safeguarding',           isStaff, visitorsCtrl.addSafeguardingFlag);
router.get('/visitors/safeguarding',            isStaff, visitorsCtrl.listSafeguardingFlags);

// ── Room Turnover (Facilities) ────────────────────────────────────────────
router.post('/room-turnovers',                  isFacilities, roomTurnoverCtrl.createTurnover);
router.get('/room-turnovers',                   isFacilities, roomTurnoverCtrl.listTurnovers);
router.patch('/room-turnovers/:id/status',      isFacilities, roomTurnoverCtrl.updateTurnoverStatus);
router.post('/room-turnovers/checklist',        isFacilities, roomTurnoverCtrl.addChecklistItem);
router.patch('/room-turnovers/checklist/:id/complete', isFacilities, roomTurnoverCtrl.completeChecklistItem);
router.get('/room-turnovers/:turnoverId/checklist', isFacilities, roomTurnoverCtrl.getChecklistItems);
router.get('/room-turnovers/dashboard',         isFacilities, roomTurnoverCtrl.getTurnoverDashboard);

// ── Custom Report Builder ─────────────────────────────────────────────────
router.get('/reports/templates',                isManager, reportBuilderCtrl.listReportTemplates);
router.post('/reports/templates',               isManager, reportBuilderCtrl.createReportTemplate);
router.get('/reports/templates/:id',            isManager, reportBuilderCtrl.getReportTemplate);
router.patch('/reports/templates/:id',          isManager, reportBuilderCtrl.updateReportTemplate);
router.delete('/reports/templates/:id',         isManager, reportBuilderCtrl.deleteReportTemplate);
router.post('/reports/run',                     isManager, reportBuilderCtrl.runReport);
router.get('/reports/runs',                     isManager, reportBuilderCtrl.listReportRuns);
router.get('/reports/runs/:id',                 isManager, reportBuilderCtrl.getReportRun);
router.get('/reports/data-sources',             isManager, reportBuilderCtrl.getAvailableDataSources);

// ── Offline Sync (Mobile) ─────────────────────────────────────────────────
router.post('/offline-sync/queue',              isStaff, offlineSyncCtrl.queueOfflineAction);
router.post('/offline-sync/sync',               isStaff, offlineSyncCtrl.syncOfflineActions);
router.get('/offline-sync/conflicts',           isStaff, offlineSyncCtrl.getConflicts);
router.patch('/offline-sync/conflicts/:id',     isStaff, offlineSyncCtrl.resolveConflict);

// ── Resident Tablet ───────────────────────────────────────────────────────
router.post('/tablet/requests',                 isStaff, residentTabletCtrl.createRequest);
router.get('/tablet/requests',                  isStaff, residentTabletCtrl.listRequests);
router.patch('/tablet/requests/:id',            isStaff, residentTabletCtrl.acknowledgeRequest);
router.get('/tablet/residents/:residentId',     isStaff, residentTabletCtrl.getResidentView);

// ── QR Room Codes ─────────────────────────────────────────────────────────
router.post('/qr-rooms',                        isManager, qrRoomCtrl.generateQrCode);
router.get('/qr-rooms',                         isStaff, qrRoomCtrl.getQrCodes);
router.get('/qr-rooms/scan/:code',              isStaff, qrRoomCtrl.scanQrCode);
router.patch('/qr-rooms/:id/deactivate',        isManager, qrRoomCtrl.deactivateQrCode);

// ── Benchmarking KPIs ─────────────────────────────────────────────────────
router.get('/benchmarking/dashboard',           isManager, benchmarkingCtrl.getDashboard);
router.post('/benchmarking/calculate',          isManager, benchmarkingCtrl.calculateKpis);
router.get('/benchmarking/metrics/:metricName', isManager, benchmarkingCtrl.getMetricHistory);
router.get('/benchmarking/national-averages',   isManager, benchmarkingCtrl.getNationalAverages);

// ── Board Pack Reports ────────────────────────────────────────────────────
router.post('/board-packs',                     isManager, boardPackCtrl.generateBoardPack);
router.get('/board-packs',                      isManager, boardPackCtrl.listBoardPacks);
router.get('/board-packs/:id',                  isManager, boardPackCtrl.getBoardPack);
router.patch('/board-packs/:id/approve',        isManager, boardPackCtrl.approveBoardPack);

// ── Staff Performance Metrics ─────────────────────────────────────────────
router.get('/staff-performance/team',           isManager, staffPerformanceCtrl.getTeamMetrics);
router.get('/staff-performance/response-times', isManager, staffPerformanceCtrl.getResponseTimes);
router.post('/staff-performance/calculate',     isManager, staffPerformanceCtrl.calculateMetrics);
router.get('/staff-performance/:staffId',       isManager, staffPerformanceCtrl.getIndividualMetrics);

// ── E-Learning ────────────────────────────────────────────────────────────
router.get('/elearning/modules',                isStaff, elearningCtrl.listModules);
router.post('/elearning/modules',               isManager, elearningCtrl.createModule);
router.get('/elearning/modules/:id',            isStaff, elearningCtrl.getModule);
router.post('/elearning/modules/:moduleId/quiz', isManager, elearningCtrl.createQuiz);
router.post('/elearning/modules/:moduleId/quiz/submit', isStaff, elearningCtrl.submitQuizAttempt);
router.get('/elearning/completions',            isStaff, elearningCtrl.getCompletions);
router.get('/elearning/progress/:staffId',      isManager, elearningCtrl.getStaffProgress);
router.get('/elearning/mandatory-status',       isStaff, elearningCtrl.getMandatoryStatus);

// ── Competency Signoffs ───────────────────────────────────────────────────
router.post('/competency-signoffs',             isClinical, competencySignoffCtrl.createSignoff);
router.get('/competency-signoffs',              isClinical, competencySignoffCtrl.listSignoffs);
router.get('/competency-signoffs/:id',          isClinical, competencySignoffCtrl.getSignoff);
router.patch('/competency-signoffs/:id',        isClinical, competencySignoffCtrl.updateSignoff);
router.get('/competency-signoffs/staff/:staffId', isManager, competencySignoffCtrl.getStaffSignoffs);

// ── Diabetes Management ───────────────────────────────────────────────────
router.post('/diabetes/glucose',                isStaff, diabetesCtrl.logGlucose);
router.get('/diabetes/glucose/:residentId',     isStaff, diabetesCtrl.getGlucoseReadings);
router.post('/diabetes/insulin',                isClinical, diabetesCtrl.logInsulinDose);
router.get('/diabetes/insulin/:residentId',     isStaff, diabetesCtrl.getInsulinDoses);
router.post('/diabetes/hba1c',                  isClinical, diabetesCtrl.recordHba1c);
router.get('/diabetes/hba1c/:residentId',       isStaff, diabetesCtrl.getHba1cHistory);
router.get('/diabetes/alerts',                  isStaff, diabetesCtrl.getAlerts);
router.patch('/diabetes/alerts/:id',            isClinical, diabetesCtrl.acknowledgeAlert);
router.get('/diabetes/patterns/:residentId',    isStaff, diabetesCtrl.getGlucosePatterns);

// ── Palliative Care ───────────────────────────────────────────────────────
router.post('/palliative/care-plans',                   isClinical, palliativeCareCtrl.createCarePlan);
router.get('/palliative/care-plans/:residentId',        isClinical, palliativeCareCtrl.getCarePlan);
router.patch('/palliative/care-plans/:id',              isClinical, palliativeCareCtrl.updateCarePlan);
router.post('/palliative/comfort-rounds',               isClinical, palliativeCareCtrl.scheduleComfortRound);
router.patch('/palliative/comfort-rounds/:id',          isClinical, palliativeCareCtrl.completeComfortRound);
router.get('/palliative/comfort-rounds/:residentId',    isClinical, palliativeCareCtrl.getComfortRounds);
router.post('/palliative/anticipatory-meds',            isClinical, palliativeCareCtrl.addAnticipatoryMed);
router.get('/palliative/anticipatory-meds/:residentId', isClinical, palliativeCareCtrl.getAnticipatoryMeds);
router.patch('/palliative/anticipatory-meds/:id',       isClinical, palliativeCareCtrl.administerAnticipatoryMed);
router.post('/palliative/family-communications',        isClinical, palliativeCareCtrl.logFamilyCommunication);
router.get('/palliative/family-communications/:residentId', isClinical, palliativeCareCtrl.getFamilyCommunications);

// ── Personal Music Therapy ────────────────────────────────────────────
router.get('/music-therapy/genres',                        isStaff, musicTherapyCtrl.getGenreLibrary);
router.get('/music-therapy/preferences/:residentId',       isStaff, musicTherapyCtrl.getResidentPreferences);
router.post('/music-therapy/preferences',                  isStaff, musicTherapyCtrl.updateResidentPreferences);
router.post('/music-therapy/sessions',                     isStaff, musicTherapyCtrl.startSession);
router.patch('/music-therapy/sessions/:id/end',            isStaff, musicTherapyCtrl.endSession);
router.get('/music-therapy/sessions/:residentId',          isStaff, musicTherapyCtrl.getSessionHistory);
router.get('/music-therapy/effectiveness',                 isStaff, musicTherapyCtrl.getEffectivenessReport);

// ── Personal Menu Choice System ───────────────────────────────────────
router.get('/menu-choices/options',                        isAllStaff, menuChoiceCtrl.listMenuOptions);
router.post('/menu-choices/options',                       isManager, menuChoiceCtrl.createMenuOption);
router.patch('/menu-choices/options/:id',                  isManager, menuChoiceCtrl.updateMenuOption);
router.delete('/menu-choices/options/:id',                 isManager, menuChoiceCtrl.deleteMenuOption);
router.get('/menu-choices/dietary-profile/:residentId',    isAllStaff, menuChoiceCtrl.getResidentDietaryProfile);
router.put('/menu-choices/dietary-profile/:residentId',    isAllStaff, menuChoiceCtrl.updateResidentDietaryProfile);
router.post('/menu-choices',                               isStaff, menuChoiceCtrl.submitMenuChoice);
router.get('/menu-choices/kitchen-dashboard',              isAllStaff, menuChoiceCtrl.getKitchenDashboard);
router.get('/menu-choices/residents/:residentId',          isAllStaff, menuChoiceCtrl.getResidentChoices);

// ── Friendship Mapper ─────────────────────────────────────────────────
router.post('/friendship-mapper/observations',             isStaff, friendshipMapperCtrl.recordObservation);
router.get('/friendship-mapper/connections/:residentId',   isStaff, friendshipMapperCtrl.getResidentConnections);
router.get('/friendship-mapper/network',                   isStaff, friendshipMapperCtrl.getNetworkGraph);
router.get('/friendship-mapper/seating-suggestions',       isStaff, friendshipMapperCtrl.getSeatingSuggestions);
router.get('/friendship-mapper/isolated',                  isStaff, friendshipMapperCtrl.getIsolatedResidents);

// ── Daily Purpose Planner ─────────────────────────────────────────────
router.get('/purpose-planner/roles',                       isStaff, purposePlannerCtrl.listRoles);
router.post('/purpose-planner/roles',                      isStaff, purposePlannerCtrl.createRole);
router.post('/purpose-planner/assign',                     isStaff, purposePlannerCtrl.assignRole);
router.get('/purpose-planner/residents/:residentId',       isStaff, purposePlannerCtrl.getResidentRoles);
router.post('/purpose-planner/engagement',                 isStaff, purposePlannerCtrl.logEngagement);
router.get('/purpose-planner/report',                      isStaff, purposePlannerCtrl.getEngagementReport);
router.get('/purpose-planner/suggestions/:residentId',     isStaff, purposePlannerCtrl.suggestNewRoles);

// ── Mood-Responsive Environment ───────────────────────────────────────
router.get('/mood-environment/suggestions/:residentId',    isStaff, moodEnvironmentCtrl.getInterventionSuggestions);
router.post('/mood-environment/interventions',             isStaff, moodEnvironmentCtrl.recordIntervention);
router.get('/mood-environment/history/:residentId',        isStaff, moodEnvironmentCtrl.getInterventionHistory);
router.get('/mood-environment/effectiveness',              isStaff, moodEnvironmentCtrl.getEffectivenessReport);

// ── Digital Photo Frame Feed ──────────────────────────────────────────
router.post('/photo-frame/photos',                         isStaff, photoFrameCtrl.uploadPhoto);
router.get('/photo-frame/photos/:residentId',              isStaff, photoFrameCtrl.listPhotos);
router.patch('/photo-frame/photos/:id/approve',            isStaff, photoFrameCtrl.approvePhoto);
router.patch('/photo-frame/photos/:id/reject',             isStaff, photoFrameCtrl.rejectPhoto);
router.patch('/photo-frame/photos/:id/schedule',           isStaff, photoFrameCtrl.schedulePhoto);
router.get('/photo-frame/viewing-history/:residentId',     isStaff, photoFrameCtrl.getViewingHistory);
router.post('/photo-frame/views',                          isStaff, photoFrameCtrl.logView);

// ── Sleep Quality Tracker ─────────────────────────────────────────────
router.post('/sleep-tracker/logs',                         isStaff, sleepTrackerCtrl.logSleep);
router.get('/sleep-tracker/history/:residentId',           isStaff, sleepTrackerCtrl.getSleepHistory);
router.get('/sleep-tracker/profile/:residentId',           isStaff, sleepTrackerCtrl.getSleepProfile);
router.get('/sleep-tracker/disturbances/:residentId',      isStaff, sleepTrackerCtrl.getDisturbancePatterns);
router.get('/sleep-tracker/suggestions/:residentId',       isStaff, sleepTrackerCtrl.getSleepSuggestions);

// ── Intergenerational Programme Manager ───────────────────────────────
router.post('/intergenerational/programmes',               isStaff, intergenerationalCtrl.createProgramme);
router.get('/intergenerational/programmes',                isStaff, intergenerationalCtrl.listProgrammes);
router.post('/intergenerational/visits',                   isStaff, intergenerationalCtrl.createVisit);
router.get('/intergenerational/visits',                    isStaff, intergenerationalCtrl.listVisits);
router.post('/intergenerational/participants',             isStaff, intergenerationalCtrl.addParticipant);
router.patch('/intergenerational/visits/:id/outcome',      isStaff, intergenerationalCtrl.logOutcome);
router.get('/intergenerational/safeguarding/:programmeId', isStaff, intergenerationalCtrl.getSafeguardingRequirements);
router.get('/intergenerational/wellbeing-impact',          isStaff, intergenerationalCtrl.getWellbeingImpact);

// ── Rehabilitation Goal Tracker ───────────────────────────────────────
router.post('/rehab-goals',                                isClinical, rehabGoalsCtrl.createGoal);
router.get('/rehab-goals/residents/:residentId',           isStaff, rehabGoalsCtrl.getResidentGoals);
router.post('/rehab-goals/milestones',                     isClinical, rehabGoalsCtrl.addMilestone);
router.patch('/rehab-goals/milestones/:id',                isClinical, rehabGoalsCtrl.updateMilestoneProgress);
router.post('/rehab-goals/progress',                       isStaff, rehabGoalsCtrl.logProgress);
router.patch('/rehab-goals/:id/celebrate',                 isStaff, rehabGoalsCtrl.celebrateAchievement);
router.get('/rehab-goals/report/:residentId',              isStaff, rehabGoalsCtrl.getProgressReport);

// ── Birthday & Celebration Planner ────────────────────────────────────
router.get('/celebrations/upcoming',                       isStaff, celebrationsCtrl.getUpcoming);
router.post('/celebrations',                               isStaff, celebrationsCtrl.createCelebration);
router.post('/celebrations/tasks',                         isStaff, celebrationsCtrl.assignTask);
router.patch('/celebrations/tasks/:id/complete',           isStaff, celebrationsCtrl.completeTask);
router.get('/celebrations/calendar',                       isStaff, celebrationsCtrl.getCelebrationCalendar);
router.post('/celebrations/:id/notify-family',             isStaff, celebrationsCtrl.notifyFamily);

// ── AI ────────────────────────────────────────────────────────────────────
router.post('/ai/family-summary',   isStaff, aiService.generateFamilySummary);
router.post('/ai/compliance-scan',  isManager, aiService.complianceScan);
router.post('/ai/scheduling',       isManager, aiService.schedulingSuggestions);
router.post('/ai/medication-flags', isClinical, aiService.medicationFlags);

router.get('/ai/audit', isManager, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT al.*, u.first_name||' '||u.last_name AS requested_by_name
       FROM ai_audit_log al
       JOIN users u ON u.id = al.requested_by
       WHERE al.care_home_id = $1 ORDER BY al.created_at DESC LIMIT 100`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── AI Care Plan Writer ───────────────────────────────────────────────────
router.post('/ai/care-plan/generate',          isClinical, aiCarePlanCtrl.generateCarePlan);
router.get('/ai/care-plans',                   isClinical, aiCarePlanCtrl.listCarePlans);
router.get('/ai/care-plans/:id',               isClinical, aiCarePlanCtrl.getCarePlan);
router.patch('/ai/care-plans/:id/approve',     isManager, aiCarePlanCtrl.approveCarePlan);

// ── Predictive Admission Matching ─────────────────────────────────────────
router.post('/admissions/match',               isManager, admissionMatchingCtrl.matchReferral);
router.get('/admissions/referrals',            isManager, admissionMatchingCtrl.listReferrals);
router.post('/admissions/referrals',           isManager, admissionMatchingCtrl.createReferral);
router.patch('/admissions/referrals/:id',      isManager, admissionMatchingCtrl.updateReferralStatus);

// ── Automated Regulatory Reporting ────────────────────────────────────────
router.post('/regulatory/generate-notification', isManager, regulatoryReportingCtrl.generateNotification);
router.get('/regulatory/notifications',        isManager, regulatoryReportingCtrl.listNotifications);
router.patch('/regulatory/notifications/:id',  isManager, regulatoryReportingCtrl.updateNotification);
router.get('/regulatory/deadlines',            isManager, regulatoryReportingCtrl.getDeadlines);

// ── Smart Handover Intelligence ───────────────────────────────────────────
router.post('/handover/smart-generate',        isClinical, smartHandoverCtrl.generateSmartHandover);
router.get('/handover/smart',                  isClinical, smartHandoverCtrl.listSmartHandovers);
router.post('/handover/smart/:id/action',      isClinical, smartHandoverCtrl.recordAction);

// ── Digital Consent Manager ───────────────────────────────────────────────
router.post('/consents',                       isStaff, consentManagerCtrl.createConsent);
router.get('/consents/expiring/all',           isManager, consentManagerCtrl.getExpiringConsents);
router.get('/consents/:residentId',            isStaff, consentManagerCtrl.listConsents);
router.patch('/consents/:id',                  isStaff, consentManagerCtrl.updateConsent);
router.post('/consents/:id/capacity-assessment', isClinical, consentManagerCtrl.recordCapacityAssessment);

// ── Resident Digital Twin ─────────────────────────────────────────────────
router.get('/digital-twin/:residentId',        isStaff, digitalTwinCtrl.getDigitalTwin);
router.get('/digital-twin/:residentId/timeline', isStaff, digitalTwinCtrl.getTimeline);

// ── Environmental Intelligence ────────────────────────────────────────────
router.post('/environment/readings',           isStaff, environmentalIntelCtrl.logReading);
router.get('/environment/dashboard',           isManager, environmentalIntelCtrl.getDashboard);
router.get('/environment/correlations',        isManager, environmentalIntelCtrl.getCorrelations);
router.get('/environment/recommendations',     isManager, environmentalIntelCtrl.getRecommendations);

// ── Audit Log ─────────────────────────────────────────────────────────────
router.get('/audit-log', isManager, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM audit_log WHERE care_home_id = $1
       ORDER BY created_at DESC LIMIT 200`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Reports ───────────────────────────────────────────────────────────────
router.get('/reports/dashboard', isAllStaff, async (req, res, next) => {
  try {
    const careHomeId = req.user!.care_home_id;
    const today = new Date().toISOString().slice(0, 10);

    const [residents, incidents, missedMeds, notes, expiringTraining, unreadMessages] =
      await Promise.all([
        query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE active) AS active,
               COUNT(*) FILTER (WHERE active AND risk_level='high') AS high_risk
               FROM residents WHERE care_home_id = $1`, [careHomeId]),
        query(`SELECT COUNT(*) AS open FROM incidents WHERE care_home_id = $1 AND status != 'closed'`, [careHomeId]),
        query(`SELECT COUNT(*) FROM med_administrations WHERE care_home_id = $1 AND status = 'missed' AND administration_date = $2`, [careHomeId, today]),
        query(`SELECT COUNT(*) FROM care_notes WHERE care_home_id = $1 AND created_at::date = $2 AND deleted_at IS NULL`, [careHomeId, today]),
        query(`SELECT COUNT(*) FROM training_records WHERE care_home_id = $1 AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'`, [careHomeId]),
        query(`SELECT COUNT(*) FROM family_messages WHERE care_home_id = $1 AND read = FALSE AND from_user_id IS NULL`, [careHomeId]),
      ]);

    res.json({
      residents: residents.rows[0],
      openIncidents: incidents.rows[0].open,
      missedMedsToday: missedMeds.rows[0].count,
      notesToday: notes.rows[0].count,
      expiringTraining: expiringTraining.rows[0].count,
      unreadMessages: unreadMessages.rows[0].count,
    });
  } catch (err) { next(err); }
});

// ── Additive REST completeness & workflow endpoints (appended last so
//    specific paths above, e.g. /medications/cd-register, match first) ──────

// CQC KLOE framework (static reference used by the Compliance page)
router.get('/compliance/framework', isStaff, (_req, res) => {
  res.json({
    regulator: 'Care Quality Commission (CQC)',
    domains: [
      { key: 'safe',       title: 'Safe',       question: 'Are people protected from abuse and avoidable harm?' },
      { key: 'effective',  title: 'Effective',  question: 'Does care achieve good outcomes and promote a good quality of life, based on best available evidence?' },
      { key: 'caring',     title: 'Caring',     question: 'Do staff involve and treat people with compassion, kindness, dignity and respect?' },
      { key: 'responsive', title: 'Responsive', question: 'Are services organised to meet people\'s needs?' },
      { key: 'well_led',   title: 'Well-led',   question: 'Do leadership, management and governance assure high-quality, person-centred care?' },
    ],
    ratings: ['Outstanding', 'Good', 'Requires improvement', 'Inadequate'],
  });
});

// Policy: get one / update
router.get('/policies/:id', isStaff, async (req, res, next) => {
  try {
    const { rows: [policy] } = await query(
      'SELECT * FROM policies WHERE id = $1 AND care_home_id = $2',
      [req.params.id, req.user!.care_home_id]
    );
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  } catch (err) { next(err); }
});
router.patch('/policies/:id', isManager, async (req, res, next) => {
  try {
    const { title, category, content, reviewDate, status, version } = req.body;
    const { rows: [policy] } = await query(
      `UPDATE policies SET
         title       = COALESCE($1, title),
         category    = COALESCE($2, category),
         content     = COALESCE($3, content),
         review_date = COALESCE($4, review_date),
         status      = COALESCE($5, status),
         version     = COALESCE($6, version),
         updated_at  = NOW()
       WHERE id = $7 AND care_home_id = $8 RETURNING *`,
      [title, category, content, reviewDate, status, version, req.params.id, req.user!.care_home_id]
    );
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  } catch (err) { next(err); }
});

// Generic get-one endpoints (care-home scoped) for REST completeness
router.get('/care-notes/:id', isStaff, async (req, res, next) => {
  try {
    const { rows: [row] } = await query(
      'SELECT * FROM care_notes WHERE id = $1 AND care_home_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Care note not found' });
    res.json(row);
  } catch (err) { next(err); }
});
router.get('/incidents/:id', isStaff, async (req, res, next) => {
  try {
    const { rows: [row] } = await query(
      'SELECT * FROM incidents WHERE id = $1 AND care_home_id = $2',
      [req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Incident not found' });
    res.json(row);
  } catch (err) { next(err); }
});
router.get('/medications/:id', isStaff, async (req, res, next) => {
  try {
    const { rows: [row] } = await query(
      'SELECT * FROM medications WHERE id = $1 AND care_home_id = $2',
      [req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Medication not found' });
    res.json(row);
  } catch (err) { next(err); }
});
router.get('/invoices/:id', isFinance, async (req, res, next) => {
  try {
    const { rows: [row] } = await query(
      'SELECT * FROM invoices WHERE id = $1 AND care_home_id = $2',
      [req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Invoice not found' });
    res.json(row);
  } catch (err) { next(err); }
});


// ── Housekeeping / cleaning checklists ─────────────────────────────────────
router.get('/housekeeping/tasks',           isAllStaff, housekeepingCtrl.listTasks);
router.get('/housekeeping/rooms',           isAllStaff, housekeepingCtrl.listRooms);
router.get('/housekeeping/communal-areas',  isAllStaff, housekeepingCtrl.listCommunalAreas);
router.get('/housekeeping/logs',            isAllStaff, housekeepingCtrl.listLogs);
router.get('/housekeeping/summary',         isAllStaff, housekeepingCtrl.summary);
router.post('/housekeeping/logs',           isAllStaff, validateBody(schemas.housekeepingLogSchema), housekeepingCtrl.submitLog);


// ── Housekeeping task management (manager) ──────────────────────────────────
router.get('/housekeeping/manage',          isManager, housekeepingCtrl.listManageTasks);
router.post('/housekeeping/manage/copy-defaults', isManager, housekeepingCtrl.copyDefaultTasks);
router.post('/housekeeping/manage',         isManager, housekeepingCtrl.createTask);
router.patch('/housekeeping/manage/:id',    isManager, housekeepingCtrl.updateTask);
router.delete('/housekeeping/manage/:id',   isManager, housekeepingCtrl.deleteTask);

// ── Care home profile & settings (manager) ──────────────────────────────────
router.get('/home',   isStaff,   homeCtrl.getHome);
router.patch('/home',  isManager, homeCtrl.updateHome);


export default router;
