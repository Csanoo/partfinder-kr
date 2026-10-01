import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePartRoute, type PartRouteHit, type PartRouteRepo, type PageStatus } from "@/lib/parts/resolve-route";
import { allocateSlug, mpnKey, slugifyMpn, slugifyName, slugKey } from "@/lib/parts/slug";

interface Fixture {
  mpn: string;
  slug: string;
  key: string;
  note: string;
}

const fixtures: Fixture[] = JSON.parse(readFileSync(join(process.cwd(), "fixtures/mpn/special-mpns.json"), "utf8"));

/** 테스트용 인메모리 저장소: 실제 DB(part / part_slug / part_variant)와 같은 규칙으로 동작한다. */
class MemoryParts implements PartRouteRepo {
  manufacturers = new Map<string, { id: string; slug: string }>();
  parts = new Map<string, { mpnDisplay: string; mpnKey: string; manufacturerId: string; status: PageStatus; slug: string }>();
  slugs: { manufacturerId: string; slug: string; key: string; partId: string }[] = [];
  variants: { manufacturerId: string; key: string; partId: string }[] = [];
  private seq = 0;

  addManufacturer(slug: string) {
    const m = { id: `m${++this.seq}`, slug };
    this.manufacturers.set(slug, m);
    return m;
  }

  /** 부품 등록: mpnKey 중복이면 거부, slug는 충돌 시 _2.. 할당 */
  addPart(manufacturerId: string, mpnDisplay: string, status: PageStatus = "published") {
    const key = mpnKey(mpnDisplay);
    for (const p of this.parts.values()) {
      if (p.manufacturerId === manufacturerId && p.mpnKey === key) throw new Error(`duplicate mpnKey ${key}`);
    }
    const taken = new Set(this.slugs.filter((s) => s.manufacturerId === manufacturerId).map((s) => s.key));
    const slug = allocateSlug(mpnDisplay, taken);
    const id = `p${++this.seq}`;
    this.parts.set(id, { mpnDisplay, mpnKey: key, manufacturerId, status, slug });
    this.slugs.push({ manufacturerId, slug, key: slugKey(slug), partId: id });
    return id;
  }

  /** 품번 표기 수정: 새 slug를 정규로, 과거 slug는 리다이렉트용으로 남긴다 */
  renamePart(id: string, mpnDisplay: string) {
    const p = this.parts.get(id)!;
    const taken = new Set(this.slugs.filter((s) => s.manufacturerId === p.manufacturerId && s.partId !== id).map((s) => s.key));
    const slug = allocateSlug(mpnDisplay, taken);
    Object.assign(p, { mpnDisplay, mpnKey: mpnKey(mpnDisplay), slug });
    if (!this.slugs.some((s) => s.partId === id && s.slug === slug)) {
      this.slugs.push({ manufacturerId: p.manufacturerId, slug, key: slugKey(slug), partId: id });
    }
  }

  addVariant(partId: string, mpnVariant: string) {
    const p = this.parts.get(partId)!;
    this.variants.push({ manufacturerId: p.manufacturerId, key: slugKey(slugifyMpn(mpnVariant)), partId });
  }

  private hit(partId: string): PartRouteHit {
    const p = this.parts.get(partId)!;
    return { partId, pageStatus: p.status, canonicalSlug: p.slug };
  }
  async findManufacturerBySlug(slug: string) {
    return this.manufacturers.get(slug) ?? null;
  }
  async findPartBySlugKey(manufacturerId: string, key: string) {
    const s = this.slugs.find((x) => x.manufacturerId === manufacturerId && x.key === key);
    return s ? this.hit(s.partId) : null;
  }
  async findPartByVariantSlugKey(manufacturerId: string, key: string) {
    const v = this.variants.find((x) => x.manufacturerId === manufacturerId && x.key === key);
    return v ? this.hit(v.partId) : null;
  }
}

describe("특수문자 품번 fixture 20종", () => {
  it("fixture가 20종이다", () => {
    expect(fixtures).toHaveLength(20);
  });

  it.each(fixtures.map((f) => [f.mpn, f]))("%s: slug·mpnKey 규칙", (_mpn, f) => {
    const slug = slugifyMpn(f.mpn);
    expect(slug).toBe(f.slug);
    expect(mpnKey(f.mpn)).toBe(f.key);
    // URL 인코딩이 필요 없는 문자만 쓴다
    expect(encodeURIComponent(slug)).toBe(slug);
    expect(slug).toMatch(/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/);
  });

  it("20종을 한 제조사에 등록하면 slug가 모두 다르고, slug로 다시 찾으면 원래 품번이 나온다 (왕복)", async () => {
    const repo = new MemoryParts();
    const m = repo.addManufacturer("test-mfr");
    const ids = fixtures.map((f) => repo.addPart(m.id, f.mpn));
    const slugs = ids.map((id) => repo.parts.get(id)!.slug);
    expect(new Set(slugs).size).toBe(20);
    expect(new Set(slugs.map(slugKey)).size).toBe(20);

    for (const [i, id] of ids.entries()) {
      const r = await resolvePartRoute("test-mfr", slugs[i], repo);
      expect(r).toEqual({ kind: "ok", partId: id });
      expect(repo.parts.get(id)!.mpnDisplay).toBe(fixtures[i].mpn); // 원본 표기 보존
    }
  });

  it("대소문자·하이픈만 다른 URL은 정규 URL로 301", async () => {
    const repo = new MemoryParts();
    const m = repo.addManufacturer("ti");
    repo.addPart(m.id, "LM358-N/NOPB");
    for (const variant of ["LM358-N_NOPB", "lm358n_nopb", "lm358--n_nopb", "LM358N_NOPB"]) {
      expect(await resolvePartRoute("ti", variant, repo)).toEqual({ kind: "redirect", location: "/parts/ti/lm358-n_nopb" });
    }
    expect(await resolvePartRoute("TI", "lm358-n_nopb", repo)).toEqual({ kind: "redirect", location: "/parts/ti/lm358-n_nopb" });
    // 비예약 문자의 퍼센트 인코딩(%2D = -)은 RFC 3986상 같은 URL이므로 그대로 정상 응답
    expect((await resolvePartRoute("ti", "lm358%2Dn_nopb", repo)).kind).toBe("ok");
  });
});

