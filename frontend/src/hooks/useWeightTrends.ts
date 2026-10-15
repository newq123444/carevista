// Recent weights for every current resident, turned into a trend on the device.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { weightTrend, type WeightTrend } from '../utils/weightTrend';

export function useWeightTrends(enabled = true) {
  const q = useQuery({
    queryKey: ['weight-trends'],
    queryFn: () => api.get('/weights/trends').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled,
  });
  const trends = useMemo(() => {
    const m = new Map<string, WeightTrend>();
    for (const r of (Array.isArray(q.data) ? q.data : [])) {
      m.set(r.resident_id, weightTrend(r.readings || [], r.height_cm));
    }
    return m;
  }, [q.data]);
  return { trends, isLoading: q.isLoading, isError: q.isError };
}
