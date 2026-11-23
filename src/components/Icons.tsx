import type { ReactNode } from 'react';

export type IconName =
  | 'import'
  | 'text'
  | 'sparkles'
  | 'trash'
  | 'eye'
  | 'eye-off'
  | 'save'
  | 'folder'
  | 'plus'
  | 'close'
  | 'blackout'
  | 'screen'
  | 'keyboard'
  | 'tap'
  | 'camera'
  | 'audio'
  | 'power'
  | 'refresh'
  | 'check'
  | 'warning'
  | 'mix'
  | 'settings'
  | 'video'
  | 'image'
  | 'generator'
  | 'layers'
  | 'play'
  | 'pause'
  | 'stop'
  | 'restart'
  | 'rewind'
  | 'forward'
  | 'loop'
  | 'edit'
  | 'chevron-down'
  | 'chevron-right'
  | 'beam';

const PATHS: Record<IconName, ReactNode> = {
  import: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </>
  ),
  text: (
    <>
      <path d="M5 5h14" />
      <path d="M12 5v14" />
      <path d="M8.5 19h7" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.4 4.2L17.5 9l-4.1 1.8L12 15l-1.4-4.2L6.5 9l4.1-1.8L12 3Z" />
      <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="M5.5 14l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6.5 7l.8 13h9.4l.8-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6A9.8 9.8 0 0 1 12 5.7c6 0 9.5 6.3 9.5 6.3a17 17 0 0 1-3 3.7" />
      <path d="M6.2 6.8A17.4 17.4 0 0 0 2.5 12S6 18.3 12 18.3c1.4 0 2.7-.3 3.8-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  save: (
    <>
      <path d="M4 4h12l4 4v12H4V4Z" />
      <path d="M8 4v6h8V4" />
      <path d="M8 20v-6h8v6" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2.5h6.5A2.5 2.5 0 0 1 21 10v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  blackout: (
    <>
      <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7Z" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16.5V20" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M12 13h.01M15 13h.01M18 13h.01M7 16h10" />
    </>
  ),
  tap: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 4V1.5M12 22.5V20M4 12H1.5M22.5 12H20" />
    </>
  ),
  camera: (
    <>
      <rect x="2.5" y="6.5" width="13" height="11" rx="2" />
      <path d="m15.5 10 6-3v10l-6-3" />
    </>
  ),
  audio: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
      <path d="M8.5 21h7" />
    </>
  ),
  power: (
    <>
      <path d="M12 2.5v9" />
      <path d="M6.2 5.8a8 8 0 1 0 11.6 0" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-13.8-5.2L3 9" />
      <path d="M3 4v5h5" />
      <path d="M4 13a8 8 0 0 0 13.8 5.2L21 15" />
      <path d="M21 20v-5h-5" />
    </>
  ),
  check: (
    <>
      <path d="m4.5 12.5 5 5 10-11" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 9v4.5" />
      <path d="M12 17h.01" />
    </>
  ),
  mix: (
    <>
      <path d="M4 8h13" />
      <path d="m14 5 3 3-3 3" />
      <path d="M20 16H7" />
      <path d="m10 13-3 3 3 3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m10 9 5 3-5 3V9Z" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </>
  ),
  generator: (
    <>
      <path d="M3 12c2.5 0 2.5-6 5-6s2.5 12 5 12 2.5-8 5-8 2.5 2 3 2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </>
  ),
  play: (
    <>
      <path d="m8 5 11 7-11 7V5Z" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  stop: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
    </>
  ),
  restart: (
    <>
      <path d="M4 5v6h6" />
      <path d="M5.5 15.5A7.5 7.5 0 1 0 6 7" />
    </>
  ),
  rewind: (
    <>
      <path d="m11 6-6 6 6 6V6Z" />
      <path d="m19 6-6 6 6 6V6Z" />
    </>
  ),
  forward: (
    <>
      <path d="m13 6 6 6-6 6V6Z" />
      <path d="m5 6 6 6-6 6V6Z" />
    </>
  ),
  loop: (
    <>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M4 12V9.5A3.5 3.5 0 0 1 7.5 6h13" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M20 12v2.5a3.5 3.5 0 0 1-3.5 3.5h-13" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  'chevron-down': (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  'chevron-right': (
    <>
      <path d="m9 6 6 6-6 6" />
    </>
  ),
  beam: (
    <>
      <path d="M12 2v5" />
      <path d="m12 7 7 13H5L12 7Z" />
      <path d="M9 13h6" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