describe("slug 충돌", () => {
  it("다른 품번인데 기본 slug가 같으면 _2를 붙인다 (예: / 와 #)", async () => {
    const repo = new MemoryParts();
    const m = repo.addManufacturer("x");
    const a = repo.addPart(m.id, "ABC/1");
    const b = repo.addPart(m.id, "ABC#1");
    const c = repo.addPart(m.id, "ABC,1");
    expect([a, b, c].map((id) => repo.parts.get(id)!.slug)).toEqual(["abc_1", "abc_1_2", "abc_1_3"]);
    expect(await resolvePartRoute("x", "abc_1_2", repo)).toEqual({ kind: "ok", partId: b });
  });

  it("slugKey가 같아지는 경우도 충돌로 본다 (하이픈만 다른 slug)", () => {
    const taken = new Set([slugKey("ab-c")]);
    expect(allocateSlug("ABC", taken)).toBe("abc_2");
  });

  it("하이픈만 다른 품번은 mpnKey가 같아 같은 부품으로 보고 중복 등록을 막는다", () => {
    const repo = new MemoryParts();
    const m = repo.addManufacturer("ti");
    repo.addPart(m.id, "LM358-N/NOPB");
    expect(() => repo.addPart(m.id, "LM358N/NOPB")).toThrow(/duplicate mpnKey/);
  });

  it("제조사가 다르면 같은 slug를 쓸 수 있다", async () => {
    const repo = new MemoryParts();
    const ti = repo.addManufacturer("ti");
    const st = repo.addManufacturer("st");
    const a = repo.addPart(ti.id, "LM358");
    const b = repo.addPart(st.id, "LM358");
    expect(await resolvePartRoute("ti", "lm358", repo)).toEqual({ kind: "ok", partId: a });
    expect(await resolvePartRoute("st", "lm358", repo)).toEqual({ kind: "ok", partId: b });
  });

  it("MAX232CPE+ 와 MAX232CPE 는 서로 다른 URL", () => {
    expect(slugifyMpn("MAX232CPE+")).not.toBe(slugifyMpn("MAX232CPE"));
  });
});

describe("리다이렉트·410", () => {
  async function setup(status: PageStatus = "published") {
    const repo = new MemoryParts();
    const m = repo.addManufacturer("analog-devices");
    const id = repo.addPart(m.id, "AD8221ARZ", status);
    return { repo, id };
  }

  it("변형 품번(릴 접미사) URL은 기준 부품으로 301", async () => {
    const { repo, id } = await setup();
    repo.addVariant(id, "AD8221ARZ-R7");
    expect(await resolvePartRoute("analog-devices", "ad8221arz-r7", repo)).toEqual({
      kind: "redirect",
      location: "/parts/analog-devices/ad8221arz",
    });
  });

  it("품번 표기를 고치면 과거 slug는 새 slug로 301", async () => {
    const { repo, id } = await setup();
    repo.renamePart(id, "AD8221ARZ-RL");
    expect(await resolvePartRoute("analog-devices", "ad8221arz", repo)).toEqual({
      kind: "redirect",
      location: "/parts/analog-devices/ad8221arz-rl",
    });
    expect(await resolvePartRoute("analog-devices", "ad8221arz-rl", repo)).toEqual({ kind: "ok", partId: id });
  });

  it("비게시(unpublished)는 410", async () => {
    const { repo } = await setup("unpublished");
    expect(await resolvePartRoute("analog-devices", "ad8221arz", repo)).toEqual({ kind: "gone" });
  });

  it.each(["draft", "review"] as const)("게시 전(%s)은 404", async (status) => {
    const { repo } = await setup(status);
    expect(await resolvePartRoute("analog-devices", "ad8221arz", repo)).toEqual({ kind: "not_found" });
  });

  it("없는 제조사·품번은 404", async () => {
    const { repo } = await setup();
    expect(await resolvePartRoute("nope", "ad8221arz", repo)).toEqual({ kind: "not_found" });
    expect(await resolvePartRoute("analog-devices", "nope", repo)).toEqual({ kind: "not_found" });
    expect(await resolvePartRoute("analog-devices", "", repo)).toEqual({ kind: "not_found" });
  });

  it("잘못된 퍼센트 인코딩도 예외 없이 처리", async () => {
    const { repo } = await setup();
    expect(await resolvePartRoute("analog-devices", "%E0%A4%A", repo)).toEqual({ kind: "not_found" });
  });
});

describe("slugifyName", () => {
  it.each([
    ["Texas Instruments", "texas-instruments"],
    ["STMicroelectronics", "stmicroelectronics"],
    ["Analog Devices, Inc.", "analog-devices-inc"],
    ["Würth Elektronik", "wurth-elektronik"],
    ["AT&T", "at-and-t"],
    ["삼성전기", "unknown"],
  ])("%s → %s", (name, slug) => {
    expect(slugifyName(name)).toBe(slug);
  });
});
