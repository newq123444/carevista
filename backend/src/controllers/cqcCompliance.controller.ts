// src/controllers/cqcCompliance.controller.ts
// CQC Compliance Automation - domain scoring, evidence packs, policy reviews, inspection prep
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { runAiOperation, AI_NOT_CONFIGURED } from '../services/ai.service';

// Default checklist items per CQC domain
const DEFAULT_CHECKLIST_ITEMS: Record<string, { title: string; description: string }[]> = {
  safe: [
    { title: 'Risk assessments up to date', description: 'Verify all resident risk assessments have been reviewed within the last month' },
    { title: 'Incident reporting procedures', description: 'Confirm incident reporting system is accessible and staff are trained' },
    { title: 'Medication management audit', description: 'Check medication storage, administration records, and controlled drugs register' },
    { title: 'Safeguarding policies current', description: 'Ensure safeguarding policies are reviewed and staff have completed training' },
    { title: 'Fire safety checks', description: 'Verify fire drills conducted, equipment tested, and evacuation plans displayed' },
    { title: 'Infection control measures', description: 'Check hand hygiene compliance, PPE availability, and cleaning schedules' },
    { title: 'Staffing levels adequate', description: 'Confirm staffing ratios meet requirements for current resident needs' },
    { title: 'Equipment maintenance records', description: 'Verify all equipment has current safety certificates and maintenance logs' },
  ],
  effective: [
    { title: 'Staff training compliance', description: 'Verify all mandatory training is up to date for all staff' },
    { title: 'Care plan reviews current', description: 'Confirm care plans have been reviewed within required timeframes' },
    { title: 'Nutrition and hydration monitoring', description: 'Check MUST assessments, food/fluid charts, and weight monitoring' },
    { title: 'Health outcome tracking', description: 'Review clinical outcome data and improvement metrics' },
    { title: 'Multi-disciplinary working', description: 'Evidence of GP visits, specialist referrals, and MDT meetings' },
    { title: 'Consent documentation', description: 'Verify mental capacity assessments and consent forms are in place' },
    { title: 'Evidence-based practice', description: 'Confirm care approaches align with current best practice guidance' },
    { title: 'Supervision records', description: 'Check staff supervision and appraisal records are current' },
  ],
  caring: [
    { title: 'Dignity and respect observations', description: 'Evidence of privacy, choice, and dignified care delivery' },
    { title: 'Family engagement records', description: 'Verify regular communication with families and involvement in care' },
    { title: 'Life story work', description: 'Confirm person-centred life stories are in place and used in care planning' },
    { title: 'Resident feedback collected', description: 'Check resident surveys, meetings, and feedback mechanisms' },
    { title: 'End of life care planning', description: 'Verify advance care plans and preferred priorities for care' },
    { title: 'Emotional support evidence', description: 'Records of emotional support, wellbeing activities, and mental health care' },
    { title: 'Cultural and spiritual needs', description: 'Evidence that cultural, religious, and spiritual needs are met' },
    { title: 'Independence promotion', description: 'Examples of supporting residents to maintain independence' },
  ],
  responsive: [
    { title: 'Activity programme variety', description: 'Verify diverse activity programme meeting different interests and abilities' },
    { title: 'Complaints handling', description: 'Review complaints log, response times, and resolution outcomes' },
    { title: 'Person-centred care plans', description: 'Confirm care plans reflect individual preferences and needs' },
    { title: 'Admission process', description: 'Check pre-admission assessments and transition support' },
    { title: 'Daily routine flexibility', description: 'Evidence that residents can choose their own routines' },
    { title: 'Communication needs met', description: 'Verify aids and approaches for residents with communication needs' },
    { title: 'Discharge planning', description: 'Check processes for planned and unplanned discharges' },
    { title: 'Environment personalisation', description: 'Evidence of personalised rooms and communal spaces' },
  ],
  well_led: [
    { title: 'Governance framework', description: 'Review management structure, accountability, and decision-making' },
    { title: 'Quality assurance audits', description: 'Verify regular internal audits are conducted and actioned' },
    { title: 'Policy review schedule', description: 'Confirm all policies are reviewed within their review dates' },
    { title: 'Staff engagement', description: 'Evidence of staff meetings, feedback mechanisms, and morale' },
    { title: 'Regulatory compliance', description: 'Check CQC notifications submitted and conditions met' },
    { title: 'Continuous improvement plan', description: 'Review improvement plans and evidence of progress' },
    { title: 'Partnership working', description: 'Evidence of working with external partners and stakeholders' },
    { title: 'Transparency and openness', description: 'Check duty of candour compliance and open culture evidence' },
  ],
};

