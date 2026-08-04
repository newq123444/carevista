import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

// ── Job Postings ──────────────────────────────────────────────────────────

export async function createJobPosting(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { title, department, contractType, hoursPerWeek, salaryRange, description, requirements, status } = req.body;

    if (!title || !department || !contractType) {
      return res.status(400).json({ error: 'title, department, and contractType are required' });
    }

    const { rows: [posting] } = await query(
      `INSERT INTO job_postings (care_home_id, title, department, contract_type, hours_per_week, salary_range, description, requirements, status, created_by, posted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [careHomeId, title, department, contractType, hoursPerWeek, salaryRange, description, requirements, status || 'draft', req.user!.id, status === 'active' ? new Date() : null]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'JOB_POSTING_CREATED', entityType: 'job_posting', entityId: posting.id,
      afterData: { title, department, status: status || 'draft' }, ip: req.ip,
    });
    res.status(201).json(posting);
  } catch (err) { next(err); }
}

export async function listJobPostings(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status } = req.query;
    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (status) { where += ` AND status = $${p++}`; params.push(status); }

    const { rows } = await query(
      `SELECT * FROM job_postings ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function updateJobPosting(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { title, department, contractType, hoursPerWeek, salaryRange, description, requirements, status, closesAt } = req.body;

    const { rows: [posting] } = await query(
      `UPDATE job_postings SET
        title = COALESCE($1, title), department = COALESCE($2, department),
        contract_type = COALESCE($3, contract_type), hours_per_week = COALESCE($4, hours_per_week),
        salary_range = COALESCE($5, salary_range), description = COALESCE($6, description),
        requirements = COALESCE($7, requirements), status = COALESCE($8, status),
        closes_at = COALESCE($9, closes_at),
        posted_at = CASE WHEN $8 = 'active' AND posted_at IS NULL THEN NOW() ELSE posted_at END
       WHERE id = $10 AND care_home_id = $11 RETURNING *`,
      [title, department, contractType, hoursPerWeek, salaryRange, description, requirements, status, closesAt, id, careHomeId]
    );
    if (!posting) throw new AppError(404, 'Job posting not found');
    res.json(posting);
  } catch (err) { next(err); }
}

// ── Applications ──────────────────────────────────────────────────────────

export async function createApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { jobPostingId, applicantName, applicantEmail, applicantPhone, cvUrl, coverLetter, notes } = req.body;

    if (!jobPostingId || !applicantName || !applicantEmail) {
      return res.status(400).json({ error: 'jobPostingId, applicantName, and applicantEmail are required' });
    }

    const { rows: [app] } = await query(
      `INSERT INTO job_applications (care_home_id, job_posting_id, applicant_name, applicant_email, applicant_phone, cv_url, cover_letter, notes, stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'applied') RETURNING *`,
      [careHomeId, jobPostingId, applicantName, applicantEmail, applicantPhone, cvUrl, coverLetter, notes]
    );

    res.status(201).json(app);
  } catch (err) { next(err); }
}

export async function listApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { jobPostingId, stage } = req.query;
    let where = 'WHERE ja.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (jobPostingId) { where += ` AND ja.job_posting_id = $${p++}`; params.push(jobPostingId); }
    if (stage) { where += ` AND ja.stage = $${p++}`; params.push(stage); }

    const { rows } = await query(
      `SELECT ja.*, jp.title AS job_title
       FROM job_applications ja
       JOIN job_postings jp ON jp.id = ja.job_posting_id
       ${where}
       ORDER BY ja.applied_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function updateApplicationStage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { stage, notes } = req.body;

    const { rows: [app] } = await query(
      `UPDATE job_applications SET stage = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND care_home_id = $4 RETURNING *`,
      [stage, notes, id, careHomeId]
    );
    if (!app) throw new AppError(404, 'Application not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'APPLICATION_STAGE_UPDATED', entityType: 'job_application', entityId: id,
      afterData: { stage }, ip: req.ip,
    });
    res.json(app);
  } catch (err) { next(err); }
}

// ── Interviews ────────────────────────────────────────────────────────────

export async function scheduleInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { applicationId, scheduledAt, durationMinutes, interviewers, location, notes } = req.body;

    if (!applicationId || !scheduledAt) {
      return res.status(400).json({ error: 'applicationId and scheduledAt are required' });
    }

    const { rows: [interview] } = await query(
      `INSERT INTO interviews (care_home_id, application_id, scheduled_at, duration_minutes, interviewers, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, applicationId, scheduledAt, durationMinutes || 60, interviewers ? JSON.stringify(interviewers) : null, location, notes]
    );

    res.status(201).json(interview);
  } catch (err) { next(err); }
}

