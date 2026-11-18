import { useCallback, useSyncExternalStore } from 'react';

/** Whether a media query matches now, kept up to date. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** The width where the ballot moves its summary to a sidebar. */
export const WIDE = '(min-width: 60rem)';
