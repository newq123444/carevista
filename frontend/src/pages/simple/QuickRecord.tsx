// ────────────────────────────────────────────────────────────────────────────
// Quick record sheet.
//
// Opens when a task is marked done, so that "done" becomes an actual record of
// what happened rather than a tick. Two or three questions, big chips, one
// Save.
//
// Save is always enabled and always works, including with nothing selected. A
// carer who genuinely has nothing to add must not be trapped — the moment this
// feels like a form to get past, people start tapping through it, and a record
// full of thoughtless taps is worse than a thin one.
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { type QuickSpec, type Selections, fluidSelection, fluidMl } from '../../utils/quickOptions';
import FluidPicker from '../../components/FluidPicker';
import { useLang } from '../../i18n';

interface Props {
  spec: QuickSpec;
  residentName: string;
  taskName: string;
  saving?: boolean;
  onSave: (sel: Selections, extra: string) => void;
  onCancel: () => void;
  onFullForm: () => void;
}

export default function QuickRecord({
  spec, residentName, taskName, saving, onSave, onCancel, onFullForm,
}: Props) {
  const { t: tr, tf, lang } = useLang();
  const [sel, setSel] = useState<Selections>({});
  const [extra, setExtra] = useState('');
  const [showNote, setShowNote] = useState(false);
  // Which groups have been expanded to their full list. Everything is always
  // reachable; this only decides what is on screen before a carer asks for more.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(groupKey: string, label: string, multi: boolean) {
    setSel(prev => {
      const current = prev[groupKey] || [];
      if (multi) {
        return { ...prev, [groupKey]: current.includes(label)
          ? current.filter(x => x !== label)
          : [...current, label] };
      }
      // Single-select: tapping the chosen one again clears it, so a mis-tap is
      // one tap to fix rather than a locked-in answer.
      return { ...prev, [groupKey]: current[0] === label ? [] : [label] };
    });
  }

  return (
    <div onClick={onCancel} style={{
      // Above the phone's top bar and bottom menu (z-index 150), or they cover
      // the title and the Save button.
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 300,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: '100%', maxWidth: 520,
        borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column',
      }} className="cv-sheet">
        {/* Header stays put while the questions scroll. */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#cbd5e1', margin: '0 auto 12px' }} />
          <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.25 }}>{tr(taskName)}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 15, color: 'var(--text-secondary)' }}>
            {residentName}
          </p>
        </div>

        <div style={{ overflowY: 'auto', padding: '4px 16px 8px', flex: 1 }}>
          {spec.groups.map(group => {
            const open = expanded[group.key];
            const shown = open ? group.choices : group.choices.slice(0, group.commonCount);
            const hidden = group.choices.length - shown.length;
            const chosenHidden = (sel[group.key] || []).filter(
              l => !shown.some(c => c.label === l)).length;
            return (
            <div key={group.key} style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{tr(group.prompt)}</span>
                {(sel[group.key] || []).length > 0 && (
                  <span style={{ fontSize: 13.5, color: '#16a34a', fontWeight: 600 }}>
                    {tf('{n} chosen', { n: (sel[group.key] || []).length })}
                  </span>
                )}
              </div>
              {group.kind === 'fluid' ? (
                <FluidPicker
                  value={fluidMl(sel)}
                  onChange={ml => setSel(prev => ({ ...prev, [group.key]: fluidSelection(ml) }))}
                />
              ) : (
              <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {shown.map(choice => {
                  const active = (sel[group.key] || []).includes(choice.label);
                  return (
                    <button
                      key={choice.label}
                      onClick={() => toggle(group.key, choice.label, group.multi)}
                      aria-pressed={active}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        minHeight: 64, padding: '0 16px', borderRadius: 14, cursor: 'pointer',
                        border: `2px solid ${active ? '#4f46e5' : 'var(--border)'}`,
                        background: active ? '#eef2ff' : '#fff',
                        color: active ? '#3730a3' : 'var(--text-primary, #111827)',
                        fontSize: 16, fontWeight: active ? 700 : 500,
                      }}>
                      <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>{choice.icon}</span>
                      {/* Shown in the carer's language; the English label is what is recorded. */}
                      {tr(choice.label)}
                      {active && <span style={{ fontSize: 17, marginLeft: 2 }} aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>

              {hidden > 0 && (
                <button onClick={() => setExpanded(e => ({ ...e, [group.key]: true }))} style={{
                  minHeight: 64, marginTop: 9, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
                  border: '1.5px dashed var(--border)', background: '#fff',
                  color: chosenHidden > 0 ? '#b45309' : 'var(--text-secondary)', fontSize: 15,
                }}>
                  {chosenHidden > 0
                    ? tf('Show all {n} — {k} chosen below', { n: group.choices.length, k: chosenHidden })
                    : tf('Show {n} more', { n: hidden })}
                </button>
              )}
              {open && group.choices.length > group.commonCount && (
                <button onClick={() => setExpanded(e => ({ ...e, [group.key]: false }))} style={{
                  minHeight: 64, marginTop: 9, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
                  border: 'none', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: 15,
                }}>
                  {tr('Show fewer')}
                </button>
              )}
              </>
              )}
            </div>
          );
          })}

          <div style={{ marginTop: 20 }}>
            {showNote ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tr('Anything else?')}</div>
                <textarea
                  autoFocus rows={3} value={extra} onChange={e => setExtra(e.target.value)}
                  placeholder={lang === 'en'
                    ? `Anything worth passing on about ${residentName.split(' ')[0]}…`
                    : tr('Write in English if you can — everyone reads this record.')}
                  style={{
                    width: '100%', borderRadius: 12, border: '1.5px solid var(--border)',
                    padding: 12, fontSize: 16, fontFamily: 'inherit', resize: 'vertical',
                  }} />
              </>
            ) : (
              <button onClick={() => setShowNote(true)} style={{
                minHeight: 64, width: '100%', borderRadius: 14, cursor: 'pointer',
                border: '1.5px dashed var(--border)', background: '#fff',
                color: 'var(--text-secondary)', fontSize: 16,
              }}>
                ✎ {tr('Add a note')}
              </button>
            )}
          </div>

          <button onClick={onFullForm} style={{
            minHeight: 48, width: '100%', marginTop: 10, borderRadius: 12, cursor: 'pointer',
            border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14.5,
          }}>
            {tr('Open the full form instead')}
          </button>
        </div>

        {/* Save sits in thumb reach and never disables — see the note at the top. */}
        <div style={{
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)', display: 'flex', gap: 10,
        }}>
          <button onClick={onCancel} style={{
            minHeight: 68, flex: '0 0 34%', borderRadius: 14, cursor: 'pointer',
            border: '1.5px solid var(--border)', background: '#fff',
            fontSize: 16, color: 'var(--text-secondary)',
          }}>{tr('Back')}</button>
          <button onClick={() => onSave(sel, extra)} disabled={saving} style={{
            minHeight: 68, flex: 1, borderRadius: 14, cursor: saving ? 'wait' : 'pointer',
            border: 'none', background: '#16a34a', color: '#fff',
            fontSize: 18, fontWeight: 700,
          }}>
            {saving ? tr('Saving…') : tr('Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
