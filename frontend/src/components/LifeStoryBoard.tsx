// src/components/LifeStoryBoard.tsx — Life Story display/edit component
import React, { useState, useEffect } from 'react';
import { useResidentLifeStory, useUpdateLifeStory } from '../hooks';
import type { ResidentLifeStory } from '../types';

interface Props {
  residentId: string;
  residentName: string;
  canEdit?: boolean;
}

function ArrayEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => { if (input.trim()) { onChange([...values, input.trim()]); setInput(''); } };
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {values.map((v, i) => (
          <span key={i} style={{ padding: '3px 10px', borderRadius: 14, background: '#8b5cf615', border: '1px solid #8b5cf630', fontSize: 12, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4 }}>
            {v}
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: 0 }}>x</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} placeholder={`Add ${label.toLowerCase()}...`} style={{ flex: 1, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--text-primary)' }} />
        <button onClick={add} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#8b5cf6', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
}

export function LifeStoryBoard({ residentId, residentName, canEdit = false }: Props) {
  const { data: story, isLoading } = useResidentLifeStory(residentId);
  const updateMut = useUpdateLifeStory();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ResidentLifeStory>>({});

  useEffect(() => {
    if (story) setForm(story);
  }, [story]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    await updateMut.mutateAsync({
      residentId,
      data: {
        occupation: form.occupation,
        hometown: form.hometown,
        spouseInfo: form.spouse_info,
        childrenInfo: form.children_info,
        pets: form.pets,
        hobbies: form.hobbies,
        favoriteMusic: form.favorite_music,
        favoriteTv: form.favorite_tv,
        favoriteFoods: form.favorite_foods,
        conversationTopics: form.conversation_topics,
        comfortItems: form.comfort_items,
        dailyRoutinePreferences: form.daily_routine_preferences,
        religiousPreferences: form.religious_preferences,
        dislikes: form.dislikes,
        importantDates: form.important_dates,
        lifeAchievements: form.life_achievements,
        warService: form.war_service,
        personalityTraits: form.personality_traits,
        communicationStyle: form.communication_style,
      },
    });
    setEditing(false);
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading life story...</div>;

  // Empty state
  if (!story && !editing) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>No Life Story Yet</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
          A life story helps every staff member connect with {residentName} as a person.
          Record their history, interests, and what makes them smile.
        </p>
        {canEdit && (
          <button onClick={() => setEditing(true)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#8b5cf6', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Start Life Story
          </button>
        )}
      </div>
    );
  }

  // Edit mode
  if (editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Edit Life Story</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={updateMut.isPending} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {updateMut.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Occupation</label>
              <input value={form.occupation || ''} onChange={e => set('occupation', e.target.value)} placeholder="e.g. Retired teacher" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hometown</label>
              <input value={form.hometown || ''} onChange={e => set('hometown', e.target.value)} placeholder="e.g. Liverpool" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Spouse / Partner</label>
              <input value={form.spouse_info || ''} onChange={e => set('spouse_info', e.target.value)} placeholder="e.g. Married to John for 50 years" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Children / Family</label>
              <textarea value={form.children_info || ''} onChange={e => set('children_info', e.target.value)} placeholder="e.g. 2 sons (David, Michael), 4 grandchildren" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', minHeight: 50, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Pets</label>
              <input value={form.pets || ''} onChange={e => set('pets', e.target.value)} placeholder="e.g. Had a cat named Whiskers" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Religious / Spiritual Preferences</label>
              <input value={form.religious_preferences || ''} onChange={e => set('religious_preferences', e.target.value)} placeholder="e.g. Church of England, enjoys hymns" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Communication Style</label>
              <input value={form.communication_style || ''} onChange={e => set('communication_style', e.target.value)} placeholder="e.g. Prefers quiet conversation, dislikes being rushed" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Life Achievements</label>
              <textarea value={form.life_achievements || ''} onChange={e => set('life_achievements', e.target.value)} placeholder="e.g. Ran the London Marathon at 65" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', minHeight: 50, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>War Service / National Service</label>
              <textarea value={form.war_service || ''} onChange={e => set('war_service', e.target.value)} placeholder="e.g. Royal Navy, 1948-1950" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', minHeight: 50, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Daily Routine Preferences</label>
              <textarea value={form.daily_routine_preferences || ''} onChange={e => set('daily_routine_preferences', e.target.value)} placeholder="e.g. Likes tea at 7am, prefers bath in the evening" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', minHeight: 50, background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <ArrayEditor label="Hobbies" values={form.hobbies || []} onChange={v => set('hobbies', v)} />
            <ArrayEditor label="Favorite Music" values={form.favorite_music || []} onChange={v => set('favorite_music', v)} />
            <ArrayEditor label="Favorite TV Shows" values={form.favorite_tv || []} onChange={v => set('favorite_tv', v)} />
            <ArrayEditor label="Favorite Foods" values={form.favorite_foods || []} onChange={v => set('favorite_foods', v)} />
            <ArrayEditor label="Conversation Topics" values={form.conversation_topics || []} onChange={v => set('conversation_topics', v)} />
            <ArrayEditor label="Comfort Items" values={form.comfort_items || []} onChange={v => set('comfort_items', v)} />
            <ArrayEditor label="Personality Traits" values={form.personality_traits || []} onChange={v => set('personality_traits', v)} />
            <ArrayEditor label="Dislikes" values={form.dislikes || []} onChange={v => set('dislikes', v)} />
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  const s = story as ResidentLifeStory;
  const sections = [
    { icon: '👤', title: 'About', items: [
      s.occupation && `Occupation: ${s.occupation}`,
      s.hometown && `Hometown: ${s.hometown}`,
      s.spouse_info && `Partner: ${s.spouse_info}`,
      s.children_info && `Family: ${s.children_info}`,
      s.pets && `Pets: ${s.pets}`,
    ].filter(Boolean) },
    { icon: '🎵', title: 'Interests & Favorites', items: [
      s.hobbies?.length && `Hobbies: ${s.hobbies.join(', ')}`,
      s.favorite_music?.length && `Music: ${s.favorite_music.join(', ')}`,
      s.favorite_tv?.length && `TV: ${s.favorite_tv.join(', ')}`,
      s.favorite_foods?.length && `Foods: ${s.favorite_foods.join(', ')}`,
    ].filter(Boolean) },
    { icon: '💬', title: 'Conversation Starters', items: s.conversation_topics?.map(t => t) || [] },
    { icon: '🧸', title: 'Comfort Items', items: s.comfort_items?.map(c => c) || [] },
    { icon: '🌅', title: 'Daily Routine', items: [s.daily_routine_preferences].filter(Boolean) },
    { icon: '⭐', title: 'Life Achievements', items: [s.life_achievements, s.war_service].filter(Boolean) },
    { icon: '🙏', title: 'Spiritual', items: [s.religious_preferences].filter(Boolean) },
    { icon: '🧠', title: 'Personality & Communication', items: [
      s.personality_traits?.length && `Traits: ${s.personality_traits.join(', ')}`,
      s.communication_style && `Style: ${s.communication_style}`,
    ].filter(Boolean) },
    { icon: '⚠️', title: 'Dislikes', items: s.dislikes?.map(d => d) || [] },
  ].filter(sec => sec.items.length > 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            📖 Life Story
          </h3>
          {s.updated_at && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Last updated {new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {s.updated_by_name && ` by ${s.updated_by_name}`}
            </p>
          )}
        </div>
        {canEdit && (
          <button onClick={() => setEditing(true)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ✏️ Edit
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {sections.map((sec, i) => (
          <div key={i} style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
              <span>{sec.icon}</span> {sec.title}
            </h4>
            <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
              {(sec.items as string[]).map((item, j) => (
                <li key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 2 }}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
