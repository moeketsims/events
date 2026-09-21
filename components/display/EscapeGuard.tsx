'use client';

import { useEffect } from 'react';

/**
 * Swallows Escape on the projection so nothing on the page reacts to it.
 * Browsers reserve Escape for leaving fullscreen and do not let a page veto
 * that, so the operator keeps the board in a kiosk window or presses F11 again;
 * this guard only makes sure the board itself never dismisses anything.
 */
export function EscapeGuard() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return null;
}