// ── Calculate Domain Scores ───────────────────────────────────────────────
export async function calculateDomainScores(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const results: any[] = [];

    // SAFE domain
    const safeScore = await calculateSafeDomain(careHomeId);
    // EFFECTIVE domain
    const effectiveScore = await calculateEffectiveDomain(careHomeId);
    // CARING domain
    const caringScore = await calculateCaringDomain(careHomeId);
    // RESPONSIVE domain
    const responsiveScore = await calculateResponsiveDomain(careHomeId);
    // WELL_LED domain
    const wellLedScore = await calculateWellLedDomain(careHomeId);

    const domainScores = [
      { domain: 'safe', ...safeScore },
      { domain: 'effective', ...effectiveScore },
      { domain: 'caring', ...caringScore },
      { domain: 'responsive', ...responsiveScore },
      { domain: 'well_led', ...wellLedScore },
    ];

    // Store each domain score and generate AI recommendations for scores below 70
    const aiFailures: string[] = [];
    for (const ds of domainScores) {
      let recommendations: string[] = [];

      if (ds.score < 70) {
        try {
          const aiResult = await runAiOperation({
            careHomeId,
            requestedBy: userId,
            operation: 'cqc_domain_recommendations',
            context: { domain: ds.domain, score: ds.score, strengths: ds.strengths, weaknesses: ds.weaknesses },
            prompt: `The CQC domain "${ds.domain}" has scored ${ds.score}/100.
Strengths identified: ${JSON.stringify(ds.strengths)}
Weaknesses identified: ${JSON.stringify(ds.weaknesses)}

Provide 3-5 specific, actionable recommendations to improve this domain score. Focus on practical steps that can be implemented within 30 days. Format as a JSON array of strings.`,
            systemPrompt: `You are a CQC compliance expert helping UK care homes improve their inspection readiness. Provide practical, evidence-based recommendations. Return ONLY a JSON array of recommendation strings, no other text.`,
          });

          if (aiResult === AI_NOT_CONFIGURED) {
            recommendations = [];
          } else {
            try {
              recommendations = JSON.parse(aiResult);
            } catch {
              recommendations = [aiResult];
            }
          }
        } catch (aiErr: any) {
          aiFailures.push(ds.domain);
          recommendations = [`AI recommendations unavailable: ${aiErr.message || 'AI service error'}`];
        }
      }

      const { rows: [inserted] } = await query(
        `INSERT INTO cqc_domain_scores (care_home_id, domain, score, evidence_count, gaps_count, strengths, weaknesses, recommendations, calculated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [
          careHomeId,
          ds.domain,
          ds.score,
          ds.evidenceCount,
          ds.gapsCount,
          JSON.stringify(ds.strengths),
          JSON.stringify(ds.weaknesses),
          JSON.stringify(recommendations),
        ]
      );

      results.push(inserted);
    }

    const response: any = { scores: results, calculatedAt: new Date().toISOString() };
    if (aiFailures.length > 0) {
      response.aiFailures = aiFailures;
      response.note = `AI recommendations could not be generated for domains: ${aiFailures.join(', ')}. Scores are still valid.`;
    }
    res.json(response);
  } catch (err) { next(err); }
}

// ── Get Domain Scores ─────────────────────────────────────────────────────
export async function getDomainScores(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT DISTINCT ON (domain) *
       FROM cqc_domain_scores
       WHERE care_home_id = $1
       ORDER BY domain, calculated_at DESC`,
      [careHomeId]
    );

    res.json({ scores: rows });
  } catch (err) { next(err); }
}

// ── Generate Evidence Pack ────────────────────────────────────────────────
export async function generateEvidencePack(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { domains, dateRangeStart, dateRangeEnd } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'domains array is required' });
    }
    if (!dateRangeStart || !dateRangeEnd) {
      return res.status(400).json({ error: 'dateRangeStart and dateRangeEnd are required' });
    }

    const content: Record<string, any> = {};

    for (const domain of domains) {
      switch (domain) {
        case 'safe':
          content.safe = await collectSafeEvidence(careHomeId, dateRangeStart, dateRangeEnd);
          break;
        case 'effective':
          content.effective = await collectEffectiveEvidence(careHomeId, dateRangeStart, dateRangeEnd);
          break;
        case 'caring':
          content.caring = await collectCaringEvidence(careHomeId, dateRangeStart, dateRangeEnd);
          break;
        case 'responsive':
          content.responsive = await collectResponsiveEvidence(careHomeId, dateRangeStart, dateRangeEnd);
          break;
        case 'well_led':
          content.well_led = await collectWellLedEvidence(careHomeId, dateRangeStart, dateRangeEnd);
          break;
      }
    }

    const { rows: [pack] } = await query(
      `INSERT INTO cqc_evidence_packs (care_home_id, generated_by, domains_included, date_range_start, date_range_end, content, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'complete')
       RETURNING *`,
      [careHomeId, userId, domains, dateRangeStart, dateRangeEnd, JSON.stringify(content)]
    );

    res.status(201).json(pack);
  } catch (err) { next(err); }
}

