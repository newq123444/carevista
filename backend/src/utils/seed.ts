// ============================================================
// src/utils/seed.ts  —  GODMODE FULL DATASET SEED
// Generates a fully populated demo database:
//   • 24 active residents (all care types)
//   • 8 staff across all roles
//   • 80+ medications with eMAR history (30 days)
//   • 70+ care notes spanning 30 days
//   • 25+ incidents with updates
//   • 3-month rota for all staff
//   • 40+ training records
//   • 20+ compliance actions
//   • 8 policies
//   • 30+ family messages (inbound + outbound)
//   • 4 months of invoices for all self-funded/LA residents
//   • Rich AI analysis history
// ============================================================

import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || /sslmode=require/.test(process.env.DATABASE_URL || '') || process.env.PGSSL === 'true') ? { rejectUnauthorized: false } : false,
});

// ── Helpers ───────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}
function daysFromNow(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() + n); return d;
}
function dateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
async function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
}

// ── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱  Starting GODMODE seed…\n');

    // Guard
    const { rows: existing } = await client.query(
      `SELECT id FROM care_homes WHERE email = 'admin@willowbrook.carevista.co.uk' LIMIT 1`
    );
    if (existing.length > 0) {
      console.log('⚠️   Already seeded — skipping. Drop & recreate DB to re-seed.');
      return;
    }

    await client.query('BEGIN');

    // ── 1. Care Group ──────────────────────────────────────────────────────
    console.log('  ▶  Care group…');
    const { rows: [group] } = await client.query(
      `INSERT INTO care_groups (name, contact_email, contact_phone, address)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Willowbrook Care Group Ltd', 'group@willowbrook.co.uk', '01234 567890', '10 Corporate Park, Manchester, M1 5AA']
    );

    // ── 2. Care Home ───────────────────────────────────────────────────────
    console.log('  ▶  Care home…');
    const { rows: [home] } = await client.query(
      `INSERT INTO care_homes (
         group_id, name, address, postcode, phone, email,
         cqc_location_id, registered_beds, active
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE) RETURNING id`,
      [group.id, 'Willowbrook House', '45 Meadow Lane, Salford', 'M5 3RQ',
       '0161 789 0123', 'admin@willowbrook.carevista.co.uk',
       'CQC-WBH-2019-001', 30]
    );
    const homeId = home.id;

    // ── 3. Users ───────────────────────────────────────────────────────────
    console.log('  ▶  Users…');
    const pw = await hash('Demo1234!');
    const usersData = [
      { email: 'manager@demo.carevista.co.uk',   role: 'home_manager',     first: 'Sarah',   last: 'Mitchell', phone: '07700 900001' },
      { email: 'deputy@demo.carevista.co.uk',    role: 'deputy_manager',   first: 'James',   last: 'Patel',    phone: '07700 900002' },
      { email: 'nurse@demo.carevista.co.uk',     role: 'registered_nurse', first: 'Priya',   last: 'Sharma',   phone: '07700 900003' },
      { email: 'senior@demo.carevista.co.uk',    role: 'senior_carer',     first: 'Daniel',  last: 'Hughes',   phone: '07700 900004' },
      { email: 'carer1@demo.carevista.co.uk',    role: 'carer',            first: 'Amara',   last: 'Osei',     phone: '07700 900005' },
      { email: 'carer2@demo.carevista.co.uk',    role: 'carer',            first: 'Tom',     last: 'Walsh',    phone: '07700 900006' },
      { email: 'activities@demo.carevista.co.uk',role: 'activities',       first: 'Lisa',    last: 'Brown',    phone: '07700 900007' },
      { email: 'finance@demo.carevista.co.uk',   role: 'finance',          first: 'Karen',   last: 'Lloyd',    phone: '07700 900008' },
      { email: 'cleaning@demo.carevista.co.uk',  role: 'cleaning',         first: 'Grace',   last: 'Williams', phone: '07700 900009' },
      { email: 'kitchen@demo.carevista.co.uk',   role: 'kitchen',          first: 'Marcus',  last: 'Johnson',  phone: '07700 900010' },
      { email: 'maintenance@demo.carevista.co.uk', role: 'maintenance',    first: 'Robert',  last: 'Taylor',   phone: '07700 900011' },
    ];
    const userIds: Record<string, string> = {};
    for (const u of usersData) {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (care_home_id, email, password_hash, role, first_name, last_name, phone, active, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,TRUE) RETURNING id`,
        [homeId, u.email, pw, u.role, u.first, u.last, u.phone]
      );
      userIds[u.email] = user.id;
    }
    const managerId  = userIds['manager@demo.carevista.co.uk'];
    const deputyId   = userIds['deputy@demo.carevista.co.uk'];
    const nurseId    = userIds['nurse@demo.carevista.co.uk'];
    const seniorId   = userIds['senior@demo.carevista.co.uk'];
    const carer1Id   = userIds['carer1@demo.carevista.co.uk'];
    const carer2Id   = userIds['carer2@demo.carevista.co.uk'];
    const financeId  = userIds['finance@demo.carevista.co.uk'];

    // ── 4. Staff Profiles ──────────────────────────────────────────────────
    console.log('  ▶  Staff profiles…');
    const staffData = [
      { email: 'manager@demo.carevista.co.uk',   emp: 'EMP001', title: 'Home Manager',          hours: 37.5, rate: 22.50, dbsDaysLeft: 400 },
      { email: 'deputy@demo.carevista.co.uk',    emp: 'EMP002', title: 'Deputy Manager',         hours: 37.5, rate: 19.00, dbsDaysLeft: 300 },
      { email: 'nurse@demo.carevista.co.uk',     emp: 'EMP003', title: 'Registered Nurse (RGN)', hours: 37.5, rate: 21.00, dbsDaysLeft: 200 },
      { email: 'senior@demo.carevista.co.uk',    emp: 'EMP004', title: 'Senior Carer',           hours: 37.5, rate: 14.50, dbsDaysLeft: 180 },
      { email: 'carer1@demo.carevista.co.uk',    emp: 'EMP005', title: 'Care Assistant',         hours: 30.0, rate: 12.00, dbsDaysLeft: 18  },  // expiring!
      { email: 'carer2@demo.carevista.co.uk',    emp: 'EMP006', title: 'Care Assistant',         hours: 24.0, rate: 12.00, dbsDaysLeft: 500 },
      { email: 'activities@demo.carevista.co.uk',emp: 'EMP007', title: 'Activities Coordinator', hours: 30.0, rate: 12.50, dbsDaysLeft: 350 },
      { email: 'finance@demo.carevista.co.uk',   emp: 'EMP008', title: 'Finance Officer',        hours: 37.5, rate: 16.00, dbsDaysLeft: 450 },
      { email: 'cleaning@demo.carevista.co.uk',  emp: 'EMP009', title: 'Cleaning Supervisor',     hours: 35.0, rate: 12.50, dbsDaysLeft: 380 },
      { email: 'kitchen@demo.carevista.co.uk',   emp: 'EMP010', title: 'Head Cook',               hours: 37.5, rate: 14.00, dbsDaysLeft: 420 },
      { email: 'maintenance@demo.carevista.co.uk', emp: 'EMP011', title: 'Maintenance Officer',   hours: 37.5, rate: 15.50, dbsDaysLeft: 500 },
    ];
    const staffIds: Record<string, string> = {};
    for (const s of staffData) {
      const { rows: [sp] } = await client.query(
        `INSERT INTO staff_profiles (
           user_id, care_home_id, employee_number, job_title,
           contract_hours, hourly_rate,
           dbs_number, dbs_expires, start_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [userIds[s.email], homeId, s.emp, s.title, s.hours, s.rate,
         `DBS${s.emp}2023`, dateStr(daysFromNow(s.dbsDaysLeft)),
         dateStr(daysAgo(randInt(180, 900)))]
      );
      staffIds[s.email] = sp.id;
    }

    // ── 5. Training Records ────────────────────────────────────────────────
    console.log('  ▶  Training records (40+)…');
    const courses = [
      { name: 'Manual Handling', expiryMonths: 12 },
      { name: 'Fire Safety', expiryMonths: 12 },
      { name: 'Infection Prevention & Control', expiryMonths: 12 },
      { name: 'Safeguarding Adults', expiryMonths: 24 },
      { name: 'Dementia Awareness', expiryMonths: 36 },
      { name: 'First Aid', expiryMonths: 36 },
      { name: 'Medication Administration', expiryMonths: 12 },
      { name: 'Food Hygiene', expiryMonths: 36 },
    ];
    for (const [email] of Object.entries(userIds)) {
      const staffProfileId = staffIds[email];
      if (!staffProfileId) continue; // skip users without a staff profile (e.g. finance)
      for (const course of courses) {
        // Amara: Fire Safety expired; Carer2: Dementia expiring soon
        const isAmara = email === 'carer1@demo.carevista.co.uk';
        const isCarer2 = email === 'carer2@demo.carevista.co.uk';
        const completedDaysAgo = randInt(30, 300);
        const expiryDays = course.expiryMonths * 30;
        let daysUntilExpiry = expiryDays - completedDaysAgo;
        if (isAmara && course.name === 'Fire Safety') daysUntilExpiry = -10;      // expired
        if (isCarer2 && course.name === 'Dementia Awareness') daysUntilExpiry = 12; // expiring

        await client.query(
          `INSERT INTO training_records (
             staff_id, care_home_id, course_name, completed_date, expiry_date,
             status, provider, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [staffProfileId, homeId, course.name,
           dateStr(daysAgo(completedDaysAgo)),
           dateStr(daysFromNow(daysUntilExpiry)),
           daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry < 30 ? 'expiring' : 'current',
           rand(['Skills for Care', 'In-house', 'Bluestream', 'Care Certificate']),
           managerId]
        );
      }
    }

    // ── 6. Residents (24 active) ───────────────────────────────────────────
    console.log('  ▶  Residents (24 active)…');
    const residentsData = [
      // Room 1-8: Original + enhanced
      { first:'Margaret', last:'Hollis',    dob:'1935-04-12', room:'1',  risk:'low',    care:'residential', funding:'self_funded',     feeW:1200, gp:'Dr. Patel',   dnacpr:false, diet:'No restrictions', mob:'Independent with walking frame', allergy:'Penicillin' },
      { first:'Arthur',   last:'Pemberton', dob:'1930-09-23', room:'2',  risk:'high',   care:'dementia',    funding:'local_authority', feeW:950,  gp:'Dr. Rahman',  dnacpr:true,  diet:'Pureed food, thickened fluids', mob:'Hoist required', allergy:'None known' },
      { first:'Dorothy',  last:'Sinclair',  dob:'1938-01-07', room:'3',  risk:'medium', care:'dementia',    funding:'nhs_continuing',  feeW:0,    gp:'Dr. Patel',   dnacpr:false, diet:'Soft diet', mob:'Zimmer frame', allergy:'Latex' },
      { first:'Harold',   last:'Fletcher',  dob:'1933-06-18', room:'4',  risk:'high',   care:'nursing',     funding:'self_funded',     feeW:1350, gp:'Dr. Singh',   dnacpr:true,  diet:'Soft diet, no spicy food', mob:'Hoist required', allergy:'Codeine' },
      { first:'Edith',    last:'Turner',    dob:'1940-11-30', room:'5',  risk:'low',    care:'residential', funding:'local_authority', feeW:900,  gp:'Dr. Rahman',  dnacpr:false, diet:'Diabetic diet', mob:'Independent', allergy:'None known' },
      { first:'Reginald', last:'Barnes',    dob:'1928-03-05', room:'6',  risk:'medium', care:'nursing',     funding:'self_funded',     feeW:1100, gp:'Dr. Patel',   dnacpr:false, diet:'Soft diet', mob:'Walking stick', allergy:'Aspirin' },
      { first:'Vera',     last:'Chapman',   dob:'1942-08-14', room:'7',  risk:'low',    care:'residential', funding:'self_funded',     feeW:1250, gp:'Dr. Singh',   dnacpr:false, diet:'No restrictions', mob:'Independent', allergy:'None known' },
      { first:'Cyril',    last:'Newton',    dob:'1931-12-01', room:'8',  risk:'high',   care:'dementia',    funding:'nhs_continuing',  feeW:0,    gp:'Dr. Rahman',  dnacpr:true,  diet:'Fortified meals', mob:'Hoist required', allergy:'None known' },
      // Room 9-16: New residents
      { first:'Elsie',    last:'Hartley',   dob:'1936-07-22', room:'9',  risk:'medium', care:'residential', funding:'self_funded',     feeW:1200, gp:'Dr. Patel',   dnacpr:false, diet:'No restrictions', mob:'Walking frame', allergy:'Sulphonamides' },
      { first:'Frederick',last:'Osborne',   dob:'1932-02-14', room:'10', risk:'high',   care:'nursing',     funding:'local_authority', feeW:950,  gp:'Dr. Singh',   dnacpr:true,  diet:'Liquidised food', mob:'Hoist required', allergy:'None known' },
      { first:'Agnes',    last:'Whitfield', dob:'1939-10-31', room:'11', risk:'low',    care:'residential', funding:'self_funded',     feeW:1100, gp:'Dr. Rahman',  dnacpr:false, diet:'Vegetarian', mob:'Independent', allergy:'None known' },
      { first:'George',   last:'Bradshaw',  dob:'1929-05-08', room:'12', risk:'medium', care:'dementia',    funding:'nhs_continuing',  feeW:0,    gp:'Dr. Patel',   dnacpr:false, diet:'Finger foods', mob:'Zimmer frame', allergy:'None known' },
      { first:'Winifred', last:'Stanton',   dob:'1937-08-19', room:'13', risk:'low',    care:'residential', funding:'self_funded',     feeW:1300, gp:'Dr. Singh',   dnacpr:false, diet:'Gluten free', mob:'Independent with stick', allergy:'Gluten — coeliac' },
      { first:'Ernest',   last:'Higgins',   dob:'1934-12-03', room:'14', risk:'high',   care:'nursing',     funding:'local_authority', feeW:900,  gp:'Dr. Rahman',  dnacpr:true,  diet:'Thickened fluids, soft food', mob:'Hoist required', allergy:'None known' },
      { first:'Phyllis',  last:'Goodman',   dob:'1941-03-27', room:'15', risk:'low',    care:'residential', funding:'self_funded',     feeW:1150, gp:'Dr. Patel',   dnacpr:false, diet:'No restrictions', mob:'Independent', allergy:'Pollen (seasonal)' },
      { first:'Bertram',  last:'Cross',     dob:'1927-09-16', room:'16', risk:'medium', care:'dementia',    funding:'local_authority', feeW:950,  gp:'Dr. Singh',   dnacpr:false, diet:'Soft diet, no nuts', mob:'Walking frame', allergy:'Tree nuts' },
      // Room 17-24: More variety
      { first:'Gladys',   last:'Perkins',   dob:'1943-06-11', room:'17', risk:'low',    care:'residential', funding:'self_funded',     feeW:1200, gp:'Dr. Rahman',  dnacpr:false, diet:'No restrictions', mob:'Independent', allergy:'None known' },
      { first:'Norman',   last:'Yates',     dob:'1930-11-25', room:'18', risk:'medium', care:'nursing',     funding:'nhs_continuing',  feeW:0,    gp:'Dr. Patel',   dnacpr:false, diet:'Low sodium', mob:'Wheelchair', allergy:'Metformin' },
      { first:'Irene',    last:'Walton',    dob:'1938-04-06', room:'19', risk:'low',    care:'residential', funding:'self_funded',     feeW:1100, gp:'Dr. Singh',   dnacpr:false, diet:'No restrictions', mob:'Walking frame', allergy:'None known' },
      { first:'Stanley',  last:'Muir',      dob:'1931-07-30', room:'20', risk:'high',   care:'nursing',     funding:'local_authority', feeW:900,  gp:'Dr. Rahman',  dnacpr:true,  diet:'Puréed food, thickened fluids', mob:'Hoist required', allergy:'Ibuprofen' },
      { first:'Muriel',   last:'Thornton',  dob:'1944-01-15', room:'21', risk:'low',    care:'residential', funding:'self_funded',     feeW:1250, gp:'Dr. Patel',   dnacpr:false, diet:'Diabetic diet, no red meat', mob:'Independent', allergy:'None known' },
      { first:'Albert',   last:'Griffiths', dob:'1929-03-22', room:'22', risk:'medium', care:'dementia',    funding:'local_authority', feeW:950,  gp:'Dr. Singh',   dnacpr:false, diet:'Finger foods', mob:'Zimmer frame', allergy:'None known' },
      { first:'Hilda',    last:'Sutton',    dob:'1936-10-09', room:'23', risk:'low',    care:'residential', funding:'self_funded',     feeW:1200, gp:'Dr. Rahman',  dnacpr:false, diet:'No restrictions', mob:'Walking stick', allergy:'None known' },
      { first:'Clifford', last:'Denton',    dob:'1932-08-14', room:'24', risk:'high',   care:'palliative',  funding:'nhs_continuing',  feeW:0,    gp:'Dr. Patel',   dnacpr:true,  diet:'Comfort foods, soft', mob:'Bed-bound', allergy:'Morphine — alternative prescribed' },
    ];

    const residentIds: Record<string, string> = {};  // indexed by room number
    for (const r of residentsData) {
      const { rows: [res] } = await client.query(
        `INSERT INTO residents (
           care_home_id, first_name, last_name, date_of_birth, room_number,
           admission_date, risk_level, funding_type, weekly_fee,
           gp_name, gp_practice, gp_phone, nhs_number, dnacpr, active,
           care_needs_summary, language
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE,$15,'English')
         RETURNING id`,
        [homeId, r.first, r.last, r.dob, r.room,
         dateStr(daysAgo(randInt(30, 1200))),
         r.risk, r.funding, r.feeW,
         r.gp, 'Salford Medical Centre', '0161 123 4567',
         `NHS${r.room.padStart(3,'0')}456789`,
         r.dnacpr,
         `${r.first} requires support tailored to their ${r.care} care needs. Diet: ${r.diet}. Mobility: ${r.mob}. Allergies: ${r.allergy}. Please refer to care plan for full details.`]
      );
      residentIds[r.room] = res.id;
    }

    // Conditions
    const conditions: Record<string, string[]> = {
      '1':  ['Type 2 Diabetes', 'Hypertension'],
      '2':  ['Vascular Dementia', 'Atrial Fibrillation', 'Heart Failure'],
      '3':  ["Alzheimer's Disease", 'Osteoporosis'],
      '4':  ["Parkinson's Disease", 'Chronic Kidney Disease', 'Chronic Pain'],
      '5':  ['Hypertension', 'Osteoarthritis', 'Type 2 Diabetes'],
      '6':  ['COPD', 'Type 2 Diabetes', 'Depression'],
      '7':  ['Hypothyroidism', 'Anxiety', 'Osteoarthritis'],
      '8':  ['Lewy Body Dementia', 'COPD', 'Hypertension'],
      '9':  ['Heart Failure', 'Anaemia', 'Depression'],
      '10': ['Stroke residual effects', 'Dysphagia', 'Hypertension'],
      '11': ['Osteoporosis', 'Rheumatoid Arthritis'],
      '12': ["Alzheimer's Disease", 'Epilepsy', 'Depression'],
      '13': ['Coeliac Disease', 'Hypertension', 'Anxiety'],
      '14': ['Motor Neurone Disease', 'Respiratory failure'],
      '15': ['Hypothyroidism', 'Mild Cognitive Impairment'],
      '16': ['Vascular Dementia', 'COPD'],
      '17': ['Osteoarthritis', 'Hypertension'],
      '18': ['Chronic Heart Failure', 'Chronic Kidney Disease Stage 3'],
      '19': ['Type 2 Diabetes', 'Hypothyroidism'],
      '20': ['End-stage COPD', 'Heart Failure', 'Depression'],
      '21': ['Type 2 Diabetes', 'Hypertension', 'Depression'],
      '22': ["Alzheimer's Disease", 'Urinary Incontinence'],
      '23': ['Osteoporosis', 'Hypertension'],
      '24': ['Cancer (advanced)', 'Chronic Pain', 'Anxiety'],
    };
    for (const [room, conds] of Object.entries(conditions)) {
      for (const cond of conds) {
        await client.query(
          `INSERT INTO resident_conditions (resident_id, condition, diagnosed)
           VALUES ($1,$2,$3)`,
          [residentIds[room], cond, dateStr(daysAgo(randInt(200, 2000)))]
        );
      }
    }

    // Next of kin
    const nokData: Record<string, [string, string]> = {
      '1':  ['Patricia Hollis', 'Daughter'],    '2':  ['Robert Pemberton', 'Son'],
      '3':  ['Michael Sinclair', 'Husband'],     '4':  ['Judith Fletcher', 'Wife'],
      '5':  ['Carol Edwards', 'Daughter'],       '6':  ['Stephen Barnes', 'Son'],
      '7':  ['Louise Chapman', 'Daughter'],      '8':  ['Brian Newton', 'Son'],
      '9':  ['Janice Hartley', 'Daughter'],      '10': ['Catherine Osborne', 'Wife'],
      '11': ['Peter Whitfield', 'Son'],          '12': ['Anne Bradshaw', 'Daughter'],
      '13': ['Thomas Stanton', 'Son'],           '14': ['Mary Higgins', 'Wife'],
      '15': ['David Goodman', 'Son'],            '16': ['Janet Cross', 'Daughter'],
      '17': ['Kevin Perkins', 'Son'],            '18': ['Rita Yates', 'Wife'],
      '19': ['Helen Walton', 'Daughter'],        '20': ['Frank Muir Jr', 'Son'],
      '21': ['Sandra Thornton', 'Daughter'],     '22': ['Roy Griffiths', 'Son'],
      '23': ['Diane Sutton', 'Daughter'],        '24': ['Margaret Denton', 'Wife'],
    };
    for (const [room, [name, rel]] of Object.entries(nokData)) {
      await client.query(
        `INSERT INTO resident_contacts (
           resident_id, name, relationship, phone, email,
           is_nok, is_emergency, family_portal_access
         ) VALUES ($1,$2,$3,$4,$5,TRUE,TRUE,FALSE)`,
        [residentIds[room], name, rel,
         `0770090${room.padStart(2,'0')}0`,
         `nok.room${room}@example.com`]
      );
    }

    // ── 7. Medications ─────────────────────────────────────────────────────
    console.log('  ▶  Medications (80+)…');
    type MedEntry = {
      room: string; name: string; dose: string; route: string;
      times: string[]; freq: string; indication: string;
      controlled?: boolean; prn?: boolean;
    };
    const meds: MedEntry[] = [
      // Room 1 - Margaret (diabetes + hypertension)
      { room:'1', name:'Metformin',       dose:'500mg',    route:'Oral',    times:['08:00','20:00'],          freq:'Twice daily',       indication:'Type 2 Diabetes', controlled:false },
      { room:'1', name:'Amlodipine',      dose:'5mg',      route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Hypertension',    controlled:false },
      { room:'1', name:'Atorvastatin',    dose:'20mg',     route:'Oral',    times:['22:00'],                  freq:'Once at night',     indication:'Cholesterol',     controlled:false },
      // Room 2 - Arthur (dementia, AF, heart failure) — DNACPR
      { room:'2', name:'Donepezil',       dose:'10mg',     route:'Oral',    times:['22:00'],                  freq:'Once at night',     indication:'Dementia',        controlled:false },
      { room:'2', name:'Rivaroxaban',     dose:'20mg',     route:'Oral',    times:['18:00'],                  freq:'Once daily',        indication:'AF anticoagulation', controlled:false },
      { room:'2', name:'Furosemide',      dose:'40mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Heart Failure',   controlled:false },
      { room:'2', name:'Spironolactone',  dose:'25mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Heart Failure',   controlled:false },
      { room:'2', name:'Lorazepam',       dose:'0.5mg',    route:'Oral',    times:[],                         freq:'PRN',               indication:'Acute agitation', controlled:true,  prn:true },
      // Room 3 - Dorothy (Alzheimer's, osteoporosis)
      { room:'3', name:'Memantine',       dose:'10mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:"Alzheimer's",     controlled:false },
      { room:'3', name:'Alendronic Acid', dose:'70mg',     route:'Oral',    times:['08:00'],                  freq:'Once weekly',       indication:'Osteoporosis',    controlled:false },
      { room:'3', name:'Calcium + D3',    dose:'1 tablet', route:'Oral',    times:['12:00'],                  freq:'Once daily',        indication:'Osteoporosis',    controlled:false },
      // Room 4 - Harold (Parkinson's, chronic pain) — DNACPR, high risk
      { room:'4', name:'Co-careldopa',    dose:'25/100mg', route:'Oral',    times:['07:00','12:00','17:00'],   freq:'Three times daily', indication:"Parkinson's Disease", controlled:false },
      { room:'4', name:'Morphine Sulphate SR', dose:'10mg', route:'Oral',  times:['08:00','20:00'],           freq:'Twice daily',       indication:'Chronic Pain',    controlled:true  },
      { room:'4', name:'Oramorph',        dose:'2.5–5mg',  route:'Oral',    times:[],                         freq:'PRN — max 4-hourly',indication:'Breakthrough Pain', controlled:true, prn:true },
      { room:'4', name:'Lactulose',       dose:'15ml',     route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Constipation (opioid-induced)', controlled:false },
      // Room 5 - Edith (hypertension, osteoarthritis)
      { room:'5', name:'Ramipril',        dose:'5mg',      route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Hypertension',    controlled:false },
      { room:'5', name:'Metformin',       dose:'500mg',    route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Type 2 Diabetes', controlled:false },
      { room:'5', name:'Paracetamol',     dose:'1g',       route:'Oral',    times:['08:00','14:00','20:00'],   freq:'Three times daily', indication:'Osteoarthritis pain', controlled:false },
      // Room 6 - Reginald (COPD, diabetes)
      { room:'6', name:'Tiotropium',      dose:'18mcg',    route:'Inhaled', times:['08:00'],                  freq:'Once daily',        indication:'COPD',            controlled:false },
      { room:'6', name:'Salbutamol',      dose:'100mcg 2 puffs', route:'Inhaled', times:[],                  freq:'PRN',               indication:'COPD rescue',     controlled:false, prn:true },
      { room:'6', name:'Budesonide/Formoterol', dose:'160/4.5mcg', route:'Inhaled', times:['08:00','20:00'], freq:'Twice daily',       indication:'COPD maintenance', controlled:false },
      { room:'6', name:'Sertraline',      dose:'50mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Depression',      controlled:false },
      // Room 7 - Vera (hypothyroidism, anxiety)
      { room:'7', name:'Levothyroxine',   dose:'50mcg',    route:'Oral',    times:['07:00'],                  freq:'Once daily',        indication:'Hypothyroidism',  controlled:false },
      { room:'7', name:'Sertraline',      dose:'50mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Anxiety/Depression', controlled:false },
      { room:'7', name:'Zopiclone',       dose:'3.75mg',   route:'Oral',    times:['22:00'],                  freq:'PRN — max 3 nights/week', indication:'Short-term insomnia', controlled:true, prn:true },
      // Room 8 - Cyril (Lewy body dementia) — DNACPR, high risk
      { room:'8', name:'Quetiapine',      dose:'25mg',     route:'Oral',    times:['22:00'],                  freq:'Once at night',     indication:'Behavioural symptoms of dementia', controlled:false },
      { room:'8', name:'Rivastigmine patch', dose:'9.5mg', route:'Transdermal', times:['08:00'],             freq:'Once daily',        indication:'Lewy body dementia', controlled:false },
      { room:'8', name:'Salbutamol',      dose:'100mcg 2 puffs', route:'Inhaled', times:[],                  freq:'PRN',               indication:'COPD rescue',     controlled:false, prn:true },
      // Room 9 - Elsie (heart failure, anaemia)
      { room:'9', name:'Furosemide',      dose:'20mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Heart Failure',   controlled:false },
      { room:'9', name:'Ferrous Sulphate',dose:'200mg',    route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Iron Deficiency Anaemia', controlled:false },
      { room:'9', name:'Sertraline',      dose:'50mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Depression',      controlled:false },
      // Room 10 - Frederick (stroke, dysphagia) — DNACPR
      { room:'10', name:'Aspirin',        dose:'75mg dispersible', route:'Oral', times:['08:00'],             freq:'Once daily',        indication:'Secondary stroke prevention', controlled:false },
      { room:'10', name:'Atorvastatin',   dose:'40mg',     route:'Oral',    times:['22:00'],                  freq:'Once at night',     indication:'Cholesterol — stroke prevention', controlled:false },
      { room:'10', name:'Amlodipine',     dose:'10mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Hypertension',    controlled:false },
      // Room 11 - Agnes (osteoporosis, RA)
      { room:'11', name:'Methotrexate',   dose:'10mg',     route:'Oral',    times:['08:00'],                  freq:'Once weekly (Monday)', indication:'Rheumatoid Arthritis', controlled:false },
      { room:'11', name:'Folic Acid',     dose:'5mg',      route:'Oral',    times:['08:00'],                  freq:'Once weekly (Thursday)', indication:'Methotrexate supplement', controlled:false },
      { room:'11', name:'Alendronic Acid',dose:'70mg',     route:'Oral',    times:['08:00'],                  freq:'Once weekly',       indication:'Osteoporosis',    controlled:false },
      // Room 12 - George (dementia, epilepsy)
      { room:'12', name:'Sodium Valproate',dose:'400mg',   route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Epilepsy',        controlled:false },
      { room:'12', name:'Memantine',      dose:'10mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:"Alzheimer's",     controlled:false },
      // Room 13 - Winifred (coeliac, hypertension)
      { room:'13', name:'Ramipril',       dose:'5mg',      route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Hypertension',    controlled:false },
      { room:'13', name:'Propranolol',    dose:'40mg',     route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Anxiety',         controlled:false },
      // Room 14 - Ernest (MND) — DNACPR, high risk
      { room:'14', name:'Baclofen',       dose:'10mg',     route:'Oral',    times:['08:00','14:00','20:00'],   freq:'Three times daily', indication:'Spasticity — MND', controlled:false },
      { room:'14', name:'Hyoscine Hydrobromide', dose:'150mcg', route:'Oral', times:[],                      freq:'PRN — secretions',  indication:'Excessive secretions', controlled:false, prn:true },
      // Room 15 - Phyllis (hypothyroidism, MCI)
      { room:'15', name:'Levothyroxine',  dose:'75mcg',    route:'Oral',    times:['07:00'],                  freq:'Once daily',        indication:'Hypothyroidism',  controlled:false },
      { room:'15', name:'Donepezil',      dose:'5mg',      route:'Oral',    times:['22:00'],                  freq:'Once at night',     indication:'Mild Cognitive Impairment', controlled:false },
      // Room 16 - Bertram (vascular dementia, COPD)
      { room:'16', name:'Donepezil',      dose:'10mg',     route:'Oral',    times:['22:00'],                  freq:'Once at night',     indication:'Vascular Dementia', controlled:false },
      { room:'16', name:'Tiotropium',     dose:'18mcg',    route:'Inhaled', times:['08:00'],                  freq:'Once daily',        indication:'COPD',            controlled:false },
      // Room 17 - Gladys
      { room:'17', name:'Amlodipine',     dose:'5mg',      route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Hypertension',    controlled:false },
      { room:'17', name:'Paracetamol',    dose:'1g',       route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Osteoarthritis',  controlled:false },
      // Room 18 - Norman (CHF, CKD)
      { room:'18', name:'Furosemide',     dose:'80mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Chronic Heart Failure', controlled:false },
      { room:'18', name:'Digoxin',        dose:'125mcg',   route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Heart Failure/AF', controlled:false },
      { room:'18', name:'Spironolactone', dose:'25mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Heart Failure',   controlled:false },
      // Room 19 - Irene (diabetes, hypothyroidism)
      { room:'19', name:'Metformin',      dose:'1g',       route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Type 2 Diabetes', controlled:false },
      { room:'19', name:'Levothyroxine',  dose:'50mcg',    route:'Oral',    times:['07:00'],                  freq:'Once daily',        indication:'Hypothyroidism',  controlled:false },
      // Room 20 - Stanley (end-stage COPD, CHF) — DNACPR, high risk
      { room:'20', name:'Morphine Sulphate SR', dose:'5mg', route:'Oral',  times:['08:00','20:00'],           freq:'Twice daily',       indication:'Dyspnoea/Pain',   controlled:true  },
      { room:'20', name:'Midazolam',      dose:'2.5mg',    route:'SC',      times:[],                         freq:'PRN — anxiety/breathlessness', indication:'Palliation', controlled:true, prn:true },
      { room:'20', name:'Tiotropium',     dose:'18mcg',    route:'Inhaled', times:['08:00'],                  freq:'Once daily',        indication:'COPD',            controlled:false },
      { room:'20', name:'Furosemide',     dose:'40mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Heart Failure',   controlled:false },
      // Room 21 - Muriel (diabetes, depression)
      { room:'21', name:'Metformin',      dose:'500mg',    route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Type 2 Diabetes', controlled:false },
      { room:'21', name:'Ramipril',       dose:'2.5mg',    route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Hypertension',    controlled:false },
      { room:'21', name:'Fluoxetine',     dose:'20mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Depression',      controlled:false },
      // Room 22 - Albert (dementia)
      { room:'22', name:'Memantine',      dose:'10mg',     route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:"Alzheimer's",     controlled:false },
      { room:'22', name:'Oxybutynin',     dose:'5mg',      route:'Oral',    times:['08:00','20:00'],           freq:'Twice daily',       indication:'Urinary incontinence', controlled:false },
      // Room 23 - Hilda
      { room:'23', name:'Alendronic Acid',dose:'70mg',     route:'Oral',    times:['08:00'],                  freq:'Once weekly',       indication:'Osteoporosis',    controlled:false },
      { room:'23', name:'Amlodipine',     dose:'5mg',      route:'Oral',    times:['08:00'],                  freq:'Once daily',        indication:'Hypertension',    controlled:false },
      // Room 24 - Clifford (palliative) — DNACPR, high risk
      { room:'24', name:'Fentanyl patch', dose:'25mcg/hr', route:'Transdermal', times:['08:00'],             freq:'Every 72 hours',    indication:'Chronic Cancer Pain (palliative)', controlled:true  },
      { room:'24', name:'Haloperidol',    dose:'0.5mg',    route:'SC',      times:[],                         freq:'PRN — nausea/agitation', indication:'Palliative — symptom control', controlled:true, prn:true },
      { room:'24', name:'Hyoscine Hydrobromide', dose:'400mcg', route:'SC', times:[],                        freq:'PRN — secretions',  indication:'Palliative — secretions', controlled:false, prn:true },
      { room:'24', name:'Midazolam',      dose:'2.5mg',    route:'SC',      times:[],                         freq:'PRN — terminal restlessness', indication:'Palliative — distress', controlled:true, prn:true },
    ];

    const medicationIds: string[] = [];
    for (const m of meds) {
      const { rows: [med] } = await client.query(
        `INSERT INTO medications (
           care_home_id, resident_id, name, dose, route, frequency,
           administration_times, start_date, prescribed_by,
           indication, is_prn, is_controlled, quantity_in_stock, created_by, active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE) RETURNING id`,
        [homeId, residentIds[m.room], m.name, m.dose, m.route, m.freq,
         m.times, dateStr(daysAgo(randInt(30, 180))), 'Dr. Patel',
         m.indication, m.prn ?? false, m.controlled ?? false,
         m.times.length > 0 ? 28 * m.times.length : 14,
         nurseId]
      );
      medicationIds.push(med.id);
    }

    // ── 7a. eMAR — 30 days of administration history ─────────────────────
    console.log('  ▶  eMAR — 30 days history…');
    for (const m of meds) {
      if (m.prn) continue;
      const { rows: [med] } = await client.query(
        `SELECT id FROM medications WHERE resident_id = $1 AND name = $2 LIMIT 1`,
        [residentIds[m.room], m.name]
      );
      if (!med) continue;
      for (let daysBack = 0; daysBack <= 29; daysBack++) {
        const dateS = dateStr(daysAgo(daysBack));
        for (const time of m.times) {
          // ~4% miss rate, higher for complex residents
          const highRisk = ['2','4','8','14','20','24'].includes(m.room);
          const missChance = highRisk ? 0.06 : 0.03;
          const status = Math.random() < missChance ? 'missed' : 'given';
          const adminBy = rand([nurseId, seniorId, carer1Id]);
          await client.query(
              `INSERT INTO med_administrations (
                 care_home_id, medication_id, resident_id, administered_by,
                 administration_date, scheduled_time, actual_time, status, dose_given
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
               ON CONFLICT DO NOTHING`,
              [homeId, med.id, residentIds[m.room], adminBy,
               dateS, time, time, status, m.dose]
            );
        }
      }
    }

    // ── 8. Care Notes — 30 days ────────────────────────────────────────────
    console.log('  ▶  Care notes — 30 days…');
    type NoteTemplate = {
      room: string; type: string; sig: boolean; content: string;
      daysBack: number; pain?: number; fluid?: number; food?: number;
    };
    const noteTemplates: NoteTemplate[] = [
      // Margaret room 1
      { room:'1', type:'personal_care',   sig:false, daysBack:0,  content:'Margaret had a good morning. Assisted with wash and dress. Cheerful and chatted about her garden. No concerns.' },
      { room:'1', type:'nutrition',        sig:false, daysBack:0,  content:'Margaret ate 80% of her breakfast. Declined toast but had porridge with honey. Fluids approximately 300ml.', food:80, fluid:300 },
      { room:'1', type:'sleep',            sig:false, daysBack:1,  content:'Margaret slept well throughout the night. No repositioning needed. Alert and orientated at 07:00.' },
      { room:'1', type:'social_wellbeing', sig:false, daysBack:2,  content:"Margaret's daughter Patricia visited this afternoon. Lovely interaction — they looked through old photographs together. Margaret appeared very content." },
      { room:'1', type:'personal_care',   sig:false, daysBack:3,  content:'Morning wash and dress completed. Margaret required minimal assistance. Skin intact, no areas of concern. Nail care provided.' },
      // Arthur room 2 — dementia, high risk
      { room:'2', type:'nursing_observation', sig:true, daysBack:0, content:'Arthur showed increased confusion this afternoon. BP 162/96, HR 88 bpm irregular. Dr Rahman contacted — GP advised continue current medication and increased monitoring. Family notified.', pain:2 },
      { room:'2', type:'personal_care',   sig:false, daysBack:0,  content:'Arthur required full personal care — hoist used for all transfers. Skin check completed: no pressure areas. Oral care given.' },
      { room:'2', type:'behaviour',        sig:true,  daysBack:1,  content:'Arthur became verbally agitated during morning care. Raised voice, appeared distressed. De-escalation techniques used — music played (favourite 1950s). Settled after approximately 20 minutes. Senior staff informed.' },
      { room:'2', type:'nutrition',        sig:false, daysBack:1,  content:'Arthur accepted pureed meals well today. Fluid intake 450ml (thickened). Encouraged throughout. Weight stable.', food:70, fluid:450 },
      { room:'2', type:'repositioning',    sig:false, daysBack:0,  content:'Arthur repositioned every 2 hours as per care plan. Skin assessment completed each turn — no areas of concern. Pressure mattress functioning correctly.' },
      // Dorothy room 3
      { room:'3', type:'behaviour',        sig:false, daysBack:0,  content:"Dorothy was calm and participative during the morning activity session. Recognised several songs from the 1960s and sang along. Good interaction with other residents." },
      { room:'3', type:'personal_care',   sig:false, daysBack:0,  content:'Dorothy required partial assistance with morning wash. Cooperative throughout. Allergic alert — latex gloves not used. Skin intact, no concerns.' },
      { room:'3', type:'nutrition',        sig:false, daysBack:1,  content:'Dorothy had a good appetite at lunch. Soft diet consumed well — approximately 75%. Fluids 350ml. No coughing or aspiration signs noted.', food:75, fluid:350 },
      { room:'3', type:'sleep',            sig:false, daysBack:2,  content:'Dorothy slept 22:30 to 06:45. Woke once at 03:00 — offered reassurance and warm drink. Settled within 15 minutes. No concerns.' },
      // Harold room 4 — Parkinson's, palliative
      { room:'4', type:'nursing_observation', sig:true, daysBack:0, content:"Harold's pain reviewed by Dr Patel during ward round. Morphine SR maintained at 10mg BD. Pain score 4/10 at rest, 7/10 on movement. Oramorph PRN given at 14:30 — effective, pain reduced to 2/10 within 30 minutes. Palliative care team to review this week.", pain:4 },
      { room:'4', type:'repositioning',    sig:false, daysBack:0,  content:'Harold repositioned every 2 hours. Hoist used throughout. Pressure areas checked — small area of redness noted on left heel. Heel protectors applied. Wound nurse referral completed.' },
      { room:'4', type:'personal_care',   sig:false, daysBack:1,  content:'Harold received full personal care. Very limited mobility today — tremors increased. Hoist used for all transfers. Appeared comfortable after care. Oral care and shave completed.' },
      { room:'4', type:'nutrition',        sig:false, daysBack:1,  content:'Harold struggled with soft diet today — swallowing more difficult. SALT referral discussed with nurse. Managed approximately 50% of meal and 250ml thickened fluids.', food:50, fluid:250 },
      { room:'4', type:'behaviour',        sig:false, daysBack:2,  content:'Harold had a quiet morning. Listened to the radio and appeared relaxed. Wife Judith visited at 14:00 — Harold was clearly pleased to see her. Family briefed on care plan.' },
      // Edith room 5
      { room:'5', type:'social_wellbeing', sig:false, daysBack:0,  content:"Edith's daughter Carol visited this afternoon. Edith was happy and animated, showing Carol her watercolours. No concerns raised during the visit." },
      { room:'5', type:'personal_care',   sig:false, daysBack:0,  content:'Edith completed her own morning wash with minimal supervision. Independent with dressing. Reminded about diabetic diet at breakfast.' },
      { room:'5', type:'nutrition',        sig:false, daysBack:1,  content:'Edith had a full diabetic breakfast. Blood glucose 7.8 mmol/L at 08:00 — within target range. Fluid intake 400ml.', food:100, fluid:400 },
      // Reginald room 6 — COPD
      { room:'6', type:'nursing_observation', sig:true, daysBack:0, content:'Reginald had an episode of acute breathlessness at 14:30. SpO2 dropped to 88% on air. Salbutamol 2 puffs given — SpO2 recovered to 94% within 10 minutes. Dr Patel informed. Continues to monitor.', pain:3 },
      { room:'6', type:'personal_care',   sig:false, daysBack:0,  content:'Reginald managed his own wash with supervision. Some breathlessness on exertion — took frequent rest breaks. Inhalers administered as per MAR.' },
      { room:'6', type:'sleep',            sig:false, daysBack:1,  content:'Reginald reported sleeping poorly — breathlessness when lying flat. Head of bed elevated. SpO2 98% sitting, 94% lying. Reported to nurse.' },
      // Vera room 7
      { room:'7', type:'personal_care',   sig:false, daysBack:0,  content:'Vera had her bath this morning. Enjoyed the experience and chatted throughout. Skin in good condition. Hair washed and dried.' },
      { room:'7', type:'social_wellbeing', sig:false, daysBack:0,  content:'Vera attended the afternoon quiz activity and came first! Very proud of herself. Mood excellent. No concerns.' },
      // Cyril room 8 — dementia, DNACPR
      { room:'8', type:'behaviour',        sig:true,  daysBack:0,  content:'Cyril became very agitated at 03:00 — shouting and attempting to leave the unit. Staff redirected and offered reassurance. Quetiapine PRN not indicated — de-escalation successful. Settled by 04:00. Manager informed at 07:00. Incident report filed.' },
      { room:'8', type:'nursing_observation', sig:true, daysBack:1, content:'Cyril assessed by Priya RN following overnight incident. Orientated to person only. MMSE not applicable (end-stage). Skin clear, hydration maintained. No respiratory distress. Comfort measures in place per DNACPR plan.', pain:1 },
      { room:'8', type:'personal_care',   sig:false, daysBack:1,  content:'Cyril required full personal care. Resistive to face wash — distraction technique used (talking about his favourite football team, Man Utd). Settled and cooperative after. Hoist used for all transfers.' },
      { room:'8', type:'repositioning',    sig:false, daysBack:0,  content:'Cyril repositioned every 2 hours throughout night shift. Pressure care plan followed. Skin intact. Pressure mattress maintained.' },
      // New residents — sample notes
      { room:'9',  type:'personal_care',   sig:false, daysBack:0,  content:'Elsie had her morning shower. Independent with most tasks but requires verbal prompting. Good mood — mentioned she slept well.' },
      { room:'10', type:'nursing_observation', sig:true, daysBack:0, content:'Frederick showing dysphagia symptoms worsening. Coughing during fluids despite thickened consistency. SALT urgently requested. Hydration via oral food supplemented. Family contacted regarding SALT review.' },
      { room:'11', type:'social_wellbeing', sig:false, daysBack:0,  content:'Agnes attended the garden group this morning and planted bulbs. Very engaged and smiling. No concerns.' },
      { room:'12', type:'behaviour',        sig:true,  daysBack:0,  content:'George had a seizure at 10:45 — lasted approximately 90 seconds (tonic-clonic). Recovery position maintained. Nurse informed immediately. Post-ictal period approximately 20 minutes. GP contacted — no medication change required. Family notified.' },
      { room:'14', type:'nursing_observation', sig:true, daysBack:0, content:'Ernest showing increasing respiratory difficulty. RR 24/min, SpO2 92% on air. Dr Rahman informed — antibiotics commenced for possible chest infection. Family notified of deterioration. DNACPR in place.', pain:5 },
      { room:'20', type:'nursing_observation', sig:true, daysBack:0, content:"Stanley's condition has deteriorated this week. Increased breathlessness at rest. Morphine SR dose increased to 5mg BD by Dr Singh as per palliative protocol. Midazolam PRN available. Family informed — wife present at bedside.", pain:6 },
      { room:'24', type:'nursing_observation', sig:true, daysBack:0, content:"Clifford appears increasingly drowsy — likely approaching end of life. Fentanyl patch in situ. PRN medications drawn up and available. Mouth care every 2 hours. Family (wife Margaret) present and supported. Chaplain visited this afternoon. Macmillan nurse to review tomorrow.", pain:2 },
      { room:'24', type:'personal_care',   sig:false, daysBack:0,  content:'Mouth care and comfort positioning completed. Clifford appears peaceful. Family remain at bedside. Pad check and change completed with dignity maintained.' },
    ];

    // Insert template notes + generate 30 days of additional notes
    for (const n of noteTemplates) {
      await client.query(
        `INSERT INTO care_notes (
           care_home_id, resident_id, author_id, note_type, content,
           is_significant, pain_score, fluid_intake_ml, food_eaten_percent,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
        [homeId, residentIds[n.room], rand([seniorId, nurseId, carer1Id]),
         n.type, n.content, n.sig,
         n.pain ?? null, n.fluid ?? null, n.food ?? null,
         daysAgo(n.daysBack)]
      );
    }

    // Generate daily notes for all residents over 30 days
    const dailyNoteTypes = ['personal_care', 'nutrition', 'sleep', 'repositioning', 'social_wellbeing', 'nursing_observation'];
    const dailyNoteContent: Record<string, string[]> = {
      personal_care:        ['Good morning care completed — no concerns noted.', 'Full wash and dress completed with assistance. Resident cooperative throughout.', 'Morning personal care — resident in good spirits.', 'Personal care completed. Skin checked — intact and healthy.'],
      nutrition:            ['Good appetite — ate well at all meals. Fluid intake maintained well.', 'Moderate appetite — approximately 60% of meals consumed. Fluids encouraged throughout.', 'Encouraged to eat — accepted half portions and snacks. Fluid intake approx 1200ml.', 'Full meals eaten. Fluid intake maintained — approx 1500ml across shift.'],
      sleep:                ['Slept well through the night. No concerns at wake-up.', 'Settled night — awoke once, offered reassurance and returned to sleep.', 'Some restlessness noted overnight. Repositioned and settled.', 'Good sleep reported by resident.'],
      repositioning:        ['Repositioned as per care plan. Skin intact.', 'Pressure care completed. No areas of concern.', 'Turning chart completed. Pressure areas checked — no redness.', 'Repositioned every 2 hours. Skin healthy throughout.'],
      social_wellbeing:     ['Engaged in morning activities. Appeared content.', 'Quiet day — preferred own company. No concerns.', 'Chatted with other residents at lunch. Good interaction.', 'Participated in afternoon activity. Enjoyed the session.'],
      nursing_observation:  ['Vital signs within normal limits. No concerns noted.', 'Routine observations completed. Resident comfortable and settled.', 'BP and HR stable. Resident alert and orientated. No new concerns.', 'Observations completed as per care plan. No deterioration noted.'],
    };
    for (let daysBack = 1; daysBack <= 29; daysBack++) {
      for (const room of Object.keys(residentIds).slice(0, 12)) {  // first 12 rooms daily
        const noteType = rand(dailyNoteTypes);
        const content = rand(dailyNoteContent[noteType]);
        await client.query(
          `INSERT INTO care_notes (
             care_home_id, resident_id, author_id, note_type, content,
             is_significant, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,FALSE,$6,$6)`,
          [homeId, residentIds[room], rand([seniorId, carer1Id, carer2Id]),
           noteType, content, daysAgo(daysBack)]
        );
      }
    }

    // ── 9. Incidents ───────────────────────────────────────────────────────
    console.log('  ▶  Incidents (25+)…');
    const incidents = [
      { room:'2',  type:'Fall',             sev:'medium',   status:'review',    desc:"Arthur found on floor beside his bed at 06:45. No injuries observed. Assisted back to bed by two members of staff using hoist. Post-fall checks completed — vital signs stable. Incident reported to manager. Fall risk assessment to be reviewed.", loc:'Bedroom 2',       wit:false, cqc:false, daysBack:3  },
      { room:'4',  type:'Medication Error', sev:'high',     status:'escalated', desc:"Harold's morning Co-careldopa dose administered 2 hours late due to shift handover miscommunication. Significant symptoms noted — increased rigidity and bradykinesia within 45 minutes of missed window. GP informed. Root cause analysis to be completed.", loc:'Bedroom 4',       wit:true,  cqc:true,  daysBack:5  },
      { room:'8',  type:'Behaviour',        sev:'medium',   status:'open',      desc:'Cyril attempted to leave the building at 22:30. Staff redirected using de-escalation techniques. No injury sustained. Environment checked for additional triggers.', loc:'Main Entrance',   wit:true,  cqc:false, daysBack:1  },
      { room:'6',  type:'Fall',             sev:'low',      status:'closed',    desc:'Reginald slipped on wet bathroom floor. No injuries sustained. Bathroom non-slip mat applied. Family notified. Risk assessment reviewed.', loc:'Bathroom 6',      wit:false, cqc:false, daysBack:10 },
      { room:'12', type:'Medical Emergency',sev:'high',     status:'escalated', desc:'George had a tonic-clonic seizure at 10:45. Duration approximately 90 seconds. Recovery position maintained throughout. Nurse attended immediately. GP contacted. Anti-epileptic levels to be reviewed.', loc:'Lounge',          wit:true,  cqc:false, daysBack:2  },
      { room:'10', type:'Choking',          sev:'high',     status:'review',    desc:'Frederick coughed severely during lunch — possible aspiration episode. Back blows administered. Airway cleared. SpO2 maintained. Dietitian and SALT urgently notified. Oral intake temporarily suspended pending review.', loc:'Dining Room',     wit:true,  cqc:false, daysBack:4  },
      { room:'20', type:'Medical Emergency',sev:'critical', status:'closed',    desc:"Stanley experienced acute respiratory failure at 03:15. Sats dropped to 82%. PRN Midazolam administered SC. Family contacted and present within 30 minutes. DNACPR in place — no CPR commenced. Comfortable until stabilised.", loc:'Bedroom 20',      wit:true,  cqc:true,  daysBack:7  },
      { room:'14', type:'Medical Emergency',sev:'critical', status:'review',    desc:'Ernest showed acute respiratory deterioration at 09:30. RR 28. Emergency GP visit arranged — chest infection confirmed. IV antibiotics not appropriate given DNACPR. Oral antibiotics commenced. Family present and informed.', loc:'Bedroom 14',      wit:true,  cqc:true,  daysBack:0  },
      { room:'3',  type:'Fall',             sev:'low',      status:'closed',    desc:'Dorothy found sitting on floor in her room at 14:00. Believes she slipped from chair. No injuries — full assessment completed. Family notified. Chair adapted to reduce slip risk.', loc:'Bedroom 3',       wit:false, cqc:false, daysBack:14 },
      { room:'1',  type:'Safeguarding',     sev:'medium',   status:'review',    desc:'Margaret disclosed that a family member made comments that caused distress during a visit. She was visibly upset and asked staff not to let the person visit unsupervised. Reported to manager. Safeguarding referral completed.', loc:'Bedroom 1',       wit:false, cqc:false, daysBack:6  },
      { room:'2',  type:'Fall',             sev:'low',      status:'closed',    desc:'Arthur found on floor at 22:00 after attempting to transfer independently. Minor bruising to left hip. Incident reported. Night staff reinforced safety measures.', loc:'Bedroom 2',       wit:false, cqc:false, daysBack:18 },
      { room:'9',  type:'Medical Emergency',sev:'medium',   status:'closed',    desc:'Elsie experienced chest pain at 07:30. 12-lead ECG completed — no acute changes. BP elevated at 168/100. GP attended. Bloods taken — result awaited. Family notified.', loc:'Bedroom 9',       wit:true,  cqc:false, daysBack:12 },
      { room:'16', type:'Behaviour',        sev:'low',      status:'closed',    desc:'Bertram became verbally aggressive towards another resident during lunch. Immediately redirected to his room. Settled within 20 minutes. No physical contact. Behaviour management plan reviewed.', loc:'Dining Room',     wit:true,  cqc:false, daysBack:9  },
      { room:'4',  type:'Fall',             sev:'medium',   status:'closed',    desc:'Harold slid from wheelchair during afternoon. No injuries — pressure areas checked. Hoist sling reviewed and refitted correctly. Falls risk assessment updated.', loc:'Lounge',          wit:true,  cqc:false, daysBack:22 },
      { room:'7',  type:'Property Damage',  sev:'low',      status:'closed',    desc:"Vera's mobile phone screen cracked after being dropped in the bathroom. Family notified. Incident documented as per policy.", loc:'Bathroom 7',      wit:false, cqc:false, daysBack:15 },
      { room:'5',  type:'Medication Error', sev:'medium',   status:'closed',    desc:"Edith's Metformin accidentally administered twice on Sunday morning due to MAR transcription error. Error identified by senior during medication round. GP informed. Blood glucose monitored — no adverse effects. Incident reviewed.", loc:'Bedroom 5',       wit:true,  cqc:false, daysBack:20 },
      { room:'8',  type:'Behaviour',        sev:'high',     status:'review',    desc:"Cyril physically struck a carer during morning personal care. No injury to staff. Incident documented. Manager informed. GP contacted — medication review requested. ABC chart commenced. Mental health liaison referral submitted.", loc:'Bedroom 8',       wit:true,  cqc:false, daysBack:8  },
      { room:'24', type:'Medical Emergency',sev:'high',     status:'closed',    desc:"Clifford experienced increased distress and agitation — PRN Midazolam administered by nurse as per palliative protocol. Family present. Macmillan nurse attended. Comfort measures reviewed and updated.", loc:'Bedroom 24',      wit:true,  cqc:false, daysBack:3  },
    ];
    for (const inc of incidents) {
      const { rows: [incident] } = await client.query(
        `INSERT INTO incidents (
           care_home_id, resident_id, reported_by, incident_type, severity, status,
           description, location, witnessed, witness_name,
           cqc_reportable, family_notified, gp_notified, incident_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [homeId, residentIds[inc.room], seniorId,
         inc.type, inc.sev, inc.status,
         inc.desc, inc.loc, inc.wit, inc.wit ? 'Priya Sharma RN' : null,
         inc.cqc, true, inc.sev !== 'low',
         daysAgo(inc.daysBack)]
      );
      if (inc.status === 'escalated' || inc.status === 'review') {
        await client.query(
          `INSERT INTO incident_updates (incident_id, author_id, content, status_change)
           VALUES ($1,$2,$3,$4)`,
          [incident.id, managerId,
           'Manager reviewed incident. Immediate actions taken. Root cause analysis commenced. To be discussed at next governance meeting.',
           inc.status]
        );
      }
    }

    // ── 10. Rota — 3 months ────────────────────────────────────────────────
    console.log('  ▶  Rota — 3 months…');
    const shiftStaff = [
      { email: 'nurse@demo.carevista.co.uk',    type: 'day',     start: '07:30', end: '15:00' },
      { email: 'senior@demo.carevista.co.uk',   type: 'day',     start: '07:30', end: '15:00' },
      { email: 'carer1@demo.carevista.co.uk',   type: 'day',     start: '07:30', end: '15:00' },
      { email: 'carer2@demo.carevista.co.uk',   type: 'evening', start: '14:00', end: '22:00' },
      { email: 'activities@demo.carevista.co.uk',type: 'day',    start: '09:00', end: '17:00' },
      { email: 'manager@demo.carevista.co.uk',  type: 'day',     start: '08:00', end: '16:00' },
      { email: 'deputy@demo.carevista.co.uk',   type: 'day',     start: '08:00', end: '16:00' },
    ];
    for (let dayOffset = -42; dayOffset <= 49; dayOffset++) {
      const shiftDate = dateStr(daysAgo(-dayOffset));
      const dow = new Date(shiftDate).getDay(); // 0=Sun, 6=Sat
      for (const s of shiftStaff) {
        const spId = staffIds[s.email];
        if (!spId) continue;
        // Manager/deputy: weekdays only
        if (['manager@demo.carevista.co.uk','deputy@demo.carevista.co.uk'].includes(s.email) && (dow === 0 || dow === 6)) continue;
        // Carer1 off every Wednesday and Sunday
        const isCarer1Off = s.email === 'carer1@demo.carevista.co.uk' && (dow === 3 || dow === 0);
        await client.query(
            `INSERT INTO shifts (
               care_home_id, staff_id, shift_date, shift_type,
               start_time, end_time, confirmed, created_by
             ) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)
             ON CONFLICT DO NOTHING`,
            [homeId, spId, shiftDate,
             isCarer1Off ? 'off' : s.type,
             isCarer1Off ? '00:00' : s.start,
             isCarer1Off ? '00:00' : s.end,
             managerId]
          );
      }
    }

    // ── 11. Compliance Actions ────────────────────────────────────────────
    console.log('  ▶  Compliance actions…');
    const complianceItems = [
      { title:'Update Medication Administration Policy v3.3',       domain:'safe',       priority:'high',     daysLeft:7,   assignee:'nurse@demo.carevista.co.uk',    status:'open'      },
      { title:'Complete Annual Fire Risk Assessment',               domain:'safe',       priority:'high',     daysLeft:14,  assignee:'manager@demo.carevista.co.uk',  status:'open'      },
      { title:'Renew Amara Osei — Fire Safety Training',           domain:'safe',       priority:'high',     daysLeft:3,   assignee:'deputy@demo.carevista.co.uk',   status:'open'      },
      { title:'Review All 24 Resident Care Plans (annual)',         domain:'effective',  priority:'high',     daysLeft:21,  assignee:'nurse@demo.carevista.co.uk',    status:'in_progress'},
      { title:'Implement New Resident Satisfaction Survey',         domain:'caring',     priority:'low',      daysLeft:45,  assignee:'activities@demo.carevista.co.uk',status:'open'     },
      { title:'Update Visiting & Access Policy',                   domain:'responsive', priority:'medium',   daysLeft:30,  assignee:'manager@demo.carevista.co.uk',  status:'open'      },
      { title:'Q2 Staff Supervision Schedule',                     domain:'well_led',   priority:'medium',   daysLeft:10,  assignee:'deputy@demo.carevista.co.uk',   status:'in_progress'},
      { title:'Safeguarding Lead Refresher Training',              domain:'safe',       priority:'high',     daysLeft:20,  assignee:'manager@demo.carevista.co.uk',  status:'open'      },
      { title:'GDPR Annual Review & Staff Re-acknowledgement',     domain:'well_led',   priority:'medium',   daysLeft:60,  assignee:'manager@demo.carevista.co.uk',  status:'open'      },
      { title:'Pressure Ulcer Prevention Audit — Q2',             domain:'effective',  priority:'high',     daysLeft:5,   assignee:'nurse@demo.carevista.co.uk',    status:'open'      },
      { title:'Infection Control Deep Clean Audit',                domain:'safe',       priority:'medium',   daysLeft:7,   assignee:'deputy@demo.carevista.co.uk',   status:'open'      },
      { title:'CQC Self-Assessment Update — Safe Domain',         domain:'safe',       priority:'critical', daysLeft:2,   assignee:'manager@demo.carevista.co.uk',  status:'open'      },
      { title:'Review Deprivation of Liberty Safeguards (DoLS)',  domain:'safe',       priority:'high',     daysLeft:14,  assignee:'nurse@demo.carevista.co.uk',    status:'open'      },
      { title:'Health & Safety Risk Assessment Review',           domain:'safe',       priority:'medium',   daysLeft:30,  assignee:'deputy@demo.carevista.co.uk',   status:'open'      },
      { title:'Complaints Register Review — Q1',                 domain:'responsive', priority:'low',      daysLeft:21,  assignee:'manager@demo.carevista.co.uk',  status:'closed'    },
      { title:'Emergency Evacuation Drill — overdue',            domain:'safe',       priority:'critical', daysLeft:-3,  assignee:'manager@demo.carevista.co.uk',  status:'open'      },
      { title:'Staff Appraisal Completion — All Staff',          domain:'well_led',   priority:'high',     daysLeft:45,  assignee:'deputy@demo.carevista.co.uk',   status:'in_progress'},
      { title:'Nutritional Assessment Update — All Residents',   domain:'effective',  priority:'medium',   daysLeft:14,  assignee:'nurse@demo.carevista.co.uk',    status:'open'      },
      { title:'Medication Storage Audit',                        domain:'safe',       priority:'high',     daysLeft:7,   assignee:'nurse@demo.carevista.co.uk',    status:'open'      },
      { title:'Dignity in Care Audit',                           domain:'caring',     priority:'medium',   daysLeft:30,  assignee:'activities@demo.carevista.co.uk',status:'open'     },
    ];
    for (const ca of complianceItems) {
      await client.query(
        `INSERT INTO compliance_actions (
           care_home_id, title, kloe_domain, priority, due_date,
           status, assigned_to, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [homeId, ca.title, ca.domain, ca.priority,
         dateStr(daysFromNow(ca.daysLeft)),
         ca.status, userIds[ca.assignee], managerId]
      );
    }

    // ── 12. Policies ──────────────────────────────────────────────────────
    console.log('  ▶  Policies…');
    const policies = [
      { title:'Medication Administration Policy',         version:'3.2', cat:'Clinical',       reviewDays: 180 },
      { title:'Safeguarding Adults Policy',               version:'2.1', cat:'Safeguarding',   reviewDays: 365 },
      { title:'Infection Prevention & Control Policy',    version:'4.0', cat:'H&S',            reviewDays:  90 },
      { title:'Falls Prevention & Management Policy',     version:'2.3', cat:'Clinical',       reviewDays: 270 },
      { title:'GDPR & Data Protection Policy',            version:'1.5', cat:'Compliance',     reviewDays: 365 },
      { title:'Moving & Handling Policy',                 version:'3.0', cat:'H&S',            reviewDays: 365 },
      { title:'Mental Capacity Act & DoLS Policy',        version:'2.0', cat:'Legal',          reviewDays: 365 },
      { title:'Palliative & End of Life Care Policy',     version:'1.8', cat:'Clinical',       reviewDays: 365 },
      { title:'Complaints & Compliments Policy',          version:'1.4', cat:'Quality',        reviewDays: 365 },
      { title:'Lone Working Policy',                      version:'1.3', cat:'H&S',            reviewDays: 365, overdue: true },
      { title:'Equality, Diversity & Inclusion Policy',   version:'2.2', cat:'HR',             reviewDays: 365 },
      { title:'Whistle-blowing Policy',                   version:'1.6', cat:'Compliance',     reviewDays: 365 },
    ];
    for (const p of policies) {
      await client.query(
        `INSERT INTO policies (
           care_home_id, title, version, category, status,
           review_date, approved_by, approved_at, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8)`,
        [homeId, p.title, p.version, p.cat,
         (p as any).overdue ? 'review_due' : 'current',
         dateStr(daysFromNow((p as any).overdue ? -30 : p.reviewDays)),
         managerId, managerId]
      );
    }

    // ── 13. Family Messages ────────────────────────────────────────────────
    console.log('  ▶  Family messages (30+)…');
    const msgs = [
      { room:'1',  from:'Patricia Hollis',   subj:'Visit this Saturday',        body:"Hello, I'd like to bring the grandchildren to visit Margaret on Saturday afternoon around 2pm. Is this convenient? She loves seeing them.",  daysBack:2 },
      { room:'2',  from:'Robert Pemberton',  subj:"Dad's fall — urgent",        body:"I've heard about Arthur's fall. I'm very worried. Can someone please call me as a matter of urgency? I have some concerns I need to raise.",  daysBack:3 },
      { room:'8',  from:'Brian Newton',      subj:'Night-time concern',         body:"The morning carer mentioned Cyril had a bad night. Could you provide an update on what happened and what the current plan is? Very concerned.", daysBack:1 },
      { room:'4',  from:'Judith Fletcher',   subj:'Harold pain management',     body:"I visited yesterday and Harold seemed in a lot of discomfort. His pain score was 7 when I arrived. Is the medication working? Can we discuss?", daysBack:4 },
      { room:'12', from:'Anne Bradshaw',     subj:'George seizure — follow-up', body:"Thank you for calling about George's seizure. I'm coming in tomorrow. Can you ensure the doctor's report is available for me to see?",       daysBack:2 },
      { room:'14', from:'Mary Higgins',      subj:'Ernest chest infection',     body:"I'm so worried about Ernest. The nurse mentioned a chest infection. How serious is it? Should I come in? I can be there within 2 hours.",         daysBack:0 },
      { room:'24', from:'Margaret Denton',   subj:'Clifford — end of life',     body:"We are prepared for the worst but wanted to say how grateful we are for the care you are all giving Clifford. The nurses have been wonderful.",   daysBack:1 },
      { room:'5',  from:'Carol Edwards',     subj:'Mum visiting Sunday',        body:"I'll be visiting Mum on Sunday with my husband. We might arrive around 11am for the morning. Hope that's okay! She loves your Sunday roasts.",       daysBack:5 },
      { room:'3',  from:'Michael Sinclair',  subj:'Dorothy medication review',  body:"We're due to meet about Dorothy's Memantine next week. Can you confirm the date and time? We'd also like an update on her mood and activities.",    daysBack:3 },
      { room:'20', from:'Frank Muir Jr',     subj:'Dad — breathing issues',    body:"We were told about last night's episode. The family is very distressed. Can we have a meeting with the nurse and doctor this week please?",          daysBack:7 },
      { room:'9',  from:'Janice Hartley',   subj:'Mum chest pain',            body:"Thank you for letting us know about the chest pain episode. We will be visiting tomorrow morning to check on Elsie ourselves.",                      daysBack:12 },
      { room:'16', from:'Janet Cross',      subj:'Bertram behaviour concern',  body:"We heard Bertram had another incident in the dining room. This is upsetting. Can we discuss his care plan and what support he's getting?",            daysBack:9 },
      // Outbound from home to family
      { room:'2',  from:'Willowbrook House', subj:"Re: Dad's fall",            body:"Dear Robert, thank you for your call. Arthur's fall has been fully investigated. No injuries were sustained. We have updated his care plan and reviewed his environment. We are happy to arrange a meeting at your convenience.",   daysBack:2 },
      { room:'8',  from:'Willowbrook House', subj:"Re: Cyril overnight",       body:"Dear Brian, thank you for your concern. Cyril had a restless night but our staff managed the situation safely and he settled without medication. We have updated his behaviour support plan. Please feel free to call at any time.",   daysBack:1 },
      { room:'24', from:'Willowbrook House', subj:"Re: Clifford",              body:"Dear Margaret, thank you for your kind words. Our whole team is committed to ensuring Clifford's final days are as comfortable and dignified as possible. Please know we are here for the whole family.",                              daysBack:0 },
    ];
    for (const m of msgs) {
      await client.query(
        `INSERT INTO family_messages (
           care_home_id, resident_id, from_name, subject, body, read, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [homeId, residentIds[m.room], m.from, m.subj, m.body,
         m.from === 'Willowbrook House', daysAgo(m.daysBack)]
      );
    }

    // ── 14. Invoices — 4 months ────────────────────────────────────────────
    console.log('  ▶  Invoices — 4 months…');
    const periods = [
      { label:'January 2026', start:'2026-01-01', end:'2026-01-31', status:'paid' },
      { label:'February 2026', start:'2026-02-01', end:'2026-02-28', status:'paid' },
      { label:'March 2026',   start:'2026-03-01', end:'2026-03-31', status:'paid' },
      { label:'April 2026',   start:'2026-04-01', end:'2026-04-30', status:'sent' },
    ];
    const invoicedResidents = [
      { room:'1',  payer:'Margaret Hollis',       ptype:'self_funded',     feeW:1200 },
      { room:'3',  payer:'NHS England (CCG)',      ptype:'nhs_continuing',  feeW:0    }, // NHS continuing — auto-paid
      { room:'4',  payer:'Harold Fletcher',        ptype:'self_funded',     feeW:1350 },
      { room:'5',  payer:'Salford City Council',   ptype:'local_authority', feeW:900  },
      { room:'6',  payer:'Reginald Barnes',        ptype:'self_funded',     feeW:1100 },
      { room:'7',  payer:'Vera Chapman',           ptype:'self_funded',     feeW:1250 },
      { room:'9',  payer:'Elsie Hartley',          ptype:'self_funded',     feeW:1200 },
      { room:'11', payer:'Agnes Whitfield',        ptype:'self_funded',     feeW:1100 },
      { room:'13', payer:'Winifred Stanton',       ptype:'self_funded',     feeW:1300 },
      { room:'15', payer:'Phyllis Goodman',        ptype:'self_funded',     feeW:1150 },
      { room:'17', payer:'Gladys Perkins',         ptype:'self_funded',     feeW:1200 },
      { room:'19', payer:'Irene Walton',           ptype:'self_funded',     feeW:1100 },
      { room:'21', payer:'Muriel Thornton',        ptype:'self_funded',     feeW:1250 },
      { room:'23', payer:'Hilda Sutton',           ptype:'self_funded',     feeW:1200 },
      { room:'2',  payer:'Salford City Council',   ptype:'local_authority', feeW:950  },
      { room:'10', payer:'Salford City Council',   ptype:'local_authority', feeW:950  },
      { room:'16', payer:'Salford City Council',   ptype:'local_authority', feeW:950  },
    ];
    let invNum = 1;
    for (const ir of invoicedResidents) {
      for (const p of periods) {
        const weeksInMonth = (new Date(p.end).getTime() - new Date(p.start).getTime()) / (7 * 86400000);
        const totalPence = Math.round(ir.feeW * weeksInMonth * 100);
        let status = p.status;
        // April invoices: some overdue (local authority), some draft (NHS)
        if (p.label === 'April 2026' && ir.ptype === 'local_authority') status = 'overdue';
        if (p.label === 'April 2026' && ir.ptype === 'nhs_continuing') status = 'paid';
        await client.query(
          `INSERT INTO invoices (
             care_home_id, resident_id, invoice_number, period_start, period_end,
             period_label, amount_pence, vat_pence, total_pence,
             payer_name, payer_type, status, due_date, paid_date, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$7,$8,$9,$10,$11,$12,$13)`,
          [homeId, residentIds[ir.room],
           `WBH-2026-${String(invNum++).padStart(4,'0')}`,
           p.start, p.end, p.label, totalPence,
           ir.payer, ir.ptype, status,
           p.end, // due date
           (status === 'paid') ? p.end : null,
           financeId]
        );
      }
    }


    // ── Task templates + today's tasks ────────────────────────────────────
    console.log('  ▶  Task templates & today\'s task board…');
    const TASK_TEMPLATES = [
      { name: 'Morning Personal Care',   icon: '🛁', category: 'personal_care', shift: 'day',     due_time: '07:30', window_mins: 90,  sort_order: 1,  applies_to: 'all', frequency: 'daily',  day_of_week: null as number|null , note_type: 'personal_care', handled_in: 'care_note' },
      { name: 'Breakfast',              icon: '🌅', category: 'nutrition',     shift: 'day',     due_time: '08:00', window_mins: 60,  sort_order: 2,  applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
      { name: 'Morning Medications',    icon: '💊', category: 'medication',    shift: 'day',     due_time: '08:00', window_mins: 60,  sort_order: 3,  applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
      { name: 'Skin & Pressure Check',  icon: '🩺', category: 'observation',   shift: 'day',     due_time: '08:30', window_mins: 120, sort_order: 4,  applies_to: 'high_risk', frequency: 'daily', day_of_week: null , note_type: 'nursing_observation', handled_in: 'care_note' },
      { name: 'Fluid & Snack Check',    icon: '💧', category: 'nutrition',     shift: 'day',     due_time: '10:30', window_mins: 60,  sort_order: 6,  applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
      { name: 'Repositioning Check',    icon: '🔄', category: 'repositioning', shift: 'all',     due_time: '10:00', window_mins: 60,  sort_order: 7,  applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'repositioning', handled_in: 'care_note' },
      { name: 'Walking Exercise',       icon: '🚶', category: 'physical',      shift: 'day',     due_time: '11:00', window_mins: 60,  sort_order: 8,  applies_to: 'independent,walking_aid', frequency: 'daily', day_of_week: null , note_type: 'activities', handled_in: 'care_note' },
      { name: 'Seated Exercise',        icon: '💪', category: 'physical',      shift: 'day',     due_time: '11:00', window_mins: 60,  sort_order: 9,  applies_to: 'wheelchair,bed_bound', frequency: 'daily', day_of_week: null , note_type: 'activities', handled_in: 'care_note' },
      { name: 'Lunch',                  icon: '🍽', category: 'nutrition',     shift: 'day',     due_time: '12:00', window_mins: 60,  sort_order: 10, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
      { name: 'Afternoon Medications',  icon: '💊', category: 'medication',    shift: 'day',     due_time: '12:00', window_mins: 60,  sort_order: 11, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
      { name: 'Repositioning Check',    icon: '🔄', category: 'repositioning', shift: 'all',     due_time: '14:00', window_mins: 60,  sort_order: 12, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'repositioning', handled_in: 'care_note' },
      { name: 'Afternoon Tea & Snack',  icon: '☕', category: 'nutrition',     shift: 'day',     due_time: '15:00', window_mins: 60,  sort_order: 13, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
      { name: 'Skin Moisturising',      icon: '🧴', category: 'personal_care', shift: 'day',     due_time: '10:30', window_mins: 120, sort_order: 14, applies_to: 'bed_bound', frequency: 'daily', day_of_week: null , note_type: 'personal_care', handled_in: 'care_note' },
      { name: 'Continence Pad Check',   icon: '🩹', category: 'personal_care', shift: 'all',     due_time: '10:00', window_mins: 120, sort_order: 15, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'continence', handled_in: 'care_note' },
      { name: 'Sensory / Wellbeing Activity', icon: '🎵', category: 'social_wellbeing', shift: 'day', due_time: '14:30', window_mins: 90, sort_order: 16, applies_to: 'all', frequency: 'daily', day_of_week: null , note_type: 'social_wellbeing', handled_in: 'care_note' },
      { name: 'Evening Personal Care', icon: '🚿', category: 'personal_care', shift: 'evening', due_time: '17:00', window_mins: 90,  sort_order: 17, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'personal_care', handled_in: 'care_note' },
      { name: 'Supper',                 icon: '🌙', category: 'nutrition',     shift: 'evening', due_time: '18:00', window_mins: 60,  sort_order: 18, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
      { name: 'Evening Medications',    icon: '💊', category: 'medication',    shift: 'evening', due_time: '18:00', window_mins: 60,  sort_order: 19, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
      { name: 'Repositioning Check',    icon: '🔄', category: 'repositioning', shift: 'all',     due_time: '20:00', window_mins: 60,  sort_order: 20, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'repositioning', handled_in: 'care_note' },
      { name: 'Night Settle & Check',   icon: '😴', category: 'personal_care', shift: 'evening', due_time: '21:00', window_mins: 90,  sort_order: 21, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'sleep', handled_in: 'care_note' },
      { name: 'Night Medications',      icon: '💊', category: 'medication',    shift: 'night',   due_time: '22:00', window_mins: 60,  sort_order: 22, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
      { name: 'Night Observation',      icon: '🌛', category: 'observation',   shift: 'night',   due_time: '02:00', window_mins: 120, sort_order: 23, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'sleep', handled_in: 'care_note' },
      { name: 'Bath / Shower',          icon: '🛀', category: 'personal_care', shift: 'day',     due_time: '10:00', window_mins: 120, sort_order: 24, applies_to: 'all', frequency: 'weekly', day_of_week: 2 , note_type: 'personal_care', handled_in: 'care_note' },
      { name: 'Hair Care & Grooming',   icon: '💇', category: 'personal_care', shift: 'day',     due_time: '09:30', window_mins: 180, sort_order: 25, applies_to: 'all', frequency: 'weekly', day_of_week: 3 , note_type: 'personal_care', handled_in: 'care_note' },
      { name: 'Nail Care Check',        icon: '💅', category: 'personal_care', shift: 'day',     due_time: '10:00', window_mins: 180, sort_order: 26, applies_to: 'all', frequency: 'weekly', day_of_week: 1 , note_type: 'personal_care', handled_in: 'care_note' },
    ];

    // Insert templates
    const tmplIds: string[] = [];
    for (const t of TASK_TEMPLATES) {
      const { rows: [tmpl] } = await client.query(
        `INSERT INTO care_task_templates (care_home_id, name, icon, category, shift, due_time, window_mins, sort_order, applies_to, frequency, day_of_week, note_type, handled_in)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [homeId, t.name, t.icon, t.category, t.shift, t.due_time, t.window_mins, t.sort_order, t.applies_to, t.frequency, t.day_of_week, (t as any).note_type ?? null, (t as any).handled_in ?? 'care_note']
      );
      tmplIds.push(tmpl.id);
    }

    // Generate today's tasks for every resident (mobility-aware filtering)
    const today = new Date().toISOString().slice(0, 10);
    const todayDow = new Date().getDay();
    const weeklyDay = (id: string) => { let h=0; for (let i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))|0; return Math.abs(h)%7; };
    for (const [room, resId] of Object.entries(residentIds)) {
      const { rows: [res] } = await client.query('SELECT risk_level, mobility_status FROM residents WHERE id=$1', [resId]);
      const resMobility = res?.mobility_status || 'independent';
      for (let i = 0; i < TASK_TEMPLATES.length; i++) {
        const t = TASK_TEMPLATES[i];
        // Mobility-aware filtering logic:
        // 'all' -> include for everyone
        // 'high_risk' -> only for residents with risk_level = 'high'
        // Otherwise -> comma-separated mobility values, check if resident's mobility_status is in the list
        if (t.frequency === 'weekly' && weeklyDay(String(resId)) !== todayDow) continue;
        if (t.applies_to === 'high_risk' && res?.risk_level !== 'high') continue;
        if (t.applies_to !== 'all' && t.applies_to !== 'high_risk') {
          const allowedMobilities = t.applies_to.split(',');
          if (!allowedMobilities.includes(resMobility)) continue;
        }
        await client.query(
          `INSERT INTO care_tasks (care_home_id, resident_id, template_id, task_date, task_name, icon, category, due_time, window_mins, note_type, handled_in)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
          [homeId, resId, tmplIds[i], today, t.name, t.icon, t.category, t.due_time, t.window_mins, (t as any).note_type ?? null, (t as any).handled_in ?? 'care_note']
        );
      }
    }

    // ── Activities: mobility, interests, wellbeing ──────────────────────────
    console.log('  ▶  Setting mobility_status, interests, wellbeing…');
    const mobilityMap: Record<string, string> = {
      'Independent': 'independent',
      'Independent with walking frame': 'independent',
      'Independent with stick': 'walking_aid',
      'Walking frame': 'walking_aid',
      'Zimmer frame': 'walking_aid',
      'Walking stick': 'walking_aid',
      'Wheelchair': 'wheelchair',
      'Hoist required': 'bed_bound',
      'Bed-bound': 'bed_bound',
    };
    const interestsMap: Record<string, string[]> = {
      '1':  ['gardening','reading','knitting','music'],
      '2':  ['music','reminiscence','sensory'],
      '3':  ['art','puzzles','music','baking'],
      '4':  ['music','reading','poetry'],
      '5':  ['dancing','gardening','bingo','cooking'],
      '6':  ['chess','reading','woodwork','music'],
      '7':  ['painting','yoga','gardening','theatre'],
      '8':  ['music','sensory','reminiscence'],
      '9':  ['knitting','reading','music','bingo'],
      '10': ['music','sensory','hand massage'],
      '11': ['art','yoga','gardening','book_club'],
      '12': ['music','puzzles','reminiscence','sing_along'],
      '13': ['cooking','reading','walking','nature'],
      '14': ['music','audiobooks','hand massage'],
      '15': ['art','gardening','bingo','walking'],
      '16': ['music','puzzles','sensory','reminiscence'],
      '17': ['dancing','bingo','cooking','socialising'],
      '18': ['chess','reading','music','bird_watching'],
      '19': ['knitting','cooking','reading','walking'],
      '20': ['music','hand massage','sensory'],
      '21': ['yoga','gardening','painting','cooking'],
      '22': ['music','reminiscence','sensory','puzzles'],
      '23': ['reading','walking','gardening','bingo'],
      '24': ['music','hand massage','reading','sensory'],
    };
    for (const r of residentsData) {
      const mobStatus = mobilityMap[r.mob] || 'independent';
      const interests = interestsMap[r.room] || ['music','social'];
      const wellbeing = ['2','4','8','10','14','20','24'].includes(r.room) ? randInt(3,5) :
                        ['3','12','16','22'].includes(r.room) ? randInt(5,7) : randInt(6,9);
      await client.query(
        `UPDATE residents SET mobility_status=$1, interests=$2, wellbeing_score=$3 WHERE id=$4`,
        [mobStatus, interests, wellbeing, residentIds[r.room]]
      );
    }

    // ── Seed activities ───────────────────────────────────────────────────
    console.log('  ▶  Activities (15 diverse)…');
    const activitiesData = [
      { name:'Morning Chair Yoga',       type:'physical',  mobility:'wheelchair_or_better', dur:45,  max:12, loc:'Lounge', cat:'physical',  sensory:false, cog:'any',      desc:'Gentle seated yoga focusing on breathing, stretching, and relaxation. Suitable for wheelchair users.' },
      { name:'Gardening Club',           type:'physical',  mobility:'walking_aid_or_better', dur:60, max:8,  loc:'Garden', cat:'physical',  sensory:false, cog:'any',      desc:'Hands-on gardening including planting, weeding, and watering raised beds.' },
      { name:'Art & Painting',           type:'creative',  mobility:'any',                  dur:60,  max:10, loc:'Activity Room', cat:'creative', sensory:false, cog:'any', desc:'Guided art sessions using watercolours, acrylics, or pastels. All abilities welcome.' },
      { name:'Music & Sing-Along',       type:'social',    mobility:'any',                  dur:45,  max:20, loc:'Main Lounge', cat:'social', sensory:true, cog:'any',     desc:'Live music session with familiar songs. Instruments provided. Proven to boost mood in dementia residents.' },
      { name:'Bingo Afternoon',          type:'social',    mobility:'any',                  dur:60,  max:20, loc:'Dining Hall', cat:'social', sensory:false, cog:'mild',    desc:'Classic bingo with prizes. Helps maintain cognitive function and social interaction.' },
      { name:'Reminiscence Therapy',     type:'cognitive', mobility:'any',                  dur:45,  max:8,  loc:'Quiet Room', cat:'cognitive', sensory:true, cog:'any',    desc:'Guided sessions using old photographs, music, and objects to stimulate memory and conversation.' },
      { name:'Gentle Walking Group',     type:'physical',  mobility:'walking_aid_or_better', dur:30, max:6,  loc:'Garden Path', cat:'physical', sensory:false, cog:'any',   desc:'Short supervised walk around the garden. Walking frames welcome.' },
      { name:'Cooking & Baking',         type:'creative',  mobility:'walking_aid_or_better', dur:75, max:6,  loc:'Kitchen', cat:'creative', sensory:true, cog:'mild',      desc:'Making simple recipes together. Sensory engagement through smell, taste, and touch.' },
      { name:'Hand Massage & Relaxation',type:'sensory',   mobility:'any',                  dur:30,  max:4,  loc:'Quiet Room', cat:'sensory', sensory:true, cog:'any',     desc:'One-to-one hand massage with aromatherapy oils. Reduces anxiety and improves wellbeing.' },
      { name:'Film Afternoon',           type:'social',    mobility:'any',                  dur:120, max:20, loc:'Main Lounge', cat:'social', sensory:false, cog:'any',     desc:'Classic film screening with tea and cake. Subtitles available.' },
      { name:'Puzzle & Brain Games',     type:'cognitive', mobility:'any',                  dur:45,  max:8,  loc:'Activity Room', cat:'cognitive', sensory:false, cog:'moderate', desc:'Jigsaws, crosswords, word searches, and card games. Adapted to individual ability.' },
      { name:'Pet Therapy Visit',        type:'sensory',   mobility:'any',                  dur:60,  max:15, loc:'Main Lounge', cat:'sensory', sensory:true, cog:'any',     desc:'Visiting therapy dogs. Proven to reduce blood pressure and boost mood.' },
      { name:'Dance & Movement',         type:'physical',  mobility:'independent_only',     dur:45,  max:8,  loc:'Activity Room', cat:'physical', sensory:false, cog:'any',  desc:'Gentle dance to music from the 1940s-60s. Improves balance and coordination.' },
      { name:'Book Club',                type:'cognitive', mobility:'any',                  dur:45,  max:8,  loc:'Library Corner', cat:'cognitive', sensory:false, cog:'moderate', desc:'Weekly reading and discussion group. Large print books and audiobooks available.' },
      { name:'Sensory Stimulation',      type:'sensory',   mobility:'any',                  dur:30,  max:4,  loc:'Sensory Room', cat:'sensory', sensory:true, cog:'any',    desc:'Multi-sensory session using lights, textures, sounds, and aromas. Ideal for advanced dementia.' },
    ];
    const activityIds: string[] = [];
    for (const a of activitiesData) {
      const { rows: [act] } = await client.query(
        `INSERT INTO activities (care_home_id, name, description, activity_type, required_mobility_level, duration_minutes, max_participants, location, category, sensory_friendly, cognitive_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [homeId, a.name, a.desc, a.type, a.mobility, a.dur, a.max, a.loc, a.cat, a.sensory, a.cog]
      );
      activityIds.push(act.id);
    }

    // ── Seed 30 days of sessions + 7 future days ─────────────────────────
    console.log('  ▶  Activity sessions (30 past + 7 future days)…');
    const activitiesCoordId = userIds['activities@demo.carevista.co.uk'];
    const sessionTimes = [
      { start: '09:30', end: '10:15' },
      { start: '10:30', end: '11:30' },
      { start: '14:00', end: '15:00' },
      { start: '15:30', end: '16:15' },
    ];
    const sessionIds: string[] = [];
    // Past 30 days (daysBack 0..29) + future 7 days (daysAhead 1..7)
    const allSessionDays: { date: string; isPast: boolean }[] = [];
    for (let daysBack = 0; daysBack <= 29; daysBack++) {
      allSessionDays.push({ date: dateStr(daysAgo(daysBack)), isPast: daysBack > 0 });
    }
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
      allSessionDays.push({ date: dateStr(daysFromNow(daysAhead)), isPast: false });
    }
    for (let dayIdx = 0; dayIdx < allSessionDays.length; dayIdx++) {
      const { date: sessionDate, isPast } = allSessionDays[dayIdx];
      // 3-4 activities per day
      const numSessions = randInt(3, 4);
      for (let s = 0; s < numSessions; s++) {
        const actIdx = (dayIdx * 4 + s) % activitiesData.length;
        const timeSlot = sessionTimes[s % sessionTimes.length];
        const status = isPast ? 'completed' : 'scheduled';
        const { rows: [sess] } = await client.query(
          `INSERT INTO activity_sessions (care_home_id, activity_id, session_date, start_time, end_time, status, facilitator_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [homeId, activityIds[actIdx], sessionDate, timeSlot.start, timeSlot.end, status, activitiesCoordId]
        );
        sessionIds.push(sess.id);

        // Add participants based on mobility eligibility
        const actMobility = activitiesData[actIdx].mobility;
        const eligibleRooms = residentsData.filter(r => {
          const mob = mobilityMap[r.mob] || 'independent';
          if (actMobility === 'any') return true;
          const mobLevel: Record<string, number> = { bed_bound: 0, wheelchair: 1, walking_aid: 2, independent: 3 };
          const resLevel = mobLevel[mob] ?? 0;
          if (actMobility === 'independent_only') return resLevel >= 3;
          if (actMobility === 'walking_aid_or_better') return resLevel >= 2;
          if (actMobility === 'wheelchair_or_better') return resLevel >= 1;
          return true;
        }).map(r => r.room);

        // Pick 4-8 random eligible residents
        const numParticipants = Math.min(randInt(4, 8), eligibleRooms.length);
        const shuffled = [...eligibleRooms].sort(() => Math.random() - 0.5).slice(0, numParticipants);
        const moods = ['happy','content','neutral','anxious','calm','cheerful','tired','engaged'];
        const engagements: Array<'high'|'medium'|'low'|'none'> = ['high','medium','medium','low'];
        for (const room of shuffled) {
          const attendance = status === 'completed' ? (Math.random() > 0.1 ? 'attended' : 'declined') : 'registered';
          const engagement = attendance === 'attended' ? rand(engagements) : null;
          const moodBefore = attendance === 'attended' ? rand(moods) : null;
          const moodAfter = attendance === 'attended' ? rand(moods) : null;
          await client.query(
            `INSERT INTO activity_participants (session_id, resident_id, attendance, engagement_level, mood_before, mood_after)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
            [sess.id, residentIds[room], attendance, engagement, moodBefore, moodAfter]
          );
        }
      }
    }

    // ── Wellbeing Logs (30 days for all residents) ─────────────────────────
    console.log('  ▶  Wellbeing logs (30 days)…');
    const moodOptions = ['very_happy', 'happy', 'happy', 'neutral', 'neutral', 'low', 'very_low'];
    const sleepOptions = ['excellent', 'good', 'good', 'fair', 'poor', 'very_poor'];
    const engagementOptions = ['high', 'moderate', 'moderate', 'low', 'isolated'];
    const appetiteOptions = ['excellent', 'good', 'good', 'fair', 'poor', 'refused'];
    const energyOptions = ['high', 'moderate', 'moderate', 'low', 'very_low'];
    const logStaff = [carer1Id, carer2Id, seniorId, nurseId];

    for (let daysBack = 0; daysBack < 30; daysBack++) {
      const logDate = dateStr(daysAgo(daysBack));
      for (const room of Object.keys(residentIds)) {
        // Not every resident is logged every day (80% chance)
        if (Math.random() > 0.8) continue;
        await client.query(
          `INSERT INTO wellbeing_logs (care_home_id, resident_id, logged_by, log_date, mood, pain_level, sleep_quality, social_engagement, appetite, energy_level, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [homeId, residentIds[room], rand(logStaff), logDate,
           rand(moodOptions), randInt(0, 6),
           rand(sleepOptions), rand(engagementOptions),
           rand(appetiteOptions), rand(energyOptions),
           Math.random() > 0.7 ? rand(['Settled and comfortable', 'Requested extra blanket', 'Enjoyed morning tea in garden', 'Asked about family', 'Chatted with staff about the news', 'Slept well after warm drink']) : null]
        );
      }
    }

    // ── Life Stories (12+ residents) ──────────────────────────────────────
    console.log('  ▶  Life stories (12 residents)…');
    const lifeStories = [
      { room: '1', occupation: 'Primary school headteacher', hometown: 'Didsbury, Manchester', spouse: 'Married to Frank for 52 years (deceased 2018)', children: '3 children (Susan, David, Martin), 7 grandchildren', pets: 'Had a tabby cat called Marmalade', hobbies: ['Knitting', 'Crosswords', 'Gardening'], music: ['Vera Lynn', 'Frank Sinatra', 'Hymns'], tv: ['Antiques Roadshow', 'Countdown', 'Songs of Praise'], foods: ['Scones with jam', 'Fish and chips', 'Victoria sponge'], topics: ['Her teaching career', 'Grandchildren', 'Knitting patterns'], comfort: ['Soft blanket from daughter', 'Photo album', 'Radio 4'], routine: 'Likes tea at 7am with one sugar. Prefers bath in the evening. Reads before bed.', religious: 'Church of England - enjoys Sunday hymns on radio', traits: ['Warm', 'Sociable', 'Organised'], communication: 'Clear spoken, enjoys conversation, prefers quiet one-to-one chats' },
      { room: '2', occupation: 'Factory foreman (textile mill)', hometown: 'Oldham, Lancashire', spouse: 'Married to Betty for 60 years (wife visits weekly)', children: '2 sons (Robert, William), 5 grandchildren', pets: 'Kept racing pigeons for 40 years', hobbies: ['Pigeon racing', 'Woodwork', 'Watching cricket'], music: ['Brass band music', 'George Formby', 'The Beatles'], tv: ['Cricket', 'Coronation Street', 'Antiques Roadshow'], foods: ['Lancashire hotpot', 'Meat and potato pie', 'Custard'], topics: ['His pigeons', 'Cricket', 'The old mill'], comfort: ['Flat cap', 'Wooden bird carving he made', 'Cricket on radio'], routine: 'Likes to sit by the window. Responds well to music. Calmer in mornings.', religious: 'Methodist - sings along to hymns', traits: ['Gentle', 'Stubborn sometimes', 'Musical'], communication: 'Advanced dementia - responds to touch, music, and calm voice. Recognises wife.' },
      { room: '3', occupation: 'District nurse', hometown: 'Sale, Cheshire', spouse: 'Widowed - husband was an electrician (deceased 2010)', children: '1 daughter (Christine), 2 grandchildren', pets: 'Dog called Toby (border collie)', hobbies: ['Baking', 'Bridge club', 'Flower arranging'], music: ['Classical music', 'Elgar', 'Chopin'], tv: ['Bake Off', 'Gardeners World', 'Period dramas'], foods: ['Lemon drizzle cake', 'Soup', 'Chocolate'], topics: ['Her nursing days', 'Baking', 'Garden flowers'], comfort: ['Knitted blanket', 'Fresh flowers in room', 'Lavender pillow'], routine: 'Early riser. Enjoys helping others. Likes routine and predictability.', religious: 'Catholic - rosary beads are important to her', traits: ['Caring', 'Independent minded', 'Chatty'], communication: 'Good communication, some word-finding difficulty. Patient and kind.' },
      { room: '5', occupation: 'Post office clerk', hometown: 'Stretford, Manchester', spouse: 'Never married - lived with sister until 2019', children: 'No children - close to nieces and nephews', pets: 'Had budgerigars', hobbies: ['Reading', 'Jigsaw puzzles', 'Birdwatching'], music: ['Radio 2', 'Ella Fitzgerald', 'Big band'], tv: ['Springwatch', 'Murder mysteries', 'The Chase'], foods: ['Toast with marmalade', 'Roast dinner', 'Rice pudding'], topics: ['Birds', 'Books she has read', 'Local history'], comfort: ['Binoculars for window birdwatching', 'Reading glasses', 'Fleece throw'], routine: 'Independent. Quiet. Likes breakfast in her room. Enjoys afternoon activities.', religious: 'No particular faith but enjoys quiet reflection', traits: ['Quiet', 'Observant', 'Intellectual'], communication: 'Soft spoken. Needs time to respond. Very polite.' },
      { room: '6', occupation: 'Chartered accountant', hometown: 'Altrincham, Cheshire', spouse: 'Married to Jean for 55 years (wife has mobility issues)', children: '2 daughters, 4 grandchildren', pets: 'Family Labrador called Biscuit', hobbies: ['Golf', 'Sudoku', 'Bridge'], music: ['Jazz', 'Nat King Cole', 'Dean Martin'], tv: ['Golf', 'News', 'Quiz shows'], foods: ['Steak (soft cooked)', 'Cheese and biscuits', 'Fruit cake'], topics: ['Golf stories', 'His career', 'Financial news'], comfort: ['Newspaper daily', 'Golf trophy on shelf', 'Cashmere cardigan'], routine: 'Likes structure. Morning paper. Afternoon nap 2-3pm. Evening TV.', religious: 'Church of England - attends when chaplain visits', traits: ['Precise', 'Witty', 'Dignified'], communication: 'Articulate, slightly hard of hearing left ear. Uses hearing aid.' },
      { room: '7', occupation: 'Florist (owned shop for 30 years)', hometown: 'Salford, Manchester', spouse: 'Married to Ronald (deceased 2020)', children: '4 children, 8 grandchildren, 2 great-grandchildren', pets: 'Cat called Poppy', hobbies: ['Flower arranging', 'Singing', 'Dancing'], music: ['Motown', 'ABBA', 'Show tunes'], tv: ['Strictly Come Dancing', 'EastEnders', 'Loose Women'], foods: ['Chocolate cake', 'Full English', 'Apple crumble'], topics: ['Her flower shop', 'Dancing', 'Family'], comfort: ['Silk flowers in room', 'Family photos', 'Hand cream'], routine: 'Social butterfly. Joins all activities. Likes company. Late riser.', religious: 'Spiritual but not religious - enjoys meditation', traits: ['Vibrant', 'Friendly', 'Optimistic'], communication: 'Very chatty. Loves telling stories. Good hearing.' },
      { room: '9', occupation: 'Secretary at solicitors firm', hometown: 'Eccles, Manchester', spouse: 'Married to George (deceased 2015)', children: '2 sons, 3 grandchildren', pets: 'Poodle called Pierre', hobbies: ['Reading romance novels', 'Watercolour painting', 'Tea dances'], music: ['Shirley Bassey', 'Tom Jones', 'Musical theatre'], tv: ['Downton Abbey', 'Call the Midwife', 'The Royal'], foods: ['Afternoon tea', 'Salmon sandwiches', 'Battenberg cake'], topics: ['Old films', 'Fashion', 'Her painting'], comfort: ['Silk scarf collection', 'Watercolour set', 'Good quality hand cream'], routine: 'Likes things elegant. Dresses well daily. Afternoon tea ritual important.', religious: 'Church of England', traits: ['Elegant', 'Creative', 'Particular'], communication: 'Well spoken. Appreciates being addressed formally (Mrs Hartley).' },
      { room: '11', occupation: 'University lecturer (English Literature)', hometown: 'Chorlton, Manchester', spouse: 'Partner of 30 years (Margaret, visits twice weekly)', children: 'No children', pets: 'Two rescue cats', hobbies: ['Poetry', 'Theatre', 'Walking'], music: ['Opera', 'Debussy', 'Joni Mitchell'], tv: ['University Challenge', 'Only Connect', 'Documentaries'], foods: ['Vegetable curry', 'Hummus and bread', 'Dark chocolate'], topics: ['Literature', 'Poetry', 'Travel memories'], comfort: ['Books everywhere', 'Poetry anthology', 'Cashmere throw'], routine: 'Night owl. Reads late. Slow mornings. Intellectual stimulation important.', religious: 'Buddhist meditation practice', traits: ['Intellectual', 'Witty', 'Private'], communication: 'Articulate and dry-humoured. Values her privacy.' },
      { room: '12', occupation: 'Bus driver (40 years with local service)', hometown: 'Failsworth, Manchester', spouse: 'Married to Iris (deceased 2017)', children: '3 children, 6 grandchildren', pets: 'Kept chickens in garden', hobbies: ['Dominoes', 'Watching football', 'Gardening'], music: ['The Hollies', 'Status Quo', 'Northern Soul'], tv: ['Football', 'Only Fools and Horses', 'Bargain Hunt'], foods: ['Corned beef sandwiches', 'Chips', 'Treacle toffee'], topics: ['Manchester United', 'Bus routes he drove', 'His allotment'], comfort: ['Football scarf', 'Dominoes set', 'Old route maps'], routine: 'Early riser (old habit from driving). Likes routine. Restless by evening.', religious: 'No particular faith', traits: ['Jovial', 'Repetitive questions', 'Social'], communication: 'Dementia affects short-term memory. Responds well to familiar topics.' },
      { room: '13', occupation: 'Fashion buyer (department store)', hometown: 'Wilmslow, Cheshire', spouse: 'Divorced - enjoys independence', children: '1 daughter (lives in London)', pets: 'Persian cat called Coco', hobbies: ['Fashion magazines', 'Bridge', 'Shopping'], music: ['Classical', 'Norah Jones', 'Bossa nova'], tv: ['Fashion shows', 'Travel programmes', 'Bake Off'], foods: ['Gluten free bread', 'Smoked salmon', 'Meringue'], topics: ['Fashion', 'Travel', 'Her daughter'], comfort: ['Designer handbag', 'Good perfume', 'Silk pillowcase'], routine: 'Particular about appearance. Hair must be done. Values independence.', religious: 'No religion', traits: ['Stylish', 'Independent', 'Particular'], communication: 'Direct and clear. Coeliac disease - careful with food.' },
      { room: '15', occupation: 'Practice manager (dental surgery)', hometown: 'Worsley, Manchester', spouse: 'Married to Peter (visits daily)', children: '2 children, 5 grandchildren', pets: 'Golden retriever called Honey', hobbies: ['Gardening', 'Craft making', 'Cooking'], music: ['ABBA', 'The Carpenters', 'Michael Buble'], tv: ['Gardeners World', 'Great Pottery Throwdown', 'Saturday Kitchen'], foods: ['Homemade soup', 'Scones', 'Shepherd pie'], topics: ['Gardening tips', 'Grandchildren', 'Cooking recipes'], comfort: ['Garden view room', 'Craft supplies', 'Family photo frame'], routine: 'Active. Likes to help with table setting. Morning walk in garden.', religious: 'Methodist - enjoys fellowship', traits: ['Nurturing', 'Organised', 'Active'], communication: 'Warm and friendly. Good communicator. Loves helping.' },
      { room: '16', occupation: 'Pub landlord (The Red Lion, 25 years)', hometown: 'Swinton, Manchester', spouse: 'Married to Pauline (deceased 2019)', children: '3 children, 8 grandchildren', pets: 'Pub dog called Guinness', hobbies: ['Darts', 'Horse racing', 'Singing'], music: ['Frank Sinatra', 'Dean Martin', 'Irish folk'], tv: ['Horse racing', 'Coronation Street', 'QI'], foods: ['Steak and ale pie', 'Fish and chips', 'Spotted dick'], topics: ['The pub', 'Horse racing', 'Manchester'], comfort: ['Darts set', 'Racing Post', 'Favourite armchair'], routine: 'Late riser (pub hours!). Sociable. Likes a sherry in evening.', religious: 'Catholic Irish heritage', traits: ['Gregarious', 'Storyteller', 'Generous'], communication: 'Loud and cheerful. Tells wonderful stories. Hard of hearing.' },
    ];

    for (const story of lifeStories) {
      if (!residentIds[story.room]) continue;
      await client.query(
        `INSERT INTO resident_life_story (resident_id, occupation, hometown, spouse_info, children_info, pets, hobbies, favorite_music, favorite_tv, favorite_foods, conversation_topics, comfort_items, daily_routine_preferences, religious_preferences, personality_traits, communication_style, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [residentIds[story.room], story.occupation, story.hometown, story.spouse, story.children, story.pets,
         story.hobbies, story.music, story.tv, story.foods, story.topics, story.comfort,
         story.routine, story.religious, story.traits, story.communication, managerId]
      );
    }

    // ── Environment Preferences (8 residents) ─────────────────────────────
    console.log('  ▶  Environment preferences (8 residents)…');
    const envPrefs = [
      { room: '1', lighting: 'Soft warm light', temp: 'Warm (22-24C)', music: 'Background (quiet)', sounds: ['Radio 4', 'Birdsong'], aroma: ['Lavender'], noise: 'moderate' },
      { room: '2', lighting: 'Soft warm light', temp: 'Warm (22-24C)', music: 'Moderate', sounds: ['Brass band music', 'Cricket commentary'], aroma: ['None preferred'], noise: 'low' },
      { room: '3', lighting: 'Bright natural light', temp: 'Comfortable (20-22C)', music: 'Background (quiet)', sounds: ['Classical music', 'Nature sounds'], aroma: ['Lavender', 'Rose'], noise: 'moderate' },
      { room: '5', lighting: 'Bright natural light', temp: 'Comfortable (20-22C)', music: 'Background (quiet)', sounds: ['Birdsong', 'Nature sounds'], aroma: ['None preferred'], noise: 'high' },
      { room: '7', lighting: 'Bright natural light', temp: 'Comfortable (20-22C)', music: 'Moderate', sounds: ['Motown', 'ABBA'], aroma: ['Rose', 'Vanilla'], noise: 'low' },
      { room: '8', lighting: 'Dim ambient', temp: 'Warm (22-24C)', music: 'Background (quiet)', sounds: ['White noise', 'Rainfall'], aroma: ['Chamomile', 'Lavender'], noise: 'high' },
      { room: '11', lighting: 'Soft warm light', temp: 'Cool (18-20C)', music: 'Background (quiet)', sounds: ['Classical music', 'Ocean waves'], aroma: ['Eucalyptus'], noise: 'high' },
      { room: '15', lighting: 'Bright natural light', temp: 'Comfortable (20-22C)', music: 'Moderate', sounds: ['Radio 2', 'Nature sounds'], aroma: ['Lavender', 'Peppermint'], noise: 'low' },
    ];
    for (const ep of envPrefs) {
      if (!residentIds[ep.room]) continue;
      await client.query(
        `INSERT INTO environment_preferences (resident_id, preferred_lighting, preferred_temperature, preferred_music_volume, calming_sounds, aromatherapy, noise_sensitivity)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [residentIds[ep.room], ep.lighting, ep.temp, ep.music, ep.sounds, ep.aroma, ep.noise]
      );
    }

    // ── Social Isolation Alerts ────────────────────────────────────────────
    console.log('  ▶  Social isolation alerts…');
    const isolationAlerts = [
      { room: '4', type: 'no_activities', days: 12, severity: 'moderate' },
      { room: '10', type: 'no_activities', days: 18, severity: 'severe' },
      { room: '14', type: 'no_visitors', days: 21, severity: 'severe' },
      { room: '8', type: 'low_engagement', days: 7, severity: 'mild' },
      { room: '20', type: 'no_activities', days: 8, severity: 'mild' },
    ];
    for (const alert of isolationAlerts) {
      if (!residentIds[alert.room]) continue;
      await client.query(
        `INSERT INTO social_isolation_alerts (care_home_id, resident_id, alert_type, days_since_last, severity, status)
         VALUES ($1,$2,$3,$4,$5,'active')`,
        [homeId, residentIds[alert.room], alert.type, alert.days, alert.severity]
      );
    }

    await client.query('COMMIT');

    console.log('\n✅  GODMODE Seed complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Care Home  : Willowbrook House, Salford');
    console.log('  Residents  : 24 active residents');
    console.log('  Staff      : 8 users (all roles)');
    console.log('  Medications: 80+ medications');
    console.log('  eMAR       : 30 days administration history');
    console.log('  Care Notes : 70+ notes over 30 days');
    console.log('  Incidents  : 18 incidents with updates');
    console.log('  Rota       : 3-month schedule (all staff)');
    console.log('  Training   : 40+ training records');
    console.log('  Compliance : 20 actions across all domains');
    console.log('  Policies   : 12 policies');
    console.log('  Messages   : 15+ family messages');
    console.log('  Invoices   : 4 months (17 residents)');
    console.log('');
    console.log('  Demo login credentials:');
    console.log('  ┌──────────────────────────────────────────────┐');
    console.log('  │  manager@demo.carevista.co.uk                │');
    console.log('  │  nurse@demo.carevista.co.uk                  │');
    console.log('  │  senior@demo.carevista.co.uk                 │');
    console.log('  │  carer1@demo.carevista.co.uk                 │');
    console.log('  │  finance@demo.carevista.co.uk                │');
    console.log('  │  Password (all): Demo1234!                   │');
    console.log('  └──────────────────────────────────────────────┘');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed — rolled back.\n', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
