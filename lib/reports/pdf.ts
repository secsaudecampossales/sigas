import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportPayload } from "./types";

/**
 * Gerador de PDF dos relatórios (jsPDF + AutoTable).
 *
 * Roda só no client (import dinâmico no botão), mas o módulo também carrega
 * em Node — usado pelos testes manuais de sanidade. As fontes padrão do
 * jsPDF usam WinAnsi: acentos latinos (á, ç, ã) funcionam, mas setas e
 * traços longos precisam ser substituídos.
 */
const TEXT_REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "—": "-",
  "–": "-",
  "·": "-",
  "±": "+/-",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
};

function pdfText(value: string): string {
  let out = value;
  for (const [from, to] of Object.entries(TEXT_REPLACEMENTS)) {
    out = out.split(from).join(to);
  }
  return out;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function stamp(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type AutoTableDoc = { lastAutoTable?: { finalY?: number } };

export function renderReportPdf(
  payload: ReportPayload,
  generatedAt: Date = new Date(),
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const footerY = pageHeight - 7;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`SIGAS Saude - ${pdfText(payload.title)}`, margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(pdfText(payload.subtitle), margin, 22);
  doc.text(`Gerado em ${stamp(generatedAt)}`, margin, 27);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, 30, pageWidth - margin, 30);

  // Resumo (um item por linha)
  let y = 37;
  if (payload.summary.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    for (const item of payload.summary) {
      doc.text(`${item.label}: ${item.value}`, margin, y);
      y += 4.5;
    }
    y += 3;
  }

  // Blocos de tabela
  for (const block of payload.blocks) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfText(block.title), margin, y);
    y += 4;

    if (block.rows.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Sem registros no periodo.", margin, y + 2);
      y += 10;
      continue;
    }

    const columnStyles: Record<number, { halign: "right" }> = {};
    block.columns.forEach((column, index) => {
      if (column.align === "right") columnStyles[index] = { halign: "right" };
    });

    autoTable(doc, {
      startY: y + 2,
      head: [block.columns.map((column) => pdfText(column.label))],
      body: block.rows.map((row) =>
        block.columns.map((column) => pdfText(String(row[column.key] ?? ""))),
      ),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 1.6,
        overflow: "linebreak",
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      columnStyles,
      margin: { left: margin, right: margin },
    });

    const previous = (doc as unknown as AutoTableDoc).lastAutoTable;
    y = (previous?.finalY ?? y + 12) + 8;
  }

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfText(payload.title), margin, footerY);
    doc.text(`Pagina ${page} de ${pages}`, pageWidth - margin, footerY, {
      align: "right",
    });
    doc.text(stamp(generatedAt), pageWidth / 2, footerY, { align: "center" });
  }

  return doc;
}

export function downloadReportPdf(
  payload: ReportPayload,
  filename: string,
  generatedAt: Date = new Date(),
): void {
  renderReportPdf(payload, generatedAt).save(filename);
}
