// src/controllers/smartHandover.controller.ts
// Smart Handover Intelligence - AI identifies critical shift items
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Generate Smart Handover ───────────────────────────────────────────────
export async function generateSmartHandover(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { shiftType, outgoingShift } = req.body;

    // Gather critical data from the shift period
    const { rows: recentIncidents } = await query(
      `SELECT i.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM incidents i JOIN residents r ON r.id = i.resident_id
       WHERE i.care_home_id = $1 AND i.created_at > NOW() - INTERVAL '12 hours' AND i.status != 'closed'
       ORDER BY i.severity DESC, i.created_at DESC LIMIT 10`,
      [careHomeId]
    );

    const { rows: recentNotes } = await query(
      `SELECT cn.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM care_notes cn JOIN residents r ON r.id = cn.resident_id
       WHERE cn.care_home_id = $1 AND cn.created_at > NOW() - INTERVAL '12 hours' AND cn.deleted_at IS NULL
       AND cn.note_type IN ('nursing_observation','medication_note','incident_note','hospital_visit')
       ORDER BY cn.created_at DESC LIMIT 15`,
      [careHomeId]
    );

    const { rows: highRiskResidents } = await query(
      `SELECT id, first_name, last_name, room_number, risk_level, mobility_status
       FROM residents WHERE care_home_id = $1 AND active = TRUE AND risk_level = 'high'`,
      [careHomeId]
    );

    // Identify top 3 critical items
    const criticalItems: any[] = [];

    // Priority 1: Unresolved incidents
    recentIncidents.forEach((inc: any) => {
      if (criticalItems.length < 3) {
        criticalItems.push({
          priority: criticalItems.length + 1,
          category: 'incident',
          urgency: inc.severity === 'critical' ? 'critical' : inc.severity === 'high' ? 'high' : 'medium',
          title: `${inc.incident_type} - ${inc.resident_name}`,
          detail: inc.description?.substring(0, 200) || 'See incident report',
          resident_name: inc.resident_name,
          action_required: 'Monitor and update status',
          source_id: inc.id,
        });
      }
    });

    // Priority 2: Clinical concerns from notes
    recentNotes.forEach((note: any) => {
      if (criticalItems.length < 3 && note.note_type === 'escalation') {
        criticalItems.push({
          priority: criticalItems.length + 1,
          category: 'clinical',
          urgency: 'high',
          title: `Clinical concern - ${note.resident_name}`,
          detail: note.content?.substring(0, 200) || 'Review care note',
          resident_name: note.resident_name,
          action_required: 'Clinical review required',
          source_id: note.id,
        });
      }
    });

    // Priority 3: High-risk residents needing checks
    if (criticalItems.length < 3) {
      highRiskResidents.forEach((r: any) => {
        if (criticalItems.length < 3) {
          criticalItems.push({
            priority: criticalItems.length + 1,
            category: 'monitoring',
            urgency: 'medium',
            title: `High-risk check - ${r.first_name} ${r.last_name} (Room ${r.room_number})`,
            detail: `Risk level: ${r.risk_level}. Mobility: ${r.mobility_status || 'unknown'}`,
            resident_name: `${r.first_name} ${r.last_name}`,
            action_required: 'Ensure regular checks completed',
            source_id: r.id,
          });
        }
      });
    }

    // Store the handover
    const { rows: [handover] } = await query(
      `INSERT INTO smart_handovers (care_home_id, shift_type, critical_items, full_summary, generated_by, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [careHomeId, shiftType || 'day', JSON.stringify(criticalItems), JSON.stringify({
        incidents_count: recentIncidents.length,
        clinical_notes_count: recentNotes.length,
        high_risk_residents: highRiskResidents.length,
        outgoing_shift: outgoingShift || null,
      }), userId]
    );

    res.status(201).json({ ...handover, critical_items: criticalItems });
  } catch (err) { next(err); }
}

// ── List Smart Handovers ──────────────────────────────────────────────────
export async function listSmartHandovers(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT sh.*, u.first_name || ' ' || u.last_name AS generated_by_name
       FROM smart_handovers sh JOIN users u ON u.id = sh.generated_by
       WHERE sh.care_home_id = $1 ORDER BY sh.created_at DESC LIMIT 30`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Record Action on Handover Item ────────────────────────────────────────
export async function recordAction(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { itemIndex, actionTaken, outcome } = req.body;

    if (!itemIndex && itemIndex !== 0) {
      return res.status(400).json({ error: 'itemIndex is required' });
    }
    if (!actionTaken) {
      return res.status(400).json({ error: 'actionTaken is required' });
    }

    const { rows: [handover] } = await query(
      `SELECT * FROM smart_handovers WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );
    if (!handover) return res.status(404).json({ error: 'Handover not found' });

    // Record action
    const { rows: [action] } = await query(
      `INSERT INTO handover_actions (care_home_id, handover_id, item_index, action_taken, outcome, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [careHomeId, id, itemIndex, actionTaken, outcome, req.user!.id]
    );

    res.status(201).json(action);
  } catch (err) { next(err); }
}
