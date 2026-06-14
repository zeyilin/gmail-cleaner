// User settings, persisted in chrome.storage.local. Usable from both the service
// worker and the UI (chrome.storage is available in both contexts).

export interface Settings {
  /** How many recent inbox messages to sample when scanning. */
  sampleSize: number;
  /** Start the dashboard in Advanced (multi-select) mode. */
  advancedMode: boolean;
  /** Default "also mark as read" when archiving. */
  markReadOnArchive: boolean;
  /** Extra sender domains the user wants treated as protected (never bulk-actioned). */
  customProtectedDomains: string[];
  /** Sender keys the user flagged "OK to keep" during triage (tagged keep, hidden from triage). */
  keepList: string[];
  /** Default order for "unsubscribe + clean" combos. */
  actionOrder: 'unsubFirst' | 'cleanFirst' | 'ask';
  /** Show the live activity log dock (every command + Gmail API call). */
  debugMode: boolean;
}

const KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  sampleSize: 1000,
  advancedMode: false,
  markReadOnArchive: true,
  customProtectedDomains: [],
  keepList: [],
  actionOrder: 'unsubFirst',
  debugMode: false,
};

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(r[KEY] as Partial<Settings> | undefined) };
}

/**
 * Normalizes user input to a bare registrable domain, or null if it isn't a
 * plausible domain. Accepts a full address ("john@chase.com" -> "chase.com"),
 * a URL, or "@domain"; rejects junk/spaces/no-dot.
 */
export function normalizeDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  if (!d) return null;
  d = d.split('@').pop() ?? d; // address -> domain
  d = d.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]; // url -> host
  if (d.length > 253) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return null;
  return d;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  next.customProtectedDomains = [
    ...new Set(next.customProtectedDomains.map(normalizeDomain).filter((d): d is string => !!d)),
  ].slice(0, 100);
  next.keepList = [...new Set(next.keepList.map((k) => k.trim().toLowerCase()).filter(Boolean))];
  next.sampleSize = Math.max(100, Math.min(5000, Math.round(next.sampleSize) || DEFAULT_SETTINGS.sampleSize));
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
