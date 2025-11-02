import { useEffect } from 'react';

interface KeyboardActions {
  onQuit?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onClearError?: () => void;
  onHelp?: () => void;
}

export function useKeyboard(actions: KeyboardActions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'q':
          if (actions.onQuit) {
            actions.onQuit();
          }
          break;
        case 'p':
          if (actions.onPause) {
            actions.onPause();
          }
          break;
        case 'r':
          if (actions.onResume) {
            actions.onResume();
          }
          break;
        case 'arrowup':
          if (actions.onScrollUp) {
            event.preventDefault();
            actions.onScrollUp();
          }
          break;
        case 'arrowdown':
          if (actions.onScrollDown) {
            event.preventDefault();
            actions.onScrollDown();
          }
          break;
        case 'c':
          if (actions.onClearError) {
            actions.onClearError();
          }
          break;
        case '?':
          if (actions.onHelp) {
            actions.onHelp();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
