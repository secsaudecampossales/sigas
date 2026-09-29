/**
 * Rótulos de status de solicitação (compartilhado entre server e client).
 *
 * ATENÇÃO: módulo importado por componentes "use client" — não importe nada
 * de `@/generated/prisma/client` aqui (o Turbopack falha ao montar o bundle
 * do navegador com módulos `node:*`). Use apenas literais de string.
 */
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE: "Pendente",
  EM_ANALISE: "Em análise",
  APROVADA: "Aprovada",
  APROVADA_PARCIALMENTE: "Aprovada parcialmente",
  REJEITADA: "Rejeitada",
  EM_ATENDIMENTO: "Em atendimento",
  ATENDIDA: "Atendida",
  ATENDIDA_PARCIALMENTE: "Atendida parcialmente",
  CANCELADA: "Cancelada",
};

export const REQUEST_STATUS_BADGE_CLASSES: Record<string, string> = {
  RASCUNHO: "bg-slate-100 text-slate-600",
  PENDENTE: "bg-amber-100 text-amber-800",
  EM_ANALISE: "bg-sky-100 text-sky-700",
  APROVADA: "bg-emerald-100 text-emerald-700",
  APROVADA_PARCIALMENTE: "bg-teal-100 text-teal-700",
  REJEITADA: "bg-red-100 text-red-700",
  EM_ATENDIMENTO: "bg-indigo-100 text-indigo-700",
  ATENDIDA: "bg-green-100 text-green-700",
  ATENDIDA_PARCIALMENTE: "bg-lime-100 text-lime-800",
  CANCELADA: "bg-slate-200 text-slate-600",
};

/** Status a partir dos quais a lista principal costuma filtrar. */
export const REQUEST_STATUS_ORDER = [
  "PENDENTE",
  "EM_ANALISE",
  "APROVADA",
  "APROVADA_PARCIALMENTE",
  "EM_ATENDIMENTO",
  "ATENDIDA",
  "ATENDIDA_PARCIALMENTE",
  "REJEITADA",
  "CANCELADA",
  "RASCUNHO",
] as const;
