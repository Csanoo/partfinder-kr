import { site } from "@/lib/site";

/** 심볼: 남색 사각형 + MS. 파비콘(src/app/icon.svg)과 같은 디자인. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="10" fill="#1c3866" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="28"
        fontWeight="700"
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
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight">{site.name}</span>
      <span className="sr-only">({site.legalName})</span>
    </span>
  );
}
