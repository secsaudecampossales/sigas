import { describe, expect, it } from "vitest";
import {
  canTransitionInventory,
  assertInventoryTransition,
} from "@/lib/inventory/state-machine";

describe("inventory state machine", () => {
  it("allows the count → conference → adjust → close flow", () => {
    expect(canTransitionInventory("ABERTO", "EM_CONTAGEM")).toBe(true);
    expect(canTransitionInventory("EM_CONTAGEM", "CONFERIDO")).toBe(true);
    expect(canTransitionInventory("CONFERIDO", "AJUSTADO")).toBe(true);
    expect(canTransitionInventory("AJUSTADO", "CONCLUIDO")).toBe(true);
    expect(canTransitionInventory("CONFERIDO", "CONCLUIDO")).toBe(true);
  });

  it("allows recount before the adjustment", () => {
    expect(canTransitionInventory("CONFERIDO", "EM_CONTAGEM")).toBe(true);
    expect(canTransitionInventory("AJUSTADO", "EM_CONTAGEM")).toBe(false);
  });

  it("allows cancelling only before an adjustment", () => {
    expect(canTransitionInventory("ABERTO", "CANCELADO")).toBe(true);
    expect(canTransitionInventory("EM_CONTAGEM", "CANCELADO")).toBe(true);
    expect(canTransitionInventory("CONFERIDO", "CANCELADO")).toBe(false);
    expect(canTransitionInventory("CONCLUIDO", "CANCELADO")).toBe(false);
  });

  it("blocks invalid transitions", () => {
    expect(canTransitionInventory("ABERTO", "CONFERIDO")).toBe(false);
    expect(canTransitionInventory("CONCLUIDO", "EM_CONTAGEM")).toBe(false);
    expect(() => assertInventoryTransition("CANCELADO", "ABERTO")).toThrow();
  });
});