// ── Get Evidence Packs ────────────────────────────────────────────────────
export async function getEvidencePacks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT * FROM cqc_evidence_packs
       WHERE care_home_id = $1
       ORDER BY created_at DESC`,
      [careHomeId]
    );

    res.json({ packs: rows });
  } catch (err) { next(err); }
}

// ── Get Policy Review Status ──────────────────────────────────────────────
export async function getPolicyReviewStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT p.*,
         pr.id AS latest_review_id,
         pr.review_date AS last_review_date,
         pr.reviewer_id,
         pr.next_review_date,
         pr.status AS review_status,
         pr.changes_made,
         pr.notes AS review_notes,
         CASE WHEN p.review_date < NOW() THEN TRUE ELSE FALSE END AS overdue
       FROM policies p
       LEFT JOIN LATERAL (
         SELECT * FROM policy_reviews
         WHERE policy_id = p.id AND care_home_id = $1
         ORDER BY review_date DESC LIMIT 1
       ) pr ON TRUE
       WHERE p.care_home_id = $1
       ORDER BY p.title`,
      [careHomeId]
    );

    res.json({ policies: rows });
  } catch (err) { next(err); }
}

// ── Create Policy Review ──────────────────────────────────────────────────
export async function createPolicyReview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { policyId, nextReviewDate, changesMade, notes } = req.body;

    if (!policyId) {
      return res.status(400).json({ error: 'policyId is required' });
    }

    // Insert review record
    const { rows: [review] } = await query(
      `INSERT INTO policy_reviews (care_home_id, policy_id, reviewer_id, review_date, next_review_date, status, changes_made, notes)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, 'reviewed', $5, $6)
       RETURNING *`,
      [careHomeId, policyId, userId, nextReviewDate || null, changesMade || null, notes || null]
    );

    // Update the policy's review_date to the next review date
    if (nextReviewDate) {
      await query(
        `UPDATE policies SET review_date = $1 WHERE id = $2 AND care_home_id = $3`,
        [nextReviewDate, policyId, careHomeId]
      );
    }

    res.status(201).json(review);
  } catch (err) { next(err); }
}

// ── Get Inspection Checklist ──────────────────────────────────────────────
export async function getInspectionChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { domain } = req.params;

    if (!DEFAULT_CHECKLIST_ITEMS[domain]) {
      return res.status(400).json({ error: 'Invalid domain. Must be one of: safe, effective, caring, responsive, well_led' });
    }

    // Check for existing checklist
    const { rows: [existing] } = await query(
      `SELECT * FROM inspection_prep_checklists
       WHERE care_home_id = $1 AND domain = $2
       ORDER BY created_at DESC LIMIT 1`,
      [careHomeId, domain]
    );

    if (existing) {
      return res.json(existing);
    }

    // Create a default checklist for this domain
    const defaultItems = DEFAULT_CHECKLIST_ITEMS[domain].map(item => ({
      ...item,
      completed: false,
    }));

    const { rows: [checklist] } = await query(
      `INSERT INTO inspection_prep_checklists (care_home_id, title, domain, items, completed_items, total_items, status, created_by)
       VALUES ($1, $2, $3, $4, 0, $5, 'in_progress', $6)
       RETURNING *`,
      [
        careHomeId,
        `CQC ${domain.replace('_', ' ').toUpperCase()} Domain - Inspection Preparation`,
        domain,
        JSON.stringify(defaultItems),
        defaultItems.length,
        req.user!.id,
      ]
    );

    res.json(checklist);
  } catch (err) { next(err); }
}

