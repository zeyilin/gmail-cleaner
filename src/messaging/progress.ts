import type { ProgressEvent } from './commands';

/**
 * Broadcasts a progress event from the service worker to any open UI.
 * Safe to call when no UI is listening (the rejection is swallowed).
 */
export function emitProgress(p: Omit<ProgressEvent, '__progress'>): void {
  chrome.runtime.sendMessage({ __progress: true, ...p } as ProgressEvent).catch(() => {});
}
