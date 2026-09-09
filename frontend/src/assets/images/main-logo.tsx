import type { SVGProps } from 'react';

/**
 * The Cmdex mark as a standalone SVG (brand-gradient rounded square with the
 * terminal-prompt glyph), for places that need an image rather than the
 * CSS-driven `BrandMark` component — e.g. the About dialog. Mirrors
 * `assets/logo.svg` and `build/appicon.png`.
 */
export function MainLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="cmdex-brand-gradient" x1="0" y1="0" x2="140" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand, #a78bfa)" />
          <stop offset="1" stopColor="var(--brand-2, #5b9dff)" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="124" height="124" rx="30" fill="url(#cmdex-brand-gradient)" />
      <g stroke="#fdfdff" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <polyline points="46 92 68 70 46 48" />
        <line x1="74" y1="100" x2="100" y2="100" />
      </g>
    </svg>
  );
}
