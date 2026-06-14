import type { ProgressEvent, LogEvent } from './commands';

/**
 * Broadcasts a progress event from the service worker to any open UI.
 * Safe to call when no UI is listening (the rejection is swallowed).
 */
export function emitProgress(p: Omit<ProgressEvent, '__progress'>): void {
  chrome.runtime.sendMessage({ __progress: true, ...p } as ProgressEvent).catch(() => {});
}

/**
 * Broadcasts a debug log event (a Gmail API call) to any open UI. Best-effort,
 * like emitProgress — swallowed when no UI is listening.
 */
export function emitLog(e: Omit<LogEvent, '__log'>): void {
  chrome.runtime.sendMessage({ __log: true, ...e } as LogEvent).catch(() => {});
}
