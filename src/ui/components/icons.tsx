import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  overview: <path d="M3 12h4l3 7 4-15 3 8h4" />,
  senders: (
    <>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </>
  ),
  unsubscribe: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8H3.5S6 15 6 9" />
      <path d="M10.5 21a2 2 0 0 0 3 0" />
      <path d="M3 3l18 18" />
    </>
  ),
  activity: (
    <>
      <path d="M9 14l-5-5 5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
    </>
  ),
  messages: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  triage: (
    <>
      <rect x="3" y="6" width="13" height="14" rx="2" />
      <path d="M8 3.5h9A1.5 1.5 0 0 1 18.5 5v10.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16" />
      <circle cx="9" cy="7" r="2.1" />
      <path d="M4 12h16" />
      <circle cx="15" cy="12" r="2.1" />
      <path d="M4 17h16" />
      <circle cx="8" cy="17" r="2.1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v5h-5" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />,
  check: <path d="M5 12l4 4L19 7" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
};

export function Icon({
  name,
  size = 17,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
