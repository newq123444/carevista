import React, { useState } from 'react';
import { useOfflineSyncConflicts, useOfflineSync, useResolveOfflineConflict } from '../hooks';

export default function OfflineMode() {
  const { data: conflicts = [], isLoading } = useOfflineSyncConflicts();
  const syncMutation = useOfflineSync();
  const resolveMutation = useResolveOfflineConflict();
  const [pendingItems] = useState<Array<{ id: string; entity_type: string; action_type: string; created_at: string }>>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = () => {
    syncMutation.mutate({ items: pendingItems });
  };

  const handleResolve = (id: string, resolution: string) => {
    resolveMutation.mutate({ id, data: { resolution } });
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}>Offline Mode</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Manage offline data synchronization and resolve conflicts.</p>

      {/* Connection Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: isOnline ? '#ecfdf5' : '#fef2f2', borderRadius: 12, marginBottom: 24, border: `1px solid ${isOnline ? '#a7f3d0' : '#fecaca'}` }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', boxShadow: `0 0 8px ${isOnline ? '#10b98180' : '#ef444480'}` }} />
        <div>
          <div style={{ fontWeight: 600, color: isOnline ? '#065f46' : '#991b1b' }}>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <div style={{ fontSize: '0.85rem', color: isOnline ? '#047857' : '#b91c1c' }}>
            {isOnline ? 'Connected to server. All changes sync automatically.' : 'No internet connection. Changes are saved locally.'}
          </div>
        </div>
      </div>

      {/* Service Worker Status */}
      <div style={{ padding: 16, background: '#f0f9ff', borderRadius: 12, marginBottom: 24, border: '1px solid #bae6fd' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <span style={{ fontWeight: 600, color: '#0c4a6e' }}>Service Worker</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#075985', margin: 0 }}>
          Service worker is registered and caching app assets. The app will work offline with limited functionality.
        </p>
      </div>

      {/* Auto-Sync Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0d9488' }}>{pendingItems.length}</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Pending Items</div>
        </div>
        <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{Array.isArray(conflicts) ? conflicts.length : 0}</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Conflicts</div>
        </div>
        <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>Auto</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Sync Mode</div>
        </div>
      </div>

      {/* Sync Button */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={handleSync}
          disabled={!isOnline || pendingItems.length === 0 || syncMutation.isPending}
          style={{ padding: '12px 24px', background: isOnline ? '#0d9488' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: isOnline ? 'pointer' : 'not-allowed', fontSize: '1rem' }}
        >
          {syncMutation.isPending ? 'Syncing...' : `Sync Now (${pendingItems.length} items)`}
        </button>
      </div>

      {/* Pending Items List */}
      {pendingItems.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12 }}>Pending Sync Items</h2>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {pendingItems.map(item => (
              <div key={item.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{item.entity_type}</span>
                  <span style={{ color: '#6b7280', marginLeft: 8 }}>{item.action_type}</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(item.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts */}
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12 }}>Sync Conflicts</h2>
        {isLoading ? (
          <p style={{ color: '#6b7280' }}>Loading conflicts...</p>
        ) : Array.isArray(conflicts) && conflicts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conflicts.map((conflict: any) => (
              <div key={conflict.id} style={{ padding: 16, background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{conflict.entity_type}</span>
                    <span style={{ color: '#92400e', marginLeft: 8, fontSize: '0.85rem' }}>Conflict detected</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(conflict.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => handleResolve(conflict.id, 'keep_local')} style={{ padding: '6px 12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    Keep Local
                  </button>
                  <button onClick={() => handleResolve(conflict.id, 'keep_server')} style={{ padding: '6px 12px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    Keep Server
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <p style={{ color: '#6b7280', margin: 0 }}>No conflicts to resolve</p>
          </div>
        )}
      </div>
    </div>
  );
}
