import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';

// Attempts to go back in browser history if available, otherwise navigates
// to a sensible fallback (parent route). This prevents returning to the global
// dashboard when the current page was opened directly.
export function useSmartBack() {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback((fallback?: string) => {
    try {
      // If the browser has a previous entry, prefer history.back()
      if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch (e) {
      // ignore and fallback
    }

    // No history: compute fallback or parent path
    if (fallback) {
      navigate(fallback);
      return;
    }

    // Derive parent path by stripping the last segment
    const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length <= 1) {
      navigate('/');
      return;
    }
    const parent = '/' + parts.slice(0, -1).join('/');
    navigate(parent);
  }, [navigate, location.pathname]);

  return goBack;
}