export async function listInterviews(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { applicationId } = req.query;
    let where = 'WHERE i.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (applicationId) { where += ` AND i.application_id = $${p++}`; params.push(applicationId); }

    const { rows } = await query(
      `SELECT i.*, ja.applicant_name, jp.title AS job_title
       FROM interviews i
       JOIN job_applications ja ON ja.id = i.application_id
       JOIN job_postings jp ON jp.id = ja.job_posting_id
       ${where}
       ORDER BY i.scheduled_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function updateInterviewOutcome(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { outcome, notes } = req.body;

    const { rows: [interview] } = await query(
      `UPDATE interviews SET outcome = $1, notes = COALESCE($2, notes)
       WHERE id = $3 AND care_home_id = $4 RETURNING *`,
      [outcome, notes, id, careHomeId]
    );
    if (!interview) throw new AppError(404, 'Interview not found');
    res.json(interview);
  } catch (err) { next(err); }
}

// ── DBS Checks ────────────────────────────────────────────────────────────

export async function createDbsCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { applicationId, staffId, personName, dbsType, certificateNumber, issueDate, notes } = req.body;

    if (!personName || !dbsType) {
      return res.status(400).json({ error: 'personName and dbsType are required' });
    }

    const { rows: [check] } = await query(
      `INSERT INTO dbs_checks (care_home_id, application_id, staff_id, person_name, dbs_type, certificate_number, issue_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8) RETURNING *`,
      [careHomeId, applicationId || null, staffId || null, personName, dbsType, certificateNumber, issueDate, notes]
    );

    res.status(201).json(check);
  } catch (err) { next(err); }
}

export async function updateDbsCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { status, certificateNumber, issueDate, notes } = req.body;

    const { rows: [check] } = await query(
      `UPDATE dbs_checks SET status = COALESCE($1, status), certificate_number = COALESCE($2, certificate_number),
        issue_date = COALESCE($3, issue_date), notes = COALESCE($4, notes)
       WHERE id = $5 AND care_home_id = $6 RETURNING *`,
      [status, certificateNumber, issueDate, notes, id, careHomeId]
    );
    if (!check) throw new AppError(404, 'DBS check not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'DBS_CHECK_UPDATED', entityType: 'dbs_check', entityId: id,
      afterData: { status }, ip: req.ip,
    });
    res.json(check);
  } catch (err) { next(err); }
}

// ── Pipeline Overview ─────────────────────────────────────────────────────

export async function getPipelineOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows: stageCounts } = await query(
      `SELECT stage, COUNT(*)::int AS count
       FROM job_applications WHERE care_home_id = $1
       GROUP BY stage`,
      [careHomeId]
    );

    const { rows: [postingStats] } = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_postings,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_postings,
        COUNT(*) FILTER (WHERE status = 'filled')::int AS filled_postings
       FROM job_postings WHERE care_home_id = $1`,
      [careHomeId]
    );

    const { rows: upcomingInterviews } = await query(
      `SELECT i.*, ja.applicant_name, jp.title AS job_title
       FROM interviews i
       JOIN job_applications ja ON ja.id = i.application_id
       JOIN job_postings jp ON jp.id = ja.job_posting_id
       WHERE i.care_home_id = $1 AND i.scheduled_at >= NOW() AND i.outcome = 'pending'
       ORDER BY i.scheduled_at ASC LIMIT 10`,
      [careHomeId]
    );

    res.json({ stageCounts, postingStats, upcomingInterviews });
  } catch (err) { next(err); }
}
