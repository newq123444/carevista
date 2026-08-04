// src/controllers/medInteractions.controller.ts
// Medication Interaction Checker - cross-reference active medications against known interactions
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// Built-in interaction database with at least 15 known drug interaction pairs
interface InteractionRule {
  drugA: string[];
  drugB: string[];
  interactionType: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  clinicalEffect: string;
  recommendation: string;
}

const INTERACTION_DATABASE: InteractionRule[] = [
  {
    drugA: ['warfarin'],
    drugB: ['ibuprofen', 'naproxen', 'diclofenac'],
    interactionType: 'anticoagulant-NSAID',
    severity: 'major',
    description: 'Warfarin and NSAID interaction',
    clinicalEffect: 'Increased bleeding risk due to combined anticoagulant and antiplatelet effects',
    recommendation: 'Avoid combination. Consider paracetamol for pain relief. Monitor INR closely if unavoidable.',
  },
  {
    drugA: ['warfarin'],
    drugB: ['amiodarone'],
    interactionType: 'anticoagulant-antiarrhythmic',
    severity: 'major',
    description: 'Warfarin and amiodarone interaction',
    clinicalEffect: 'Increased INR and bleeding risk due to inhibition of warfarin metabolism',
    recommendation: 'Reduce warfarin dose by 30-50%. Monitor INR frequently.',
  },
  {
    drugA: ['ramipril', 'lisinopril', 'enalapril'],
    drugB: ['spironolactone', 'amiloride'],
    interactionType: 'ACEi-potassium-sparing-diuretic',
    severity: 'major',
    description: 'ACE inhibitor and potassium-sparing diuretic interaction',
    clinicalEffect: 'Risk of hyperkalaemia (dangerously high potassium levels)',
    recommendation: 'Monitor serum potassium regularly. Consider alternative diuretic.',
  },
  {
    drugA: ['metformin'],
    drugB: ['alcohol'],
    interactionType: 'biguanide-alcohol',
    severity: 'moderate',
    description: 'Metformin and alcohol interaction',
    clinicalEffect: 'Increased risk of lactic acidosis',
    recommendation: 'Advise patient to limit alcohol consumption.',
  },
  {
    drugA: ['sertraline', 'fluoxetine', 'citalopram', 'paroxetine'],
    drugB: ['phenelzine', 'tranylcypromine'],
    interactionType: 'SSRI-MAOI',
    severity: 'contraindicated',
    description: 'SSRI and MAOI interaction',
    clinicalEffect: 'Risk of serotonin syndrome - potentially fatal',
    recommendation: 'NEVER combine. Allow washout period of at least 2 weeks (5 weeks for fluoxetine) between switching.',
  },
  {
    drugA: ['sertraline', 'fluoxetine', 'citalopram', 'paroxetine'],
    drugB: ['tramadol'],
    interactionType: 'SSRI-opioid',
    severity: 'major',
    description: 'SSRI and tramadol interaction',
    clinicalEffect: 'Increased risk of seizures and serotonin syndrome',
    recommendation: 'Use alternative analgesic if possible. Monitor for signs of serotonin syndrome.',
  },
  {
    drugA: ['lithium'],
    drugB: ['ibuprofen', 'naproxen', 'diclofenac'],
    interactionType: 'lithium-NSAID',
    severity: 'major',
    description: 'Lithium and NSAID interaction',
    clinicalEffect: 'Increased lithium levels leading to toxicity',
    recommendation: 'Avoid NSAIDs. Use paracetamol for analgesia. Monitor lithium levels.',
  },
  {
    drugA: ['lithium'],
    drugB: ['ramipril', 'lisinopril', 'enalapril'],
    interactionType: 'lithium-ACEi',
    severity: 'major',
    description: 'Lithium and ACE inhibitor interaction',
    clinicalEffect: 'Increased lithium levels leading to toxicity',
    recommendation: 'Monitor lithium levels closely. Consider dose adjustment.',
  },
  {
    drugA: ['digoxin'],
    drugB: ['amiodarone'],
    interactionType: 'cardiac-glycoside-antiarrhythmic',
    severity: 'major',
    description: 'Digoxin and amiodarone interaction',
    clinicalEffect: 'Increased digoxin levels leading to toxicity (nausea, arrhythmias)',
    recommendation: 'Reduce digoxin dose by 50% when starting amiodarone. Monitor digoxin levels.',
  },
  {
    drugA: ['simvastatin', 'atorvastatin'],
    drugB: ['clarithromycin', 'erythromycin'],
    interactionType: 'statin-macrolide',
    severity: 'major',
    description: 'Statin and macrolide antibiotic interaction',
    clinicalEffect: 'Increased risk of rhabdomyolysis (muscle breakdown)',
    recommendation: 'Suspend statin during macrolide course or use azithromycin instead.',
  },
  {
    drugA: ['methotrexate'],
    drugB: ['trimethoprim'],
    interactionType: 'antimetabolite-antifolate',
    severity: 'major',
    description: 'Methotrexate and trimethoprim interaction',
    clinicalEffect: 'Increased risk of bone marrow suppression and pancytopenia',
    recommendation: 'Avoid combination. Use alternative antibiotic.',
  },
  {
    drugA: ['clopidogrel'],
    drugB: ['omeprazole'],
    interactionType: 'antiplatelet-PPI',
    severity: 'moderate',
    description: 'Clopidogrel and omeprazole interaction',
    clinicalEffect: 'Reduced antiplatelet effect of clopidogrel',
    recommendation: 'Use lansoprazole or pantoprazole instead of omeprazole.',
  },
  {
    drugA: ['amlodipine'],
    drugB: ['simvastatin'],
    interactionType: 'CCB-statin',
    severity: 'moderate',
    description: 'Amlodipine and simvastatin interaction',
    clinicalEffect: 'Increased statin levels and risk of myopathy',
    recommendation: 'Limit simvastatin dose to 20mg daily when co-prescribed with amlodipine.',
  },
  {
    drugA: ['ciprofloxacin'],
    drugB: ['theophylline'],
    interactionType: 'fluoroquinolone-xanthine',
    severity: 'major',
    description: 'Ciprofloxacin and theophylline interaction',
    clinicalEffect: 'Increased theophylline levels leading to toxicity (seizures, arrhythmias)',
    recommendation: 'Avoid combination. Use alternative antibiotic or monitor theophylline levels.',
  },
  {
    drugA: ['warfarin'],
    drugB: ['miconazole'],
    interactionType: 'anticoagulant-antifungal',
    severity: 'major',
    description: 'Warfarin and miconazole interaction',
    clinicalEffect: 'Increased INR and bleeding risk',
    recommendation: 'Monitor INR closely. Consider alternative antifungal.',
  },
  {
    drugA: ['bendroflumethiazide'],
    drugB: ['lithium'],
    interactionType: 'thiazide-lithium',
    severity: 'major',
    description: 'Bendroflumethiazide and lithium interaction',
    clinicalEffect: 'Increased lithium levels leading to toxicity',
    recommendation: 'Monitor lithium levels. Consider alternative diuretic.',
  },
  {
    drugA: ['carbamazepine'],
    drugB: ['oral contraceptive', 'ethinylestradiol', 'levonorgestrel', 'desogestrel'],
    interactionType: 'enzyme-inducer-contraceptive',
    severity: 'major',
    description: 'Carbamazepine and oral contraceptive interaction',
    clinicalEffect: 'Reduced contraceptive effect due to enzyme induction',
    recommendation: 'Use alternative contraceptive method (IUD, injection) or higher dose pill.',
  },
];

