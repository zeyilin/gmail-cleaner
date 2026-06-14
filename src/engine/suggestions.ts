import type { SenderTag, SuggestedAction } from '../types';

export function suggestAction(
  tag: SenderTag,
  _count: number,
  hasUnsub: boolean,
): SuggestedAction {
  if (tag === 'protected') return 'protected';
  if (tag === 'keep') return 'keep';
  if (tag === 'marketing') return hasUnsub ? 'unsubscribe' : 'review';
  return 'review';
}
