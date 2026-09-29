"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReportPayload } from "@/lib/reports/types";

export function ReportPdfButton({
  payload,
  filename,
}: {
  payload: ReportPayload;
  filename: string;
}) {
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBuilding(true);
    setError(null);
    try {
      // Import dinâmico: o jsPDF só entra no bundle quando o usuário baixa.
      const { downloadReportPdf } = await import("@/lib/reports/pdf");
      downloadReportPdf(payload, filename);
    } catch {
      setError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleDownload()}
        disabled={building}
      >
        {building ? "Gerando..." : "Baixar PDF"}
      </Button>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
