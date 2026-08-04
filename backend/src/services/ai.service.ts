import Anthropic from '@anthropic-ai/sdk';
import { query } from '../models/db';
import { logger } from '../utils/logger';

// Only instantiate Anthropic client when API key is available
let anthropic: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Model is configurable via env so it can be updated without a code change.
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

export const AI_NOT_CONFIGURED = 'AI_SERVICE_NOT_CONFIGURED';

// Runtime helpers so callers and health checks can verify AI availability.
export function isAiConfigured(): boolean {
  return !!(anthropic && process.env.ANTHROPIC_API_KEY);
}
export function aiModel(): string { return AI_MODEL; }

export interface AiRequest {
  careHomeId: string;
  requestedBy: string;
  operation: string;
  context: object;
  prompt: string;
  systemPrompt?: string;
  max_tokens?: number;
}

export async function runAiOperation(req: AiRequest): Promise<string> {
  const { careHomeId, requestedBy, operation, context, prompt, systemPrompt, max_tokens } = req;

  // If no API key is configured, return a sentinel value so callers can handle the fallback
  if (!anthropic || !process.env.ANTHROPIC_API_KEY) {
    logger.warn('AI operation skipped: ANTHROPIC_API_KEY not configured');
    // Still audit the attempt
    try {
      await query(
        `INSERT INTO ai_audit_log (
          care_home_id, requested_by, operation, input_context,
          input_tokens, output_tokens, output_summary, model_used, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [careHomeId, requestedBy, operation, JSON.stringify(context),
         0, 0, 'AI service not configured - no API key',
         'none', 'skipped']
      );
    } catch (auditErr: any) {
      logger.error('Failed to audit skipped AI operation:', auditErr.message);
    }
    return AI_NOT_CONFIGURED;
  }

  const system = systemPrompt || `You are an AI assistant embedded in CareVista, a UK care home management system.
You help care home managers and staff with administrative tasks.
IMPORTANT GUIDELINES:
- All outputs are advisory and must be reviewed by qualified humans before any action
- Never make clinical diagnoses or prescribe medications
- Medication pattern flags are administrative observations only — always recommend nurse/GP review
- Maintain resident dignity and confidentiality at all times
- Follow CQC standards and UK care regulations
- Be concise, professional, and compassionate
- Always note that AI suggestions require human approval before implementation`;

  let outputText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let auditStatus = 'success';

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: max_tokens || 1500,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    outputText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('\n');

    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  } catch (err: any) {
    logger.error('AI operation failed:', err.message);
    outputText = `AI service temporarily unavailable: ${err.message}`;
    auditStatus = 'error';
  }

  // Always audit AI operations
  try {
    await query(
      `INSERT INTO ai_audit_log (
        care_home_id, requested_by, operation, input_context,
        input_tokens, output_tokens, output_summary, model_used, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [careHomeId, requestedBy, operation, JSON.stringify(context),
       inputTokens, outputTokens, outputText.slice(0, 500),
       AI_MODEL, auditStatus]
    );
  } catch (auditErr: any) {
    logger.error('Failed to audit AI operation:', auditErr.message);
  }

  return outputText;
}

// ── Build context from DB and call AI ─────────────────────────────────────

import { Request, Response, NextFunction } from 'express';

export async function generateFamilySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.body;

    const { rows: [resident] } = await query(
      'SELECT * FROM residents WHERE id = $1 AND care_home_id = $2',
      [residentId, careHomeId]
    );
    if (!resident) return next(new Error('Resident not found'));

    const { rows: notes } = await query(
      `SELECT cn.content, cn.note_type, cn.created_at, u.first_name||' '||u.last_name AS author
       FROM care_notes cn
       JOIN users u ON u.id = cn.author_id
       WHERE cn.resident_id = $1 AND cn.is_private = FALSE
         AND cn.created_at > NOW() - INTERVAL '7 days'
         AND cn.deleted_at IS NULL
       ORDER BY cn.created_at DESC LIMIT 20`,
      [residentId]
    );

    const notesSummary = notes.map(n =>
      `[${new Date(n.created_at).toLocaleDateString('en-GB')} ${n.note_type}] ${n.content}`
    ).join('\n\n');

    const prompt = `Generate a warm, concise weekly family update for ${resident.first_name} ${resident.last_name} (Room ${resident.room_number}).

Care notes from the past 7 days:
${notesSummary || 'No notes recorded this week.'}

Write a 2-3 paragraph update suitable for sending to the family. Be positive where appropriate, honest about any concerns, and always professional. Do not include clinical diagnoses or specific medication names.`;

    const result = await runAiOperation({
      careHomeId, requestedBy: req.user!.id,
      operation: 'family_summary',
      context: { residentId, noteCount: notes.length },
      prompt,
    });

    res.json({ summary: result, residentId, residentName: `${resident.first_name} ${resident.last_name}` });
  } catch (err) { next(err); }
}

