// Today so far, for one resident: every note since midnight (device time),
// newest last, with who wrote it. What a nurse asks first at handover.
import React from 'react';
import { useCareNotes } from '../hooks';
import { Icon, type IconName } from './Icon';
import { Empty } from './ds';
import { useLang } from '../i18n';

const TYPE_ICON: Record<string, IconName> = {
  personal_care: 'bath', nutrition: 'utensils', continence: 'droplets', repositioning: 'rotate-cw', sleep: 'moon',
  social_wellbeing: 'smile', behaviour: 'brain', nursing_observation: 'activity', medication_note: 'pill',
  incident_note: 'triangle-alert', wound_care: 'bandage', fall_observation: 'triangle-alert', activities: 'smile',
  gp_visit: 'stethoscope', hospital_visit: 'stethoscope', family_update: 'users', end_of_life: 'hand-heart', handover: 'history',
};

export function ResidentToday({ residentId, compact = false }: { residentId: string; compact?: boolean }) {
  const { t: tr } = useLang();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { data, isLoading } = useCareNotes({ residentId, startDate: start.toISOString(), limit: 60 });
  const notes = (Array.isArray(data) ? data : []).slice().sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
  const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  if (isLoading) return <p style={{ color: 'var(--text-muted)' }}>{tr('Loading…')}</p>;
  if (!notes.length) return <Empty icon="clock" title={tr('Nothing recorded yet today')}>{!compact && tr('Care recorded for this person today will appear here, in order.')}</Empty>;
  return (
    <ul className="cv-timeline">
      {notes.map((n: any) => (
        <li key={n.id}>
          <span className="cv-tl-time">{hhmm(n.client_recorded_at || n.created_at)}</span>
          <span className="cv-tl-icon"><Icon name={TYPE_ICON[n.note_type] || 'notebook-pen'} size={17} /></span>
          <div>
            <div className="cv-tl-text">{compact && n.content.length > 140 ? `${n.content.slice(0, 140)}…` : n.content}</div>
            <div className="cv-tl-by">{n.author_name}{n.client_recorded_at ? ` · ${tr('made offline')}` : ''}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