// ── Update Checklist Item ─────────────────────────────────────────────────
export async function updateChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { itemIndex, completed } = req.body;

    if (itemIndex === undefined || completed === undefined) {
      return res.status(400).json({ error: 'itemIndex and completed are required' });
    }

    // Get current checklist
    const { rows: [checklist] } = await query(
      `SELECT * FROM inspection_prep_checklists WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    const items = checklist.items;
    if (itemIndex < 0 || itemIndex >= items.length) {
      return res.status(400).json({ error: 'Invalid item index' });
    }

    // Update item completion status
    items[itemIndex].completed = completed;

    // Recalculate completed_items
    const completedItems = items.filter((item: any) => item.completed).length;
    const status = completedItems === items.length ? 'completed' : 'in_progress';

    const { rows: [updated] } = await query(
      `UPDATE inspection_prep_checklists
       SET items = $1, completed_items = $2, status = $3, updated_at = NOW()
       WHERE id = $4 AND care_home_id = $5
       RETURNING *`,
      [JSON.stringify(items), completedItems, status, id, careHomeId]
    );

    res.json(updated);
  } catch (err) { next(err); }
}

// ── Get Compliance Overview ───────────────────────────────────────────────
export async function getComplianceOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Latest domain scores
    const { rows: domainScores } = await query(
      `SELECT DISTINCT ON (domain) domain, score, calculated_at
       FROM cqc_domain_scores
       WHERE care_home_id = $1
       ORDER BY domain, calculated_at DESC`,
      [careHomeId]
    );

    // Overdue policies count
    const { rows: [overdueData] } = await query(
      `SELECT COUNT(*) AS overdue_count
       FROM policies
       WHERE care_home_id = $1 AND review_date < NOW()`,
      [careHomeId]
    );

    // Expiring training in next 30 days
    const { rows: [trainingData] } = await query(
      `SELECT COUNT(*) AS expiring_count
       FROM training_records
       WHERE care_home_id = $1
         AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'`,
      [careHomeId]
    );

    // Open compliance actions
    const { rows: [actionsData] } = await query(
      `SELECT COUNT(*) AS open_count
       FROM compliance_actions
       WHERE care_home_id = $1 AND status != 'closed'`,
      [careHomeId]
    );

    // Calculate overall readiness score (average of 5 domains)
    let overallReadiness = 0;
    if (domainScores.length > 0) {
      const total = domainScores.reduce((sum: number, ds: any) => sum + ds.score, 0);
      overallReadiness = Math.round(total / domainScores.length);
    }

    res.json({
      domainScores,
      overduePolicies: parseInt(overdueData.overdue_count) || 0,
      expiringTraining: parseInt(trainingData.expiring_count) || 0,
      openComplianceActions: parseInt(actionsData.open_count) || 0,
      overallReadiness,
    });
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helper functions for domain score calculations
// ═══════════════════════════════════════════════════════════════════════════

async function calculateSafeDomain(careHomeId: string) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let evidenceCount = 0;
  let gapsCount = 0;

  // Open incidents count
  const { rows: [incidentsData] } = await query(
    `SELECT COUNT(*) AS open_incidents FROM incidents
     WHERE care_home_id = $1 AND status != 'closed'`,
    [careHomeId]
  );
  const openIncidents = parseInt(incidentsData.open_incidents) || 0;
  evidenceCount++;
  if (openIncidents <= 2) strengths.push('Low number of open incidents');
  else { weaknesses.push(`${openIncidents} open incidents requiring attention`); gapsCount++; }

  // Medication errors in last 30 days
  const { rows: [medErrors] } = await query(
    `SELECT COUNT(*) AS error_count FROM med_administrations
     WHERE care_home_id = $1 AND status = 'missed'
       AND administration_date > NOW() - INTERVAL '30 days'`,
    [careHomeId]
  );
  const medErrorCount = parseInt(medErrors.error_count) || 0;
  evidenceCount++;
  if (medErrorCount <= 3) strengths.push('Low medication error rate');
  else { weaknesses.push(`${medErrorCount} medication errors in last 30 days`); gapsCount++; }

  // Falls in last 90 days
  const { rows: [fallsData] } = await query(
    `SELECT COUNT(*) AS falls_count FROM incidents
     WHERE care_home_id = $1 AND incident_type ILIKE '%fall%'
       AND incident_date > NOW() - INTERVAL '90 days'`,
    [careHomeId]
  );
  const fallsCount = parseInt(fallsData.falls_count) || 0;
  evidenceCount++;
  if (fallsCount <= 3) strengths.push('Low falls rate');
  else { weaknesses.push(`${fallsCount} falls in last 90 days`); gapsCount++; }

  // Staffing levels (shifts filled vs required - approximate by checking recent shifts)
  const { rows: [staffingData] } = await query(
    `SELECT COUNT(*) AS total_shifts,
            COUNT(*) FILTER (WHERE confirmed = TRUE) AS filled_shifts
     FROM shifts
     WHERE care_home_id = $1
       AND shift_date >= NOW() - INTERVAL '14 days'
       AND shift_date <= NOW()`,
    [careHomeId]
  );
  const totalShifts = parseInt(staffingData.total_shifts) || 1;
  const filledShifts = parseInt(staffingData.filled_shifts) || 0;
  const staffingRate = totalShifts > 0 ? (filledShifts / totalShifts) * 100 : 100;
  evidenceCount++;
  if (staffingRate >= 90) strengths.push('Strong staffing coverage');
  else { weaknesses.push(`Staffing fill rate at ${Math.round(staffingRate)}%`); gapsCount++; }

  // Calculate score: start at 100, deduct based on issues
  let score = 100;
  score -= Math.min(openIncidents * 5, 20);       // max -20 for incidents
  score -= Math.min(medErrorCount * 3, 20);       // max -20 for med errors
  score -= Math.min(fallsCount * 4, 20);          // max -20 for falls
  score -= Math.max(0, Math.round((100 - staffingRate) * 0.4)); // max -40 for understaffing
  score = Math.max(0, Math.min(100, score));

  return { score, evidenceCount, gapsCount, strengths, weaknesses };
}

