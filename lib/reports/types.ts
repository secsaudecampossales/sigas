/**
 * Tipos dos payloads de relatório (compartilhados entre server e client).
 *
 * Módulo sem imports de runtime — pode ser importado por componentes "use
 * client" (ex.: botão de exportar PDF) sem arrastar Prisma/módulos Node.
 */
export type ReportColumn = {
  key: string;
  label: string;
  align?: "right";
};

export type ReportBlock = {
  title: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
};

export type ReportSummaryItem = {
  label: string;
  value: string;
};

export type ReportPayload = {
  type: string;
  title: string;
  subtitle: string;
  summary: ReportSummaryItem[];
  blocks: ReportBlock[];
};
