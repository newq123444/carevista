// src/hooks/useSSE.ts — real-time task updates via Server-Sent Events
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useTaskSSE() {
  const qc = useQueryClient();
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'TASK_COMPLETED':
        case 'TASK_DEFERRED':
        case 'TASK_STARTED':
        case 'TASK_RELEASED':
          // Invalidate tasks so all open TaskBoard instances refresh
          qc.invalidateQueries({ queryKey: ['tasks'], exact: false });
          break;
        case 'HEARTBEAT':
          break; // ignore
      }
    } catch {}
  }, [qc]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    if (!token) return;

    const url = `${apiBase}/tasks/stream`;
    // SSE with auth: use EventSource with custom headers via fetch-event-source or
    // pass token as query param (simpler for demo)
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
    es.onmessage = handleMessage;
    es.onerror = () => { /* auto-reconnects */ };
    return () => es.close();
  }, [handleMessage, apiBase]);
}
