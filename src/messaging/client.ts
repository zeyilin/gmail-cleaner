import type {
  Command,
  CommandResponseMap,
  CommandType,
  ErrorEnvelope,
} from './commands';
import { pushLog } from './debugLog';

function isError(x: unknown): x is ErrorEnvelope {
  return !!x && typeof x === 'object' && '__error' in (x as object);
}

/** Short, human-readable summary of a command's key args for the debug log. */
function summarizeCmd(cmd: any): string {
  switch (cmd.type) {
    case 'ARCHIVE_SENDER':
    case 'TRASH_SENDER':
    case 'LABEL_SENDER':
    case 'UNSUBSCRIBE':
    case 'COMBO_CLEANUP':
      return cmd.email ?? '';
    case 'MESSAGE_ACTION':
      return `${cmd.op} ${cmd.ids?.length ?? 0} msg`;
    case 'GET_SNAPSHOT':
      return cmd.force ? 'force rescan' : 'cached ok';
    case 'COUNT_EXACT':
      return cmd.query ?? '';
    case 'UNDO':
      return cmd.undoId ?? '';
    default:
      return '';
  }
}

/** Short summary of a command's result for the debug log. */
function summarizeRes(type: string, res: any): string {
  if (res == null) return '';
  switch (type) {
    case 'ARCHIVE_SENDER':
    case 'TRASH_SENDER':
    case 'LABEL_SENDER':
    case 'MESSAGE_ACTION':
      return `affected ${res.affected}${res.protectedExcluded ? `, ${res.protectedExcluded} protected kept` : ''}`;
    case 'COMBO_CLEANUP':
      return [
        res.unsubscribe ? `unsub ${res.unsubscribe.ok ? 'ok' : 'manual'}` : '',
        res.archive ? `cleaned ${res.archive.affected}` : '',
      ]
        .filter(Boolean)
        .join(', ');
    case 'COUNT_EXACT':
      return `count ${res.count}${res.exact ? '' : '+'}`;
    case 'GET_SNAPSHOT':
      return `${res.senders?.length ?? 0} senders, ${res.messages?.length ?? 0} msgs`;
    case 'UNDO':
      return res.ok ? 'undone' : 'noop';
    case 'AUTH_STATUS':
    case 'SIGN_IN':
      return res.signedIn ? `signed in${res.email ? ` (${res.email})` : ''}` : 'signed out';
    default:
      return '';
  }
}

/**
 * UI-side typed wrapper over chrome.runtime.sendMessage.
 * Throws if the worker reported an error. Records each call to the debug log
 * (consumed by Debug mode; harmless and cheap when Debug mode is off).
 */
export async function send<T extends CommandType>(
  cmd: Extract<Command, { type: T }>,
): Promise<CommandResponseMap[T]> {
  const start = Date.now();
  let res: unknown;
  try {
    res = await chrome.runtime.sendMessage(cmd);
  } catch (e: any) {
    pushLog({
      ts: start,
      src: 'command',
      label: cmd.type,
      detail: summarizeCmd(cmd) || String(e?.message ?? e),
      ok: false,
      ms: Date.now() - start,
    });
    throw e;
  }
  const ms = Date.now() - start;
  if (isError(res)) {
    pushLog({ ts: start, src: 'command', label: cmd.type, detail: res.__error, ok: false, ms });
    throw new Error(res.__error);
  }
  pushLog({
    ts: start,
    src: 'command',
    label: cmd.type,
    detail: [summarizeCmd(cmd), summarizeRes(cmd.type, res)].filter(Boolean).join(' → '),
    ok: true,
    ms,
  });
  return res as CommandResponseMap[T];
}
