// src/components/LiveActivityFeed.tsx - Real-time activity feed with filtering
import React, { useState, useEffect, useMemo } from 'react';

interface ActivityEntry {
  id: string;
  type: 'care-note' | 'task' | 'incident' | 'medication' | 'admission' | 'cleaning' | 'maintenance' | 'kitchen';
  message: string;
  user: string;
  department: string;
  timestamp: Date;
  icon: string;
  color: string;
}

export default function LiveActivityFeed() {
  const [filter, setFilter] = useState<string>('all');
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  // Generate simulated activity entries
  const generateActivities = useMemo(() => {
    const now = new Date();
    const activities: ActivityEntry[] = [
      { id: '1', type: 'medication', message: 'Morning medications administered to Margaret Hollis (Room 1)', user: 'Priya Sharma', department: 'Nursing', timestamp: new Date(now.getTime() - 3 * 60000), icon: '💊', color: '#7c3aed' },
      { id: '2', type: 'care-note', message: 'Personal care completed - assisted with wash and dressing', user: 'Daniel Hughes', department: 'Care', timestamp: new Date(now.getTime() - 7 * 60000), icon: '📝', color: '#0d9488' },
      { id: '3', type: 'cleaning', message: 'Room 3 morning clean completed - all areas sanitised', user: 'Grace Williams', department: 'Cleaning', timestamp: new Date(now.getTime() - 12 * 60000), icon: '🧹', color: '#14b8a6' },
      { id: '4', type: 'task', message: 'Breakfast service completed for all residents', user: 'Marcus Johnson', department: 'Kitchen', timestamp: new Date(now.getTime() - 18 * 60000), icon: '✅', color: '#16a34a' },
      { id: '5', type: 'incident', message: 'Near miss reported: wet floor in corridor (resolved)', user: 'Lisa Brown', department: 'Care', timestamp: new Date(now.getTime() - 25 * 60000), icon: '⚠️', color: '#d97706' },
      { id: '6', type: 'maintenance', message: 'Radiator repair completed in Room 4 - heating restored', user: 'Robert Taylor', department: 'Maintenance', timestamp: new Date(now.getTime() - 32 * 60000), icon: '🔧', color: '#64748b' },
      { id: '7', type: 'medication', message: 'PRN paracetamol given to Ernest Higgins (Room 14) for headache', user: 'Amara Osei', department: 'Nursing', timestamp: new Date(now.getTime() - 40 * 60000), icon: '💊', color: '#7c3aed' },
      { id: '8', type: 'care-note', message: 'Fluid intake chart updated - 5 residents below target', user: 'Tom Walsh', department: 'Care', timestamp: new Date(now.getTime() - 48 * 60000), icon: '📝', color: '#0d9488' },
      { id: '9', type: 'kitchen', message: 'Lunch prep started - dietary requirements confirmed for 24 residents', user: 'Marcus Johnson', department: 'Kitchen', timestamp: new Date(now.getTime() - 55 * 60000), icon: '👨‍🍳', color: '#f97316' },
      { id: '10', type: 'admission', message: 'New admission documentation completed for Bed 8 (arriving tomorrow)', user: 'Sarah Mitchell', department: 'Admin', timestamp: new Date(now.getTime() - 63 * 60000), icon: '🏥', color: '#ec4899' },
      { id: '11', type: 'cleaning', message: 'Infection control deep clean completed - Shared bathroom 2', user: 'Grace Williams', department: 'Cleaning', timestamp: new Date(now.getTime() - 72 * 60000), icon: '🧹', color: '#14b8a6' },
      { id: '12', type: 'task', message: 'Fire door check completed - all doors operational', user: 'Robert Taylor', department: 'Maintenance', timestamp: new Date(now.getTime() - 80 * 60000), icon: '✅', color: '#16a34a' },
      { id: '13', type: 'care-note', message: 'Repositioning completed for 3 high-risk residents (tissue viability)', user: 'Daniel Hughes', department: 'Care', timestamp: new Date(now.getTime() - 90 * 60000), icon: '📝', color: '#0d9488' },
      { id: '14', type: 'medication', message: 'Controlled drug count verified - all correct', user: 'Priya Sharma', department: 'Nursing', timestamp: new Date(now.getTime() - 105 * 60000), icon: '💊', color: '#7c3aed' },
      { id: '15', type: 'maintenance', message: 'Weekly fire alarm test completed successfully - all zones clear', user: 'Robert Taylor', department: 'Maintenance', timestamp: new Date(now.getTime() - 120 * 60000), icon: '🔧', color: '#64748b' },
    ];
    return activities;
  }, []);

  useEffect(() => {
    setEntries(generateActivities);
  }, [generateActivities]);

  // Simulate new entries appearing
  useEffect(() => {
    const timer = setInterval(() => {
      const newMessages = [
        { type: 'care-note' as const, message: 'Wellbeing check completed for all ground floor residents', user: 'Lisa Brown', department: 'Care', icon: '📝', color: '#0d9488' },
        { type: 'task' as const, message: 'Medication round started - First floor', user: 'Amara Osei', department: 'Nursing', icon: '✅', color: '#16a34a' },
        { type: 'cleaning' as const, message: 'Corridor mopping in progress - Ground floor', user: 'Grace Williams', department: 'Cleaning', icon: '🧹', color: '#14b8a6' },
      ];
      const random = newMessages[Math.floor(Math.random() * newMessages.length)];
      const newEntry: ActivityEntry = {
        id: Date.now().toString(),
        ...random,
        timestamp: new Date(),
      };
      setEntries(prev => [newEntry, ...prev.slice(0, 14)]);
    }, 30000); // Add a new entry every 30 seconds

    return () => clearInterval(timer);
  }, []);

  const departments = useMemo(() => {
    const depts = Array.from(new Set(entries.map(e => e.department)));
    return ['all', ...depts];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter(e => e.department === filter);
  }, [entries, filter]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="card-title">📡 Live Activity Feed</span>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'pulse 2s infinite', boxShadow: '0 0 6px #16a34a80' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setFilter(dept)}
              style={{
                padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)',
                background: filter === dept ? '#0d948815' : 'transparent',
                color: filter === dept ? '#0d9488' : 'var(--text-muted)',
                fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body" style={{ padding: 0, maxHeight: 420, overflowY: 'auto' }}>
        {filteredEntries.map((entry, index) => (
          <div
            key={entry.id}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              background: index === 0 ? `${entry.color}05` : 'transparent',
              transition: 'background 500ms ease',
            }}
          >
            {/* Timeline dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: entry.color + '15', border: `1px solid ${entry.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13,
              }}>
                {entry.icon}
              </div>
              {index < filteredEntries.length - 1 && (
                <div style={{ width: 1, height: 20, background: 'var(--border)', marginTop: 4 }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {entry.message}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: entry.color }}>{entry.user}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entry.department}</span>
              </div>
            </div>

            {/* Timestamp */}
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{formatTimeAgo(entry.timestamp)}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{formatTime(entry.timestamp)}</div>
            </div>
          </div>
        ))}

        {filteredEntries.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No activities for this filter
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Showing {filteredEntries.length} activities
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Auto-updates every 30s
        </span>
      </div>
    </div>
  );
}
