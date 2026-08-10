import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useQrRoomCodes, useGenerateQrCode, useScanQrCode, useDeactivateQrCode } from '../hooks';

export default function QrRoomScanning() {
  const { t } = useLang();
  const { data: qrCodes = [], isLoading } = useQrRoomCodes();
  const generateMutation = useGenerateQrCode();
  const scanMutation = useScanQrCode();
  const deactivateMutation = useDeactivateQrCode();

  const [showGenerate, setShowGenerate] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate({ room_number: roomNumber }, { onSuccess: () => { setShowGenerate(false); setRoomNumber(''); } });
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    scanMutation.mutate(scanCode, { onSuccess: (data) => setScanResult(data) });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>QR Room Scanning</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Generate QR codes for rooms and scan for quick access to resident information.</p>
        </div>
        <button onClick={() => setShowGenerate(!showGenerate)} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          + Generate QR
        </button>
      </div>

      {/* Scan Section */}
      <div style={{ padding: 20, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd', marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, color: '#0c4a6e' }}>Scan QR Code</h2>
        <form onSubmit={handleScan} style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            value={scanCode}
            onChange={e => setScanCode(e.target.value)}
            placeholder="Enter or scan QR code..."
            style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem' }}
          />
          <button type="submit" disabled={!scanCode || scanMutation.isPending} style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            {scanMutation.isPending ? 'Scanning...' : 'Scan'}
          </button>
        </form>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Scan Result</h2>
            <button onClick={() => setScanResult(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem' }}>x</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('Room')}</div>
              <div style={{ fontWeight: 600 }}>{scanResult.room_number || 'N/A'}</div>
            </div>
            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('Resident')}</div>
              <div style={{ fontWeight: 600 }}>{scanResult.resident_name || 'Unoccupied'}</div>
            </div>
          </div>
          {scanResult.care_plan_summary && (
            <div style={{ marginTop: 16, padding: 12, background: '#ecfdf5', borderRadius: 8 }}>
              <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 600, marginBottom: 4 }}>Care Plan Summary</div>
              <p style={{ margin: 0, color: '#047857', fontSize: '0.9rem' }}>{scanResult.care_plan_summary}</p>
            </div>
          )}
          {scanResult.todays_tasks && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Today's Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(Array.isArray(scanResult.todays_tasks) ? scanResult.todays_tasks : []).map((task: any, i: number) => (
                  <div key={i} style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: 6, fontSize: '0.85rem' }}>{task.title || task}</div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>Log Note</button>
            <button style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>Complete Task</button>
          </div>
        </div>
      )}

      {/* Generate Form */}
      {showGenerate && (
        <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Generate QR Code</h2>
          <form onSubmit={handleGenerate} style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={roomNumber}
              onChange={e => setRoomNumber(e.target.value)}
              placeholder="Room number..."
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem' }}
              required
            />
            <button type="submit" disabled={generateMutation.isPending} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {generateMutation.isPending ? 'Generating...' : 'Generate'}
            </button>
          </form>
        </div>
      )}

      {/* QR Code List */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12 }}>Room QR Codes</h2>
      {isLoading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
          {(Array.isArray(qrCodes) ? qrCodes : []).map((qr: any) => (
            <div key={qr.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Room {qr.room_number}</span>
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: qr.status === 'active' ? '#dcfce7' : '#fee2e2', color: qr.status === 'active' ? '#166534' : '#991b1b' }}>
                  {qr.status}
                </span>
              </div>
              {qr.resident_name && <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Resident: {qr.resident_name}</p>}
              <div style={{ marginTop: 8, padding: 12, background: '#f9fafb', borderRadius: 8, textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151' }}>
                {qr.qr_code || 'QR-' + qr.id?.substring(0, 8)}
              </div>
              {qr.status === 'active' && (
                <button onClick={() => deactivateMutation.mutate(qr.id)} style={{ marginTop: 8, padding: '6px 12px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}>
                  Deactivate
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
