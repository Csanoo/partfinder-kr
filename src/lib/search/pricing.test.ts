import { describe, expect, it } from "vitest";
import { priceAtQty, sortOffersByPrice } from "@/lib/search/pricing";

const offer = {
  priceBreaks: [
    { minQty: 100, unitPrice: 3.1 },
    { minQty: 1, unitPrice: 4.2 },
    { minQty: 10, unitPrice: 3.8 },
  ],
  moq: 1,
};

describe("priceAtQty", () => {
  it("수량에 맞는 가격 구간을 적용한다", () => {
    expect(priceAtQty(offer, 1)).toEqual({ status: "ok", unitPrice: 4.2, total: 4.2 });
    expect(priceAtQty(offer, 9)).toEqual({ status: "ok", unitPrice: 4.2, total: 37.8 });
    expect(priceAtQty(offer, 10)).toEqual({ status: "ok", unitPrice: 3.8, total: 38 });
    expect(priceAtQty(offer, 250)).toEqual({ status: "ok", unitPrice: 3.1, total: 775 });
  });

  it("MOQ 미만이면 below_min", () => {
    expect(priceAtQty({ priceBreaks: [{ minQty: 1, unitPrice: 1 }], moq: 10 }, 5)).toEqual({
      status: "below_min",
      minQty: 10,
    });
  });

  it("첫 가격 구간보다 적으면 below_min", () => {
    expect(priceAtQty({ priceBreaks: [{ minQty: 10, unitPrice: 1 }], moq: null }, 3)).toEqual({
      status: "below_min",
      minQty: 10,
    });
  });

  it("가격 정보가 없으면 no_price", () => {
    expect(priceAtQty({ priceBreaks: [], moq: null }, 1)).toEqual({ status: "no_price" });
  });
});

describe("sortOffersByPrice", () => {
  const a = { id: "a", currency: "USD", moq: 1, priceBreaks: [{ minQty: 1, unitPrice: 4.2 }, { minQty: 100, unitPrice: 3.1 }] };
  const b = { id: "b", currency: "USD", moq: 1, priceBreaks: [{ minQty: 1, unitPrice: 4.05 }, { minQty: 250, unitPrice: 2.95 }] };
  const noPrice = { id: "n", currency: "USD", moq: null, priceBreaks: [] };

  it("수량이 없으면 최소 구간 단가 기준으로 정렬한다", () => {
    expect(sortOffersByPrice([a, b], null).map((o) => o.id)).toEqual(["b", "a"]);
  });

  it("수량이 있으면 해당 수량 기준 단가로 정렬한다", () => {
    // 100개: a=3.1, b=4.05
    expect(sortOffersByPrice([b, a], 100).map((o) => o.id)).toEqual(["a", "b"]);
    // 300개: a=3.1, b=2.95
    expect(sortOffersByPrice([a, b], 300).map((o) => o.id)).toEqual(["b", "a"]);
  });

  it("가격이 없는 항목은 숨기지 않고 맨 뒤에 둔다", () => {
    expect(sortOffersByPrice([noPrice, a, b], null).map((o) => o.id)).toEqual(["b", "a", "n"]);
  });

  it("가격이 같으면 원래 순서를 유지한다", () => {
    const c = { ...a, id: "c" };
    expect(sortOffersByPrice([a, c], null).map((o) => o.id)).toEqual(["a", "c"]);
    expect(sortOffersByPrice([c, a], null).map((o) => o.id)).toEqual(["c", "a"]);
  });
});
