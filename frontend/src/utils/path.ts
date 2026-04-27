import type { OSPathMap, OSKey } from '../types';

/**
 * Normalizes a raw runtime OS string to a well-known OSKey.
 */
export function normalizeOS(raw: string): OSKey {
  if (raw === 'darwin' || raw === 'linux' || raw === 'windows') return raw;
  return 'unknown';
}

/**
 * Returns the path for the current OS from an OSPathMap, or empty string if not set.
 */
export function getOSPath(map: OSPathMap | undefined, os: OSKey): string {
  if (os === 'unknown') return '';
  return map?.[os] || '';
}

/**
 * Sets or clears a path for the given OS in an OSPathMap.
 * Returns a new map; does not mutate the input.
 */
export function setOSPath(map: OSPathMap | undefined, os: OSKey, path: string): OSPathMap {
  const updated: OSPathMap = { ...(map || {}) };
  if (os === 'unknown') return updated;
  if (path) {
    updated[os] = path;
  } else {
    delete updated[os];
  }
  return updated;
}

/**
 * Shortens a file path to show only the last N segments.
 */
export function shortenPath(path: string, segments = 2): string {
  if (!path) return '';
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= segments) return path;
  const sep = path.includes('\\') ? '\\' : '/';
  return '...' + sep + parts.slice(-segments).join(sep);
}
