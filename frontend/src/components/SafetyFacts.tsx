// ────────────────────────────────────────────────────────────────────────────
// "Know before you help": the few facts that must be exact — allergies,
// DNACPR, food and drink textures, how to transfer, the sling, how often to
// reposition, PEEP — shown where carers are about to give care.
//
// They come from the care plan's structured details (or, before there is a
// plan, from current assessments, and it says so). The text is the record's
// own words, in English like every record; the heading is translated.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Icon } from './Icon';
import { useResidentFacts } from '../hooks';
import { useLang } from '../i18n';

export function SafetyFacts({ residentId, facts: given, source, compact }: { residentId?: string; facts?: { text: string; tone: string }[]; source?: string; compact?: boolean }) {
  const { t: tr } = useLang();
  const { data } = useResidentFacts(given ? undefined : residentId);
  const all: { text: string; tone: string }[] = given || data?.facts || [];
  const from = source || data?.source;
  // On the round's card: only the red and amber ones, at most three.
  const facts = compact ? all.filter(f => f.tone === 'red' || f.tone === 'amber').slice(0, 3) : all;
  if (!facts.length) return null;
  if (compact) {
    return (
      <ul aria-label={tr('Know before you help')} style={{ listStyle: 'none', margin: '4px 0 10px', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {facts.map(f => <li key={f.text} className={`cv-fact${f.tone === 'red' ? ' cv-fact-red' : ' cv-fact-amber'}`}>{f.text}</li>)}
      </ul>
    );
  }
  return (
    <div className="cv-safety" role="note" aria-label={tr('Know before you help')}>
      <div className="cv-safety-title"><Icon name="shield-check" size={15} />{tr('Know before you help')}</div>
      <ul>
        {facts.map(f => (
          <li key={f.text} className={`cv-fact${f.tone === 'red' ? ' cv-fact-red' : f.tone === 'amber' ? ' cv-fact-amber' : ''}`}>
            {f.tone === 'red' && <Icon name="triangle-alert" size={14} />}{f.text}
          </li>
        ))}
      </ul>
      {from === 'assessments' && <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{tr('From assessments — not yet in their care plan.')}</div>}
    </div>
  );
}
