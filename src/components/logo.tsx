import { site } from "@/lib/site";

/** 칩 모양 심볼: 청록 솔더마스크 몸체 + 구리 핀. 파비콘(src/app/icon.svg)과 같은 디자인. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ms-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b85a8" />
          <stop offset="1" stopColor="#0b3343" />
        </linearGradient>
      </defs>
      <g stroke="#c4692b" strokeWidth="3.5" strokeLinecap="round">
        <path d="M22 3v7M32 3v7M42 3v7M22 54v7M32 54v7M42 54v7M3 22h7M3 32h7M3 42h7M54 22h7M54 32h7M54 42h7" />
      </g>
      <rect x="10" y="10" width="44" height="44" rx="9" fill="url(#ms-logo-grad)" />
      <circle cx="18" cy="18" r="2.5" fill="#d98244" />
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="22"
        fontWeight="800"
        fill="#ffffff"
        letterSpacing="-1"
      >
        MS
      </text>
    </svg>
  );
}

/** 헤더용 로고: 심볼 + 워드마크. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={30} />
      <span className="text-lg font-bold tracking-tight">
        <span className="text-brand-600 dark:text-brand-300">MS</span>
        <span>전자</span>
      </span>
      <span className="sr-only">({site.legalName})</span>
    </span>
  );
}
