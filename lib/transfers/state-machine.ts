import { TransferStatus } from "@prisma/client";

const allowedTransitions: Record<TransferStatus, TransferStatus[]> = {
  PENDENTE: ["SAIDA_CONFIRMADA", "CANCELADA"],
  SAIDA_CONFIRMADA: ["RECEBIDA", "CANCELADA"],
  RECEBIDA: [],
  CANCELADA: [],
};

export function canTransitionTransfer(
  from: TransferStatus,
  to: TransferStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransferTransition(
  from: TransferStatus,
  to: TransferStatus,
): void {
  if (!canTransitionTransfer(from, to)) {
    throw new Error(`Transição de transferência inválida: ${from} → ${to}`);
  }
}
