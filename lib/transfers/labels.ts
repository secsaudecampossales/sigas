/**
 * Rótulos de transferência (compartilhado entre server e client).
 *
 * ATENÇÃO: módulo importado por componentes "use client" — não importe nada
 * de `@/generated/prisma/client` aqui (o Turbopack falha ao montar o bundle
 * do navegador com módulos `node:*`). Use apenas literais de string.
 */
export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  SAIDA_CONFIRMADA: "Em trânsito",
  RECEBIDA: "Recebida",
  CANCELADA: "Cancelada",
};

export const TRANSFER_STATUS_BADGE_CLASSES: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  SAIDA_CONFIRMADA: "bg-indigo-100 text-indigo-700",
  RECEBIDA: "bg-emerald-100 text-emerald-700",
  CANCELADA: "bg-slate-200 text-slate-600",
};

export const TRANSFER_STATUS_ORDER = [
  "PENDENTE",
  "SAIDA_CONFIRMADA",
  "RECEBIDA",
  "CANCELADA",
] as const;
