/**
 * Tipos de entrada de estoque (compartilhado entre server e client).
 *
 * ATENÇÃO: este módulo é importado por componentes "use client", então não
 * pode importar nada de `@/generated/prisma/client` — o client gerado do
 * Prisma puxa módulos `node:*` e o Turbopack falha ao montar o bundle do
 * navegador ("does not support external modules (request: node:module)").
 * Mantenha apenas literais de string aqui.
 */
export const ENTRY_TYPES = [
  "ENTRADA_COMPRA",
  "ENTRADA_DEVOLUCAO",
  "ENTRADA_TRANSFERENCIA",
  "ENTRADA_DOACAO",
  "ENTRADA_IMPLANTACAO",
] as const;

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  ENTRADA_COMPRA: "Compra",
  ENTRADA_DEVOLUCAO: "Devolução",
  ENTRADA_TRANSFERENCIA: "Transferência recebida",
  ENTRADA_DOACAO: "Doação",
  ENTRADA_IMPLANTACAO: "Implantação inicial",
};

export const ENTRY_TYPE_BADGE_CLASSES: Record<string, string> = {
  ENTRADA_COMPRA: "bg-sky-100 text-sky-700",
  ENTRADA_DEVOLUCAO: "bg-violet-100 text-violet-700",
  ENTRADA_TRANSFERENCIA: "bg-indigo-100 text-indigo-700",
  ENTRADA_DOACAO: "bg-teal-100 text-teal-700",
  ENTRADA_IMPLANTACAO: "bg-slate-200 text-slate-700",
};
