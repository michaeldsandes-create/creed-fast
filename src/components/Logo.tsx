import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
  animated?: boolean;
  tagline?: boolean;
}

let uid = 0;

export function LogoMark({
  size = 64,
  className = '',
  glow = true,
  animated = false,
  tagline = true,
}: LogoProps) {
  const id = React.useMemo(() => `fc${++uid}`, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Fast Credit"
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x="2" y="2" width="124" height="124" rx="32" />
        </clipPath>
        <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#141A18" />
          <stop offset="55%" stopColor="#0A0E0D" />
          <stop offset="100%" stopColor="#000000" />
        </linearGradient>
        <linearGradient id={`${id}-green`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#12735A" />
          <stop offset="55%" stopColor="#0F5F4A" />
          <stop offset="100%" stopColor="#0A4436" />
        </linearGradient>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5CE6AC" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5CE6AC" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#10B981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#5CE6AC" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {glow && (
        <rect x="2" y="2" width="124" height="124" rx="32" fill="#10B981" opacity="0.25" filter={`url(#${id}-glow)`} />
      )}

      <g clipPath={`url(#${id}-clip)`}>
        <rect x="2" y="2" width="124" height="124" fill={`url(#${id}-dark)`} />
        <path d="M2 2 H100 C110 44 92 88 48 112 C30 122 14 128 2 128 Z" fill={`url(#${id}-green)`} />
        <path
          d="M100 2 C110 44 92 88 48 112 C30 122 14 128 2 128"
          stroke="#5CE6AC"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          fill="none"
        />
        <g stroke="#5CE6AC" strokeOpacity="0.07" strokeWidth="1">
          <path d="M2 40 H126 M2 76 H126 M40 2 V126 M84 2 V126" />
        </g>

        <rect x="18" y="14" width="38" height="38" rx="12" fill={`url(#${id}-tile)`} />
        <rect x="18" y="14" width="38" height="38" rx="12" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1" />
        <g stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M26 42 L34 34 L39 39 L48 27" />
          <path d="M41 26 H49 V34" />
        </g>

        <text x="18" y="80" fontFamily="Inter, Helvetica, Arial, sans-serif" fontSize="23" fontWeight="900" letterSpacing="0.5" fill="#FFFFFF">
          FAST
        </text>
        <text x="18" y="102" fontFamily="Inter, Helvetica, Arial, sans-serif" fontSize="23" fontWeight="900" letterSpacing="0.5" fill="#34D399">
          CREDIT
        </text>
        {tagline && (
          <text x="19" y="113" fontFamily="Inter, Helvetica, Arial, sans-serif" fontSize="6" fontWeight="700" letterSpacing="1.5" fill="#5CE6AC" fillOpacity="0.55">
            GESTÃO DE CRÉDITO
          </text>
        )}

        <rect x="2" y="2" width="124" height="124" fill={`url(#${id}-sheen)`} />
      </g>

      <rect x="2.75" y="2.75" width="122.5" height="122.5" rx="31.5" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="1.5">
        {animated && <animate attributeName="stroke-opacity" values="1;0.45;1" dur="3.2s" repeatCount="indefinite" />}
      </rect>
    </svg>
  );
}

export function Logo(props: LogoProps) {
  return <LogoMark {...props} />;
}

export default Logo;
