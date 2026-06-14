/* Pure-logic edge-case tests. Run with: npm run test:logic
 * Covers the modules that don't touch chrome.* APIs. */
import { parseFrom, parseListUnsubscribe, resolveUnsubMethod } from '../src/engine/headerParse';
import { isProtectedMessage, classifySender } from '../src/engine/classifier';
import { normalizeSenderKey, buildSnapshot } from '../src/engine/aggregator';
import { suggestAction } from '../src/engine/suggestions';
import { detectPhishing } from '../src/safety/phishing';
import type { MessageMeta } from '../src/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) passed++;
  else {
    failed++;
    console.error('  ✗ ' + name);
  }
}
function eq(name: string, got: unknown, want: unknown) {
  check(`${name} — got ${JSON.stringify(got)}`, JSON.stringify(got) === JSON.stringify(want));
}

const NOW = Date.now();
const DAY = 86_400_000;
function msg(p: Partial<MessageMeta> & { email: string }): MessageMeta {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    threadId: p.threadId ?? 't',
    from: { name: p.from?.name ?? p.email, email: p.email },
    subject: p.subject ?? '',
    date: p.date ?? NOW,
    labelIds: p.labelIds ?? [],
    unread: p.unread ?? false,
    listUnsubscribe: p.listUnsubscribe,
    listUnsubscribePost: p.listUnsubscribePost,
  };
}
const ctx = (labels: string[] = [], extra: string[] = []) => ({
  protectedLabelIds: new Set(labels),
  extraProtectedDomains: extra,
});

// ── headerParse: parseFrom ─────────────────────────────
eq('parseFrom named', parseFrom('The New York Times <nytdirect@nytimes.com>'), {
  name: 'The New York Times',
  email: 'nytdirect@nytimes.com',
});
eq('parseFrom bare', parseFrom('nytdirect@nytimes.com'), {
  name: 'nytdirect@nytimes.com',
  email: 'nytdirect@nytimes.com',
});
eq('parseFrom quoted+comma', parseFrom('"Lin, Zeyi" <Zeyi.Lin@Gmail.com>'), {
  name: 'Lin, Zeyi',
  email: 'zeyi.lin@gmail.com',
});
eq('parseFrom uppercase bare', parseFrom('FOO@BAR.COM'), { name: 'foo@bar.com', email: 'foo@bar.com' });
eq('parseFrom empty', parseFrom(''), { name: '', email: '' });

// ── headerParse: parseListUnsubscribe ──────────────────
eq('LU both', parseListUnsubscribe('<https://x.com/u>, <mailto:u@x.com>'), {
  https: 'https://x.com/u',
  mailto: 'mailto:u@x.com',
});
eq('LU mailto only', parseListUnsubscribe('<mailto:u@x.com>'), { mailto: 'mailto:u@x.com' });
eq('LU https only', parseListUnsubscribe('<https://x.com/u>'), { https: 'https://x.com/u' });
eq('LU none', parseListUnsubscribe(undefined), {});
eq('LU spacing/multi picks first https', parseListUnsubscribe(' <https://a.com> , <https://b.com> '), {
  https: 'https://a.com',
});

// ── headerParse: resolveUnsubMethod ────────────────────
eq(
  'method one-click',
  resolveUnsubMethod('<https://x/u>, <mailto:u@x>', 'List-Unsubscribe=One-Click'),
  { method: 'one-click', target: 'https://x/u' },
);
eq('method https', resolveUnsubMethod('<https://x/u>', undefined), {
  method: 'https',
  target: 'https://x/u',
});
eq('method mailto', resolveUnsubMethod('<mailto:u@x>', undefined), {
  method: 'mailto',
  target: 'mailto:u@x',
});
eq('method manual (header, no urls)', resolveUnsubMethod('unsubscribe here', undefined), {
  method: 'manual',
});
eq('method none', resolveUnsubMethod(undefined, undefined), { method: 'none' });

