// src/controllers/aiHandover.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { runAiOperation, AI_NOT_CONFIGURED } from '../services/ai.service';

export async function generateHandover(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const hoursBack = parseInt(req.query.hours as string) || 8;

    const [notes, incidents, missedMeds, tasks, flagged] = await Promise.all([
      query(`SELECT cn.content, cn.note_type, cn.is_significant, cn.flagged,
               r.first_name||' '||r.last_name AS resident_name, r.room_number,
               u.first_name||' '||u.last_name AS author
             FROM care_notes cn
             JOIN residents r ON r.id=cn.resident_id
             JOIN users u ON u.id=cn.author_id
             WHERE cn.care_home_id=$1 AND cn.created_at>NOW()-MAKE_INTERVAL(hours=>$2)
             ORDER BY r.room_number, cn.created_at DESC`, [careHomeId, hoursBack]),
      query(`SELECT i.description, i.incident_type, i.severity,
               r.first_name||' '||r.last_name AS resident_name, r.room_number
             FROM incidents i JOIN residents r ON r.id=i.resident_id
             WHERE i.care_home_id=$1 AND i.incident_date>NOW()-MAKE_INTERVAL(hours=>$2)`,
        [careHomeId, hoursBack]),
      query(`SELECT r.first_name||' '||r.last_name AS resident_name, r.room_number,
               m.name AS medication, ma.scheduled_time
             FROM med_administrations ma
             JOIN residents r ON r.id=ma.resident_id
             JOIN medications m ON m.id=ma.medication_id
             WHERE ma.care_home_id=$1 AND ma.status='missed' AND ma.administration_date=CURRENT_DATE`,
        [careHomeId]),
      query(`SELECT ct.task_name, ct.status,
               r.first_name||' '||r.last_name AS resident_name, r.room_number
             FROM care_tasks ct JOIN residents r ON r.id=ct.resident_id
             WHERE ct.care_home_id=$1 AND ct.task_date=CURRENT_DATE AND ct.status IN ('missed','overdue')`,
        [careHomeId]),
      query(`SELECT cn.content, r.first_name||' '||r.last_name AS resident_name, r.room_number
             FROM care_notes cn JOIN residents r ON r.id=cn.resident_id
             WHERE cn.care_home_id=$1 AND cn.flagged=true AND cn.created_at>NOW()-MAKE_INTERVAL(hours=>$2)`,
        [careHomeId, hoursBack]),
    ]);

    const prompt = `Generate a professional shift handover report for a UK care home.

CARE NOTES (last ${hoursBack} hours):
${notes.rows.map((n:any) => `Room ${n.room_number} - ${n.resident_name} [${n.note_type}${n.is_significant?' ⚠SIGNIFICANT':''}${n.flagged?' 🚩FLAGGED':''}]: ${n.content?.slice(0,200)}`).join('\n') || 'None recorded'}

INCIDENTS:
${incidents.rows.map((i:any) => `Room ${i.room_number} - ${i.resident_name}: ${i.incident_type} (${i.severity}) - ${i.description?.slice(0,150)}`).join('\n') || 'None'}

MISSED MEDICATIONS:
${missedMeds.rows.map((m:any) => `${m.resident_name} Room ${m.room_number}: ${m.medication} at ${m.scheduled_time}`).join('\n') || 'None'}

OUTSTANDING TASKS:
${tasks.rows.map((t:any) => `${t.resident_name} Room ${t.room_number}: ${t.task_name} (${t.status})`).join('\n') || 'None'}

FLAGGED NOTES:
${flagged.rows.map((f:any) => `${f.resident_name} Room ${f.room_number}: ${f.content?.slice(0,200)}`).join('\n') || 'None'}

Write a structured handover report with:
1. SHIFT OVERVIEW
2. RESIDENTS REQUIRING MONITORING
3. INCIDENTS & CONCERNS
4. MEDICATIONS
5. OUTSTANDING TASKS
6. ACTIONS FOR INCOMING SHIFT

Be concise but complete. Use professional UK care home language.`;

    const result = await runAiOperation({
      careHomeId, requestedBy: req.user!.id,
      operation: 'handover_report',
      context: { hoursBack },
      prompt,
      systemPrompt: `You are an experienced care home manager writing shift handover reports. 
Write clearly and professionally. Be specific about residents by name and room number. 
This is a legal document - be accurate and factual.`,
    });

    if (result === AI_NOT_CONFIGURED) return res.status(503).json({ error: 'AI features are not enabled. Add ANTHROPIC_API_KEY to the server to generate handovers.' });
    res.json({
      report: result,
      generatedAt: new Date().toISOString(),
      hoursBack,
      stats: {
        notes: notes.rows.length, incidents: incidents.rows.length,
        missedMeds: missedMeds.rows.length, tasks: tasks.rows.length, flagged: flagged.rows.length,
      }
    });
  } catch (err) { next(err); }
}

