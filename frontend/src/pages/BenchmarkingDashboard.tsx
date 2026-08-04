import React, { useState } from 'react';
import { useBenchmarkingDashboard, useCalculateBenchmarks, useNationalAverages } from '../hooks';

export default function BenchmarkingDashboard() {
  const { data: dashboard, isLoading } = useBenchmarkingDashboard();
  const { data: averages } = useNationalAverages();
  const calculateMutation = useCalculateBenchmarks();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'above': return { bg: '#dcfce7', color: '#166534', border: '#a7f3d0' };
      case 'average': return { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' };
      case 'below': return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
      default: return { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
    }
  };

  const metrics = Array.isArray(dashboard) ? dashboard : (dashboard?.metrics || []);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Benchmarking Dashboard</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Compare your home's performance against national averages.</p>
        </div>
        <button onClick={() => calculateMutation.mutate({})} disabled={calculateMutation.isPending} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          {calculateMutation.isPending ? 'Calculating...' : 'Recalculate'}
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: '#6b7280' }}>Loading benchmarking data...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>
            {metrics.map((kpi: any) => {
              const colors = getPerformanceColor(kpi.performance_level);
              return (
                <div
                  key={kpi.id || kpi.metric_name}
                  onClick={() => setSelectedMetric(kpi.metric_name)}
                  style={{ padding: 20, background: '#fff', borderRadius: 12, border: `2px solid ${colors.border}`, cursor: 'pointer', transition: 'all 150ms', boxShadow: selectedMetric === kpi.metric_name ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151', margin: 0, textTransform: 'capitalize' }}>
                      {(kpi.metric_name || '').replace(/_/g, ' ')}
                    </h3>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: colors.bg, color: colors.color, textTransform: 'uppercase' }}>
                      {kpi.performance_level}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: colors.color }}>{typeof kpi.metric_value === 'number' ? kpi.metric_value.toFixed(1) : kpi.metric_value}</span>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>vs {typeof kpi.national_average === 'number' ? kpi.national_average.toFixed(1) : kpi.national_average} avg</span>
                  </div>
                  {kpi.percentile_rank != null && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Percentile Rank</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.color }}>{kpi.percentile_rank}th</span>
                      </div>
                      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${kpi.percentile_rank}%`, background: colors.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* National Averages Reference */}
          {averages && (
            <div style={{ padding: 20, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>National Averages Reference</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {(Array.isArray(averages) ? averages : []).map((avg: any) => (
                  <div key={avg.metric_name} style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4, textTransform: 'capitalize' }}>{(avg.metric_name || '').replace(/_/g, ' ')}</div>
                    <div style={{ fontWeight: 700, color: '#111827' }}>{avg.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: 24, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Above Average</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ca8a04' }} />
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Near Average</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#dc2626' }} />
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Below Average</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
