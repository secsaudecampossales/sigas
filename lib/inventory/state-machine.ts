import { InventoryStatus } from "@/generated/prisma/client";

/**
 * ABERTO → EM_CONTAGEM → CONFERIDO → (ajuste) AJUSTADO → CONCLUIDO.
 * - Recontagem: CONFERIDO volta para EM_CONTAGEM antes do ajuste.
 * - Cancelamento: só enquanto nada foi ajustado.
 * - CONCLUIR direto de CONFERIDO só quando não há divergências (validado
 *   na rota); com divergência o caminho obrigatório é AJUSTADO.
 */
const allowedTransitions: Record<InventoryStatus, InventoryStatus[]> = {
  ABERTO: ["EM_CONTAGEM", "CANCELADO"],
  EM_CONTAGEM: ["CONFERIDO", "CANCELADO"],
  CONFERIDO: ["AJUSTADO", "CONCLUIDO", "EM_CONTAGEM"],
  AJUSTADO: ["CONCLUIDO"],
  CONCLUIDO: [],
  CANCELADO: [],
};

export function canTransitionInventory(
  from: InventoryStatus,
  to: InventoryStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertInventoryTransition(
  from: InventoryStatus,
  to: InventoryStatus,
): void {
  if (!canTransitionInventory(from, to)) {
    throw new Error(`Transição de inventário inválida: ${from} → ${to}`);
  }
}
