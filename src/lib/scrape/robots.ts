/**
 * robots.txt 파서 (RFC 9309 기준).
 * - User-agent 그룹 매칭: 우리 UA 토큰과 일치하는 그룹이 있으면 그 그룹, 없으면 `*` 그룹
 * - Allow/Disallow 중 가장 긴(구체적인) 규칙 우선, 길이가 같으면 Allow 우선
 * - `*` 와일드카드, `$` 끝 고정 지원
 */

interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

export interface RobotsRules {
  isAllowed(pathWithQuery: string): boolean;
}

export function parseRobots(text: string, userAgentToken: string): RobotsRules {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (m == null) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();

    if (key === "user-agent") {
      // 연속된 User-agent 줄은 같은 그룹으로 묶는다.
      if (current == null || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current == null) continue;
    if ((key === "allow" || key === "disallow") && value !== "") {
      current.rules.push({ allow: key === "allow", pattern: value, regex: toRegex(value) });
    }
  }

  const token = userAgentToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const selected = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = selected.flatMap((g) => g.rules);

  return {
    isAllowed(pathWithQuery: string): boolean {
      let best: Rule | null = null;
      for (const r of rules) {
        if (!r.regex.test(pathWithQuery)) continue;
        if (
          best == null ||
          r.pattern.length > best.pattern.length ||
          (r.pattern.length === best.pattern.length && r.allow && !best.allow)
        ) {
          best = r;
        }
      }
      return best == null || best.allow;
    },
  };
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** 모두 허용 (robots.txt가 404 등 4xx일 때). */
export const ALLOW_ALL: RobotsRules = { isAllowed: () => true };
/** 모두 금지 (robots.txt를 확인할 수 없을 때, 보수적으로). */
export const DISALLOW_ALL: RobotsRules = { isAllowed: () => false };
