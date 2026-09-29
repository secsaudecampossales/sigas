import type { ReportBlock } from "@/lib/reports/types";

/**
 * Tabelas do relatório (server component — sem interatividade).
 * As mesmas colunas/linhas alimentam o PDF exportável.
 */
export function ReportBlocks({ blocks }: { blocks: ReportBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <section
          key={block.title}
          className="rounded-lg border border-slate-200 bg-white shadow-sm"
        >
          <h2 className="px-4 pt-4 text-lg font-medium text-slate-900">
            {block.title}
          </h2>

          {block.rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Sem registros com os filtros atuais.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    {block.columns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-4 py-2 font-medium text-slate-700 ${
                          column.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {block.columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-4 py-2 text-slate-700 ${
                            column.align === "right"
                              ? "text-right tabular-nums"
                              : ""
                          }`}
                        >
                          {String(row[column.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {block.rows.length > 0 ? (
            <p className="border-t px-4 py-3 text-xs text-slate-500">
              {block.rows.length} registro(s)
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
