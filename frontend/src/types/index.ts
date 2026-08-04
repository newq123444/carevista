// src/types/index.ts — All shared TypeScript types for CareVista

export type UserRole =
  | 'home_manager' | 'deputy_manager' | 'registered_nurse'
  | 'senior_carer' | 'carer' | 'activities'
  | 'finance' | 'admin' | 'super_admin' | 'group_admin'
  | 'cleaning' | 'kitchen' | 'maintenance' | 'family';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  careHomeId: string;
  careHomeName: string;
  phone?: string;
}

export interface Resident {
  id: string;
  care_home_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nhs_number?: string;
  room_number: string;
  admission_date: string;
  care_type: 'residential' | 'nursing' | 'dementia' | 'respite' | 'palliative';
  status: 'active' | 'hospital' | 'leave' | 'discharged' | 'deceased';
  risk_level: 'low' | 'medium' | 'high';
  dnacpr: boolean;
  allergies?: string;
  dietary_requirements?: string;
  mobility_notes?: string;
  mobility_status?: 'independent' | 'walking_aid' | 'wheelchair' | 'bed_bound';
  interests?: string[];
  wellbeing_score?: number;
  key_worker_id?: string;
  gp_name?: string;
  gp_phone?: string;
  funding_type?: string;
  weekly_fee_pence?: number;
  care_needs_summary?: string;
  created_at: string;
  updated_at: string;
  photo_url?: string;
}

export interface CareNote {
  id: string;
  resident_id: string;
  resident_name?: string;
  staff_id: string;
  staff_name?: string;
  author_name?: string;
  note_type: string;
  body: string;
  flagged: boolean;
  created_at: string;
}

export interface Medication {
  id: string;
  resident_id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  times_of_day: string[];
  prescriber: string;
  start_date: string;
  end_date?: string;
  prn: boolean;
  controlled: boolean;
  status: 'active' | 'discontinued';
  instructions?: string;
  notes?: string;
}

export type MedAdministration = Administration;

export interface Administration {
  id: string;
  medication_id: string;
  resident_id: string;
  administered_by: string;
  administered_at: string;
  scheduled_time: string;
  status: 'given' | 'missed' | 'refused' | 'held';
  actual_time?: string;
  notes?: string;
}

export interface EmarEntry {
  resident: Resident;
  medications: Medication[];
  administrations: Administration[];
}

export interface Incident {
  id: string;
  care_home_id: string;
  resident_id?: string;
  resident_name?: string;
  reported_by_id: string;
  reported_by_name?: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'closed';
  incident_date: string;
  location?: string;
  description: string;
  immediate_action?: string;
  witnesses?: string;
  notified_family: boolean;
  notified_gp: boolean;
  notified_cqc: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  staff_id: string;
  staff_name?: string;
  care_home_id: string;
  shift_date: string;
  shift_type: 'day' | 'evening' | 'night' | 'sleep-in';
  start_time: string;
  end_time: string;
  role_cover?: string;
  notes?: string;
}

export interface StaffProfile {
  id: string;
  user_id: string;
  care_home_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  employee_number?: string;
  job_title?: string;
  phone?: string;
  start_date?: string;
  contracted_hours?: number;
  hourly_rate?: number;
  dbs_number?: string;
  dbs_expiry?: string;
  active: boolean;
}

export interface TrainingRecord {
  id: string;
  staff_id: string;
  staff_name?: string;
  course_name: string;
  completed_date: string;
  expiry_date?: string;
  status: 'current' | 'expiring' | 'expired';
  provider?: string;
  certificate_url?: string;
}

export type KloeDomain = 'safe' | 'effective' | 'caring' | 'responsive' | 'well_led';

