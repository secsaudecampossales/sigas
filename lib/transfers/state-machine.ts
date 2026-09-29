import { TransferStatus } from "@/generated/prisma/client";

/**
 * PENDENTE → (saída confirmada na origem) → SAIDA_CONFIRMADA → (recebimento
 * no destino) → RECEBIDA. Cancelamento só antes da saída: depois disso o
 * estoque já saiu da origem e o caminho certo é concluir o recebimento.
 */
const allowedTransitions: Record<TransferStatus, TransferStatus[]> = {
  PENDENTE: ["SAIDA_CONFIRMADA", "CANCELADA"],
  SAIDA_CONFIRMADA: ["RECEBIDA"],
  RECEBIDA: [],
  CANCELADA: [],
};

export function canTransitionTransfer(
  from: TransferStatus,
  to: TransferStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransferStatus(
  from: TransferStatus,
  to: TransferStatus,
): void {
  if (!canTransitionTransfer(from, to)) {
    throw new Error(`Transição de transferência inválida: ${from} → ${to}`);
  }
}
