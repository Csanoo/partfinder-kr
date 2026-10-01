import type { ManufacturerFacts } from "@/lib/manufacturer/types";

export type ProposalField = "lifecycle" | "package" | "datasheetUrl" | "specs";

export interface Proposal {
  field: ProposalField;
  label: string;
  current: string;
  proposed: string;
  /** 현재 값과 다른지 (같으면 기본 체크 해제) */
  changed: boolean;
}

export interface CurrentPartFacts {
  lifecycleStatus: string;
  lifecycleCheckedAt: Date | null;
  package: string | null;
  datasheetUrl: string | null;
  keySpecs: { label: string; value: string }[];
}

const LC: Record<string, string> = { active: "양산", nrnd: "NRND", ltb: "LTB", eol: "단종(EOL)", unknown: "미확인" };

/** 제조사 정보 → 현재 값과 비교한 제안 목록 (값이 없는 항목은 제안하지 않음) */
export function buildProposals(current: CurrentPartFacts, facts: ManufacturerFacts): Proposal[] {
  const out: Proposal[] = [];
  if (facts.lifecycle !== "unknown") {
    out.push({
      field: "lifecycle",
      label: "수명주기 (확인일·출처 함께 갱신)",
      current: `${LC[current.lifecycleStatus] ?? current.lifecycleStatus}${current.lifecycleCheckedAt ? ` · ${current.lifecycleCheckedAt.toISOString().slice(0, 10)}` : ""}`,
      proposed: `${LC[facts.lifecycle]} (${facts.lifecycleRaw}) · ${facts.fetchedAt.slice(0, 10)}`,
      // 상태가 같아도 확인일 갱신 가치가 있으므로 항상 제안
      changed: true,
    });
  }
  if (facts.package) {
    out.push({
      field: "package",
      label: "패키지",
      current: current.package ?? "",
      proposed: facts.package,
      changed: (current.package ?? "") !== facts.package,
    });
  }
  if (facts.datasheetUrl) {
    out.push({
      field: "datasheetUrl",
      label: "데이터시트",
      current: current.datasheetUrl ?? "",
      proposed: facts.datasheetUrl,
      changed: (current.datasheetUrl ?? "") !== facts.datasheetUrl,
    });
  }
  const newSpecs = mergeSpecs(current.keySpecs, facts.specs);
  if (newSpecs.length > current.keySpecs.length) {
    out.push({
      field: "specs",
      label: "주요 스펙 (없는 항목만 추가)",
      current: current.keySpecs.map((s) => `${s.label}: ${s.value}`).join(", "),
      proposed: newSpecs.map((s) => `${s.label}: ${s.value}`).join(", "),
      changed: true,
    });
  }
  return out;
}

/** 기존 스펙은 유지하고, 같은 라벨이 없는 항목만 덧붙인다 (관리자 입력을 덮어쓰지 않음) */
export function mergeSpecs(current: { label: string; value: string }[], incoming: { label: string; value: string }[]) {
  const labels = new Set(current.map((s) => s.label.trim()));
  return [...current, ...incoming.filter((s) => !labels.has(s.label.trim()))];
}
