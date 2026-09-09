import { useEffect } from 'react';

export function useAppLifecycle(onSuspend?: () => void, onResume?: () => void): void {
  useEffect(() => {
    if (!window.electronAPI) return;

    if (onSuspend) {
      window.electronAPI.onSuspend(onSuspend);
    }
    if (onResume) {
      window.electronAPI.onResume(onResume);
    }

    return () => {
      window.electronAPI.removeAllListeners('app-suspend');
      window.electronAPI.removeAllListeners('app-resume');
    };
  }, [onSuspend, onResume]);
}
