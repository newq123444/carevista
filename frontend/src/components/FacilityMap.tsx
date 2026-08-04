// src/components/FacilityMap.tsx - Interactive SVG floor plan showing room statuses
import React, { useState, useMemo } from 'react';

type RoomStatus = 'occupied' | 'vacant' | 'needs-cleaning' | 'maintenance-required';

interface Room {
  id: number;
  resident: string | null;
  status: RoomStatus;
  floor: 'ground' | 'first' | 'second';
  lastCheck: string;
  notes?: string;
}

interface FacilityMapProps {
  context?: 'cleaning' | 'maintenance';
}

export default function FacilityMap({ context = 'cleaning' }: FacilityMapProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<'ground' | 'first' | 'second'>('ground');

  const rooms: Room[] = useMemo(() => [
    { id: 1, resident: 'Margaret Hollis', status: 'occupied', floor: 'ground', lastCheck: '08:15' },
    { id: 2, resident: 'Arthur Pemberton', status: 'needs-cleaning', floor: 'ground', lastCheck: '06:30', notes: 'Spill in bathroom' },
    { id: 3, resident: 'Dorothy Sinclair', status: 'occupied', floor: 'ground', lastCheck: '08:20' },
    { id: 4, resident: 'Harold Fletcher', status: 'maintenance-required', floor: 'ground', lastCheck: '07:00', notes: 'Radiator not heating' },
    { id: 5, resident: 'Edith Turner', status: 'occupied', floor: 'ground', lastCheck: '08:10' },
    { id: 6, resident: 'Reginald Barnes', status: 'occupied', floor: 'ground', lastCheck: '07:45' },
    { id: 7, resident: 'Vera Chapman', status: 'needs-cleaning', floor: 'ground', lastCheck: '06:50', notes: 'Scheduled deep clean' },
    { id: 8, resident: null, status: 'vacant', floor: 'ground', lastCheck: '08:00' },
    { id: 9, resident: 'Elsie Hartley', status: 'occupied', floor: 'first', lastCheck: '08:05' },
    { id: 10, resident: 'Frederick Osborne', status: 'occupied', floor: 'first', lastCheck: '07:55' },
    { id: 11, resident: 'Agnes Whitfield', status: 'needs-cleaning', floor: 'first', lastCheck: '06:00', notes: 'Post-incontinence clean needed' },
    { id: 12, resident: 'George Bradshaw', status: 'maintenance-required', floor: 'first', lastCheck: '07:20', notes: 'Toilet flush broken' },
    { id: 13, resident: 'Winifred Stanton', status: 'occupied', floor: 'first', lastCheck: '08:10' },
    { id: 14, resident: 'Ernest Higgins', status: 'occupied', floor: 'first', lastCheck: '07:50' },
    { id: 15, resident: null, status: 'vacant', floor: 'first', lastCheck: '08:00' },
    { id: 16, resident: 'Bertram Cross', status: 'occupied', floor: 'first', lastCheck: '08:15' },
    { id: 17, resident: 'Gladys Perkins', status: 'occupied', floor: 'second', lastCheck: '07:40' },
    { id: 18, resident: 'Norman Yates', status: 'maintenance-required', floor: 'second', lastCheck: '06:30', notes: 'Extractor fan noise' },
    { id: 19, resident: 'Florence Webb', status: 'occupied', floor: 'second', lastCheck: '08:00' },
    { id: 20, resident: 'Albert Moss', status: 'needs-cleaning', floor: 'second', lastCheck: '06:45', notes: 'Morning tidy overdue' },
    { id: 21, resident: 'Mabel Kirby', status: 'occupied', floor: 'second', lastCheck: '07:55' },
    { id: 22, resident: null, status: 'vacant', floor: 'second', lastCheck: '08:00' },
    { id: 23, resident: 'Cecil Rowlands', status: 'occupied', floor: 'second', lastCheck: '08:10' },
    { id: 24, resident: 'Iris Loveday', status: 'occupied', floor: 'second', lastCheck: '07:30' },
  ], []);

  const floorRooms = useMemo(() => rooms.filter(r => r.floor === selectedFloor), [rooms, selectedFloor]);

  const statusConfig: Record<RoomStatus, { color: string; bg: string; label: string; icon: string }> = {
    'occupied': { color: '#16a34a', bg: '#dcfce7', label: 'Occupied', icon: '👤' },
    'vacant': { color: '#6b7280', bg: '#f3f4f6', label: 'Vacant', icon: '🚪' },
    'needs-cleaning': { color: '#d97706', bg: '#fef3c7', label: 'Needs Cleaning', icon: '🧹' },
    'maintenance-required': { color: '#dc2626', bg: '#fee2e2', label: 'Maintenance Required', icon: '🔧' },
  };

  const stats = useMemo(() => ({
    occupied: rooms.filter(r => r.status === 'occupied').length,
    vacant: rooms.filter(r => r.status === 'vacant').length,
    needsCleaning: rooms.filter(r => r.status === 'needs-cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance-required').length,
  }), [rooms]);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-title">
          {context === 'maintenance' ? '🏗️' : '🗺️'} Interactive Facility Map
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ground', 'first', 'second'] as const).map(floor => (
            <button
              key={floor}
              onClick={() => { setSelectedFloor(floor); setSelectedRoom(null); }}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: selectedFloor === floor ? (context === 'maintenance' ? '#64748b20' : '#14b8a620') : 'transparent',
                color: selectedFloor === floor ? (context === 'maintenance' ? '#64748b' : '#14b8a6') : 'var(--text-muted)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize'
              }}
            >
              {floor} Floor
            </button>
          ))}
        </div>
      </div>
      <div className="card-body" style={{ padding: '16px 20px' }}>
        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const count = key === 'occupied' ? stats.occupied : key === 'vacant' ? stats.vacant : key === 'needs-cleaning' ? stats.needsCleaning : stats.maintenance;
            return (
              <div key={key} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}30`, textAlign: 'center' }}>
                <div style={{ fontSize: 14 }}>{cfg.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: cfg.color }}>{count}</div>
                <div style={{ fontSize: 9, color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>

        {/* Floor Plan Grid */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {selectedFloor} Floor - {floorRooms.length} Rooms
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Click a room for details</span>
          </div>

          {/* Corridor representation */}
          <div style={{ position: 'relative' }}>
            {/* Top row of rooms */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.ceil(floorRooms.length / 2)}, 1fr)`, gap: 8, marginBottom: 6 }}>
              {floorRooms.slice(0, Math.ceil(floorRooms.length / 2)).map(room => {
                const cfg = statusConfig[room.status];
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(isSelected ? null : room)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: 8,
                      background: isSelected ? cfg.color + '25' : cfg.bg,
                      border: `2px solid ${isSelected ? cfg.color : cfg.color + '40'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 150ms ease',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: isSelected ? `0 4px 12px ${cfg.color}30` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>R{room.id}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.resident ? room.resident.split(' ')[1] : 'Empty'}
                    </div>
                    <div style={{ marginTop: 4, width: 8, height: 8, borderRadius: '50%', background: cfg.color, margin: '0 auto', boxShadow: `0 0 4px ${cfg.color}60` }} />
                  </div>
                );
              })}
            </div>

            {/* Corridor Line */}
            <div style={{ height: 24, background: '#e2e8f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: 1 }}>CORRIDOR</span>
            </div>

            {/* Bottom row of rooms */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.ceil(floorRooms.length / 2)}, 1fr)`, gap: 8, marginTop: 6 }}>
              {floorRooms.slice(Math.ceil(floorRooms.length / 2)).map(room => {
                const cfg = statusConfig[room.status];
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(isSelected ? null : room)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: 8,
                      background: isSelected ? cfg.color + '25' : cfg.bg,
                      border: `2px solid ${isSelected ? cfg.color : cfg.color + '40'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 150ms ease',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: isSelected ? `0 4px 12px ${cfg.color}30` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>R{room.id}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.resident ? room.resident.split(' ')[1] : 'Empty'}
                    </div>
                    <div style={{ marginTop: 4, width: 8, height: 8, borderRadius: '50%', background: cfg.color, margin: '0 auto', boxShadow: `0 0 4px ${cfg.color}60` }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Room Detail */}
        {selectedRoom && (
          <div style={{ padding: 14, borderRadius: 10, background: statusConfig[selectedRoom.status].bg, border: `1px solid ${statusConfig[selectedRoom.status].color}30`, animation: 'fadeIn 200ms ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{statusConfig[selectedRoom.status].icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Room {selectedRoom.id}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {selectedRoom.resident || 'Vacant'} - {selectedRoom.floor} floor
                  </div>
                </div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: statusConfig[selectedRoom.status].color + '20', color: statusConfig[selectedRoom.status].color }}>
                {statusConfig[selectedRoom.status].label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Last check: {selectedRoom.lastCheck}</span>
              {selectedRoom.notes && <span style={{ color: statusConfig[selectedRoom.status].color, fontWeight: 600 }}>Note: {selectedRoom.notes}</span>}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center' }}>
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
