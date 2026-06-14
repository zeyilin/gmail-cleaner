import type { MessageMeta, PhishingFlag } from '../types';
import { domainOf } from '../engine/classifier';

interface BrandRule {
  brand: RegExp;
  /** Exact domain labels that mark a legitimate sender (covers regional ccTLDs + subdomains). */
  brandLabels: string[];
}

// Display-name brands paired with the domain labels their real mail uses.
// A label match is exact (amazon.co.uk / email.amazon.com are legit; evil-amazon.com is not).
const BRAND_RULES: BrandRule[] = [
  { brand: /\bamazon\b/i, brandLabels: ['amazon'] },
  { brand: /\bpaypal\b/i, brandLabels: ['paypal'] },
  { brand: /\bapple\b/i, brandLabels: ['apple', 'icloud'] },
  { brand: /\b(microsoft|outlook|office\s?365)\b/i, brandLabels: ['microsoft', 'outlook', 'office', 'live'] },
  { brand: /\bnetflix\b/i, brandLabels: ['netflix'] },
  { brand: /\b(american express|amex)\b/i, brandLabels: ['americanexpress', 'aexp'] },
  {
    brand: /\b(bank of america|wells fargo|chase|citi|citibank|capital one)\b/i,
    brandLabels: ['bankofamerica', 'wellsfargo', 'chase', 'citi', 'citibank', 'capitalone'],
  },
  { brand: /\b(ups|fedex|usps|dhl)\b/i, brandLabels: ['ups', 'fedex', 'usps', 'dhl'] },
  { brand: /\bcoinbase\b/i, brandLabels: ['coinbase'] },
  { brand: /\bvenmo\b/i, brandLabels: ['venmo'] },
  { brand: /\brobinhood\b/i, brandLabels: ['robinhood'] },
  { brand: /\b(intuit|turbotax)\b/i, brandLabels: ['intuit', 'turbotax'] },
  { brand: /\b(irs|internal revenue)\b/i, brandLabels: ['irs'] },
];

// Language that pressures the reader into an urgent financial/security action.
const URGENT_RE =
  /(payment\s+declined|verify your account|account (suspended|locked|disabled)|unusual (sign-?in|activity)|update your (payment|information|billing)|confirm your (identity|payment)|reactivate your account|unauthorized (charge|login))/i;

/** Read-only advisory. Flags suspicious mail; NEVER triggers an action. */
export function detectPhishing(messages: MessageMeta[], max = 50): PhishingFlag[] {
  const flags: PhishingFlag[] = [];
  for (const m of messages) {
    const reasons: string[] = [];
    const dom = domainOf(m.from.email);
    const labels = dom.split('.');
    const fromText = `${m.from.name} ${m.from.email}`;

    // 1) Display-name brand vs. sending-domain mismatch (exact-label check avoids
    //    flagging amazon.co.uk while still catching evil-amazon.com).
    for (const rule of BRAND_RULES) {
      if (rule.brand.test(fromText) && !rule.brandLabels.some((b) => labels.includes(b))) {
        reasons.push(`claims to be a known brand but is sent from "${dom}"`);
        break;
      }
    }

    // 2) Urgent financial/security pressure language.
    if (URGENT_RE.test(m.subject)) {
      reasons.push('urgent payment/security language — verify directly, do not click links');
    }

    if (reasons.length) {
      flags.push({ messageId: m.id, from: m.from.email, subject: m.subject, reasons });
      if (flags.length >= max) break;
    }
  }
  return flags;
}
