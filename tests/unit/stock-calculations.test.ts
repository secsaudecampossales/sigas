import { describe, expect, it } from "vitest";
import {
  availableQuantity,
  isBelowMinimum,
} from "@/lib/stock/calculations";

describe("stock calculations", () => {
  it("calculates available quantity", () => {
    expect(availableQuantity(100, 30)).toBe(70);
    expect(availableQuantity(10, 20)).toBe(0);
  });

  it("detects below minimum", () => {
    expect(isBelowMinimum(5, 10)).toBe(true);
    expect(isBelowMinimum(10, 10)).toBe(false);
  });
});
