import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAppLifecycle(onSuspend?: () => void, onResume?: () => void): void {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current === 'active' && nextState === 'background') {
        onSuspend?.();
      } else if (appState.current === 'background' && nextState === 'active') {
        onResume?.();
      }
      appState.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [onSuspend, onResume]);
}