export async function generateCarePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    const [resident, notes, meds, incidents, weights] = await Promise.all([
      query(`SELECT * FROM residents WHERE id=$1 AND care_home_id=$2`, [residentId, careHomeId]),
      query(`SELECT note_type, content, created_at FROM care_notes WHERE resident_id=$1 ORDER BY created_at DESC LIMIT 20`, [residentId]),
      query(`SELECT name, dose, route, frequency, indication FROM medications WHERE resident_id=$1 AND active=true`, [residentId]),
      query(`SELECT incident_type, severity, description FROM incidents WHERE resident_id=$1 ORDER BY incident_date DESC LIMIT 5`, [residentId]),
      query(`SELECT weight_kg, created_at FROM resident_weights WHERE resident_id=$1 ORDER BY created_at DESC LIMIT 5`, [residentId]),
    ]);

    if (!resident.rows[0]) return res.status(404).json({ error: 'Resident not found' });
    const r = resident.rows[0];

    const prompt = `Generate a comprehensive person-centred care plan for:
Name: ${r.first_name} ${r.last_name}
DOB: ${r.date_of_birth} | Room: ${r.room_number}
Risk: ${r.risk_level} | DNACPR: ${r.dnacpr ? 'YES' : 'No'}
GP: ${r.gp_name || 'Not recorded'} — ${r.gp_practice || ''}
Care Summary: ${r.care_needs_summary || 'See notes'}

MEDICATIONS: ${meds.rows.map((m:any) => `${m.name} ${m.dose} ${m.route}`).join(', ') || 'None'}
RECENT NOTES: ${notes.rows.slice(0,8).map((n:any) => `[${n.note_type}] ${n.content?.slice(0,100)}`).join(' | ')}
INCIDENTS: ${incidents.rows.map((i:any) => `${i.incident_type}(${i.severity})`).join(', ') || 'None'}
WEIGHTS: ${weights.rows.map((w:any) => `${w.weight_kg}kg`).join(', ') || 'Not recorded'}

Write a full person-centred care plan with sections:
1. PERSONAL PROFILE 2. COMMUNICATION 3. PERSONAL CARE 4. NUTRITION & HYDRATION
5. MOBILITY & MOVING 6. CONTINENCE 7. SLEEP & REST 8. HEALTH & MEDICATION
9. SOCIAL & EMOTIONAL WELLBEING 10. SAFETY & RISK 11. END OF LIFE 12. REVIEW DATE

Write compassionately using first name. Note gaps needing family input.`;

    const result = await runAiOperation({
      careHomeId, requestedBy: req.user!.id,
      operation: 'care_plan', context: { residentId }, prompt,
    });

    if (result === AI_NOT_CONFIGURED) return res.status(503).json({ error: 'AI features are not enabled. Add ANTHROPIC_API_KEY to the server to generate care plans.' });
    res.json({ plan: result, resident: r, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}
