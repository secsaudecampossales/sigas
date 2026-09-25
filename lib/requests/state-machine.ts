import { RequestStatus } from "@prisma/client";

const allowedTransitions: Record<RequestStatus, RequestStatus[]> = {
  RASCUNHO: ["PENDENTE", "CANCELADA"],
  PENDENTE: ["EM_ANALISE", "CANCELADA"],
  EM_ANALISE: [
    "APROVADA",
    "APROVADA_PARCIALMENTE",
    "REJEITADA",
    "CANCELADA",
  ],
  APROVADA: ["EM_ATENDIMENTO", "CANCELADA"],
  APROVADA_PARCIALMENTE: ["EM_ATENDIMENTO", "CANCELADA"],
  REJEITADA: [],
  EM_ATENDIMENTO: ["ATENDIDA", "ATENDIDA_PARCIALMENTE", "CANCELADA"],
  ATENDIDA: [],
  ATENDIDA_PARCIALMENTE: ["EM_ATENDIMENTO"],
  CANCELADA: [],
};

export function canTransitionRequest(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertRequestTransition(
  from: RequestStatus,
  to: RequestStatus,
): void {
  if (!canTransitionRequest(from, to)) {
    throw new Error(`Transição de solicitação inválida: ${from} → ${to}`);
  }
}
