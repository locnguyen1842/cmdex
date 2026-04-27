import { useRef } from 'react';

/**
 * Returns a ref that stays in sync with the latest value.
 * The update happens during render (no extra render cycle needed),
 * and is guaranteed to be current before any event handlers or effects run.
 */
export function useSyncedRef<T>(value: T) {
  const ref = useRef(value);
  // eslint-disable-next-line react-hooks/refs -- render-phase sync is intentional and documented
  ref.current = value;
  return ref;
}
