import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { EXIT_TYPE_LABELS } from "@/lib/stock/exit-types";
import type {
  ExitReceiptPayload,
  ExitReceiptMovement,
  ExitReceipt,
} from "./types";

export type { ExitReceiptPayload, ExitReceiptMovement, ExitReceipt };

/**
 * Comprovante de saída em PDF (jsPDF + AutoTable) com blocos de assinatura
 * das duas partes (quem entrega / quem recebe).
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

const nf = new Intl.NumberFormat("pt-BR");

function slug(value: string): string {
  return value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function exitReceiptFilename(payload: ExitReceiptPayload): string {
  const ref =
    payload.movement.documentRef ||
    payload.movement.product.code ||
    payload.movement.id.slice(0, 8);
  const date = new Date(payload.receipt.emittedAt);
  return `comprovante-saida-${slug(ref)}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.pdf`;
}

export function renderExitReceiptPdf(
  payload: ExitReceiptPayload,
  generatedAt: Date = new Date(),
): jsPDF {
  const { movement, receipt } = payload;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const footerY = pageHeight - 7;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfText(payload.orgName), margin, 16);

  doc.setFontSize(11);
  doc.setTextColor(41, 128, 185);
  doc.text("Comprovante de Saída", margin, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Documento de conferência para assinatura das duas partes.", margin, 28);
  doc.text(`Gerado em ${stamp(generatedAt)}`, margin, 33);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, 36, pageWidth - margin, 36);

  // Dados da movimentação
  const rows: Array<[string, string]> = [
    ["Tipo", EXIT_TYPE_LABELS[movement.type] ?? movement.type],
    ["Documento", movement.documentRef ?? "-"],
    [
      "Data / hora",
      new Date(movement.createdAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ],
    ["Produto", `${movement.product.code} - ${movement.product.name}`],
    [
      "Quantidade",
      `${nf.format(movement.quantity)}${movement.unit ? ` ${movement.unit}` : ""}`,
    ],
    ["Almoxarifado de origem", movement.warehouseFrom],
    ["Almoxarifado de destino", movement.warehouseTo ?? "-"],
    ["Registrado por", movement.registeredBy],
    ["Observações", movement.notes ?? "-"],
  ];

  autoTable(doc, {
    startY: 41,
    head: [["Campo", "Valor"]],
    body: rows.map(([label, value]) => [pdfText(label), pdfText(value)]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 1.8,
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
    columnStyles: { 0: { cellWidth: 52 } },
    margin: { left: margin, right: margin },
  });

  const previous = (doc as unknown as AutoTableDoc).lastAutoTable;
  let y = (previous?.finalY ?? 90) + 10;

  // Blocos de assinatura
  if (y > pageHeight - 66) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Assinaturas das partes", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Após a impressão, as partes devem assinar e datar os campos abaixo.",
    margin,
    y + 4.5,
  );
  y += 9;

  const boxWidth = (pageWidth - 2 * margin - 6) / 2;
  const boxHeight = 50;
  const boxes = [
    { x: margin, title: "ENTREGUE POR", name: receipt.entreguePor },
    { x: margin + boxWidth + 6, title: "RECEBIDO POR", name: receipt.recebidoPor },
  ];

  for (const box of boxes) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(box.x, y, boxWidth, boxHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(41, 128, 185);
    doc.text(box.title, box.x + 4, y + 6);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Nome", box.x + 4, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(pdfText(box.name), boxWidth - 8);
    (Array.isArray(lines) ? lines : [lines])
      .slice(0, 2)
      .forEach((line: string, index: number) => {
        doc.text(line, box.x + 4, y + 17 + index * 4.5);
      });

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.line(box.x + 4, y + 33, box.x + boxWidth - 4, y + 33);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Assinatura", box.x + 4, y + 37);

    doc.setFontSize(8);
    doc.text("Data:      /      /", box.x + 4, y + 45);
  }
  y += boxHeight + 9;

  // Emissão / rastreio
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfText(
      `Comprovante emitido por ${receipt.emittedBy} em ${stamp(new Date(receipt.emittedAt))}.`,
    ),
    margin,
    y,
  );
  doc.setTextColor(148, 163, 184);
  doc.text(`Movimentação ${movement.id}`, margin, y + 4);

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Comprovante de Saída", margin, footerY);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, footerY, {
      align: "right",
    });
    doc.text(stamp(generatedAt), pageWidth / 2, footerY, { align: "center" });
  }

  return doc;
}

export function downloadExitReceiptPdf(
  payload: ExitReceiptPayload,
  generatedAt: Date = new Date(),
): void {
  renderExitReceiptPdf(payload, generatedAt).save(
    exitReceiptFilename(payload),
  );
}
