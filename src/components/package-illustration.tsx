import type { ReactNode } from "react";
import type { PackageInfo } from "@/lib/package/parse-package";

/**
 * 패키지 일러스트 (직접 그린 SVG, 위에서 본 모양).
 * 실제 제품 사진이 아니라 패키지 형태를 나타내는 그림이다.
 */

const BODY = "#2f343c";
const BODY_EDGE = "#1f2329";
const HILITE = "#ffffff";
const METAL = "#c9ced6";
const METAL_EDGE = "#8f97a3";
const MARK = "#7b8494";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Body({ x, y, w, h, r = 3 }: { x: number; y: number; w: number; h: number; r?: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={BODY} stroke={BODY_EDGE} strokeWidth={1} />
      {/* 윗면 하이라이트 */}
      <rect x={x + 2} y={y + 2} width={w - 4} height={Math.max(2, h * 0.28)} rx={r} fill={HILITE} opacity={0.07} />
    </>
  );
}

function Metal({ x, y, w, h, r = 0.8 }: { x: number; y: number; w: number; h: number; r?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={METAL} stroke={METAL_EDGE} strokeWidth={0.6} />;
}

/** 길이 span 안에 count개를 균등 배치한 중심 좌표 */
function spread(start: number, span: number, count: number): number[] {
  const step = span / count;
  return Array.from({ length: count }, (_, i) => start + step * (i + 0.5));
}

function dual(pins: number, thin: boolean): ReactNode {
  const perSide = Math.max(1, Math.round(pins / 2));
  const drawn = Math.min(perSide, 14);
  const w = clamp(drawn * 8 + 8, 40, 100);
  const h = thin ? 28 : 36;
  const x = 60 - w / 2;
  const y = 60 - h / 2;
  const pinW = clamp((w / drawn) * 0.5, 2, 5);
  const xs = spread(x + 2, w - 4, drawn);
  return (
    <>
      {xs.map((cx) => (
        <g key={cx}>
          <Metal x={cx - pinW / 2} y={y - 11} w={pinW} h={12} />
          <Metal x={cx - pinW / 2} y={y + h - 1} w={pinW} h={12} />
        </g>
      ))}
      <Body x={x} y={y} w={w} h={h} />
      <circle cx={x + 6} cy={y + h - 6} r={2.4} fill={MARK} />
    </>
  );
}

function dip(pins: number): ReactNode {
  const perSide = Math.max(1, Math.round(pins / 2));
  const drawn = Math.min(perSide, 14);
  const w = clamp(drawn * 8 + 8, 44, 104);
  const h = 40;
  const x = 60 - w / 2;
  const y = 60 - h / 2;
  const xs = spread(x + 2, w - 4, drawn);
  return (
    <>
      {xs.map((cx) => (
        <g key={cx}>
          <Metal x={cx - 1.6} y={y - 15} w={3.2} h={16} r={0.5} />
          <Metal x={cx - 2.6} y={y - 5} w={5.2} h={6} r={0.5} />
          <Metal x={cx - 1.6} y={y + h - 1} w={3.2} h={16} r={0.5} />
          <Metal x={cx - 2.6} y={y + h - 1} w={5.2} h={6} r={0.5} />
        </g>
      ))}
      <Body x={x} y={y} w={w} h={h} r={2} />
      {/* 1번 핀 쪽 홈 */}
      <path d={`M ${x} ${60 - 5} A 5 5 0 0 1 ${x} ${60 + 5}`} fill={BODY_EDGE} stroke={MARK} strokeWidth={0.8} />
      <circle cx={x + 7} cy={y + h - 7} r={2.2} fill={MARK} />
    </>
  );
}

function quad(pins: number): ReactNode {
  const perSide = Math.max(1, Math.round(pins / 4));
  const drawn = Math.min(perSide, 16);
  const s = clamp(drawn * 4.5 + 18, 50, 78);
  const o = 60 - s / 2;
  const pinW = clamp((s / drawn) * 0.45, 1.4, 4);
  const pos = spread(o + 4, s - 8, drawn);
  return (
    <>
      {pos.map((p) => (
        <g key={p}>
          <Metal x={p - pinW / 2} y={o - 10} w={pinW} h={11} r={0.4} />
          <Metal x={p - pinW / 2} y={o + s - 1} w={pinW} h={11} r={0.4} />
          <Metal x={o - 10} y={p - pinW / 2} w={11} h={pinW} r={0.4} />
          <Metal x={o + s - 1} y={p - pinW / 2} w={11} h={pinW} r={0.4} />
        </g>
      ))}
      <Body x={o} y={o} w={s} h={s} r={2.5} />
      <circle cx={o + 7} cy={o + 7} r={2.6} fill={MARK} />
    </>
  );
}

function qfn(pins: number, twoSided: boolean): ReactNode {
  const s = twoSided ? 50 : 62;
  const o = 60 - s / 2;
  const sides = twoSided ? 2 : 4;
  const perSide = Math.max(1, Math.round(pins / sides));
  const drawn = Math.min(perSide, 12);
  const padW = clamp((s / drawn) * 0.45, 1.6, 5);
  const pos = spread(o + 5, s - 10, drawn);
  return (
    <>
      <Body x={o} y={o} w={s} h={s} r={4} />
      {pos.map((p) => (
        <g key={p}>
          {twoSided ? (
            <>
              <Metal x={o - 1} y={p - padW / 2} w={6} h={padW} r={0.4} />
              <Metal x={o + s - 5} y={p - padW / 2} w={6} h={padW} r={0.4} />
            </>
          ) : (
            <>
              <Metal x={p - padW / 2} y={o - 1} w={padW} h={6} r={0.4} />
              <Metal x={p - padW / 2} y={o + s - 5} w={padW} h={6} r={0.4} />
              <Metal x={o - 1} y={p - padW / 2} w={6} h={padW} r={0.4} />
              <Metal x={o + s - 5} y={p - padW / 2} w={6} h={padW} r={0.4} />
            </>
          )}
        </g>
      ))}
      <circle cx={o + 11} cy={o + 11} r={2.4} fill={MARK} />
    </>
  );
}

function sot23(pins: number): ReactNode {
  const bottom = pins >= 5 ? 3 : 2;
  const top = pins - bottom;
  const w = 40;
  const h = 22;
  const x = 60 - w / 2;
  const y = 60 - h / 2;
  return (
    <>
      {spread(x + 2, w - 4, bottom).map((cx) => (
        <Metal key={`b${cx}`} x={cx - 3} y={y + h - 1} w={6} h={11} />
      ))}
      {(top === 1 ? [60] : spread(x + 2, w - 4, top === 2 ? 3 : top).filter((_, i) => top !== 2 || i !== 1)).map(
        (cx) => (
          <Metal key={`t${cx}`} x={cx - 3} y={y - 10} w={6} h={11} />
        ),
      )}
      <Body x={x} y={y} w={w} h={h} r={2} />
      <circle cx={x + 5} cy={y + h - 5} r={1.8} fill={MARK} />
    </>
  );
}

function sot223(): ReactNode {
  const w = 60;
  const h = 36;
  const x = 60 - w / 2;
  const y = 54 - h / 2;
  return (
    <>
      <Metal x={60 - 17} y={y - 14} w={34} h={15} r={1} />
      {spread(x + 4, w - 8, 3).map((cx) => (
        <Metal key={cx} x={cx - 3.5} y={y + h - 1} w={7} h={14} />
      ))}
      <Body x={x} y={y} w={w} h={h} r={2} />
      <circle cx={x + 7} cy={y + h - 7} r={2.2} fill={MARK} />
    </>
  );
}

function to220(): ReactNode {
  return (
    <>
      <Metal x={34} y={8} w={52} h={40} r={2} />
      <circle cx={60} cy={24} r={7} fill={METAL_EDGE} />
      <circle cx={60} cy={24} r={5} fill={BODY_EDGE} />
      {[46, 60, 74].map((cx) => (
        <Metal key={cx} x={cx - 2.5} y={76} w={5} h={38} r={0.6} />
      ))}
      <Body x={34} y={40} w={52} h={38} r={2} />
    </>
  );
}

function to92(): ReactNode {
  return (
    <>
      {[48, 60, 72].map((cx) => (
        <Metal key={cx} x={cx - 1.8} y={72} w={3.6} h={40} r={0.5} />
      ))}
      <path d="M 34 74 L 34 46 A 26 26 0 0 1 86 46 L 86 74 Z" fill={BODY} stroke={BODY_EDGE} strokeWidth={1} />
      <path d="M 38 50 A 22 22 0 0 1 82 50" fill="none" stroke={HILITE} strokeOpacity={0.08} strokeWidth={6} />
    </>
  );
}

function bga(pins: number): ReactNode {
  const s = 78;
  const o = 60 - s / 2;
  const grid = clamp(Math.round(Math.sqrt(pins)), 3, 10);
  const pos = spread(o + 4, s - 8, grid);
  const r = clamp(((s - 8) / grid) * 0.3, 1.4, 4.5);
  return (
    <>
      <Body x={o} y={o} w={s} h={s} r={3} />
      {pos.flatMap((cy) =>
        pos.map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={METAL} stroke={METAL_EDGE} strokeWidth={0.5} />),
      )}
      {/* A1 표시 */}
      <path d={`M ${o} ${o + 12} L ${o} ${o + 3} Q ${o} ${o} ${o + 3} ${o} L ${o + 12} ${o} Z`} fill={MARK} />
    </>
  );
}