async function calculateEffectiveDomain(careHomeId: string) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let evidenceCount = 0;
  let gapsCount = 0;

  // Training compliance (% current)
  const { rows: [trainingData] } = await query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'current' OR expiry_date > NOW()) AS current_count
     FROM training_records
     WHERE care_home_id = $1`,
    [careHomeId]
  );
  const totalTraining = parseInt(trainingData.total) || 1;
  const currentTraining = parseInt(trainingData.current_count) || 0;
  const trainingCompliance = (currentTraining / totalTraining) * 100;
  evidenceCount++;
  if (trainingCompliance >= 85) strengths.push(`Training compliance at ${Math.round(trainingCompliance)}%`);
  else { weaknesses.push(`Training compliance only ${Math.round(trainingCompliance)}%`); gapsCount++; }

  // Care note frequency (avg notes per resident per day over last 7 days)
  const { rows: [noteData] } = await query(
    `SELECT
       (SELECT COUNT(*) FROM care_notes WHERE care_home_id = $1 AND created_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL) AS note_count,
       (SELECT COUNT(*) FROM residents WHERE care_home_id = $1 AND active = TRUE) AS resident_count`,
    [careHomeId]
  );
  const noteCount = parseInt(noteData.note_count) || 0;
  const residentCount = parseInt(noteData.resident_count) || 1;
  const notesPerResidentPerDay = noteCount / (residentCount * 7);
  evidenceCount++;
  if (notesPerResidentPerDay >= 2) strengths.push('Good care documentation frequency');
  else { weaknesses.push('Care note documentation frequency below target'); gapsCount++; }

  // Weight monitoring (% residents weighed in last month)
  const { rows: [weightData] } = await query(
    `SELECT
       (SELECT COUNT(DISTINCT resident_id) FROM resident_weights WHERE care_home_id = $1 AND created_at > NOW() - INTERVAL '30 days') AS weighed,
       (SELECT COUNT(*) FROM residents WHERE care_home_id = $1 AND active = TRUE) AS total_residents`,
    [careHomeId]
  );
  const weighed = parseInt(weightData.weighed) || 0;
  const totalResidents = parseInt(weightData.total_residents) || 1;
  const weightMonitoringRate = (weighed / totalResidents) * 100;
  evidenceCount++;
  if (weightMonitoringRate >= 80) strengths.push(`Weight monitoring at ${Math.round(weightMonitoringRate)}%`);
  else { weaknesses.push(`Only ${Math.round(weightMonitoringRate)}% residents weighed in last month`); gapsCount++; }

  // Calculate score
  let score = 100;
  score -= Math.max(0, Math.round((100 - trainingCompliance) * 0.4)); // max -40
  if (notesPerResidentPerDay < 2) score -= Math.round((2 - notesPerResidentPerDay) * 15); // max -30
  score -= Math.max(0, Math.round((100 - weightMonitoringRate) * 0.3)); // max -30
  score = Math.max(0, Math.min(100, score));

  return { score, evidenceCount, gapsCount, strengths, weaknesses };
}

async function calculateCaringDomain(careHomeId: string) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let evidenceCount = 0;
  let gapsCount = 0;

  // Wellbeing log average mood
  const { rows: [moodData] } = await query(
    `SELECT AVG(mood_score) AS avg_mood, COUNT(*) AS total_logs
     FROM wellbeing_logs
     WHERE care_home_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
    [careHomeId]
  );
  const avgMood = moodData.avg_mood ? parseFloat(moodData.avg_mood) : 3;
  evidenceCount++;
  if (avgMood >= 3.5) strengths.push(`Average resident mood score: ${avgMood.toFixed(1)}/5`);
  else { weaknesses.push(`Low average mood score: ${avgMood.toFixed(1)}/5`); gapsCount++; }

  // Family message response rate
  const { rows: [messageData] } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE direction = 'inbound' OR from_user_id IS NULL) AS inbound,
       COUNT(*) FILTER (WHERE direction = 'inbound' AND read_at IS NOT NULL) AS responded
     FROM family_messages
     WHERE care_home_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
    [careHomeId]
  );
  const inboundMessages = parseInt(messageData.inbound) || 0;
  const respondedMessages = parseInt(messageData.responded) || 0;
  const responseRate = inboundMessages > 0 ? (respondedMessages / inboundMessages) * 100 : 100;
  evidenceCount++;
  if (responseRate >= 80) strengths.push(`Family message response rate: ${Math.round(responseRate)}%`);
  else { weaknesses.push(`Low family message response rate: ${Math.round(responseRate)}%`); gapsCount++; }

  // Life story completion rate
  const { rows: [lifeStoryData] } = await query(
    `SELECT
       (SELECT COUNT(*) FROM resident_life_story rls JOIN residents r ON r.id = rls.resident_id WHERE r.care_home_id = $1) AS with_story,
       (SELECT COUNT(*) FROM residents WHERE care_home_id = $1 AND active = TRUE) AS total_residents`,
    [careHomeId]
  );
  const withStory = parseInt(lifeStoryData.with_story) || 0;
  const totalResidents = parseInt(lifeStoryData.total_residents) || 1;
  const lifeStoryRate = (withStory / totalResidents) * 100;
  evidenceCount++;
  if (lifeStoryRate >= 75) strengths.push(`Life story completion: ${Math.round(lifeStoryRate)}%`);
  else { weaknesses.push(`Life story completion only ${Math.round(lifeStoryRate)}%`); gapsCount++; }

  // Calculate score
  let score = 100;
  score -= Math.max(0, Math.round((3.5 - avgMood) * 20)); // max -40 for low mood
  score -= Math.max(0, Math.round((100 - responseRate) * 0.3)); // max -30 for low response
  score -= Math.max(0, Math.round((100 - lifeStoryRate) * 0.3)); // max -30 for low life story
  score = Math.max(0, Math.min(100, score));

  return { score, evidenceCount, gapsCount, strengths, weaknesses };
}

