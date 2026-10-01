/** 패키지 계열. 일러스트 모양을 결정한다. */
export type PackageFamily =
  | "dual" // SOIC, SOP, TSSOP, SSOP, MSOP (양쪽 갈매기 날개 핀)
  | "dip" // DIP, PDIP (스루홀 양쪽 핀)
  | "quad" // QFP, LQFP, TQFP (4면 핀)
  | "qfn" // QFN, DFN (리드리스 패드)
  | "sot23" // SOT-23, SOT-23-5/6
  | "sot223" // SOT-223 (탭 포함)
  | "to220" // TO-220 (방열 탭 + 긴 리드)
  | "to92" // TO-92 (반원형)
  | "bga" // BGA (볼 그리드)
  | "chip" // 0402/0603 등 칩 수동소자
  | "unknown";

export interface PackageInfo {
  family: PackageFamily;
  /** 핀 수 (알 수 없으면 null) */
  pins: number | null;
  /** 표시용 이름 (예: "LQFP-48") */
  label: string;
}

interface Rule {
  re: RegExp;
  family: PackageFamily;
  /** 정규식 매치에서 라벨과 핀 수 만들기 */
  build: (m: RegExpMatchArray) => { label: string; pins: number | null };
}

const n = (s: string | undefined) => (s ? Number(s) : null);

// 순서 중요: 더 구체적인 패턴을 먼저 둔다 (SOT-223 > SOT-23, TSSOP > SOP).
const RULES: Rule[] = [
  { re: /\bSOT-?223\b/i, family: "sot223", build: () => ({ label: "SOT-223", pins: 4 }) },
  {
    re: /\bSOT-?23(?:-(\d))?\b/i,
    family: "sot23",
    build: (m) => ({ label: m[1] ? `SOT-23-${m[1]}` : "SOT-23", pins: n(m[1]) ?? 3 }),
  },
  { re: /\bTO-?220\w*\b/i, family: "to220", build: () => ({ label: "TO-220", pins: 3 }) },
  { re: /\bTO-?92\b/i, family: "to92", build: () => ({ label: "TO-92", pins: 3 }) },
  {
    re: /\b((?:L|T|V|P)?QFP)-?(\d+)\b/i,
    family: "quad",
    build: (m) => ({ label: `${m[1].toUpperCase()}-${m[2]}`, pins: n(m[2]) }),
  },
  {
    re: /\b((?:V|W|U|X)?(?:QFN|DFN))-?(\d+)\b/i,
    family: "qfn",
    build: (m) => ({ label: `${m[1].toUpperCase()}-${m[2]}`, pins: n(m[2]) }),
  },
  {
    re: /\b((?:F|LF|TF|UF)?BGA)-?(\d+)\b/i,
    family: "bga",
    build: (m) => ({ label: `${m[1].toUpperCase()}-${m[2]}`, pins: n(m[2]) }),
  },
  {
    re: /\b(TSSOP|SSOP|MSOP|VSSOP|SOIC|SOP|SO)-?(\d+)\b/i,
    family: "dual",
    build: (m) => ({ label: `${m[1].toUpperCase()}-${m[2]}`, pins: n(m[2]) }),
  },
  {
    re: /\b(PDIP|DIP)-?(\d+)\b/i,
    family: "dip",
    build: (m) => ({ label: `${m[1].toUpperCase()}-${m[2]}`, pins: n(m[2]) }),
  },
  {
    re: /\b(01005|0201|0402|0603|0805|1206|1210|2512)\b/,
    family: "chip",
    build: (m) => ({ label: m[1], pins: 2 }),
  },
];

/** 설명·패키지 문자열에서 패키지를 추정한다. 못 찾으면 unknown. */
export function parsePackage(text: string | null | undefined): PackageInfo {
  if (text) {
    for (const rule of RULES) {
      const m = text.match(rule.re);
      if (m) return { family: rule.family, ...rule.build(m) };
    }
  }
  return { family: "unknown", pins: null, label: "패키지 미상" };
}
