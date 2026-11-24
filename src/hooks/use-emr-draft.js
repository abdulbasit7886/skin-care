import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// A per-appointment, per-user draft so clinical entries survive a logout,
// a session expiry or a closed browser tab. Cleared once the EMR is saved.
// userKey: the signed-in user id (falls back to email), so drafts never leak between users.
const storageKey = (appointmentId, userKey) => `emr-draft:${appointmentId}:${userKey || 'anonymous'}`;

export function useEmrDraft(appointmentId, userKey) {
  const key = useMemo(() => storageKey(appointmentId, userKey), [appointmentId, userKey]);
  const [draft] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const timer = useRef(null);
  const latest = useRef(null);

  const write = useCallback(() => {
    if (!latest.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
    } catch (e) { /* storage unavailable or full */ }
  }, [key]);

  const saveDraft = useCallback((form) => {
    latest.current = form;
    clearTimeout(timer.current);
    timer.current = setTimeout(write, 400);
  }, [write]);

  const clearDraft = useCallback(() => {
    clearTimeout(timer.current);
    latest.current = null;
    try {
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  }, [key]);

  // Leaving the page must not swallow a draft still waiting on its timer.
  useEffect(() => () => {
    clearTimeout(timer.current);
    write();
  }, [write]);

  return { draft, saveDraft, clearDraft };
}