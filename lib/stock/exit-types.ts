/**
 * Tipos de saída de estoque (compartilhado entre server e client).
 *
 * ATENÇÃO: este módulo é importado por componentes "use client", então não
 * pode importar nada de `@/generated/prisma/client` — o client gerado do
 * Prisma puxa módulos `node:*` e o Turbopack falha ao montar o bundle do
 * navegador ("does not support external modules (request: node:module)").
 * Mantenha apenas literais de string aqui.
 */
export const EXIT_TYPES = [
  "SAIDA_ATENDIMENTO",
  "SAIDA_CONSUMO",
  "SAIDA_DEVOLUCAO_FORNECEDOR",
  "SAIDA_PERDA",
  "SAIDA_TRANSFERENCIA",
] as const;

export const EXIT_TYPE_LABELS: Record<string, string> = {
  SAIDA_ATENDIMENTO: "Atendimento de solicitação",
  SAIDA_CONSUMO: "Consumo interno",
  SAIDA_DEVOLUCAO_FORNECEDOR: "Devolução ao fornecedor",
  SAIDA_PERDA: "Perda / avaria",
  SAIDA_TRANSFERENCIA: "Transferência enviada",
};

export const EXIT_TYPE_BADGE_CLASSES: Record<string, string> = {
  SAIDA_ATENDIMENTO: "bg-amber-100 text-amber-800",
  SAIDA_CONSUMO: "bg-orange-100 text-orange-700",
  SAIDA_DEVOLUCAO_FORNECEDOR: "bg-rose-100 text-rose-700",
  SAIDA_PERDA: "bg-red-100 text-red-700",
  SAIDA_TRANSFERENCIA: "bg-indigo-100 text-indigo-700",
};
