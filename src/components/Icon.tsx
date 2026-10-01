export type IconName =
  | "play"
  | "search"
  | "book"
  | "target"
  | "doc"
  | "chart"
  | "clock"
  | "home"
  | "chevron";

const PATHS: Record<IconName, React.ReactNode> = {
  play: (
    <>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <path d="M7.5 12h3M9 10.5v3M15.5 11.2h.01M17.5 12.8h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v16H7.5A2.5 2.5 0 0 0 5 20.5z" />
      <path d="M5 4.5v16" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  doc: (
    <>
      <path d="M6 2.5h7l5 5V21.5H6z" />
      <path d="M13 2.5v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 21h16" />
      <path d="M6 21V13M12 21V6M18 21v-9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M6 9.8V20h12V9.8" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
};

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
