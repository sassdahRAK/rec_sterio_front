/** Line icons used by the dataset portal. 1.7px strokes, currentColor. */
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="M13.2 6.6 17.4 10.8" stroke="currentColor" strokeWidth="1.7" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M4 7h16M9 7V5h6v2M6.5 7l.8 12h9.4l.8-12"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" />
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.4 3.5 8.5S14.4 18.1 12 20.5C9.6 18.1 8.5 15.1 8.5 12S9.6 5.9 12 3.5Z"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </Svg>
);

export const FolderIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-10Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="17.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="6.5" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="17.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="m8.7 10.8 6.6-3.8M8.7 13.2l6.6 3.8" stroke="currentColor" strokeWidth="1.7" />
  </Svg>
);

export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M10 14a4.5 4.5 0 0 0 6.4 0l2.2-2.2a4.5 4.5 0 1 0-6.4-6.4L11 6.6M14 10a4.5 4.5 0 0 0-6.4 0l-2.2 2.2a4.5 4.5 0 1 0 6.4 6.4L13 17.4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </Svg>
);

export const KeyIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="m11 12 8-8m-2.5 2.5 2.5 2.5M14 9l2 2"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M12 4v11m0 0 4-4m-4 4-4-4M4.5 19.5h15"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M20 14.2A8 8 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M12 2.5v2M12 19.5v2M4.7 4.7l1.4 1.4M17.9 17.9l1.4 1.4M2.5 12h2M19.5 12h2M4.7 19.3l1.4-1.4M17.9 6.1l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.7" />
    <path d="m15 15 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </Svg>
);

export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M12 16V5m0 0L8 9m4-4 4 4M4.5 19.5h15"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <path
      d="M15.5 5.6a3.2 3.2 0 0 1 0 5.9M17 14.4c2 .6 3.2 2.2 3.5 4.6"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </Svg>
);

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" stroke="currentColor" strokeWidth="1.7" />
  </Svg>
);

export const SpeakerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M4 9.5v5h3l4 3.5v-12L7 9.5H4Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="M14.5 9a4.2 4.2 0 0 1 0 6M17 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </Svg>
);

export const ArrowUpRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="18" cy="12" r="1.6" fill="currentColor" />
  </Svg>
);

export const MusicIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M9 18V6l10-2v12"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="6.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="16.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.7" />
  </Svg>
);
