// src/controllers/voiceSbar.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { runAiOperation, AI_NOT_CONFIGURED } from '../services/ai.service';

// ── Voice Transcription ───────────────────────────────────────────────────

export async function transcribeAudio(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { text, residentId, audioDuration } = req.body;

    // In production this would call Whisper API on req.file.
    // For now the frontend uses Web Speech API and sends text directly.
    const transcriptionText = text;
    if (!transcriptionText) {
      return res.status(400).json({ error: 'No transcription text provided' });
    }

    const { rows: [transcription] } = await query(
      `INSERT INTO voice_transcriptions
         (care_home_id, user_id, resident_id, audio_duration_seconds, transcription_text, confidence_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'transcribed')
       RETURNING *`,
      [careHomeId, userId, residentId || null, audioDuration || null, transcriptionText, 0.95]
    );

    res.status(201).json(transcription);
  } catch (err) { next(err); }
}

export async function createNoteFromVoice(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { transcriptionId, residentId, noteType } = req.body;

    if (!transcriptionId || !residentId) {
      return res.status(400).json({ error: 'transcriptionId and residentId are required' });
    }

    // Retrieve the transcription
    const { rows: [transcription] } = await query(
      `SELECT * FROM voice_transcriptions WHERE id = $1 AND care_home_id = $2`,
      [transcriptionId, careHomeId]
    );
    if (!transcription) {
      return res.status(404).json({ error: 'Transcription not found' });
    }

    // Use AI to clean up and structure the raw transcription
    const cleanedContent = await runAiOperation({
      careHomeId,
      requestedBy: userId,
      operation: 'voice_note_cleanup',
      context: { transcriptionId, residentId, noteType: noteType || 'general' },
      prompt: `You are formatting a voice-dictated care note into a proper written care note for a UK care home.

Raw voice transcription:
"${transcription.transcription_text}"

Note type: ${noteType || 'general'}

Instructions:
- Fix grammar and punctuation
- Add proper structure (short paragraphs if needed)
- Keep the meaning and all clinical details intact
- Use professional UK care home terminology
- Do NOT add information that was not in the original
- Keep it concise and factual
- Output ONLY the cleaned care note text, no headers or labels`,
    });

    // Create the care note
    const { rows: [careNote] } = await query(
      `INSERT INTO care_notes (care_home_id, resident_id, author_id, note_type, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [careHomeId, residentId, userId, noteType || 'general', cleanedContent]
    );

    // Update transcription record
    await query(
      `UPDATE voice_transcriptions SET care_note_id = $1, status = 'converted_to_note' WHERE id = $2`,
      [careNote.id, transcriptionId]
    );

    res.status(201).json(careNote);
  } catch (err) { next(err); }
}

export async function getVoiceHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    const { rows } = await query(
      `SELECT vt.*,
              r.first_name || ' ' || r.last_name AS resident_name
       FROM voice_transcriptions vt
       LEFT JOIN residents r ON r.id = vt.resident_id
       WHERE vt.care_home_id = $1 AND vt.user_id = $2
       ORDER BY vt.created_at DESC
       LIMIT 20`,
      [careHomeId, userId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── SBAR Handover ─────────────────────────────────────────────────────────

export async function generateSbarHandover(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { shiftDate, shiftType } = req.body;

    if (!shiftDate || !shiftType) {
      return res.status(400).json({ error: 'shiftDate and shiftType are required' });
    }

    // Query all relevant shift data
    const [notes, incidents, missedMeds, missedTasks, wellbeing, flaggedNotes] = await Promise.all([
      query(
        `SELECT cn.content, cn.note_type, cn.is_significant, cn.created_at,
                r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
                cn.resident_id
         FROM care_notes cn
         JOIN residents r ON r.id = cn.resident_id
         WHERE cn.care_home_id = $1 AND cn.created_at::date = $2 AND cn.deleted_at IS NULL
           AND cn.is_private = FALSE
         ORDER BY cn.created_at DESC`,
        [careHomeId, shiftDate]
      ),
      query(
        `SELECT i.description, i.incident_type, i.severity, i.status,
                r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
                i.resident_id
         FROM incidents i
         JOIN residents r ON r.id = i.resident_id
         WHERE i.care_home_id = $1 AND i.incident_date::date = $2`,
        [careHomeId, shiftDate]
      ),
      query(
        `SELECT ma.status AS admin_status, ma.scheduled_time,
                m.name AS medication_name, m.dose,
                r.first_name || ' ' || r.last_name AS resident_name, r.room_number
         FROM med_administrations ma
         JOIN medications m ON m.id = ma.medication_id
         JOIN residents r ON r.id = ma.resident_id
         WHERE ma.care_home_id = $1 AND ma.administration_date = $2
           AND ma.status IN ('missed', 'refused')`,
        [careHomeId, shiftDate]
      ),
      query(
        `SELECT ct.task_name, ct.status,
                r.first_name || ' ' || r.last_name AS resident_name, r.room_number
         FROM care_tasks ct
         JOIN residents r ON r.id = ct.resident_id
         WHERE ct.care_home_id = $1 AND ct.task_date = $2
           AND ct.status IN ('missed', 'overdue')`,
        [careHomeId, shiftDate]
      ),
      query(
        `SELECT wl.mood_score, wl.pain_level, wl.sleep_quality, wl.notes,
                r.first_name || ' ' || r.last_name AS resident_name, r.room_number
         FROM wellbeing_logs wl
         JOIN residents r ON r.id = wl.resident_id
         WHERE wl.care_home_id = $1 AND wl.log_date = $2`,
        [careHomeId, shiftDate]
      ),
      query(
        `SELECT cn.content, cn.note_type,
                r.first_name || ' ' || r.last_name AS resident_name, r.room_number
         FROM care_notes cn
         JOIN residents r ON r.id = cn.resident_id
         WHERE cn.care_home_id = $1 AND cn.created_at::date = $2
           AND cn.flagged = true AND cn.deleted_at IS NULL`,
        [careHomeId, shiftDate]
      ),
    ]);

    // Collect unique resident IDs from notes and incidents
    const residentIdSet = new Set<string>();
    for (const row of (notes.rows as any[])) {
      if (row.resident_id) residentIdSet.add(row.resident_id);
    }
    for (const row of (incidents.rows as any[])) {
      if (row.resident_id) residentIdSet.add(row.resident_id);
    }
    const residentsCoveredArray = Array.from(residentIdSet);

    const prompt = `Generate a structured SBAR handover report for a UK care home.

Shift: ${shiftType} on ${shiftDate}

DATA FOR THIS SHIFT:

CARE NOTES (${notes.rows.length} total):
${notes.rows.map((n: any) => `- Room ${n.room_number} ${n.resident_name} [${n.note_type}${n.is_significant ? ' SIGNIFICANT' : ''}]: ${n.content?.slice(0, 200)}`).join('\n') || 'None recorded'}

INCIDENTS (${incidents.rows.length}):
${incidents.rows.map((i: any) => `- Room ${i.room_number} ${i.resident_name}: ${i.incident_type} (${i.severity}) - ${i.description?.slice(0, 150)}`).join('\n') || 'None'}

MISSED/REFUSED MEDICATIONS (${missedMeds.rows.length}):
${missedMeds.rows.map((m: any) => `- Room ${m.room_number} ${m.resident_name}: ${m.medication_name} ${m.dose} at ${m.scheduled_time} (${m.admin_status})`).join('\n') || 'None'}

MISSED/OVERDUE TASKS (${missedTasks.rows.length}):
${missedTasks.rows.map((t: any) => `- Room ${t.room_number} ${t.resident_name}: ${t.task_name} (${t.status})`).join('\n') || 'None'}

WELLBEING OBSERVATIONS (${wellbeing.rows.length}):
${wellbeing.rows.map((w: any) => `- Room ${w.room_number} ${w.resident_name}: mood=${w.mood_score || 'N/A'}, pain=${w.pain_level || 'N/A'}, sleep=${w.sleep_quality || 'N/A'}${w.notes ? ' - ' + w.notes.slice(0, 100) : ''}`).join('\n') || 'None'}

FLAGGED NOTES:
${flaggedNotes.rows.map((f: any) => `- Room ${f.room_number} ${f.resident_name} [${f.note_type}]: ${f.content?.slice(0, 200)}`).join('\n') || 'None'}

Generate a STRUCTURED SBAR report with EXACTLY these 4 sections, each prefixed with its label on its own line:

SITUATION:
(What is happening right now? Key events of the shift.)

BACKGROUND:
(Relevant history, ongoing concerns, context for incoming staff.)

ASSESSMENT:
(Clinical assessment of the situation, what needs attention.)

RECOMMENDATION:
(Specific actions for the incoming shift.)

Be concise, professional, and actionable. Use UK care home terminology.`;

    const result = await runAiOperation({
      careHomeId,
      requestedBy: userId,
      operation: 'sbar_handover',
      context: {
        shiftDate, shiftType,
        noteCount: notes.rows.length,
        incidentCount: incidents.rows.length,
        missedMedsCount: missedMeds.rows.length,
      },
      prompt,
      systemPrompt: `You are an experienced UK care home clinical lead generating SBAR handover reports.
Write clearly, concisely, and professionally. Include specific resident names and room numbers.
This is a clinical communication tool - be accurate and factual.
Structure your response with exactly 4 labeled sections: SITUATION, BACKGROUND, ASSESSMENT, RECOMMENDATION.`,
      max_tokens: 1000,
    });

    // Parse the AI output into 4 sections
    let sections: { situation: string; background: string; assessment: string; recommendation: string };

    if (result === AI_NOT_CONFIGURED || result.startsWith('AI service temporarily unavailable')) {
      // Generate structured handover from database data without AI
      sections = buildFallbackSbar({
        shiftDate,
        shiftType,
        notes: notes.rows,
        incidents: incidents.rows,
        missedMeds: missedMeds.rows,
        missedTasks: missedTasks.rows,
        wellbeing: wellbeing.rows,
        flaggedNotes: flaggedNotes.rows,
      });
    } else {
      sections = parseSbarSections(result);
    }

    // Build key concerns from flagged notes and incidents
    const keyConcerns = [
      ...flaggedNotes.rows.map((f: any) => ({ resident: f.resident_name, room: f.room_number, concern: f.content?.slice(0, 100) })),
      ...incidents.rows.map((i: any) => ({ resident: i.resident_name, room: i.room_number, concern: `${i.incident_type}: ${i.description?.slice(0, 100)}` })),
    ];

    // Store in sbar_handovers table
    const { rows: [handover] } = await query(
      `INSERT INTO sbar_handovers
         (care_home_id, generated_by, shift_date, shift_type, situation, background, assessment, recommendation, residents_covered, key_concerns, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
       RETURNING *`,
      [
        careHomeId, userId, shiftDate, shiftType,
        sections.situation, sections.background,
        sections.assessment, sections.recommendation,
        residentsCoveredArray, JSON.stringify(keyConcerns),
      ]
    );

    res.status(201).json(handover);
  } catch (err) { next(err); }
}

export async function listSbarHandovers(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT sh.*,
              u.first_name || ' ' || u.last_name AS generated_by_name
       FROM sbar_handovers sh
       JOIN users u ON u.id = sh.generated_by
       WHERE sh.care_home_id = $1
       ORDER BY sh.shift_date DESC, sh.created_at DESC
       LIMIT 20`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

export async function getSbarHandover(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;

    const { rows: [handover] } = await query(
      `SELECT sh.*,
              u.first_name || ' ' || u.last_name AS generated_by_name,
              a.first_name || ' ' || a.last_name AS approved_by_name
       FROM sbar_handovers sh
       JOIN users u ON u.id = sh.generated_by
       LEFT JOIN users a ON a.id = sh.approved_by
       WHERE sh.id = $1 AND sh.care_home_id = $2`,
      [id, careHomeId]
    );

    if (!handover) {
      return res.status(404).json({ error: 'Handover not found' });
    }

    res.json(handover);
  } catch (err) { next(err); }
}

export async function approveSbarHandover(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { id } = req.params;

    const { rows: [handover] } = await query(
      `UPDATE sbar_handovers
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND care_home_id = $3
       RETURNING *`,
      [userId, id, careHomeId]
    );

    if (!handover) {
      return res.status(404).json({ error: 'Handover not found' });
    }

    res.json(handover);
  } catch (err) { next(err); }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')            // Remove bold markers (**)
    .replace(/#{1,6}\s*/g, '')       // Remove heading markers (##, #, etc.)
    .replace(/---+/g, '')            // Remove horizontal rules (---)
    .replace(/--/g, '')              // Remove double dashes
    .replace(/^\s*[-*]\s+/gm, '')    // Remove bullet point markers at start of lines
    .replace(/\n{3,}/g, '\n\n')      // Collapse multiple blank lines
    .trim();
}

function parseSbarSections(text: string): {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
} {
  const sections = {
    situation: '',
    background: '',
    assessment: '',
    recommendation: '',
  };

  // Try to split on section headers
  const situationMatch = text.match(/SITUATION[:\s]*\n?([\s\S]*?)(?=BACKGROUND[:\s]*\n?|$)/i);
  const backgroundMatch = text.match(/BACKGROUND[:\s]*\n?([\s\S]*?)(?=ASSESSMENT[:\s]*\n?|$)/i);
  const assessmentMatch = text.match(/ASSESSMENT[:\s]*\n?([\s\S]*?)(?=RECOMMENDATION[:\s]*\n?|$)/i);
  const recommendationMatch = text.match(/RECOMMENDATION[:\s]*\n?([\s\S]*?)$/i);

  sections.situation = stripMarkdown(situationMatch?.[1]?.trim() || text.slice(0, Math.floor(text.length / 4)));
  sections.background = stripMarkdown(backgroundMatch?.[1]?.trim() || '');
  sections.assessment = stripMarkdown(assessmentMatch?.[1]?.trim() || '');
  sections.recommendation = stripMarkdown(recommendationMatch?.[1]?.trim() || '');

  return sections;
}

function buildFallbackSbar(data: {
  shiftDate: string;
  shiftType: string;
  notes: any[];
  incidents: any[];
  missedMeds: any[];
  missedTasks: any[];
  wellbeing: any[];
  flaggedNotes: any[];
}): { situation: string; background: string; assessment: string; recommendation: string } {
  const { shiftDate, shiftType, notes, incidents, missedMeds, missedTasks, wellbeing, flaggedNotes } = data;

  // SITUATION: Summary of what happened this shift
  const situationParts: string[] = [];
  situationParts.push(`Handover report for ${shiftType} shift on ${shiftDate}.`);
  situationParts.push(`${notes.length} care note(s) recorded during this shift.`);
  if (incidents.length > 0) {
    situationParts.push(`${incidents.length} incident(s) occurred:`);
    incidents.forEach((i: any) => {
      situationParts.push(`  - ${i.resident_name} (Room ${i.room_number}): ${i.incident_type} (${i.severity}) - ${(i.description || '').slice(0, 100)}`);
    });
  }
  if (flaggedNotes.length > 0) {
    situationParts.push(`${flaggedNotes.length} flagged note(s) requiring attention:`);
    flaggedNotes.forEach((f: any) => {
      situationParts.push(`  - ${f.resident_name} (Room ${f.room_number}): ${(f.content || '').slice(0, 100)}`);
    });
  }

  // BACKGROUND: Context from care notes
  const backgroundParts: string[] = [];
  if (notes.length > 0) {
    backgroundParts.push('Care notes summary:');
    const significantNotes = notes.filter((n: any) => n.is_significant);
    const regularNotes = notes.filter((n: any) => !n.is_significant);
    if (significantNotes.length > 0) {
      backgroundParts.push('Significant observations:');
      significantNotes.slice(0, 5).forEach((n: any) => {
        backgroundParts.push(`  - ${n.resident_name} (Room ${n.room_number}) [${n.note_type}]: ${(n.content || '').slice(0, 120)}`);
      });
    }
    if (regularNotes.length > 0) {
      backgroundParts.push(`${regularNotes.length} additional care note(s) recorded.`);
    }
  } else {
    backgroundParts.push('No care notes recorded during this shift.');
  }
  if (wellbeing.length > 0) {
    backgroundParts.push('Wellbeing observations:');
    wellbeing.slice(0, 5).forEach((w: any) => {
      const details = [];
      if (w.mood_score) details.push(`mood: ${w.mood_score}`);
      if (w.pain_level) details.push(`pain: ${w.pain_level}`);
      if (w.sleep_quality) details.push(`sleep: ${w.sleep_quality}`);
      backgroundParts.push(`  - ${w.resident_name} (Room ${w.room_number}): ${details.join(', ')}${w.notes ? ' - ' + (w.notes as string).slice(0, 80) : ''}`);
    });
  }

  // ASSESSMENT: Issues that need attention
  const assessmentParts: string[] = [];
  if (missedMeds.length > 0) {
    assessmentParts.push(`${missedMeds.length} missed/refused medication(s):`);
    missedMeds.forEach((m: any) => {
      assessmentParts.push(`  - ${m.resident_name} (Room ${m.room_number}): ${m.medication_name} ${m.dose} at ${m.scheduled_time} (${m.admin_status})`);
    });
  }
  if (missedTasks.length > 0) {
    assessmentParts.push(`${missedTasks.length} missed/overdue task(s):`);
    missedTasks.forEach((t: any) => {
      assessmentParts.push(`  - ${t.resident_name} (Room ${t.room_number}): ${t.task_name} (${t.status})`);
    });
  }
  if (incidents.length > 0) {
    const highSeverity = incidents.filter((i: any) => i.severity === 'high' || i.severity === 'critical');
    if (highSeverity.length > 0) {
      assessmentParts.push(`${highSeverity.length} high/critical severity incident(s) require follow-up.`);
    }
  }
  if (assessmentParts.length === 0) {
    assessmentParts.push('No significant concerns identified during this shift. All medications administered and tasks completed as scheduled.');
  }

  // RECOMMENDATION: Actions for incoming shift
  const recommendationParts: string[] = [];
  if (missedMeds.length > 0) {
    recommendationParts.push('Follow up on missed/refused medications with nursing staff.');
  }
  if (missedTasks.length > 0) {
    recommendationParts.push('Complete overdue care tasks as priority.');
  }
  if (incidents.length > 0) {
    recommendationParts.push('Review and follow up on incident reports. Update families if required.');
  }
  if (flaggedNotes.length > 0) {
    recommendationParts.push('Review flagged care notes and take appropriate action.');
  }
  const lowMood = wellbeing.filter((w: any) => w.mood_score && parseInt(w.mood_score) <= 3);
  if (lowMood.length > 0) {
    recommendationParts.push(`Monitor residents with low mood scores: ${lowMood.map((w: any) => `${w.resident_name} (Room ${w.room_number})`).join(', ')}.`);
  }
  if (recommendationParts.length === 0) {
    recommendationParts.push('Continue routine care. No urgent actions identified.');
  }

  return {
    situation: situationParts.join('\n'),
    background: backgroundParts.join('\n'),
    assessment: assessmentParts.join('\n'),
    recommendation: recommendationParts.join('\n'),
  };
}
