// src/components/StaffWellnessWidget.tsx - Staff wellbeing panel
import React, { useState, useMemo } from 'react';

interface ShiftData {
  day: string;
  hoursWorked: number;
  contracted: number;
}

interface TeamMoodEntry {
  label: string;
  percentage: number;
  icon: string;
  color: string;
}

export default function StaffWellnessWidget() {
  const [showConcernForm, setShowConcernForm] = useState(false);
  const [concernText, setConcernText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Simulated shift data for current week
  const weeklyShifts: ShiftData[] = useMemo(() => [
    { day: 'Mon', hoursWorked: 8, contracted: 8 },
    { day: 'Tue', hoursWorked: 8.5, contracted: 8 },
    { day: 'Wed', hoursWorked: 7.5, contracted: 8 },
    { day: 'Thu', hoursWorked: 8, contracted: 8 },
    { day: 'Fri', hoursWorked: 4, contracted: 8 },
    { day: 'Sat', hoursWorked: 0, contracted: 0 },
    { day: 'Sun', hoursWorked: 0, contracted: 0 },
  ], []);

  const totalWorked = weeklyShifts.reduce((sum, d) => sum + d.hoursWorked, 0);
  const totalContracted = weeklyShifts.reduce((sum, d) => sum + d.contracted, 0);
  const overtimeHours = Math.max(0, totalWorked - totalContracted);

  // Anonymous team mood
  const teamMood: TeamMoodEntry[] = useMemo(() => [
    { label: 'Happy', percentage: 45, icon: '😊', color: '#16a34a' },
    { label: 'Content', percentage: 30, icon: '🙂', color: '#0d9488' },
    { label: 'Tired', percentage: 15, icon: '😴', color: '#d97706' },
    { label: 'Stressed', percentage: 10, icon: '😟', color: '#dc2626' },
  ], []);

  const overallMoodScore = 7.8; // Out of 10

  // Rest day info
  const upcomingRest = useMemo(() => [
    { day: 'Saturday 18 Jan', type: 'Rest Day' },
    { day: 'Sunday 19 Jan', type: 'Rest Day' },
    { day: 'Wednesday 22 Jan', type: 'Annual Leave' },
  ], []);

  // Break information
  const breaks = useMemo(() => ({
    nextBreak: '11:30',
    breaksTaken: 1,
    breaksRemaining: 2,
    lunchTime: '13:00',
  }), []);

  // Wellness tips
  const wellnessTips = useMemo(() => [
    { tip: 'Remember to stay hydrated. Aim for 6-8 glasses of water during your shift.', icon: '💧' },
    { tip: 'Take micro-breaks every 90 minutes to stretch and reset.', icon: '🧘' },
    { tip: 'The EAP helpline (0800 XXX XXXX) is available 24/7 for confidential support.', icon: '📞' },
  ], []);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">💚 Staff Wellbeing</span>
      </div>
      <div className="card-body" style={{ padding: '16px 20px' }}>
        {/* Hours Worked This Week */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>HOURS THIS WEEK</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: totalWorked > totalContracted ? '#d97706' : '#16a34a' }}>
              {totalWorked}h / {totalContracted}h
              {overtimeHours > 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>(+{overtimeHours}h overtime)</span>}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 50 }}>
            {weeklyShifts.map(shift => {
              const maxH = 8;
              const height = shift.contracted > 0 ? (shift.hoursWorked / maxH) * 40 : 4;
              const isOver = shift.hoursWorked > shift.contracted;
              return (
                <div key={shift.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%', height, borderRadius: 4, minHeight: 4,
                    background: shift.contracted === 0 ? '#e5e7eb' : isOver ? '#d97706' : '#16a34a',
                    opacity: shift.contracted === 0 ? 0.4 : 1,
                    transition: 'height 300ms ease',
                  }} />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{shift.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Break Info */}
        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0d9488' }}>Next Break: {breaks.nextBreak}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {breaks.breaksTaken} taken | {breaks.breaksRemaining} remaining | Lunch at {breaks.lunchTime}
              </div>
            </div>
            <span style={{ fontSize: 22 }}>☕</span>
          </div>
        </div>

        {/* Team Mood Score */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>TEAM MOOD (ANONYMOUS)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>{overallMoodScore}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/10</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {teamMood.map(mood => (
              <div key={mood.label} style={{ flex: mood.percentage, height: 8, borderRadius: 4, background: mood.color, transition: 'flex 300ms ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {teamMood.map(mood => (
              <div key={mood.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 12 }}>{mood.icon}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{mood.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Rest Days */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>UPCOMING REST</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingRest.map((rest, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: 12 }}>🌿</span>
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{rest.day}</span>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: rest.type === 'Annual Leave' ? '#dbeafe' : '#dcfce7', color: rest.type === 'Annual Leave' ? '#0d9488' : '#16a34a', fontWeight: 600 }}>
                  {rest.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wellness Tips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>WELLNESS TIPS</div>
          {wellnessTips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: i < wellnessTips.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{tip.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{tip.tip}</span>
            </div>
          ))}
        </div>

        {/* Report Concern Button */}
        {submitted ? (
          <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>Thank you</div>
            <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.4 }}>
              Your concern has been submitted confidentially. A member of management will review it within 24 hours.
            </div>
            <button
              onClick={() => { setSubmitted(false); setConcernText(''); }}
              style={{ marginTop: 10, padding: '6px 14px', borderRadius: 6, background: '#16a34a15', color: '#16a34a', border: '1px solid #16a34a30', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        ) : !showConcernForm ? (
          <button
            onClick={() => setShowConcernForm(true)}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: '2px dashed #d97706',
              background: '#fffbeb', color: '#d97706', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 150ms ease',
            }}
          >
            <span style={{ fontSize: 16 }}>🤝</span>
            Report a Concern (Confidential)
          </button>
        ) : (
          <div style={{ padding: 14, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 8 }}>Report a Concern</div>
            <div style={{ fontSize: 11, color: '#92400e', marginBottom: 10, lineHeight: 1.4 }}>
              Your concern will be handled confidentially by management. You can also contact the EAP helpline directly.
            </div>
            <textarea
              value={concernText}
              onChange={(e) => setConcernText(e.target.value)}
              placeholder="Describe your concern here..."
              style={{
                width: '100%', minHeight: 60, padding: 10, borderRadius: 8, border: '1px solid #fde68a',
                fontSize: 12, resize: 'vertical', fontFamily: 'inherit', background: '#fff',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => { setShowConcernForm(false); setSubmitted(true); }}
                disabled={!concernText.trim()}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6, background: concernText.trim() ? '#d97706' : '#e5e7eb',
                  color: concernText.trim() ? '#fff' : '#9ca3af', border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: concernText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Submit
              </button>
              <button onClick={() => { setShowConcernForm(false); setConcernText(''); }} style={{ padding: '8px 12px', borderRadius: 6, background: '#f3f4f6', color: '#6b7280', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