async function calculateResponsiveDomain(careHomeId: string) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let evidenceCount = 0;
  let gapsCount = 0;

  // Activity participation rate
  const { rows: [activityData] } = await query(
    `SELECT
       (SELECT COUNT(DISTINCT resident_id) FROM activity_participants ap
        JOIN activity_sessions acs ON acs.id = ap.session_id
        WHERE acs.care_home_id = $1 AND acs.session_date > NOW() - INTERVAL '30 days') AS participants,
       (SELECT COUNT(*) FROM residents WHERE care_home_id = $1 AND active = TRUE) AS total_residents`,
    [careHomeId]
  );
  const participants = parseInt(activityData.participants) || 0;
  const totalResidents = parseInt(activityData.total_residents) || 1;
  const participationRate = (participants / totalResidents) * 100;
  evidenceCount++;
  if (participationRate >= 70) strengths.push(`Activity participation: ${Math.round(participationRate)}%`);
  else { weaknesses.push(`Low activity participation: ${Math.round(participationRate)}%`); gapsCount++; }

  // Complaint/concern resolution time (incidents with type complaint/concern)
  const { rows: [complaintData] } = await query(
    `SELECT
       COUNT(*) AS total_complaints,
       COUNT(*) FILTER (WHERE status = 'closed') AS resolved,
       AVG(EXTRACT(EPOCH FROM (updated_at - incident_date)) / 86400) FILTER (WHERE status = 'closed') AS avg_resolution_days
     FROM incidents
     WHERE care_home_id = $1
       AND (incident_type ILIKE '%complaint%' OR incident_type ILIKE '%concern%')
       AND incident_date > NOW() - INTERVAL '90 days'`,
    [careHomeId]
  );
  const totalComplaints = parseInt(complaintData.total_complaints) || 0;
  const resolved = parseInt(complaintData.resolved) || 0;
  const avgResolutionDays = complaintData.avg_resolution_days ? parseFloat(complaintData.avg_resolution_days) : 0;
  evidenceCount++;
  if (totalComplaints === 0 || avgResolutionDays <= 7) strengths.push('Good complaint resolution time');
  else { weaknesses.push(`Average complaint resolution: ${Math.round(avgResolutionDays)} days`); gapsCount++; }

  // Person-centred care evidence (life stories + environment preferences)
  const { rows: [personCentredData] } = await query(
    `SELECT
       (SELECT COUNT(*) FROM resident_life_story rls JOIN residents r ON r.id = rls.resident_id WHERE r.care_home_id = $1) AS life_stories,
       (SELECT COUNT(*) FROM resident_environment_preferences WHERE care_home_id = $1) AS env_prefs`,
    [careHomeId]
  );
  const lifeStories = parseInt(personCentredData.life_stories) || 0;
  const envPrefs = parseInt(personCentredData.env_prefs) || 0;
  const personCentredCount = lifeStories + envPrefs;
  evidenceCount++;
  if (personCentredCount >= totalResidents) strengths.push('Good person-centred care evidence');
  else { weaknesses.push('Limited person-centred care documentation'); gapsCount++; }

  // Calculate score
  let score = 100;
  score -= Math.max(0, Math.round((100 - participationRate) * 0.35)); // max -35
  if (avgResolutionDays > 7) score -= Math.min(30, Math.round((avgResolutionDays - 7) * 3)); // max -30
  if (personCentredCount < totalResidents) {
    score -= Math.max(0, Math.round((1 - personCentredCount / totalResidents) * 35)); // max -35
  }
  score = Math.max(0, Math.min(100, score));

  return { score, evidenceCount, gapsCount, strengths, weaknesses };
}

