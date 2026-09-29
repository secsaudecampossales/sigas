/**
 * Rótulos de inventário (compartilhado entre server e client).
 *
 * ATENÇÃO: módulo importado por componentes "use client" — não importe nada
 * de `@/generated/prisma/client` aqui (o Turbopack falha ao montar o bundle
 * do navegador com módulos `node:*`). Use apenas literais de string.
 */
export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  ABERTO: "Aberto",
  EM_CONTAGEM: "Em contagem",
  CONFERIDO: "Conferido",
  AJUSTADO: "Ajustado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const INVENTORY_STATUS_BADGE_CLASSES: Record<string, string> = {
  ABERTO: "bg-sky-100 text-sky-700",
  EM_CONTAGEM: "bg-amber-100 text-amber-800",
  CONFERIDO: "bg-orange-100 text-orange-700",
  AJUSTADO: "bg-purple-100 text-purple-700",
  CONCLUIDO: "bg-emerald-100 text-emerald-700",
  CANCELADO: "bg-slate-200 text-slate-600",
};

export const INVENTORY_STATUS_ORDER = [
  "ABERTO",
  "EM_CONTAGEM",
  "CONFERIDO",
  "AJUSTADO",
  "CONCLUIDO",
  "CANCELADO",
] as const;

/** Inventário não tem número sequencial no modelo: usa o código curto do id. */
export function formatInventoryCode(id: string): string {
  return `INV-${id.slice(0, 8).toUpperCase()}`;
}

/** Rotulo do movimento de correcao gerado no ajuste. */
export const ADJUSTMENT_LABEL = "Ajuste de inventário";
export const ADJUSTMENT_BADGE_CLASSES = "bg-purple-100 text-purple-700";