function chip(): ReactNode {
  const w = 72;
  const h = 36;
  const x = 60 - w / 2;
  const y = 60 - h / 2;
  return (
    <>
      <Body x={x + 12} y={y} w={w - 24} h={h} r={1.5} />
      <Metal x={x} y={y} w={14} h={h} r={2} />
      <Metal x={x + w - 14} y={y} w={14} h={h} r={2} />
    </>
  );
}

function unknown(): ReactNode {
  return (
    <>
      {dual(8, false)}
      <text x={60} y={66} textAnchor="middle" fontSize={18} fontWeight={700} fill={MARK}>
        ?
      </text>
    </>
  );
}

function draw(info: PackageInfo): ReactNode {
  const pins = info.pins ?? 8;
  switch (info.family) {
    case "dual":
      return dual(pins, /^(TSSOP|MSOP|VSSOP|SSOP)/.test(info.label));
    case "dip":
      return dip(pins);
    case "quad":
      return quad(pins);
    case "qfn":
      return qfn(pins, /DFN/.test(info.label));
    case "sot23":
      return sot23(pins);
    case "sot223":
      return sot223();
    case "to220":
      return to220();
    case "to92":
      return to92();
    case "bga":
      return bga(pins);
    case "chip":
      return chip();
    default:
      return unknown();
  }
}

export function PackageIllustration({ info, size = 120 }: { info: PackageInfo; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${info.label} 패키지 일러스트`}
      className="shrink-0"
    >
      <title>{`${info.label} 패키지 (일러스트)`}</title>
      {draw(info)}
    </svg>
  );
}

/** 일러스트 + 패키지명 캡션 */
export function PackageFigure({ info, size = 120 }: { info: PackageInfo; size?: number }) {
  return (
    <figure className="inline-flex flex-col items-center gap-1 rounded-md border border-line bg-surface p-3">
      <PackageIllustration info={info} size={size} />
      <figcaption className="mpn text-xs text-muted">
        {info.label}
        {info.family !== "unknown" && <span className="sr-only"> (실제 제품 사진 아님)</span>}
      </figcaption>
    </figure>
  );
}
