import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// ─────────────────────────────────────────────────────────────────────────────
// Ambient night sensing.
//
// The problem: to know whether a resident slept, someone has to open the door
// and look — which is itself the thing most likely to wake them. Night checks
// are care and disturbance at the same time.
//
// The approach: a presence sensor and an on-device sound classifier in the
// room. Neither sends audio or images. The device sends event labels only, and
// this service turns a stream of labels into a small number of statements a
// nurse can act on: settled, restless, out of bed for 40 minutes, distress at
// 03:10 with nobody attending for 25 minutes.
//
// What makes this different from a bed sensor or a camera:
//   * nothing is recorded, so nothing can be replayed or subpoenaed;
//   * the resident wears nothing and is touched by nothing;
//   * the output is clinical, not raw — "possible fall", not "motion spike";
//   * it is correlated with the care record, so the system can say whether
//     anyone actually went in.
// ─────────────────────────────────────────────────────────────────────────────

function hashKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ── Device registration ─────────────────────────────────────────────────────
export async function registerDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const roomNumber = b.roomNumber || b.room_number;
    if (!roomNumber) return res.status(400).json({ error: 'A room is required' });
    if (!b.deviceName && !b.device_name) return res.status(400).json({ error: 'Give the device a name' });

    const type = b.deviceType || b.device_type || 'presence';
    if (!['presence', 'acoustic', 'presence_acoustic', 'environment'].includes(type)) {
      return res.status(400).json({ error: 'Unknown device type' });
    }

    // The key is shown once, at registration, and never again — the same
    // contract as any API credential.
    const key = `cvs_${crypto.randomBytes(24).toString('base64url')}`;
    const prefix = key.slice(0, 12);

    const { rows: [device] } = await query(
      `INSERT INTO sensor_devices
         (care_home_id, room_number, resident_id, device_name, device_type,
          hardware_model, api_key_hash, api_key_prefix, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, room_number, device_name, device_type`,
      [chId, roomNumber, b.residentId || b.resident_id || null,
       b.deviceName || b.device_name, type, b.hardwareModel || b.hardware_model || null,
       hashKey(key), prefix, req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'SENSOR_DEVICE_REGISTERED', entityType: 'sensor_device', entityId: device.id,
      afterData: { roomNumber, type },
    });

    res.status(201).json({
      ...device,
      apiKey: key,
      warning: 'Copy this key now — it is not shown again. Sensing stays off until consent is recorded.',
    });
  } catch (err) { next(err); }
}

