// src/utils/formatters.ts — Shared formatting utilities

export const ROLE_LABELS: Record<string, string> = {
  home_manager:     'Home Manager',
  deputy_manager:   'Deputy Manager',
  registered_nurse: 'Registered Nurse',
  senior_carer:     'Senior Carer',
  carer:            'Care Assistant',
  activities:       'Activities Co-ord',
  finance:          'Finance Officer',
  admin:            'Administrator',
  super_admin:      'Super Admin',
  group_admin:      'Group Admin',
  cleaning:         'Cleaning Staff',
  kitchen:          'Kitchen Staff',
  maintenance:      'Maintenance Staff',
};

export const NOTE_TYPE_LABELS: Record<string, string> = {
  personal_care:       'Personal Care',
  continence:          'Continence & Toileting',
  nursing_observation: 'Nursing Observation',
  nutrition:           'Nutrition & Fluids',
  sleep:               'Sleep',
  repositioning:       'Repositioning',
  social_wellbeing:    'Social Wellbeing',
  behaviour:           'Behaviour',
  wound_care:          'Wound Care',
  fall_observation:    'Fall / Post-Fall Observation',
  activities:          'Activities & Wellbeing',
  gp_visit:            'GP / Clinical Visit',
  hospital_visit:      'Hospital Visit',
  family_update:       'Family Communication',
  end_of_life:         'End of Life Care',
  handover:            'Handover Note',
  medication_note:     'Medication Note',
  incident_note:       'Incident / Concern',
  oral_health:         'Oral Health',
};

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

export function formatAge(dob: string | undefined | null): string {
  if (!dob) return '—';
  try {
    const diff = Date.now() - new Date(dob).getTime();
    return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))} yrs`;
  } catch { return '—'; }
}

export function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function truncate(str: string, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

export function getRiskColor(level: string): string {
  if (level === 'high') return '#dc2626';
  if (level === 'medium') return '#d97706';
  return '#16a34a';
}

export function getSeverityColor(severity: string): string {
  if (severity === 'critical') return '#7c3aed';
  if (severity === 'high') return '#dc2626';
  if (severity === 'medium') return '#d97706';
  return '#6b7280';
}

export const FUNDING_LABELS: Record<string, string> = {
  local_authority: 'Local Authority',
  self_funded:     'Self-Funded',
  nhs:             'NHS Continuing Care',
  mixed:           'Mixed Funding',
};