// ── classifier: isProtectedMessage ─────────────────────
check(
  'protected by label id',
  isProtectedMessage(msg({ email: 'x@whatever.com', labelIds: ['Label_3'] }), ctx(['Label_3'])).protected,
);
check(
  'protected by domain (subdomain)',
  isProtectedMessage(msg({ email: 'x@welcome.americanexpress.com' }), ctx()).protected,
);
check('protected by .gov', isProtectedMessage(msg({ email: 'a@city.gov' }), ctx()).protected);
check(
  'protected by custom domain',
  isProtectedMessage(msg({ email: 'a@statements.mybank.test' }), ctx([], ['mybank.test'])).protected,
);
check(
  'protected by subject (no unsubscribe)',
  isProtectedMessage(msg({ email: 'a@shop.example', subject: 'Your receipt #123' }), ctx()).protected,
);
check(
  'NOT protected: subject keyword WITH unsubscribe (newsletter)',
  !isProtectedMessage(
    msg({ email: 'dan@tldrnewsletter.com', subject: 'OpenAI payment news', listUnsubscribe: '<https://u>' }),
    ctx(),
  ).protected,
);
check(
  'NOT protected: plain marketing',
  !isProtectedMessage(
    msg({ email: 'sales@shop.example', subject: '50% off sale', listUnsubscribe: '<https://u>' }),
    ctx(),
  ).protected,
);

// ── classifier: classifySender ─────────────────────────
eq('tag protected wins', classifySender([msg({ email: 'x@vanguard.com' })], ctx()).tag, 'protected');
eq(
  'tag keep (newsletter domain)',
  classifySender([msg({ email: 'a@nytimes.com', listUnsubscribe: '<https://u>' })], ctx()).tag,
  'keep',
);
eq(
  'tag marketing (promotions + unsub)',
  classifySender(
    [msg({ email: 'a@dwr.example', labelIds: ['CATEGORY_PROMOTIONS'], listUnsubscribe: '<https://u>' })],
    ctx(),
  ).tag,
  'marketing',
);
eq('tag unknown', classifySender([msg({ email: 'a@randomperson.example' })], ctx()).tag, 'unknown');

// ── suggestions: suggestAction ─────────────────────────
eq('suggest protected', suggestAction('protected', 5, true), 'protected');
eq('suggest keep', suggestAction('keep', 5, true), 'keep');
eq('suggest marketing+unsub', suggestAction('marketing', 5, true), 'unsubscribe');
eq('suggest marketing no-unsub', suggestAction('marketing', 5, false), 'review');
eq('suggest unknown', suggestAction('unknown', 5, false), 'review');

// ── classifier: strong subject protects even with List-Unsubscribe ─────────
check(
  'STRONG subject (receipt) protects despite unsubscribe header',
  isProtectedMessage(
    msg({ email: 'a@shop.example', subject: 'Your receipt is ready', listUnsubscribe: '<https://u>' }),
    ctx(),
  ).protected,
);
check(
  'government .gov.uk protected',
  isProtectedMessage(msg({ email: 'a@hmrc.gov.uk' }), ctx()).protected,
);

// ── aggregator: normalizeSenderKey ─────────────────────
eq('normalize +tag', normalizeSenderKey('lenny+community-wisdom@substack.com'), 'lenny@substack.com');
eq('normalize case', normalizeSenderKey('Foo@Bar.com'), 'foo@bar.com');
eq('normalize no domain', normalizeSenderKey('nodomain'), 'nodomain');