export interface ComplianceAction {
  id: string;
  care_home_id: string;
  title: string;
  description?: string;
  category: string;
  kloe_domain?: KloeDomain;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'closed';
  assigned_to_id?: string;
  assigned_to_name?: string;
  assigned_to?: string;
  assigned_name?: string;
  due_date?: string;
  evidence_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMessage {
  id: string;
  resident_id: string;
  resident_name?: string;
  contact_name: string;
  direction: 'inbound' | 'outbound';
  subject?: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number?: string;
  resident_id: string;
  resident_name?: string;
  payer_type?: string;
  period_start: string;
  period_end: string;
  period_label?: string;
  fee_per_week_pence: number;
  total_pence: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  due_date: string;
  paid_date?: string;
  notes?: string;
  created_at: string;
  funding_type?: string;
  payer_name?: string;
  amount_pence?: number;
  vat_pence?: number;
}

export interface DashboardData {
  residents: { active: number; high_risk: number; on_leave: number; in_hospital: number };
  openIncidents: string;
  missedMedsToday: string;
  expiringTraining: string;
  unreadMessages: string;
  notesToday: string;
  occupancyRate?: number;
}

// ── Activities & Wellbeing ────────────────────────────────────────────────
export type MobilityStatus = 'independent' | 'walking_aid' | 'wheelchair' | 'bed_bound';
export type MobilityRequirement = 'any' | 'walking_aid_or_better' | 'wheelchair_or_better' | 'independent_only';

export interface Activity {
  id: string;
  care_home_id: string;
  name: string;
  description?: string;
  activity_type: string;
  required_mobility_level: MobilityRequirement;
  duration_minutes: number;
  max_participants: number;
  location?: string;
  facilitator?: string;
  recurring: boolean;
  recurrence_pattern?: string;
  category: string;
  sensory_friendly: boolean;
  cognitive_level: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivitySession {
  id: string;
  care_home_id: string;
  activity_id: string;
  activity_name?: string;
  category?: string;
  required_mobility_level?: string;
  location?: string;
  duration_minutes?: number;
  sensory_friendly?: boolean;
  session_date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  facilitator_id?: string;
  facilitator_name?: string;
  notes?: string;
  mood_rating_avg?: number;
  participant_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityParticipant {
  id: string;
  session_id: string;
  resident_id: string;
  first_name?: string;
  last_name?: string;
  room_number?: string;
  mobility_status?: string;
  photo_url?: string;
  attendance: 'registered' | 'attended' | 'declined' | 'unable';
  engagement_level?: 'high' | 'medium' | 'low' | 'none';
  mood_before?: string;
  mood_after?: string;
  notes?: string;
  created_at: string;
  // For history view
  session_date?: string;
  start_time?: string;
  end_time?: string;
  session_status?: string;
  activity_name?: string;
  activity_type?: string;
}

export interface WellbeingStats {
  stats: {
    unique_participants: string;
    total_participations: string;
    total_attended: string;
    high_engagement: string;
    medium_engagement: string;
    low_engagement: string;
    attendance_rate: string;
  };
  popular_activities: Array<{ name: string; category: string; participant_count: string }>;
  inactive_residents: Array<{
    id: string;
    first_name: string;
    last_name: string;
    room_number: string;
    mobility_status: string;
    last_activity_date: string | null;
  }>;
  week_stats: {
    sessions_this_week: string;
    completed: string;
    upcoming: string;
  };
}

// ── Wellbeing Tracking ────────────────────────────────────────────────────
export type MoodLevel = 'very_happy' | 'happy' | 'neutral' | 'low' | 'very_low';
export type SleepQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
export type SocialEngagement = 'high' | 'moderate' | 'low' | 'isolated';
export type AppetiteLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'refused';
export type EnergyLevel = 'high' | 'moderate' | 'low' | 'very_low';

export interface WellbeingLog {
  id: string;
  care_home_id: string;
  resident_id: string;
  logged_by: string;
  logged_by_name?: string;
  log_date: string;
  mood: MoodLevel;
  pain_level: number | null;
  sleep_quality: SleepQuality;
  social_engagement: SocialEngagement;
  appetite: AppetiteLevel;
  energy_level: EnergyLevel;
  notes?: string;
  created_at: string;
}

export interface WellbeingOverview {
  todayLogs: Array<WellbeingLog & { first_name: string; last_name: string; room_number: string; photo_url?: string }>;
  needsAttention: Array<{ id: string; first_name: string; last_name: string; room_number: string; photo_url?: string; mood: MoodLevel; pain_level: number | null; log_date: string }>;
  stats: { happy_count: string; neutral_count: string; low_count: string; avg_pain: string; logged_residents: string };
}

export interface ResidentLifeStory {
  id: string;
  resident_id: string;
  occupation?: string;
  hometown?: string;
  spouse_info?: string;
  children_info?: string;
  pets?: string;
  hobbies?: string[];
  favorite_music?: string[];
  favorite_tv?: string[];
  favorite_foods?: string[];
  conversation_topics?: string[];
  comfort_items?: string[];
  daily_routine_preferences?: string;
  religious_preferences?: string;
  dislikes?: string[];
  important_dates?: Record<string, string>;
  life_achievements?: string;
  war_service?: string;
  personality_traits?: string[];
  communication_style?: string;
  updated_at?: string;
  updated_by?: string;
  updated_by_name?: string;
}

export type AlertSeverity = 'mild' | 'moderate' | 'severe';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface SocialIsolationAlert {
  id: string;
  care_home_id: string;
  resident_id: string;
  first_name?: string;
  last_name?: string;
  room_number?: string;
  photo_url?: string;
  alert_type: 'no_visitors' | 'no_activities' | 'no_social_notes' | 'low_engagement';
  days_since_last: number;
  severity: AlertSeverity;
  status: AlertStatus;
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  resolved_at?: string;
  created_at: string;
}

export interface EnvironmentPreferences {
  id: string;
  resident_id: string;
  preferred_lighting?: string;
  preferred_temperature?: string;
  preferred_music_volume?: string;
  calming_sounds?: string[];
  aromatherapy?: string[];
  room_decorations?: string;
  photo_display_preference?: string;
  tv_volume?: string;
  noise_sensitivity?: 'low' | 'moderate' | 'high';
  notes?: string;
  updated_at?: string;
}

// ── Predictive Care ───────────────────────────────────────────────────────
export interface PredictiveRiskScore {
  id: string;
  care_home_id: string;
  resident_id: string;
  risk_type: 'falls' | 'deterioration';
  score: number;
  factors: Record<string, any>;
  generated_at: string;
}

export interface PredictiveAlert {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  room_number?: string;
  alert_type: string;
  risk_score: number;
  threshold: number;
  factors: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  resolved_at?: string;
  created_at: string;
}

export interface PredictiveRiskDashboardItem {
  resident_id: string;
  first_name: string;
  last_name: string;
  room_number: string;
  risk_level: string;
  falls_score: number | null;
  falls_generated_at: string | null;
  deterioration_score: number | null;
  deterioration_generated_at: string | null;
}

// ── Family Portal ─────────────────────────────────────────────────────────
export interface FamilyDailySummary {
  id: string;
  resident_id: string;
  summary_date: string;
  meals_summary: string | null;
  activities_summary: string | null;
  mood_summary: string | null;
  care_notes_summary: string | null;
  photo_urls: string[];
  generated_at: string;
  generated_by: string;
}

export interface FamilyWeeklyReport {
  id: string;
  resident_id: string;
  week_start: string;
  week_end: string;
  report_content: string;
  wellbeing_score_avg: number | null;
  highlights: string[];
  concerns: string[];
  generated_at: string;
  sent_at: string | null;
}

export interface FamilyPhoto {
  id: string;
  resident_id: string;
  photo_url: string;
  caption: string | null;
  activity_session_id: string | null;
  uploaded_by_name?: string;
  created_at: string;
}

export interface FamilyDashboardData {
  resident: {
    id: string;
    first_name: string;
    last_name: string;
    room_number: string;
    photo_url: string | null;
  };
  today_summary: FamilyDailySummary | null;
  recent_photos: FamilyPhoto[];
  unread_messages: number;
  latest_wellbeing: any;
}

// ── CQC Compliance ────────────────────────────────────────────────────────
export interface CqcDomainScore {
  id: string;
  domain: string;
  score: number;
  evidence_count: number;
  gaps_count: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  calculated_at: string;
}

export interface CqcEvidencePack {
  id: string;
  domains_included: string[];
  date_range_start: string;
  date_range_end: string;
  content: any;
  status: 'generating' | 'complete' | 'failed';
  created_at: string;
}

export interface PolicyReview {
  id: string;
  policy_id: string;
  policy_title?: string;
  reviewer_name?: string;
  reviewer_id: string;
  review_date: string;
  next_review_date: string | null;
  status: string;
  changes_made: string | null;
  notes: string | null;
  created_at: string;
}

export interface PolicyWithReview {
  id: string;
  title: string;
  category: string | null;
  review_date: string | null;
  status: string;
  version: string | null;
  latest_review_date: string | null;
  latest_reviewer: string | null;
  next_review_date: string | null;
  is_overdue: boolean;
}

export interface InspectionChecklist {
  id: string;
  title: string;
  domain: string;
  items: Array<{ title: string; description: string; completed: boolean; evidence?: string }>;
  completed_items: number;
  total_items: number;
  status: string;
}

export interface ComplianceOverview {
  domain_scores: CqcDomainScore[];
  overdue_policies_count: number;
  expiring_training_count: number;
  open_actions_count: number;
  overall_readiness_score: number;
}

// ── Voice Transcription ───────────────────────────────────────────────────
export interface VoiceTranscription {
  id: string;
  user_id: string;
  resident_id: string | null;
  resident_name?: string;
  audio_duration_seconds: number | null;
  transcription_text: string;
  confidence_score: number | null;
  care_note_id: string | null;
  status: 'transcribed' | 'converted_to_note' | 'discarded';
  created_at: string;
}

// ── SBAR Handover ─────────────────────────────────────────────────────────
export interface SbarHandover {
  id: string;
  care_home_id: string;
  generated_by: string;
  generated_by_name?: string;
  shift_date: string;
  shift_type: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  residents_covered: string[];
  key_concerns: any;
  status: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  created_at: string;
}

// -- NEWS2 --
export interface News2Assessment {
  id: string;
  care_home_id: string;
  resident_id: string;
  assessed_by: string;
  assessed_by_name?: string;
  respiratory_rate: number;
  spo2: number;
  supplemental_oxygen: boolean;
  systolic_bp: number;
  pulse: number;
  consciousness: 'alert' | 'confusion' | 'voice' | 'pain' | 'unresponsive';
  temperature: number;
  total_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  escalation_action?: string;
  escalation_triggered_at?: string;
  notes?: string;
  created_at: string;
}

export interface News2Escalation {
  id: string;
  assessment_id: string;
  resident_id: string;
  resident_name?: string;
  escalation_level: 'low' | 'medium' | 'high' | 'critical';
  action_taken?: string;
  responded_by?: string;
  responded_by_name?: string;
  responded_at?: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  created_at: string;
}

// -- Wounds --
export interface WoundAssessment {
  id: string;
  care_home_id: string;
  resident_id: string;
  assessed_by: string;
  assessed_by_name?: string;
  resident_name?: string;
  room_number?: string;
  wound_type: string;
  location_body_area: string;
  location_x?: number;
  location_y?: number;
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  wound_bed?: string;
  exudate_level?: string;
  exudate_type?: string;
  surrounding_skin?: string;
  pain_level?: number;
  photo_url?: string;
  notes?: string;
  status: 'active' | 'healing' | 'healed' | 'worsening';
  created_at: string;
  updated_at: string;
}

// -- Infections --
export interface InfectionOutbreak {
  id: string;
  care_home_id: string;
  outbreak_type: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'contained' | 'resolved';
  affected_count: number;
  isolation_protocol?: string;
  notes?: string;
  reported_by?: string;
  reported_by_name?: string;
  case_count?: number;
  created_at: string;
  updated_at: string;
}

export interface InfectionCase {
  id: string;
  outbreak_id: string;
  resident_id: string;
  resident_name?: string;
  room_number?: string;
  symptoms?: string;
  onset_date: string;
  isolation_start?: string;
  isolation_end?: string;
  status: 'active' | 'recovering' | 'resolved' | 'deceased';
  notes?: string;
  created_at: string;
}

// -- Continence --
export interface ContinenceLog {
  id: string;
  resident_id: string;
  logged_by: string;
  logged_by_name?: string;
  event_type: 'continent' | 'incontinent_urine' | 'incontinent_faeces' | 'incontinent_both' | 'pad_change' | 'toileted_successfully' | 'toileted_unsuccessfully';
  event_time: string;
  pad_status?: 'dry' | 'wet' | 'soiled' | 'not_applicable';
  location?: string;
  notes?: string;
  created_at: string;
}

export interface ContinenceAssessment {
  id: string;
  resident_id: string;
  assessed_by: string;
  pattern_analysis?: any;
  recommended_schedule?: any;
  pad_type?: string;
  current_pad_usage?: number;
  target_pad_usage?: number;
  dignity_notes?: string;
  review_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ContinencePattern {
  hour: number;
  continent_count: number;
  incontinent_count: number;
  total_events: number;
}

// -- Smart Rota --
export interface RotaTemplate {
  id: string;
  care_home_id: string;
  name: string;
  week_start: string;
  status: 'draft' | 'published' | 'archived';
  constraints?: any;
  budget_limit_pence?: number;
  created_by?: string;
  created_by_name?: string;
  shifts?: RotaShift[];
  created_at: string;
  updated_at: string;
}

export interface RotaShift {
  id: string;
  template_id: string;
  staff_id: string;
  staff_name?: string;
  staff_role?: string;
  shift_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  role_required?: string;
  auto_generated: boolean;
  notes?: string;
}

// -- Natural Language Search --
export interface NlSearchResult {
  query: string;
  parsedIntent: any;
  results: any[];
  resultsCount: number;
}

export interface NlSearchQuery {
  id: string;
  query_text: string;
  parsed_intent?: any;
  results_count: number;
  created_at: string;
}

// -- Risk Assessments --
export interface RiskAssessment {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  room_number?: string;
  assessed_by: string;
  assessed_by_name?: string;
  assessment_type: 'waterlow' | 'must' | 'falls';
  total_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'very_high';
  factors: any;
  auto_populated: boolean;
  next_review_date?: string;
  status: 'current' | 'overdue' | 'superseded';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskOverviewItem {
  resident_id: string;
  first_name: string;
  last_name: string;
  room_number: string;
  waterlow_score?: number;
  waterlow_level?: string;
  must_score?: number;
  must_level?: string;
  falls_score?: number;
  falls_level?: string;
}

// ── Batch 2: Finance ──────────────────────────────────────────────────────
export interface RateUplift {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  previous_rate_pence: number;
  new_rate_pence: number;
  effective_date: string;
  reason?: string;
  approved_by?: string;
  approved_by_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface PaymentReminder {
  id: string;
  care_home_id: string;
  invoice_id: string;
  invoice_number?: string;
  resident_name?: string;
  payer_name?: string;
  amount_due_pence: number;
  due_date: string;
  days_overdue: number;
  reminder_sent_at?: string;
  status: 'pending' | 'sent' | 'paid';
  created_at: string;
}

export interface OccupancyRecord {
  id: string;
  care_home_id: string;
  record_date: string;
  total_beds: number;
  occupied_beds: number;
  occupancy_rate: number;
  notes?: string;
  created_at: string;
}

export interface OccupancyForecast {
  id: string;
  care_home_id: string;
  forecast_date: string;
  predicted_occupancy: number;
  confidence_low: number;
  confidence_high: number;
  model_type?: string;
  generated_at: string;
}

export interface StaffCost {
  id: string;
  care_home_id: string;
  staff_id: string;
  staff_name?: string;
  period_start: string;
  period_end: string;
  regular_hours: number;
  overtime_hours: number;
  agency_hours: number;
  regular_cost_pence: number;
  overtime_cost_pence: number;
  agency_cost_pence: number;
  total_cost_pence: number;
  created_at: string;
}

export interface CostBudget {
  id: string;
  care_home_id: string;
  budget_name: string;
  period_start: string;
  period_end: string;
  budget_amount_pence: number;
  actual_amount_pence?: number;
  variance_pence?: number;
  status: 'on_track' | 'over_budget' | 'under_budget';
  created_at: string;
  updated_at: string;
}

// ── Batch 2: HR ───────────────────────────────────────────────────────────
export interface JobPosting {
  id: string;
  care_home_id: string;
  title: string;
  department?: string;
  description?: string;
  requirements?: string;
  salary_range?: string;
  contract_type: 'full_time' | 'part_time' | 'bank' | 'agency';
  status: 'draft' | 'open' | 'closed' | 'filled';
  posted_date?: string;
  closing_date?: string;
  applications_count?: number;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  care_home_id: string;
  posting_id: string;
  posting_title?: string;
  applicant_name: string;
  applicant_email?: string;
  applicant_phone?: string;
  cv_url?: string;
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  notes?: string;
  applied_date: string;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  care_home_id: string;
  application_id: string;
  applicant_name?: string;
  posting_title?: string;
  interviewer_id?: string;
  interviewer_name?: string;
  scheduled_at: string;
  duration_minutes?: number;
  location?: string;
  interview_type: 'phone' | 'video' | 'in_person';
  outcome?: 'pass' | 'fail' | 'pending';
  notes?: string;
  created_at: string;
}

export interface DbsCheck {
  id: string;
  care_home_id: string;
  application_id?: string;
  staff_id?: string;
  applicant_name?: string;
  check_type: 'basic' | 'standard' | 'enhanced';
  status: 'pending' | 'in_progress' | 'clear' | 'flagged';
  submitted_date?: string;
  completed_date?: string;
  certificate_number?: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Competency {
  id: string;
  care_home_id: string;
  name: string;
  category?: string;
  description?: string;
  required_for_roles?: string[];
  renewal_months?: number;
  created_at: string;
  updated_at: string;
}

export interface StaffCompetency {
  id: string;
  care_home_id: string;
  staff_id: string;
  staff_name?: string;
  competency_id: string;
  competency_name?: string;
  achieved_date?: string;
  expiry_date?: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'expired';
  evidence_url?: string;
  assessor_id?: string;
  assessor_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AbsenceRecord {
  id: string;
  care_home_id: string;
  staff_id: string;
  staff_name?: string;
  absence_type: 'sick' | 'holiday' | 'compassionate' | 'unpaid' | 'maternity' | 'other';
  start_date: string;
  end_date?: string;
  days_lost: number;
  reason?: string;
  self_certified: boolean;
  fit_note_received: boolean;
  return_to_work_completed: boolean;
  return_to_work_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BradfordScore {
  id: string;
  care_home_id: string;
  staff_id: string;
  staff_name?: string;
  score: number;
  spells: number;
  total_days: number;
  period_start: string;
  period_end: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  calculated_at: string;
}

// ── Batch 2: Facilities ───────────────────────────────────────────────────
export interface FireTest {
  id: string;
  care_home_id: string;
  test_type: string;
  test_date: string;
  conducted_by: string;
  conducted_by_name?: string;
  location?: string;
  result: 'pass' | 'fail' | 'partial';
  issues_found?: string;
  corrective_action?: string;
  next_test_due?: string;
  notes?: string;
  created_at: string;
}

export interface FireEquipmentCheck {
  id: string;
  care_home_id: string;
  equipment_type: string;
  equipment_id_tag?: string;
  location: string;
  check_date: string;
  checked_by: string;
  checked_by_name?: string;
  status: 'pass' | 'fail' | 'needs_attention';
  issues_found?: string;
  next_check_due?: string;
  notes?: string;
  created_at: string;
}

export interface Peep {
  id: string;
  care_home_id: string;
  resident_id?: string;
  resident_name?: string;
  staff_id?: string;
  staff_name?: string;
  person_name: string;
  mobility_needs?: string;
  evacuation_method?: string;
  assistance_required?: string;
  location?: string;
  floor_level?: string;
  review_date?: string;
  status: 'active' | 'archived';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VisitorRecord {
  id: string;
  care_home_id: string;
  visitor_name: string;
  visitor_company?: string;
  visitor_phone?: string;
  visiting_resident_id?: string;
  visiting_resident_name?: string;
  purpose?: string;
  sign_in_time: string;
  sign_out_time?: string;
  badge_number?: string;
  car_registration?: string;
  dbs_checked?: boolean;
  health_declaration?: boolean;
  signed_in_by?: string;
  notes?: string;
  created_at: string;
}

export interface VisitorSafeguarding {
  id: string;
  care_home_id: string;
  visitor_name: string;
  flag_type: 'banned' | 'supervised_only' | 'alert' | 'dbs_required';
  reason?: string;
  resident_id?: string;
  resident_name?: string;
  flagged_by?: string;
  flagged_by_name?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomTurnover {
  id: string;
  care_home_id: string;
  room_number: string;
  previous_resident_id?: string;
  previous_resident_name?: string;
  vacated_date: string;
  target_ready_date?: string;
  actual_ready_date?: string;
  status: 'pending' | 'in_progress' | 'cleaning' | 'maintenance' | 'inspection' | 'ready';
  assigned_to?: string;
  assigned_to_name?: string;
  notes?: string;
  checklist_progress?: number;
  created_at: string;
  updated_at: string;
}

export interface TurnoverChecklistItem {
  id: string;
  turnover_id: string;
  task_name: string;
  category?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  completed: boolean;
  completed_at?: string;
  completed_by?: string;
  completed_by_name?: string;
  notes?: string;
  sort_order?: number;
  created_at: string;
}

export interface ReportTemplate {
  id: string;
  care_home_id: string;
  name: string;
  description?: string;
  data_source: string;
  filters?: Record<string, any>;
  columns?: string[];
  grouping?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  chart_type?: 'table' | 'bar' | 'line' | 'pie';
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportRun {
  id: string;
  care_home_id: string;
  template_id: string;
  template_name?: string;
  run_by?: string;
  run_by_name?: string;
  parameters?: Record<string, any>;
  row_count?: number;
  status: 'running' | 'completed' | 'failed';
  result_data?: any;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

// -- Medication Interactions --
export interface MedicationInteraction {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  room_number?: string;
  medication_a_id: string;
  medication_a_name?: string;
  medication_b_id: string;
  medication_b_name?: string;
  interaction_type?: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description?: string;
  clinical_effect?: string;
  recommendation?: string;
  flagged_at: string;
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  acknowledged_at?: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'overridden';
  created_at: string;
}

// ── Batch 3: Offline Sync ─────────────────────────────────────────────────
export interface OfflineSyncItem {
  id: string;
  care_home_id: string;
  user_id: string;
  action_type: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id?: string;
  payload: Record<string, any>;
  status: 'pending' | 'synced' | 'conflict' | 'failed';
  conflict_data?: Record<string, any>;
  resolved_at?: string;
  created_at: string;
  synced_at?: string;
}

// ── Batch 3: Resident Tablet ──────────────────────────────────────────────
export interface ResidentTabletRequest {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  request_type: 'help' | 'meal_rating' | 'activity_choice' | 'video_call' | 'entertainment';
  details?: Record<string, any>;
  status: 'pending' | 'acknowledged' | 'completed';
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  acknowledged_at?: string;
  created_at: string;
}

// ── Batch 3: QR Room Scanning ─────────────────────────────────────────────
export interface QrRoomCode {
  id: string;
  care_home_id: string;
  room_number: string;
  qr_code: string;
  resident_id?: string;
  resident_name?: string;
  status: 'active' | 'inactive';
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  deactivated_at?: string;
}

// ── Batch 3: Benchmarking ─────────────────────────────────────────────────
export interface BenchmarkingKpi {
  id: string;
  care_home_id: string;
  metric_name: string;
  metric_value: number;
  national_average: number;
  percentile_rank?: number;
  period_start: string;
  period_end: string;
  performance_level: 'above' | 'average' | 'below';
  calculated_at: string;
}

// ── Batch 3: Board Pack ───────────────────────────────────────────────────
export interface BoardPackReport {
  id: string;
  care_home_id: string;
  title: string;
  period_start: string;
  period_end: string;
  sections: Record<string, any>;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  generated_by?: string;
  generated_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Batch 3: Staff Performance ────────────────────────────────────────────
export interface StaffPerformanceMetric {
  id: string;
  care_home_id: string;
  staff_id: string;
  staff_name?: string;
  metric_type: string;
  metric_value: number;
  period_start: string;
  period_end: string;
  tasks_completed?: number;
  avg_response_time_minutes?: number;
  notes_logged?: number;
  calculated_at: string;
}

// ── Batch 3: E-Learning ──────────────────────────────────────────────────
export interface ElearningModule {
  id: string;
  care_home_id: string;
  title: string;
  description?: string;
  category: string;
  duration_minutes?: number;
  mandatory: boolean;
  content_url?: string;
  thumbnail_url?: string;
  pass_mark?: number;
  status: 'draft' | 'published' | 'archived';
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ElearningQuiz {
  id: string;
  module_id: string;
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correct_answer: number;
  }>;
  created_at: string;
}

export interface ElearningCompletion {
  id: string;
  care_home_id: string;
  staff_id: string;
  staff_name?: string;
  module_id: string;
  module_title?: string;
  quiz_score?: number;
  pass_mark?: number;
  passed: boolean;
  completed_at: string;
  certificate_url?: string;
}

// ── Batch 3: Competency Sign-Off ─────────────────────────────────────────
export interface CompetencySignoff {
  id: string;
  care_home_id: string;
  staff_id: string;
  staff_name?: string;
  competency_name: string;
  assessor_id: string;
  assessor_name?: string;
  outcome: 'competent' | 'not_yet_competent' | 'requires_training';
  evidence_notes?: string;
  observation_date: string;
  status: 'pending' | 'signed_off' | 'expired';
  signed_off_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Batch 3: Diabetes Management ─────────────────────────────────────────
export interface GlucoseReading {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  reading_mmol: number;
  meal_timing: 'fasting' | 'pre_meal' | 'post_meal' | 'bedtime' | 'random';
  logged_by: string;
  logged_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface InsulinDose {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  insulin_type: string;
  dose_units: number;
  injection_site?: string;
  administered_by: string;
  administered_by_name?: string;
  scheduled_time?: string;
  notes?: string;
  created_at: string;
}

export interface DiabetesAlert {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  alert_type: 'hypo' | 'hyper' | 'missed_insulin' | 'pattern_concern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  glucose_reading_id?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  created_at: string;
}

export interface Hba1cRecord {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  value_mmol_mol: number;
  value_percent: number;
  test_date: string;
  ordered_by?: string;
  notes?: string;
  created_at: string;
}

// ── Batch 3: Palliative Care ─────────────────────────────────────────────
export interface PalliativeCarePlan {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  preferred_place_of_death?: string;
  resuscitation_status: 'for_resuscitation' | 'dnacpr';
  spiritual_needs?: string;
  preferred_priorities?: Record<string, any>;
  advance_decisions?: string;
  key_contacts?: Array<{ name: string; relationship: string; phone: string }>;
  status: 'active' | 'review_due' | 'archived';
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ComfortRound {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  scheduled_time: string;
  completed_time?: string;
  completed_by?: string;
  completed_by_name?: string;
  pain_score?: number;
  comfort_measures?: string[];
  position_change?: boolean;
  fluid_offered?: boolean;
  mouth_care?: boolean;
  notes?: string;
  status: 'scheduled' | 'completed' | 'missed';
  created_at: string;
}

export interface AnticipatoryMedication {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  medication_name: string;
  indication: string;
  dose: string;
  route: string;
  max_frequency?: string;
  prescribed_by?: string;
  last_administered_at?: string;
  last_administered_by?: string;
  last_administered_by_name?: string;
  stock_remaining?: number;
  status: 'active' | 'discontinued';
  created_at: string;
  updated_at: string;
}

export interface FamilyCommunicationLog {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  family_member_name: string;
  communication_type: 'phone' | 'in_person' | 'video' | 'email' | 'letter';
  summary: string;
  discussed_topics?: string[];
  follow_up_required?: boolean;
  follow_up_notes?: string;
  logged_by: string;
  logged_by_name?: string;
  communication_date: string;
  created_at: string;
}

// ── Quality of Life: Music Therapy ───────────────────────────────────────
export interface MusicGenre {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface MusicPreference {
  id: string;
  care_home_id: string;
  resident_id: string;
  genre_id?: string;
  genre_name?: string;
  preferred_artists?: string;
  preferred_era?: string;
  tempo_preference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MusicSession {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  facilitated_by: string;
  facilitated_by_name?: string;
  mood_before: number;
  mood_after?: number;
  effectiveness?: number;
  notes?: string;
  started_at: string;
  ended_at?: string;
  created_at: string;
}

export interface MusicSessionSong {
  id: string;
  session_id: string;
  title: string;
  artist?: string;
  genre_id?: string;
  genre_name?: string;
  duration_secs?: number;
  resident_response?: string;
  play_order: number;
  created_at?: string;
}

// ── Quality of Life: Menu Choices ────────────────────────────────────────
export interface MenuOption {
  id: string;
  care_home_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description?: string;
  photo_url?: string;
  allergens?: string[];
  texture_suitable?: string[];
  cultural_suitable?: string[];
  available_date: string;
  active: boolean;
  created_at: string;
}

export interface MenuDietaryProfile {
  id: string;
  care_home_id: string;
  resident_id: string;
  cultural_needs?: string[];
  religious_needs?: string[];
  texture_requirement?: 'normal' | 'soft' | 'pureed' | 'liquid';
  allergies?: string[];
  dislikes?: string[];
  preferences?: string[];
  notes?: string;
  updated_at: string;
}

export interface MenuChoice {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  menu_option_id: string;
  option_name?: string;
  meal_type: string;
  meal_date: string;
  notes?: string;
  created_at: string;
}

// ── Quality of Life: Friendship Mapper ───────────────────────────────────
export interface FriendshipObservation {
  id: string;
  care_home_id: string;
  resident_a_id: string;
  resident_b_id: string;
  resident_a_name?: string;
  resident_b_name?: string;
  observed_by: string;
  observed_by_name?: string;
  interaction_type: 'conversation' | 'activity' | 'meal' | 'spontaneous' | 'conflict';
  quality: 'positive' | 'neutral' | 'negative';
  context?: string;
  notes?: string;
  observed_at: string;
  created_at: string;
}

export interface FriendshipConnection {
  id: string;
  care_home_id: string;
  resident_a_id: string;
  resident_b_id: string;
  resident_a_name?: string;
  resident_b_name?: string;
  strength: number;
  interaction_count: number;
  last_interaction_at?: string;
  relationship_type?: 'friend' | 'acquaintance' | 'conflict';
}

// ── Quality of Life: Purpose Planner ─────────────────────────────────────
export interface PurposeRole {
  id: string;
  care_home_id: string;
  name: string;
  description?: string;
  category?: string;
  mobility_requirement?: string;
  cognitive_requirement?: string;
  active: boolean;
  created_at: string;
}

export interface PurposeRoleAssignment {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  role_id: string;
  role_name?: string;
  assigned_by?: string;
  assigned_by_name?: string;
  status: 'active' | 'paused' | 'completed';
  start_date: string;
  end_date?: string;
  notes?: string;
  created_at: string;
}

export interface PurposeEngagementLog {
  id: string;
  care_home_id: string;
  assignment_id: string;
  resident_id: string;
  resident_name?: string;
  role_name?: string;
  engagement_level: 'high' | 'medium' | 'low' | 'refused';
  satisfaction_score?: number;
  duration_minutes?: number;
  notes?: string;
  logged_by?: string;
  logged_by_name?: string;
  logged_at: string;
  created_at: string;
}

// ── Quality of Life: Mood Environment ────────────────────────────────────
export interface MoodIntervention {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  intervention_type: string;
  description?: string;
  mood_before: 'very_low' | 'low' | 'neutral' | 'good' | 'very_good';
  mood_after?: 'very_low' | 'low' | 'neutral' | 'good' | 'very_good';
  effectiveness_score?: number;
  administered_by?: string;
  administered_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface MoodInterventionHistory {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  intervention_type: string;
  avg_effectiveness: number;
  usage_count: number;
  last_used_at: string;
}

// ── Quality of Life: Photo Frame ─────────────────────────────────────────
export interface PhotoFramePhoto {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  photo_url: string;
  caption?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_by_name?: string;
  show_on_date?: string;
  occasion?: string;
  created_at: string;
  updated_at: string;
}

export interface PhotoViewingHistory {
  id: string;
  photo_id: string;
  resident_id: string;
  viewed_at: string;
  reaction?: 'positive' | 'neutral' | 'negative';
  notes?: string;
}

// ── Quality of Life: Sleep Tracker ───────────────────────────────────────
export interface SleepLog {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  sleep_date: string;
  bedtime: string;
  wake_time: string;
  disturbances: number;
  disturbance_types?: string[];
  interventions?: string[];
  quality_rating: number;
  total_sleep_hrs?: number;
  logged_by?: string;
  logged_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface SleepProfile {
  id: string;
  care_home_id: string;
  resident_id: string;
  avg_bedtime?: string;
  avg_wake_time?: string;
  avg_quality?: number;
  avg_disturbances?: number;
  common_disturbances?: string[];
  effective_interventions?: string[];
  analysis_period_days?: number;
  trend_direction?: 'improving' | 'stable' | 'declining';
  last_updated?: string;
}

// ── Quality of Life: Intergenerational Programme ─────────────────────────
export interface IntergenerationalProgramme {
  id: string;
  care_home_id: string;
  name: string;
  description?: string;
  partner_organisation: string;
  partner_type: 'school' | 'nursery' | 'youth_group' | 'other';
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  safeguarding_status: 'pending' | 'approved' | 'expired';
  dbs_requirements?: string;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface IntergenerationalVisit {
  id: string;
  care_home_id: string;
  programme_id: string;
  programme_name?: string;
  visit_date: string;
  start_time: string;
  end_time?: string;
  activity_type: 'reading' | 'art' | 'baking' | 'singing' | 'games' | 'gardening' | 'other';
  activity_description?: string;
  visitor_count?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface IntergenerationalParticipant {
  id: string;
  visit_id: string;
  resident_id: string;
  resident_name?: string;
  engagement_level?: 'high' | 'medium' | 'low' | 'observer';
  wellbeing_before?: number;
  wellbeing_after?: number;
  notes?: string;
}

// ── Quality of Life: Rehab Goals ─────────────────────────────────────────
export interface RehabGoal {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  title: string;
  description?: string;
  category?: string;
  target_date?: string;
  status: 'active' | 'achieved' | 'paused' | 'discontinued';
  priority?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface RehabMilestone {
  id: string;
  care_home_id: string;
  goal_id: string;
  title: string;
  description?: string;
  target_date?: string;
  completed: boolean;
  completed_at?: string;
  display_order: number;
  created_at: string;
}

export interface RehabProgressLog {
  id: string;
  care_home_id: string;
  goal_id: string;
  milestone_id?: string;
  resident_id: string;
  resident_name?: string;
  milestone_title?: string;
  goal_title?: string;
  progress_notes?: string;
  score?: number;
  celebration?: boolean;
  family_notified?: boolean;
  logged_by?: string;
  logged_by_name?: string;
  logged_at: string;
  created_at: string;
}

// ── Quality of Life: Celebrations ────────────────────────────────────────
export interface Celebration {
  id: string;
  care_home_id: string;
  resident_id?: string;
  resident_name?: string;
  celebration_type: 'birthday' | 'admission_anniversary' | 'religious_festival' | 'national_day' | 'personal' | 'other';
  title: string;
  description?: string;
  celebration_date: string;
  auto_detected: boolean;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  budget?: number;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface CelebrationTask {
  id: string;
  care_home_id: string;
  celebration_id: string;
  title: string;
  assigned_to?: string;
  assigned_to_name?: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
}

// ── AI Care Plan Writer Types ─────────────────────────────────────────────
export interface AiCarePlan {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  content: any;
  status: 'draft' | 'approved' | 'rejected';
  version: number;
  generated_by: string;
  generated_by_name?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
}

// ── Admission Matching Types ──────────────────────────────────────────────
export interface AdmissionReferral {
  id: string;
  care_home_id: string;
  name: string;
  date_of_birth?: string;
  referral_source?: string;
  care_needs?: any;
  medical_history?: string;
  mobility?: string;
  behavior?: string;
  preferences?: any;
  urgency: 'routine' | 'urgent' | 'emergency';
  status: 'pending' | 'accepted' | 'declined' | 'waitlist';
  decision_notes?: string;
  created_by: string;
  created_at: string;
}

export interface AdmissionMatch {
  id: string;
  referral_id?: string;
  overall_score: number;
  recommendation: 'accept' | 'conditional' | 'decline';
  reasoning: { area: string; score: number; detail: string }[];
  home_stats?: any;
}

// ── Wellbeing Heatmap Types ───────────────────────────────────────────────
export interface HeatmapRoom {
  resident_id: string;
  resident_name: string;
  room_number: string;
  status: 'green' | 'amber' | 'red';
  status_label: string;
  mood: string;
  pain_level: number;
  engagement: string;
  risk_level: string;
  wellbeing_score?: number;
  last_updated?: string;
}

export interface HeatmapSummary {
  total: number;
  green: number;
  amber: number;
  red: number;
  last_updated: string;
}

// ── Regulatory Reporting Types ────────────────────────────────────────────
export interface RegulatoryNotification {
  id: string;
  care_home_id: string;
  type: 'cqc' | 'safeguarding' | 'dols' | 'death';
  resident_id?: string;
  resident_name?: string;
  incident_id?: string;
  form_data: any;
  status: 'draft' | 'pending' | 'submitted' | 'overdue';
  deadline: string;
  submission_ref?: string;
  submitted_at?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  is_overdue?: boolean;
  days_remaining?: number;
}

// ── Smart Handover Types ──────────────────────────────────────────────────
export interface SmartHandover {
  id: string;
  care_home_id: string;
  shift_type: string;
  critical_items: HandoverCriticalItem[];
  full_summary: any;
  generated_by: string;
  generated_by_name?: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface HandoverCriticalItem {
  priority: number;
  category: 'incident' | 'clinical' | 'monitoring';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  resident_name: string;
  action_required: string;
  source_id: string;
}

// ── Consent Manager Types ─────────────────────────────────────────────────
export interface ConsentRecord {
  id: string;
  care_home_id: string;
  resident_id: string;
  resident_name?: string;
  category: 'photography' | 'outings' | 'medical' | 'research' | 'dnr' | 'other';
  description?: string;
  consent_given_by: string;
  relationship?: string;
  review_date?: string;
  capacity_assessed: boolean;
  notes?: string;
  status: 'active' | 'withdrawn' | 'expired';
  recorded_by: string;
  recorded_by_name?: string;
  created_at: string;
}

// ── Digital Twin Types ────────────────────────────────────────────────────
export interface DigitalTwin {
  personal: {
    id: string;
    name: string;
    date_of_birth: string;
    room_number: string;
    admission_date: string;
    care_type: string;
    nhs_number?: string;
    photo_url?: string;
  };
  medical: {
    medications: any[];
    allergies?: string;
    dietary_requirements?: string;
    mobility_status?: string;
    risk_level: string;
    dnacpr: boolean;
    gp: { name?: string; phone?: string };
  };
  social: {
    interests: string[];
    key_worker: any;
    funding_type?: string;
  };
  emotional: {
    current_wellbeing_score?: number;
    recent_moods: { mood: string; date: string }[];
    wellbeing_trend: any[];
  };
  risk_indicators: { type: string; level: string; detail: string }[];
  recent_events: { care_notes: any[]; incidents: any[] };
  last_updated: string;
}

export interface TimelineEvent {
  event_type: 'care_note' | 'incident' | 'wellbeing';
  id: string;
  sub_type: string;
  detail: string;
  event_date: string;
}

// ── Environmental Intelligence Types ──────────────────────────────────────
export interface EnvironmentalReading {
  id: string;
  care_home_id: string;
  zone: string;
  noise_level?: number;
  light_level?: number;
  temperature?: number;
  humidity?: number;
  air_quality?: number;
  recorded_at: string;
  recorded_by: string;
}

export interface EnvironmentalRecommendation {
  zone: string;
  recommendations: {
    type: string;
    priority: 'high' | 'medium' | 'low';
    message: string;
  }[];
}
