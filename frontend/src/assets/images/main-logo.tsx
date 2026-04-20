import type { SVGProps } from 'react';

export function MainLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="1024"
      height="1024"
      viewBox="0 0 140 140"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="10"
        y="10"
        width="120"
        height="120"
        rx="16"
        stroke="var(--primary)"
        strokeWidth="10"
        fill="none"
        opacity="0.9"
      />
      <rect
        x="25"
        y="25"
        width="90"
        height="90"
        rx="8"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeOpacity="0.8"
        fill="none"
      />
      <path
        d="m50 45 25 25-25 25"
        stroke="var(--primary)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ fill: 'none', filter: 'saturate(2) brightness(1.1)' }}
      />
      <path
        stroke="var(--primary)"
        strokeWidth="12"
        strokeLinecap="round"
        style={{ fill: 'none', filter: 'saturate(2) brightness(1.1)' }}
        d="M80 95h10"
      />
      <circle cx="105" cy="70" r="6" fill="var(--primary)" opacity="0.8" />
      <rect x="30" y="130" width="25" height="10" rx="2" fill="var(--primary)" />
      <rect x="85" y="130" width="25" height="10" rx="2" fill="var(--primary)" />
    </svg>
  );
}