// ── aggregator: buildSnapshot ──────────────────────────
const messages: MessageMeta[] = [
  msg({ email: 'lenny@substack.com', from: { name: 'Lenny', email: 'lenny@substack.com' }, listUnsubscribe: '<https://u>', date: NOW - 2 * DAY, unread: true }),
  msg({ email: 'lenny+community@substack.com', from: { name: 'Lenny', email: 'lenny+community@substack.com' }, listUnsubscribe: '<https://u>', date: NOW - 5 * DAY }),
  msg({ email: 'nytdirect@nytimes.com', from: { name: 'NYT', email: 'nytdirect@nytimes.com' }, listUnsubscribe: '<https://u>', date: NOW - 200 * DAY }),
  msg({ email: 'x@americanexpress.com', from: { name: 'Amex', email: 'x@americanexpress.com' }, date: NOW - 400 * DAY }),
];
const snap = buildSnapshot(messages, {
  sampleSize: 10,
  protectedLabelIds: new Set(),
  extraProtectedDomains: [],
  categoryFacets: [],
  readUnreadFacets: [],
});
eq('snapshot sender count (lenny merged)', snap.senders.length, 3);
eq('snapshot top sender is lenny (count 2)', snap.senders[0].key, 'lenny@substack.com');
eq('snapshot lenny count', snap.senders[0].count, 2);
eq('snapshot protectedCount', snap.facets.protectedCount, 1);
eq('snapshot age buckets', snap.facets.age, { lt1m: 2, m1to6: 0, m6to12: 1, gt1y: 1 });
check(
  'snapshot hasUnsub facet',
  snap.facets.hasUnsub.find((f) => f.key === 'yes')?.count === 3,
);
const amex = snap.senders.find((s) => s.key === 'x@americanexpress.com');
eq('snapshot amex protected', amex?.tag, 'protected');

// ── phishing ───────────────────────────────────────────
const phish = detectPhishing([
  msg({ email: 'payments-update@evil-amazon.com', from: { name: 'Amazon', email: 'payments-update@evil-amazon.com' }, subject: 'Payment declined: update your information' }),
  msg({ email: 'auto-confirm@amazon.com', from: { name: 'Amazon', email: 'auto-confirm@amazon.com' }, subject: 'Your order has shipped' }),
  msg({ email: 'random@x.com', from: { name: 'IT', email: 'random@x.com' }, subject: 'Verify your account now' }),
]);
check('phishing flags brand mismatch', phish.some((p) => p.from === 'payments-update@evil-amazon.com'));
check('phishing flags urgent language', phish.some((p) => p.from === 'random@x.com'));
check('phishing does not flag legit amazon order', !phish.some((p) => p.from === 'auto-confirm@amazon.com'));

// ── triage: recentSubjects + keep-list tagging ─────────
const tmsgs: MessageMeta[] = [
  msg({ email: 'a@shop.test', subject: 'Sale 1', labelIds: ['CATEGORY_PROMOTIONS'], listUnsubscribe: '<https://u>', date: NOW - 1 * DAY }),
  msg({ email: 'a@shop.test', subject: 'Sale 2', labelIds: ['CATEGORY_PROMOTIONS'], listUnsubscribe: '<https://u>', date: NOW - 2 * DAY }),
];
const baseOpts = {
  sampleSize: 10,
  protectedLabelIds: new Set<string>(),
  extraProtectedDomains: [] as string[],
  categoryFacets: [],
  readUnreadFacets: [],
};
const tsnap = buildSnapshot(tmsgs, baseOpts);
eq('recentSubjects newest-first', tsnap.senders[0].recentSubjects, ['Sale 1', 'Sale 2']);
eq('shop tagged marketing', tsnap.senders[0].tag, 'marketing');
const ksnap = buildSnapshot(tmsgs, { ...baseOpts, keepKeys: new Set(['a@shop.test']) });
eq('keepKeys forces tag=keep', ksnap.senders[0].tag, 'keep');
const psnap = buildSnapshot([msg({ email: 'x@vanguard.com', subject: 'Statement' })], {
  ...baseOpts,
  keepKeys: new Set(['x@vanguard.com']),
});
eq('protected beats keep', psnap.senders[0].tag, 'protected');

// ── summary ────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