function matchesDrug(medicationName: string, drugPatterns: string[]): boolean {
  const lowerName = medicationName.toLowerCase();
  return drugPatterns.some(pattern => lowerName.includes(pattern.toLowerCase()));
}

// ── Check Interactions ────────────────────────────────────────────────────
export async function checkInteractions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.body;

    if (!residentId) {
      return res.status(400).json({ error: 'residentId is required' });
    }

    // Verify resident
    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, room_number FROM residents WHERE id = $1 AND care_home_id = $2 AND active = TRUE`,
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // Get all active medications for the resident
    const { rows: medications } = await query(
      `SELECT id, name, dose, route, frequency FROM medications
       WHERE resident_id = $1 AND care_home_id = $2 AND active = TRUE`,
      [residentId, careHomeId]
    );

    const newInteractions: any[] = [];

    // For each pair of active medications, check against interaction database
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const medA = medications[i];
        const medB = medications[j];

        for (const rule of INTERACTION_DATABASE) {
          const aMatchesA = matchesDrug(medA.name, rule.drugA);
          const aMatchesB = matchesDrug(medA.name, rule.drugB);
          const bMatchesA = matchesDrug(medB.name, rule.drugA);
          const bMatchesB = matchesDrug(medB.name, rule.drugB);

          if ((aMatchesA && bMatchesB) || (aMatchesB && bMatchesA)) {
            // Check if an active record already exists for this pair
            const { rows: existing } = await query(
              `SELECT id FROM medication_interactions
               WHERE resident_id = $1 AND care_home_id = $2
                 AND ((medication_a_id = $3 AND medication_b_id = $4) OR (medication_a_id = $4 AND medication_b_id = $3))
                 AND status = 'active'`,
              [residentId, careHomeId, medA.id, medB.id]
            );

            if (existing.length === 0) {
              // Determine which is A and which is B based on match
              const medAId = aMatchesA ? medA.id : medB.id;
              const medBId = aMatchesA ? medB.id : medA.id;

              const { rows: [interaction] } = await query(
                `INSERT INTO medication_interactions
                   (care_home_id, resident_id, medication_a_id, medication_b_id, interaction_type, severity, description, clinical_effect, recommendation, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active') RETURNING *`,
                [careHomeId, residentId, medAId, medBId, rule.interactionType, rule.severity, rule.description, rule.clinicalEffect, rule.recommendation]
              );
              newInteractions.push(interaction);
            }
          }
        }
      }
    }

    // Get all interactions for this resident (new and existing)
    const { rows: allInteractions } = await query(
      `SELECT mi.*,
              ma.name AS medication_a_name, ma.dose AS medication_a_dose,
              mb.name AS medication_b_name, mb.dose AS medication_b_dose
       FROM medication_interactions mi
       JOIN medications ma ON ma.id = mi.medication_a_id
       JOIN medications mb ON mb.id = mi.medication_b_id
       WHERE mi.resident_id = $1 AND mi.care_home_id = $2
       ORDER BY
         CASE mi.severity
           WHEN 'contraindicated' THEN 1
           WHEN 'major' THEN 2
           WHEN 'moderate' THEN 3
           WHEN 'minor' THEN 4
         END,
         mi.created_at DESC`,
      [residentId, careHomeId]
    );

    res.json({
      residentId,
      residentName: `${resident.first_name} ${resident.last_name}`,
      room: resident.room_number,
      medicationsChecked: medications.length,
      newInteractionsFound: newInteractions.length,
      totalInteractions: allInteractions.length,
      interactions: allInteractions,
    });
  } catch (err) { next(err); }
}

