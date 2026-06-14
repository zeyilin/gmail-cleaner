// ── The financial-safety allowlists ──────────────────────────────────────────
// Anything matching these is treated as PROTECTED and excluded from every
// destructive bulk action. Tune freely — this is the heart of the safety promise.

/** User label names (lowercased) that mark protected mail. Resolved to ids at runtime. */
export const PROTECTED_LABEL_NAMES = [
  'finances',
  'finances/receipts',
  'finances/taxes',
  'finances/credit cards',
  'finances/investments',
  'finances/payroll',
  'insurance',
  'medical',
  'benefits',
];

/**
 * Base domains for banks, brokerages, payment processors, order/receipt senders,
 * government, and medical. Subdomains match automatically (e.g. welcome.americanexpress.com).
 */
export const PROTECTED_DOMAINS = [
  // Cards / banks
  'americanexpress.com',
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'citi.com',
  'citibank.com',
  'capitalone.com',
  'discover.com',
  'usbank.com',
  'ally.com',
  // Brokerages / investing
  'vanguard.com',
  'e-vanguard.com',
  'schwab.com',
  'fidelity.com',
  'robinhood.com',
  'coinbase.com',
  // Payments / tax
  'paypal.com',
  'venmo.com',
  'stripe.com',
  'intuit.com',
  'turbotax.com',
  // Credit / rewards / receipts
  'experian.com',
  'equifax.com',
  'transunion.com',
  'biltrewards.com',
  'rakuten.com',
  // Orders / shipping
  'amazon.com',
  'justride.com',
  // Bills / services
  'dell.com',
  'honest.net',
  // Government
  'irs.gov',
  'ssa.gov',
  'usps.com',
  // Medical
  'nourish.com',
  'onemedical.com',
  'truemed.com',
  'remindmemd.com',
];

// Unambiguous transactional/financial/medical subject signals — these ALWAYS
// protect, even when the message carries a List-Unsubscribe header (some merchants,
// clinics, and payroll systems add one to genuine receipts/statements).
export const PROTECTED_SUBJECT_STRONG_RE =
  /\b(receipt|invoice|e-?statement|statement|\btax\b|w-?2|1099|prescription|refill|deductible|wire transfer|explanation of benefits|order\s*(?:#|confirmation|number))\b/i;

// Ambiguous tokens that are common in marketing too ("Go Premium", "Claim your
// discount") — these only protect when there is NO List-Unsubscribe header.
export const PROTECTED_SUBJECT_WEAK_RE =
  /\b(payment|paid|autopay|transaction|refund|deposit|premium|policy|claim|appointment|verification code|confirmation number|\border\b)\b/i;

/** Soft signal that a sender is promotional/marketing. */
export const MARKETING_HINT_RE =
  /(\b\d{1,3}%\s*off\b|\bsale\b|\bdeal\b|\boffer\b|new arrivals?|\bshop\b|\bsave\b|\bdiscount\b|\bcoupon\b|early access|limited time|\bpromo\b|\bbonus\b|last chance)/i;

/** Content newsletters the user reads — suggested action defaults to "keep" (still unsubscribable manually). */
export const KEEP_NEWSLETTER_DOMAINS = [
  'nytimes.com',
  'theverge.com',
  'theinformation.com',
  'newyorker.com',
  'semafor.com',
  'farnamstreetblog.com',
  'substack.com',
  'stratechery.com',
  'axios.com',
  'theathletic.com',
  'groundnewsletter.com',
  'strictlyvc.com',
  'sundaylongread.com',
];