export async function complianceScan(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const [openActions, expiringTraining, openIncidents, missedMeds, overduePlans] = await Promise.all([
      query(`SELECT kloe_domain, COUNT(*) FROM compliance_actions WHERE care_home_id = $1 AND status = 'open' GROUP BY kloe_domain`, [careHomeId]),
      query(`SELECT COUNT(*) FROM training_records WHERE care_home_id = $1 AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'`, [careHomeId]),
      query(`SELECT incident_type, severity, COUNT(*) FROM incidents WHERE care_home_id = $1 AND status != 'closed' GROUP BY incident_type, severity`, [careHomeId]),
      query(`SELECT COUNT(*) FROM med_administrations WHERE care_home_id = $1 AND status = 'missed' AND administration_date > NOW() - INTERVAL '7 days'`, [careHomeId]),
      query(`SELECT COUNT(*) FROM residents WHERE care_home_id = $1 AND active = TRUE`, [careHomeId]),
    ]);

    const prompt = `Perform a CQC compliance gap analysis for a UK care home with the following data:

Open action plan items by KLOE domain:
${openActions.rows.map(r => `- ${r.kloe_domain}: ${r.count} open actions`).join('\n') || 'None'}

Training concerns:
- ${expiringTraining.rows[0]?.count || 0} training certificates expiring in 30 days

Open incidents:
${openIncidents.rows.map(r => `- ${r.incident_type} (${r.severity}): ${r.count}`).join('\n') || 'None'}

Medication administration:
- ${missedMeds.rows[0]?.count || 0} missed doses in last 7 days

Total active residents: ${overduePlans.rows[0]?.count || 0}

Provide a concise gap analysis for each of the 5 CQC KLOE domains (Safe, Effective, Caring, Responsive, Well-led). For each domain, identify the risk level and 1-2 specific actions. Keep it actionable and prioritised.`;

    const result = await runAiOperation({
      careHomeId, requestedBy: req.user!.id,
      operation: 'compliance_scan',
      context: { openActions: openActions.rows, missedMeds: missedMeds.rows[0] },
      prompt,
    });

    res.json({ analysis: result });
  } catch (err) { next(err); }
}

export async function schedulingSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { weekStart, weekEnd } = req.body;

    const { rows: coverage } = await query(
      `SELECT shift_date::text AS date, COUNT(*) AS working_staff
       FROM shifts
       WHERE care_home_id = $1 AND shift_date BETWEEN $2 AND $3
         AND shift_type NOT IN ('off','annual_leave','sick')
       GROUP BY shift_date ORDER BY shift_date`,
      [careHomeId, weekStart, weekEnd]
    );

    const { rows: [{ count: residentCount }] } = await query(
      'SELECT COUNT(*) FROM residents WHERE care_home_id = $1 AND active = TRUE',
      [careHomeId]
    );

    const minStaff = Math.ceil(parseInt(residentCount) / 5); // 1:5 ratio

    const prompt = `Analyse this care home staffing situation and provide scheduling recommendations.

Resident count: ${residentCount} (recommended minimum staff ratio: 1:5 = ${minStaff} minimum per shift)

Current week coverage (${weekStart} to ${weekEnd}):
${coverage.map(d => `- ${d.date}: ${d.working_staff} staff (${parseInt(d.working_staff) < minStaff ? 'UNDERSTAFFED - need '+(minStaff - parseInt(d.working_staff))+' more' : 'adequate'})`).join('\n')}

Provide specific recommendations for any understaffed days. Suggest which approaches to take (overtime offers, agency staff, shift swaps). Be concise and practical.`;

    const result = await runAiOperation({
      careHomeId, requestedBy: req.user!.id,
      operation: 'scheduling_suggest',
      context: { coverage, residentCount, minStaff },
      prompt,
    });

    res.json({ suggestions: result });
  } catch (err) { next(err); }
}

export async function medicationFlags(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows: patterns } = await query(
      `SELECT
        r.first_name||' '||r.last_name AS resident_name, r.room_number,
        m.name AS medication_name, m.dose,
        COUNT(*) FILTER (WHERE ma.status = 'refused') AS refused_count,
        COUNT(*) FILTER (WHERE ma.status = 'missed') AS missed_count,
        COUNT(*) AS total_scheduled,
        MAX(ma.administration_date)::text AS last_date
       FROM med_administrations ma
       JOIN medications m ON m.id = ma.medication_id
       JOIN residents r ON r.id = ma.resident_id
       WHERE ma.care_home_id = $1
         AND ma.administration_date > NOW() - INTERVAL '14 days'
       GROUP BY r.first_name, r.last_name, r.room_number, m.name, m.dose
       HAVING COUNT(*) FILTER (WHERE ma.status IN ('refused','missed')) > 1
       ORDER BY (COUNT(*) FILTER (WHERE ma.status IN ('refused','missed')))::float /
                COUNT(*)::float DESC`,
      [careHomeId]
    );

    if (patterns.length === 0) {
      return res.json({ flags: 'No significant medication administration patterns identified in the last 14 days. All medications appear to be on track.' });
    }

    const prompt = `Review these ADMINISTRATIVE medication administration patterns from the last 14 days and flag any that warrant nurse or GP attention. This is NOT a clinical assessment — administrative observations only.

${patterns.map(p =>
  `- ${p.resident_name} (Room ${p.room_number}): ${p.medication_name} ${p.dose}
   Refused: ${p.refused_count} times | Missed: ${p.missed_count} times | Total scheduled: ${p.total_scheduled}`
).join('\n\n')}

For each flagged pattern, provide: (1) what the pattern is, (2) why it may need review, (3) suggested next step. Always emphasise these are administrative observations requiring clinical review.`;

    const result = await runAiOperation({
      careHomeId, requestedBy: req.user!.id,
      operation: 'medication_flags',
      context: { patternCount: patterns.length },
      prompt,
    });

    res.json({ flags: result, patternCount: patterns.length });
  } catch (err) { next(err); }
}
