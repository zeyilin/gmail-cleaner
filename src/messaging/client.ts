import type {
  Command,
  CommandResponseMap,
  CommandType,
  ErrorEnvelope,
} from './commands';

function isError(x: unknown): x is ErrorEnvelope {
  return !!x && typeof x === 'object' && '__error' in (x as object);
}

/**
 * UI-side typed wrapper over chrome.runtime.sendMessage.
 * Throws if the worker reported an error.
 */
export async function send<T extends CommandType>(
  cmd: Extract<Command, { type: T }>,
): Promise<CommandResponseMap[T]> {
  const res = await chrome.runtime.sendMessage(cmd);
  if (isError(res)) throw new Error(res.__error);
  return res as CommandResponseMap[T];
}
