import { describe, expect, it } from "vitest";
import {
  canTransitionRequest,
  assertRequestTransition,
} from "@/lib/requests/state-machine";

describe("request state machine", () => {
  it("allows valid transitions", () => {
    expect(canTransitionRequest("PENDENTE", "EM_ANALISE")).toBe(true);
    expect(canTransitionRequest("EM_ANALISE", "APROVADA_PARCIALMENTE")).toBe(
      true,
    );
  });

  it("blocks invalid transitions", () => {
    expect(canTransitionRequest("REJEITADA", "ATENDIDA")).toBe(false);
    expect(() => assertRequestTransition("ATENDIDA", "PENDENTE")).toThrow();
  });
});
