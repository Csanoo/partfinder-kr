import { site } from "@/lib/site";

/** 칩 모양 심볼. 파비콘(src/app/icon.svg)과 같은 디자인. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ms-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <g stroke="#0f766e" strokeWidth="3" strokeLinecap="round">
        <path d="M22 4v6M32 4v6M42 4v6M22 54v6M32 54v6M42 54v6M4 22h6M4 32h6M4 42h6M54 22h6M54 32h6M54 42h6" />
      </g>
      <rect x="10" y="10" width="44" height="44" rx="10" fill="url(#ms-logo-grad)" />
      <circle cx="18" cy="18" r="2.5" fill="#ffffff" opacity="0.7" />
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
      <LogoMark size={32} />
      <span className="text-xl font-extrabold tracking-tight">
        <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">MS</span>
        <span>전자</span>
      </span>
      <span className="sr-only">({site.legalName})</span>
    </span>
  );
}
