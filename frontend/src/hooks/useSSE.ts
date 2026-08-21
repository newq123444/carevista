// src/hooks/useSSE.ts — real-time task updates via Server-Sent Events
import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type TaskEvent = {
  type: 'TASK_COMPLETED' | 'TASK_DEFERRED' | 'TASK_STARTED' | 'TASK_RELEASED'
      | 'TASK_TAKEN_OVER' | 'HEARTBEAT' | string;
  taskId?: string;
  residentId?: string;
  taskName?: string;
  staffName?: string;
  staffId?: string;
  completedBy?: string;
  completedAt?: string;
  previousHolderId?: string;
  previousHolderName?: string;
  reason?: string;
};

/**
 * Subscribes to the care home's task stream.
 *
 * The access token lives under `cv_access_token` — the same key the axios
 * client uses. It was previously read as `accessToken`, which never exists, so
 * this hook returned early every time and no live update ever arrived. That is
 * why two carers could work the same task without either seeing the other.
 *
 * Pass `onEvent` to react to a specific task (e.g. the one currently open on
 * screen) rather than just refreshing lists.
 */
export function useTaskSSE(onEvent?: (e: TaskEvent) => void) {
  const qc = useQueryClient();
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const handleMessage = useCallback((event: MessageEvent) => {
    let data: TaskEvent;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'HEARTBEAT') return;

    if (['TASK_COMPLETED', 'TASK_DEFERRED', 'TASK_STARTED', 'TASK_RELEASED', 'TASK_TAKEN_OVER'].includes(data.type)) {
      qc.invalidateQueries({ queryKey: ['tasks'], exact: false });
    }
    try { handler.current?.(data); } catch { /* a listener must never kill the stream */ }
  }, [qc]);

  useEffect(() => {
    const token = localStorage.getItem('cv_access_token');
    if (!token) return;

    const es = new EventSource(`${apiBase}/tasks/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = handleMessage;
    es.onerror = () => { /* EventSource reconnects on its own */ };
    return () => es.close();
  }, [handleMessage, apiBase]);
}
