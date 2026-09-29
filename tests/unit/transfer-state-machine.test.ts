import { describe, expect, it } from "vitest";
import {
  canTransitionTransfer,
  assertTransferStatus,
} from "@/lib/transfers/state-machine";

describe("transfer state machine", () => {
  it("allows the exit → receipt flow", () => {
    expect(canTransitionTransfer("PENDENTE", "SAIDA_CONFIRMADA")).toBe(true);
    expect(canTransitionTransfer("SAIDA_CONFIRMADA", "RECEBIDA")).toBe(true);
    expect(canTransitionTransfer("PENDENTE", "CANCELADA")).toBe(true);
  });

  it("blocks cancelling after the exit was confirmed", () => {
    expect(canTransitionTransfer("SAIDA_CONFIRMADA", "CANCELADA")).toBe(false);
    expect(canTransitionTransfer("RECEBIDA", "CANCELADA")).toBe(false);
  });

  it("blocks going backwards", () => {
    expect(canTransitionTransfer("RECEBIDA", "SAIDA_CONFIRMADA")).toBe(false);
    expect(canTransitionTransfer("SAIDA_CONFIRMADA", "PENDENTE")).toBe(false);
    expect(() => assertTransferStatus("RECEBIDA", "PENDENTE")).toThrow();
  });
});
