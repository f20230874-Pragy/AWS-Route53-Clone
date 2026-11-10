import React from "react";

const P: Record<string, React.ReactNode> = {
  search: <><circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" /></>,
  close: <path d="M3 3l10 10M13 3L3 13" />,
  "chevron-down": <path d="M3 6l5 5 5-5" />,
  "chevron-up": <path d="M3 10l5-5 5 5" />,
  "chevron-left": <path d="M10 3L5 8l5 5" />,
  "chevron-right": <path d="M6 3l5 5-5 5" />,
  "caret-down": <path d="M4 6h8l-4 5z" fill="currentColor" stroke="none" />,
  "caret-right": <path d="M6 4v8l5-4z" fill="currentColor" stroke="none" />,
  settings: <><circle cx="8" cy="8" r="2.3" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></>,
  external: <><path d="M9 2h5v5M14 2L7 9" /><path d="M12 10v4H2V4h4" /></>,
  success: <><circle cx="8" cy="8" r="7" /><path d="M4.5 8.2l2.4 2.4 4.6-4.8" /></>,
  error: <><circle cx="8" cy="8" r="7" /><path d="M8 4v5M8 11v1.2" /></>,
  warning: <><path d="M8 1.5l7 12.5H1z" /><path d="M8 6v4M8 11.5v.8" /></>,
  info: <><circle cx="8" cy="8" r="7" /><path d="M8 7v4.5M8 4.5v1" /></>,
  grid: <><rect x="2" y="2" width="3" height="3" /><rect x="6.5" y="2" width="3" height="3" /><rect x="11" y="2" width="3" height="3" /><rect x="2" y="6.5" width="3" height="3" /><rect x="6.5" y="6.5" width="3" height="3" /><rect x="11" y="6.5" width="3" height="3" /><rect x="2" y="11" width="3" height="3" /><rect x="6.5" y="11" width="3" height="3" /><rect x="11" y="11" width="3" height="3" /></>,
  bell: <><path d="M3 12h10l-1.5-2V7a3.5 3.5 0 00-7 0v3z" /><path d="M6.5 14a1.5 1.5 0 003 0" /></>,
  sun: <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" /></>,
  moon: <path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z" />,
  keyboard: <><rect x="1.5" y="4" width="13" height="8" rx="1" /><path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6" /></>,
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
  refresh: <><path d="M13.5 8A5.5 5.5 0 114 4.2" /><path d="M4 1.5v3h3" /></>,
  upload: <><path d="M8 11V2M4.5 5.5L8 2l3.5 3.5" /><path d="M2 11v3h12v-3" /></>,
  download: <><path d="M8 2v9M4.5 7.5L8 11l3.5-3.5" /><path d="M2 11v3h12v-3" /></>,
  remove: <path d="M3 8h10" />,
  globe: <><circle cx="8" cy="8" r="6.5" /><path d="M1.5 8h13M8 1.5c2 2 2.500 4.500 2.500 6.500S10 12.500 8 14.500C6 12.500 5.500 10 5.500 8S6 3.500 8 1.500z" /></>,
  user: <><circle cx="8" cy="5" r="3" /><path d="M2 14c0-3 2.500-4.500 6-4.500s6 1.500 6 4.500" /></>,
  cube: <><path d="M8 1.500l6 3v7l-6 3-6-3v-7z" /><path d="M2 4.500l6 3 6-3M8 7.500v7" /></>,
};

export function Icon({ name, size = 16, className = "", style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`icon ${className}`} style={style} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
