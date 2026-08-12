import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useCreateTabletRequest } from '../hooks';

export default function ResidentTablet() {
  const { t: tr } = useLang();
  const [residentId] = useState('demo-resident');
  const [view, setView] = useState<'home' | 'meals' | 'activities' | 'entertainment'>('home');
  const [mealRating, setMealRating] = useState<string | null>(null);
  const createRequest = useCreateTabletRequest();

  const handleHelpRequest = () => {
    createRequest.mutate({ resident_id: residentId, request_type: 'help', details: { urgent: true } });
  };

  const handleMealRating = (rating: string) => {
    setMealRating(rating);
    createRequest.mutate({ resident_id: residentId, request_type: 'meal_rating', details: { rating } });
  };

  const handleActivityChoice = (activity: string) => {
    createRequest.mutate({ resident_id: residentId, request_type: 'activity_choice', details: { activity } });
  };

  const handleVideoCall = () => {
    createRequest.mutate({ resident_id: residentId, request_type: 'video_call', details: {} });
  };

  if (view === 'meals') {
    return (
      <div style={{ padding: 32, minHeight: '100vh', background: '#ffffff' }}>
        <button onClick={() => setView('home')} style={{ fontSize: '24px', padding: '16px 32px', background: '#f3f4f6', border: '2px solid #d1d5db', borderRadius: 12, cursor: 'pointer', marginBottom: 32, minHeight: 64, fontWeight: 600 }}>
          {tr('Back to Home')}
        </button>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#111827', marginBottom: 32, textAlign: 'center' }}>{tr('Rate Your Meal')}</h1>
        <p style={{ fontSize: '28px', color: '#374151', textAlign: 'center', marginBottom: 48 }}>How was your meal today?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 500, margin: '0 auto' }}>
          <button onClick={() => handleMealRating('excellent')} style={{ padding: '24px 32px', fontSize: '28px', background: mealRating === 'excellent' ? '#dcfce7' : '#fff', border: `3px solid ${mealRating === 'excellent' ? '#16a34a' : '#d1d5db'}`, borderRadius: 16, cursor: 'pointer', minHeight: 80, fontWeight: 600, color: '#111827' }}>
            😊 Excellent
          </button>
          <button onClick={() => handleMealRating('good')} style={{ padding: '24px 32px', fontSize: '28px', background: mealRating === 'good' ? '#dbeafe' : '#fff', border: `3px solid ${mealRating === 'good' ? '#0d9488' : '#d1d5db'}`, borderRadius: 16, cursor: 'pointer', minHeight: 80, fontWeight: 600, color: '#111827' }}>
            🙂 Good
          </button>
          <button onClick={() => handleMealRating('okay')} style={{ padding: '24px 32px', fontSize: '28px', background: mealRating === 'okay' ? '#fef9c3' : '#fff', border: `3px solid ${mealRating === 'okay' ? '#ca8a04' : '#d1d5db'}`, borderRadius: 16, cursor: 'pointer', minHeight: 80, fontWeight: 600, color: '#111827' }}>
            😐 Okay
          </button>
          <button onClick={() => handleMealRating('poor')} style={{ padding: '24px 32px', fontSize: '28px', background: mealRating === 'poor' ? '#fee2e2' : '#fff', border: `3px solid ${mealRating === 'poor' ? '#dc2626' : '#d1d5db'}`, borderRadius: 16, cursor: 'pointer', minHeight: 80, fontWeight: 600, color: '#111827' }}>
            😞 Not Good
          </button>
        </div>
      </div>
    );
  }

  if (view === 'activities') {
    const activities = ['Arts & Crafts', 'Music Session', 'Garden Walk', 'Bingo', 'Film Afternoon', 'Chair Exercises'];
    return (
      <div style={{ padding: 32, minHeight: '100vh', background: '#ffffff' }}>
        <button onClick={() => setView('home')} style={{ fontSize: '24px', padding: '16px 32px', background: '#f3f4f6', border: '2px solid #d1d5db', borderRadius: 12, cursor: 'pointer', marginBottom: 32, minHeight: 64, fontWeight: 600 }}>
          {tr('Back to Home')}
        </button>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#111827', marginBottom: 32, textAlign: 'center' }}>{tr('Choose an Activity')}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, maxWidth: 700, margin: '0 auto' }}>
          {activities.map(activity => (
            <button key={activity} onClick={() => handleActivityChoice(activity)} style={{ padding: '32px 24px', fontSize: '26px', background: '#fff', border: '3px solid #d1d5db', borderRadius: 16, cursor: 'pointer', minHeight: 100, fontWeight: 600, color: '#111827', textAlign: 'center' }}>
              {activity}
            </button>
          ))}
          {activities.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 28, textAlign: 'center', fontSize: '20px', color: '#6b7280', background: '#fff', borderRadius: 16, border: '2px dashed #d1d5db' }}>
              No activities are set up yet. Ask a staff member to add some.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'entertainment') {
    return (
      <div style={{ padding: 32, minHeight: '100vh', background: '#ffffff' }}>
        <button onClick={() => setView('home')} style={{ fontSize: '24px', padding: '16px 32px', background: '#f3f4f6', border: '2px solid #d1d5db', borderRadius: 12, cursor: 'pointer', marginBottom: 32, minHeight: 64, fontWeight: 600 }}>
          {tr('Back to Home')}
        </button>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#111827', marginBottom: 32, textAlign: 'center' }}>{tr('Entertainment')}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 500, margin: '0 auto' }}>
          <div style={{ padding: 24, background: '#f0f9ff', borderRadius: 16, border: '3px solid #bae6fd' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 600, color: '#0c4a6e', marginBottom: 12 }}>{tr('Music Playlist')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Classical Favourites', 'Golden Oldies', 'Relaxation Sounds', 'Hymns'].map(track => (
                <button key={track} style={{ padding: '16px 24px', fontSize: '24px', background: '#fff', border: '2px solid #bae6fd', borderRadius: 12, cursor: 'pointer', minHeight: 64, textAlign: 'left', color: '#111827' }}>
                  🎵 {track}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 24, background: '#fdf4ff', borderRadius: 16, border: '3px solid #e9d5ff' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 600, color: '#581c87', marginBottom: 12 }}>{tr('Photo Gallery')}</h2>
            <button style={{ padding: '16px 24px', fontSize: '24px', background: '#fff', border: '2px solid #e9d5ff', borderRadius: 12, cursor: 'pointer', minHeight: 64, width: '100%', color: '#111827' }}>
              📷 View My Photos
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Home view
  return (
    <div style={{ padding: 32, minHeight: '100vh', background: '#ffffff' }}>
      <h1 style={{ fontSize: '40px', fontWeight: 700, color: '#111827', marginBottom: 8, textAlign: 'center' }}>Hello!</h1>
      <p style={{ fontSize: '28px', color: '#374151', textAlign: 'center', marginBottom: 48 }}>How can we help you today?</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 500, margin: '0 auto' }}>
        {/* Help Button - Large and Red */}
        <button
          onClick={handleHelpRequest}
          disabled={createRequest.isPending}
          style={{ padding: '32px', fontSize: '32px', fontWeight: 700, background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 20, cursor: 'pointer', minHeight: 100, boxShadow: '0 4px 12px rgba(220,38,38,0.4)', textAlign: 'center' }}
        >
          🔔 I Need Help
        </button>

        {/* Meal Rating */}
        <button
          onClick={() => setView('meals')}
          style={{ padding: '24px 32px', fontSize: '28px', fontWeight: 600, background: '#fff7ed', color: '#9a3412', border: '3px solid #fed7aa', borderRadius: 16, cursor: 'pointer', minHeight: 80, textAlign: 'center' }}
        >
          🍽️ Rate My Meal
        </button>

        {/* Activities */}
        <button
          onClick={() => setView('activities')}
          style={{ padding: '24px 32px', fontSize: '28px', fontWeight: 600, background: '#ecfdf5', color: '#065f46', border: '3px solid #a7f3d0', borderRadius: 16, cursor: 'pointer', minHeight: 80, textAlign: 'center' }}
        >
          🎯 Choose Activities
        </button>

        {/* Video Call */}
        <button
          onClick={handleVideoCall}
          style={{ padding: '24px 32px', fontSize: '28px', fontWeight: 600, background: '#eff6ff', color: '#0f766e', border: '3px solid #bfdbfe', borderRadius: 16, cursor: 'pointer', minHeight: 80, textAlign: 'center' }}
        >
          📹 Video Call Family
        </button>

        {/* Entertainment */}
        <button
          onClick={() => setView('entertainment')}
          style={{ padding: '24px 32px', fontSize: '28px', fontWeight: 600, background: '#fdf4ff', color: '#7e22ce', border: '3px solid #e9d5ff', borderRadius: 16, cursor: 'pointer', minHeight: 80, textAlign: 'center' }}
        >
          🎶 Entertainment
        </button>
      </div>
    </div>
  );
}