export async function listDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT d.id, d.room_number, d.device_name, d.device_type, d.hardware_model,
              d.firmware_version, d.consent_status, d.consent_basis, d.active,
              d.last_seen_at, d.battery_percent, d.api_key_prefix,
              r.first_name || ' ' || r.last_name AS resident_name, d.resident_id,
              (SELECT COUNT(*)::int FROM sensor_observations o
                WHERE o.device_id = d.id AND o.observed_at > NOW() - INTERVAL '24 hours') AS readings_24h
       FROM sensor_devices d
       LEFT JOIN residents r ON r.id = d.resident_id
       WHERE d.care_home_id = $1
       ORDER BY d.room_number`, [req.user!.care_home_id]);

    const now = Date.now();
    res.json(rows.map(d => ({
      id: d.id, roomNumber: d.room_number, deviceName: d.device_name,
      deviceType: d.device_type, hardwareModel: d.hardware_model,
      firmwareVersion: d.firmware_version, consentStatus: d.consent_status,
      consentBasis: d.consent_basis, active: d.active,
      residentId: d.resident_id, residentName: d.resident_name,
      lastSeenAt: d.last_seen_at, batteryPercent: d.battery_percent,
      keyPrefix: d.api_key_prefix, readings24h: d.readings_24h,
      // A sensor nobody notices has stopped is worse than no sensor.
      offline: !d.last_seen_at || (now - new Date(d.last_seen_at).getTime()) > 60 * 60 * 1000,
      sensing: d.active && d.consent_status === 'given',
    })));
  } catch (err) { next(err); }
}

// ── Consent ─────────────────────────────────────────────────────────────────
// Sensing does not start until this is recorded, and withdrawing it stops
// ingestion immediately.
export async function setConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const status = req.body?.consentStatus || req.body?.consent_status;
    if (!['pending', 'given', 'refused', 'withdrawn'].includes(status)) {
      return res.status(400).json({ error: 'Unknown consent status' });
    }
    const basis = req.body?.consentBasis || req.body?.consent_basis || null;
    if (status === 'given' && !basis) {
      return res.status(400).json({
        error: 'Record the lawful basis: the resident consented, an attorney consented, or it is a best interests decision.',
      });
    }

    const { rows: [d] } = await query(
      `UPDATE sensor_devices
       SET consent_status = $1, consent_basis = $2, consent_notes = $3,
           consent_recorded_by = $4, consent_recorded_at = NOW(), updated_at = NOW()
       WHERE id = $5 AND care_home_id = $6 RETURNING id, room_number, consent_status`,
      [status, basis, req.body?.notes || null, req.user!.id, req.params.id, chId]);
    if (!d) return res.status(404).json({ error: 'Device not found' });

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'SENSOR_CONSENT_RECORDED', entityType: 'sensor_device', entityId: d.id,
      afterData: { status, basis },
    });
    res.json(d);
  } catch (err) { next(err); }
}

// ── Ingestion ───────────────────────────────────────────────────────────────
// Called by the device itself, authenticated with its own key — never with a
// staff login. Rejects anything that looks like raw media.
export async function ingest(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || '';
    const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!key) return res.status(401).json({ error: 'Device key required' });

    const { rows: [device] } = await query(
      `SELECT * FROM sensor_devices WHERE api_key_prefix = $1 AND active = TRUE`,
      [key.slice(0, 12)]);
    if (!device || device.api_key_hash !== hashKey(key)) {
      return res.status(401).json({ error: 'Unknown device' });
    }
    if (device.consent_status !== 'given') {
      return res.status(403).json({
        error: 'Sensing is not consented for this room. Readings are refused.',
        consentStatus: device.consent_status,
      });
    }

    const batch = Array.isArray(req.body?.observations) ? req.body.observations : [];
    if (!batch.length) return res.status(400).json({ error: 'No observations supplied' });
    if (batch.length > 500) return res.status(413).json({ error: 'Send at most 500 observations at a time' });

    // Defence in depth: if a future firmware ever tried to send media, refuse
    // the whole batch loudly rather than quietly storing it.
    for (const o of batch) {
      if (o.audio || o.audioData || o.waveform || o.image || o.frame || o.transcript) {
        return res.status(422).json({
          error: 'This endpoint accepts event labels only. Audio, images and transcripts are refused by design.',
        });
      }
    }

    let stored = 0;
    for (const o of batch) {
      const signal = o.signal;
      if (!['presence','absence','motion','bed_occupied','bed_exit','sound_event',
            'light_level','temperature','humidity'].includes(signal)) continue;
      const label = o.eventLabel || o.event_label || null;
      await query(
        `INSERT INTO sensor_observations
           (care_home_id, device_id, resident_id, observed_at, signal, event_label, confidence, numeric_value)
         VALUES ($1,$2,$3, COALESCE($4::timestamptz, NOW()), $5,$6,$7,$8)`,
        [device.care_home_id, device.id, device.resident_id,
         o.observedAt || o.observed_at || null, signal,
         label && label !== 'none' ? label : null,
         o.confidence ?? null, o.value ?? o.numericValue ?? null]);
      stored++;
    }

    await query(
      `UPDATE sensor_devices SET last_seen_at = NOW(),
              battery_percent = COALESCE($1, battery_percent),
              firmware_version = COALESCE($2, firmware_version)
       WHERE id = $3`,
      [req.body?.battery ?? null, req.body?.firmware ?? null, device.id]);

    res.status(202).json({ stored, deviceId: device.id });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inference: turning a stream of labels into a handful of clinical statements.
//
// This is the part that matters. A raw feed of "motion at 02:14, motion at
// 02:15, sound_event cough 0.8" is noise to a nurse on a night shift. What she
// needs is: "out of bed 02:10–02:52, forty-two minutes, nobody attended".
//
// Deliberately rule-based rather than a learned model. On a night shift a nurse
// has to be able to ask why the system said something, and be given an answer
// she can check against the room. An unexplainable score would not be acted on,
// and should not be.
// ─────────────────────────────────────────────────────────────────────────────

const OUT_OF_BED_ATTENTION_MINS = 20;   // long enough to be worth a look
const OUT_OF_BED_URGENT_MINS    = 45;   // long enough to be a fall or a wander
const COUGH_CLUSTER             = 5;    // in one hour — chest infection signal
const RESTLESS_MOVEMENTS        = 12;   // in one night

type Obs = { observed_at: string; signal: string; event_label: string | null; confidence: number | null };

export function inferNightEvents(observations: Obs[], nightOf: string) {
  const events: any[] = [];
  const sorted = [...observations].sort(
    (a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());
  const at = (o: Obs) => new Date(o.observed_at).getTime();
  const mins = (a: number, b: number) => Math.round((b - a) / 60000);

  // ── Out of bed ────────────────────────────────────────────────────────────
  // A bed_exit with no matching bed_occupied is somebody up in the dark.
  let exitAt: number | null = null;
  for (const o of sorted) {
    if (o.signal === 'bed_exit') { if (exitAt === null) exitAt = at(o); continue; }
    if (o.signal === 'bed_occupied' && exitAt !== null) {
      const away = mins(exitAt, at(o));
      if (away >= 3) {
        events.push({
          event_type: away >= OUT_OF_BED_URGENT_MINS ? 'out_of_bed_prolonged' : 'out_of_bed',
          started_at: new Date(exitAt).toISOString(),
          ended_at: o.observed_at,
          duration_mins: away,
          severity: away >= OUT_OF_BED_URGENT_MINS ? 'urgent'
                  : away >= OUT_OF_BED_ATTENTION_MINS ? 'attention' : 'info',
          evidence: `Out of bed for ${away} minutes, returned at ${o.observed_at.slice(11, 16)}.`,
          confidence: 0.9,
        });
      }
      exitAt = null;
    }
  }
  // Still out of bed when the night's observations end.
  if (exitAt !== null && sorted.length) {
    const away = mins(exitAt, at(sorted[sorted.length - 1]));
    if (away >= OUT_OF_BED_ATTENTION_MINS) {
      events.push({
        event_type: 'out_of_bed_prolonged',
        started_at: new Date(exitAt).toISOString(), ended_at: null, duration_mins: away,
        severity: 'urgent',
        evidence: `Left bed and has not been detected returning (${away} minutes).`,
        confidence: 0.75,
      });
    }
  }

  // ── Distress ──────────────────────────────────────────────────────────────
  for (const o of sorted) {
    if (o.signal !== 'sound_event') continue;
    if (o.event_label === 'distress' || o.event_label === 'call_out') {
      if ((o.confidence ?? 1) < 0.6) continue;   // don't wake a nurse on a guess
      events.push({
        event_type: 'distress',
        started_at: o.observed_at, ended_at: null, duration_mins: null,
        severity: o.event_label === 'distress' ? 'urgent' : 'attention',
        evidence: o.event_label === 'distress'
          ? 'Sounds of distress detected in the room.'
          : 'Resident called out.',
        confidence: o.confidence ?? 0.7,
      });
    }
    if (o.event_label === 'fall_impact' && (o.confidence ?? 0) >= 0.5) {
      events.push({
        event_type: 'possible_fall',
        started_at: o.observed_at, ended_at: null, duration_mins: null,
        severity: 'urgent',
        evidence: 'An impact consistent with a fall was detected. Check the room.',
        confidence: o.confidence ?? 0.5,
      });
    }
  }

  // ── Repeated coughing — a chest infection often shows here first ──────────
  const coughs = sorted.filter(o => o.signal === 'sound_event' && o.event_label === 'cough');
  for (let i = 0; i + COUGH_CLUSTER - 1 < coughs.length; i++) {
    const window = mins(at(coughs[i]), at(coughs[i + COUGH_CLUSTER - 1]));
    if (window <= 60) {
      events.push({
        event_type: 'repeated_coughing',
        started_at: coughs[i].observed_at,
        ended_at: coughs[i + COUGH_CLUSTER - 1].observed_at,
        duration_mins: window, severity: 'attention',
        evidence: `${COUGH_CLUSTER} or more coughing episodes within ${window} minutes. Consider a chest assessment.`,
        confidence: 0.7,
      });
      break;   // one is enough; the night nurse does not need five of these
    }
  }

  // ── Overall settledness ───────────────────────────────────────────────────
  const movements = sorted.filter(o => o.signal === 'motion').length;
  if (sorted.length) {
    const restless = movements >= RESTLESS_MOVEMENTS || events.some(e => e.event_type !== 'settled');
    events.push({
      event_type: restless ? 'restless' : 'settled',
      started_at: sorted[0].observed_at,
      ended_at: sorted[sorted.length - 1].observed_at,
      duration_mins: mins(at(sorted[0]), at(sorted[sorted.length - 1])),
      severity: 'info',
      evidence: restless
        ? `${movements} movements detected overnight.`
        : `A settled night: ${movements} movements, no disturbances detected.`,
      confidence: 0.8,
    });
  }

  return events.map(e => ({ ...e, night_of: nightOf }));
}

/** Run inference for one resident and one night, and store what it finds. */
export async function analyseNight(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const residentId = req.params.residentId;
    const night = String(req.query.night || new Date(Date.now() - 86400000).toISOString().slice(0, 10));

    // A "night" runs 20:00 to 10:00 the following morning.
    const { rows: obs } = await query(
      `SELECT observed_at, signal, event_label, confidence
       FROM sensor_observations
       WHERE resident_id = $1 AND care_home_id = $2
         AND observed_at >= ($3::date + TIME '20:00')
         AND observed_at <  ($3::date + INTERVAL '1 day' + TIME '10:00')
       ORDER BY observed_at`, [residentId, chId, night]);

    if (!obs.length) {
      return res.json({ night, events: [], observations: 0,
        message: 'No sensor readings for this night. Either no device is fitted to this room, or it was offline.' });
    }

    const inferred = inferNightEvents(obs as any, night);

    for (const e of inferred) {
      await query(
        `INSERT INTO night_events
           (care_home_id, resident_id, night_of, event_type, started_at, ended_at,
            duration_mins, severity, evidence, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (resident_id, event_type, started_at) DO NOTHING`,
        [chId, residentId, night, e.event_type, e.started_at, e.ended_at,
         e.duration_mins, e.severity, e.evidence, e.confidence]);
    }

    // Did anybody go in? Correlate with the care record so the night's story is
    // complete: a disturbance nobody responded to is the finding that matters.
    await query(
      `UPDATE night_events ne SET
         staff_attended = EXISTS (
           SELECT 1 FROM care_notes cn
           WHERE cn.resident_id = ne.resident_id AND cn.deleted_at IS NULL
             AND cn.created_at BETWEEN ne.started_at AND ne.started_at + INTERVAL '45 minutes'),
         attended_within_mins = (
           SELECT ROUND(EXTRACT(EPOCH FROM (MIN(cn.created_at) - ne.started_at)) / 60)::int
           FROM care_notes cn
           WHERE cn.resident_id = ne.resident_id AND cn.deleted_at IS NULL
             AND cn.created_at BETWEEN ne.started_at AND ne.started_at + INTERVAL '45 minutes')
       WHERE ne.resident_id = $1 AND ne.night_of = $2`, [residentId, night]);

    const { rows: stored } = await query(
      `SELECT * FROM night_events WHERE resident_id = $1 AND night_of = $2
       ORDER BY started_at`, [residentId, night]);

    res.json({
      night, observations: obs.length,
      events: stored.map(e => ({
        id: e.id, eventType: e.event_type, startedAt: e.started_at, endedAt: e.ended_at,
        durationMins: e.duration_mins, severity: e.severity, evidence: e.evidence,
        confidence: e.confidence != null ? Number(e.confidence) : null,
        staffAttended: e.staff_attended, attendedWithinMins: e.attended_within_mins,
      })),
    });
  } catch (err) { next(err); }
}

/** Last night across the whole home — the handover view. */
export async function nightOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const night = String(req.query.night || new Date(Date.now() - 86400000).toISOString().slice(0, 10));
    const { rows } = await query(
      `SELECT ne.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM night_events ne JOIN residents r ON r.id = ne.resident_id
       WHERE ne.care_home_id = $1 AND ne.night_of = $2
       ORDER BY CASE ne.severity WHEN 'urgent' THEN 0 WHEN 'attention' THEN 1 ELSE 2 END,
                ne.started_at`, [chId, night]);

    const events = rows.map(e => ({
      id: e.id, residentId: e.resident_id, residentName: e.resident_name, roomNumber: e.room_number,
      eventType: e.event_type, startedAt: e.started_at, durationMins: e.duration_mins,
      severity: e.severity, evidence: e.evidence,
      staffAttended: e.staff_attended, attendedWithinMins: e.attended_within_mins,
    }));

    res.json({
      night, events,
      urgent: events.filter(e => e.severity === 'urgent').length,
      attention: events.filter(e => e.severity === 'attention').length,
      unattended: events.filter(e => e.severity !== 'info' && !e.staffAttended).length,
    });
  } catch (err) { next(err); }
}