// ── Get Resident Interactions ─────────────────────────────────────────────
export async function getResidentInteractions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    const { rows } = await query(
      `SELECT mi.*,
              ma.name AS medication_a_name, ma.dose AS medication_a_dose,
              mb.name AS medication_b_name, mb.dose AS medication_b_dose,
              u.first_name || ' ' || u.last_name AS acknowledged_by_name
       FROM medication_interactions mi
       JOIN medications ma ON ma.id = mi.medication_a_id
       JOIN medications mb ON mb.id = mi.medication_b_id
       LEFT JOIN users u ON u.id = mi.acknowledged_by
       WHERE mi.resident_id = $1 AND mi.care_home_id = $2
       ORDER BY
         CASE mi.severity
           WHEN 'contraindicated' THEN 1
           WHEN 'major' THEN 2
           WHEN 'moderate' THEN 3
           WHEN 'minor' THEN 4
         END,
         mi.created_at DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Acknowledge Interaction ───────────────────────────────────────────────
export async function acknowledgeInteraction(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { id } = req.params;

    const { rows: [interaction] } = await query(
      `UPDATE medication_interactions
       SET acknowledged_by = $1, acknowledged_at = NOW(), status = 'acknowledged'
       WHERE id = $2 AND care_home_id = $3
       RETURNING *`,
      [userId, id, careHomeId]
    );

    if (!interaction) return res.status(404).json({ error: 'Interaction not found' });
    res.json(interaction);
  } catch (err) { next(err); }
}

// ── Get Interaction Alerts ────────────────────────────────────────────────
export async function getInteractionAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT mi.*,
              r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
              ma.name AS medication_a_name, ma.dose AS medication_a_dose,
              mb.name AS medication_b_name, mb.dose AS medication_b_dose
       FROM medication_interactions mi
       JOIN residents r ON r.id = mi.resident_id
       JOIN medications ma ON ma.id = mi.medication_a_id
       JOIN medications mb ON mb.id = mi.medication_b_id
       WHERE mi.care_home_id = $1 AND mi.status = 'active'
       ORDER BY
         CASE mi.severity
           WHEN 'contraindicated' THEN 1
           WHEN 'major' THEN 2
           WHEN 'moderate' THEN 3
           WHEN 'minor' THEN 4
         END,
         mi.flagged_at DESC`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