async function calculateWellLedDomain(careHomeId: string) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let evidenceCount = 0;
  let gapsCount = 0;

  // Compliance action completion rate
  const { rows: [actionData] } = await query(
    `SELECT
       COUNT(*) AS total_actions,
       COUNT(*) FILTER (WHERE status = 'closed') AS completed
     FROM compliance_actions
     WHERE care_home_id = $1`,
    [careHomeId]
  );
  const totalActions = parseInt(actionData.total_actions) || 0;
  const completedActions = parseInt(actionData.completed) || 0;
  const actionCompletionRate = totalActions > 0 ? (completedActions / totalActions) * 100 : 100;
  evidenceCount++;
  if (actionCompletionRate >= 80) strengths.push(`Compliance action completion: ${Math.round(actionCompletionRate)}%`);
  else { weaknesses.push(`Low compliance action completion: ${Math.round(actionCompletionRate)}%`); gapsCount++; }

  // Policy review currency (% policies reviewed within review_date)
  const { rows: [policyData] } = await query(
    `SELECT
       COUNT(*) AS total_policies,
       COUNT(*) FILTER (WHERE review_date >= NOW()) AS current_policies
     FROM policies
     WHERE care_home_id = $1`,
    [careHomeId]
  );
  const totalPolicies = parseInt(policyData.total_policies) || 0;
  const currentPolicies = parseInt(policyData.current_policies) || 0;
  const policyCurrency = totalPolicies > 0 ? (currentPolicies / totalPolicies) * 100 : 100;
  evidenceCount++;
  if (policyCurrency >= 80) strengths.push(`Policy review currency: ${Math.round(policyCurrency)}%`);
  else { weaknesses.push(`Only ${Math.round(policyCurrency)}% policies are current`); gapsCount++; }

  // Audit log activity (indicating active governance)
  const { rows: [auditData] } = await query(
    `SELECT COUNT(*) AS audit_entries
     FROM ai_audit_log
     WHERE care_home_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
    [careHomeId]
  );
  const auditEntries = parseInt(auditData.audit_entries) || 0;
  evidenceCount++;
  if (auditEntries >= 10) strengths.push('Active audit and governance activity');
  else { weaknesses.push('Limited audit activity in last 30 days'); gapsCount++; }

  // Calculate score
  let score = 100;
  score -= Math.max(0, Math.round((100 - actionCompletionRate) * 0.35)); // max -35
  score -= Math.max(0, Math.round((100 - policyCurrency) * 0.35)); // max -35
  if (auditEntries < 10) score -= Math.round((10 - auditEntries) * 3); // max -30
  score = Math.max(0, Math.min(100, score));

  return { score, evidenceCount, gapsCount, strengths, weaknesses };
}

// ═══════════════════════════════════════════════════════════════════════════
// Evidence collection helpers
// ═══════════════════════════════════════════════════════════════════════════

async function collectSafeEvidence(careHomeId: string, startDate: string, endDate: string) {
  const { rows: incidents } = await query(
    `SELECT id, incident_type, severity, status, incident_date, description
     FROM incidents
     WHERE care_home_id = $1 AND incident_date BETWEEN $2 AND $3
     ORDER BY incident_date DESC LIMIT 50`,
    [careHomeId, startDate, endDate]
  );

  const { rows: medAudit } = await query(
    `SELECT status, COUNT(*) AS count
     FROM med_administrations
     WHERE care_home_id = $1 AND administration_date BETWEEN $2 AND $3
     GROUP BY status`,
    [careHomeId, startDate, endDate]
  );

  const { rows: staffing } = await query(
    `SELECT shift_date, COUNT(*) AS staff_count
     FROM shifts
     WHERE care_home_id = $1 AND shift_date BETWEEN $2 AND $3
     GROUP BY shift_date ORDER BY shift_date`,
    [careHomeId, startDate, endDate]
  );

  return {
    incidentsSummary: {
      total: incidents.length,
      incidents: incidents.slice(0, 20),
    },
    medicationAudit: medAudit,
    staffingData: staffing,
  };
}

async function collectEffectiveEvidence(careHomeId: string, startDate: string, endDate: string) {
  const { rows: training } = await query(
    `SELECT tr.id, tr.course_name, tr.status, tr.completed_date, tr.expiry_date,
       u.first_name || ' ' || u.last_name AS staff_name
     FROM training_records tr
     JOIN staff_profiles sp ON sp.id = tr.staff_id
     JOIN users u ON u.id = sp.user_id
     WHERE tr.care_home_id = $1 AND tr.completed_date BETWEEN $2 AND $3
     ORDER BY tr.completed_date DESC LIMIT 50`,
    [careHomeId, startDate, endDate]
  );

  const { rows: careNotes } = await query(
    `SELECT note_type, COUNT(*) AS count
     FROM care_notes
     WHERE care_home_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL
     GROUP BY note_type`,
    [careHomeId, startDate, endDate]
  );

  return {
    trainingRecords: training,
    carePlanSamples: careNotes,
    outcomeData: { period: `${startDate} to ${endDate}` },
  };
}

async function collectCaringEvidence(careHomeId: string, startDate: string, endDate: string) {
  const { rows: messages } = await query(
    `SELECT id, subject, direction, created_at, read_at
     FROM family_messages
     WHERE care_home_id = $1 AND created_at BETWEEN $2 AND $3
     ORDER BY created_at DESC LIMIT 30`,
    [careHomeId, startDate, endDate]
  );

  const { rows: wellbeing } = await query(
    `SELECT AVG(mood_score) AS avg_mood, COUNT(*) AS total_entries,
       COUNT(DISTINCT resident_id) AS residents_covered
     FROM wellbeing_logs
     WHERE care_home_id = $1 AND created_at BETWEEN $2 AND $3`,
    [careHomeId, startDate, endDate]
  );

  const { rows: lifeStories } = await query(
    `SELECT COUNT(*) AS count FROM resident_life_story rls JOIN residents r ON r.id = rls.resident_id WHERE r.care_home_id = $1`,
    [careHomeId]
  );

  return {
    familyFeedback: messages,
    dignityIndicators: wellbeing[0] || {},
    personalization: { lifeStories: parseInt(lifeStories[0]?.count) || 0 },
  };
}

async function collectResponsiveEvidence(careHomeId: string, startDate: string, endDate: string) {
  const { rows: activities } = await query(
    `SELECT a.name, acs.session_date, COUNT(ap.id) AS participant_count
     FROM activity_sessions acs
     JOIN activities a ON a.id = acs.activity_id
     LEFT JOIN activity_participants ap ON ap.session_id = acs.id
     WHERE acs.care_home_id = $1 AND acs.session_date BETWEEN $2 AND $3
     GROUP BY a.name, acs.session_date
     ORDER BY acs.session_date DESC LIMIT 30`,
    [careHomeId, startDate, endDate]
  );

  const { rows: complaints } = await query(
    `SELECT id, incident_type, status, incident_date, description
     FROM incidents
     WHERE care_home_id = $1
       AND (incident_type ILIKE '%complaint%' OR incident_type ILIKE '%concern%')
       AND incident_date BETWEEN $2 AND $3
     ORDER BY incident_date DESC`,
    [careHomeId, startDate, endDate]
  );

  return {
    activitiesData: activities,
    complaintsHandling: complaints,
    individualCarePlans: { period: `${startDate} to ${endDate}` },
  };
}

async function collectWellLedEvidence(careHomeId: string, startDate: string, endDate: string) {
  const { rows: actions } = await query(
    `SELECT id, title, kloe_domain, status, due_date, created_at
     FROM compliance_actions
     WHERE care_home_id = $1 AND created_at BETWEEN $2 AND $3
     ORDER BY created_at DESC LIMIT 30`,
    [careHomeId, startDate, endDate]
  );

  const { rows: policies } = await query(
    `SELECT id, title, category, version, review_date, status
     FROM policies
     WHERE care_home_id = $1
     ORDER BY title`,
    [careHomeId]
  );

  const { rows: auditTrail } = await query(
    `SELECT operation, created_at
     FROM ai_audit_log
     WHERE care_home_id = $1 AND created_at BETWEEN $2 AND $3
     ORDER BY created_at DESC LIMIT 50`,
    [careHomeId, startDate, endDate]
  );

  return {
    governanceRecords: actions,
    policyList: policies,
    auditTrail,
    staffSupervision: { period: `${startDate} to ${endDate}` },
  };
}
