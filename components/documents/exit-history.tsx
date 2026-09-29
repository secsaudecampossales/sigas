"use client";

import { Fragment, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXIT_TYPE_BADGE_CLASSES,
  EXIT_TYPE_LABELS,
} from "@/lib/stock/exit-types";
import type {
  ExitReceipt,
  ExitReceiptMovement,
} from "@/lib/documents/types";

const nf = new Intl.NumberFormat("pt-BR");

export type ExitHistoryRow = {
  id: string;
  type: string;
  quantity: number;
  documentRef: string | null;
  notes: string | null;
  createdAt: string;
  product: { id: string; code: string; name: string };
  warehouseFrom: string | null;
  registeredBy: string | null;
};

type IssueResponse = {
  error?: string;
  orgName?: string;
  movement?: ExitReceiptMovement;
  receipt?: ExitReceipt;
};

/**
 * Histórico de saídas com a geração do comprovante em PDF: para emitir,
 * as duas partes digitam os nomes (quem entrega / quem recebe), o servidor
 * registra a emissão na auditoria e devolve os dados autoritativos da
 * movimentação, que o client renderiza no jsPDF.
 */
export function ExitHistory({
  rows,
  limit,
}: {
  rows: ExitHistoryRow[];
  limit: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [entreguePor, setEntreguePor] = useState("");
  const [recebidoPor, setRecebidoPor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm(row: ExitHistoryRow) {
    setOpenId(row.id);
    setEntreguePor("");
    setRecebidoPor("");
    setError(null);
  }

  function closeForm() {
    if (busy) return;
    setOpenId(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/movimentacoes/comprovante", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          movementId: openId,
          entreguePor: entreguePor.trim(),
          recebidoPor: recebidoPor.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as IssueResponse;
      if (!response.ok || !data?.movement || !data?.receipt) {
        setError(data?.error ?? "Não foi possível registrar o comprovante.");
        return;
      }

      // Import dinâmico: o jsPDF só entra no bundle quando o usuário baixa.
      const { downloadExitReceiptPdf } = await import("@/lib/documents/pdf");
      downloadExitReceiptPdf({
        orgName: data.orgName ?? "SIGAS Saúde",
        movement: data.movement,
        receipt: data.receipt,
      });
      setOpenId(null);
    } catch {
      setError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-lg font-medium text-slate-900">
          Últimas saídas
        </h2>
        <span className="text-xs text-slate-500">
          {rows.length >= limit
            ? `Exibindo as ${limit} mais recentes`
            : `${rows.length} registro(s)`}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full table-auto text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-2 font-medium text-slate-700">
                Data / hora
              </th>
              <th className="px-4 py-2 font-medium text-slate-700">Tipo</th>
              <th className="px-4 py-2 font-medium text-slate-700">
                Produto
              </th>
              <th className="px-4 py-2 font-medium text-slate-700">
                Almoxarifado
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">
                Qtd.
              </th>
              <th className="px-4 py-2 font-medium text-slate-700">
                Documento
              </th>
              <th className="px-4 py-2 font-medium text-slate-700">
                Registrado por
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">
                Comprovante
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t align-top">
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {new Date(row.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        EXIT_TYPE_BADGE_CLASSES[row.type] ?? "bg-slate-100"
                      }`}
                    >
                      {EXIT_TYPE_LABELS[row.type] ?? row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/produtos/${row.product.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {row.product.name}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {row.product.code}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {row.warehouseFrom ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {nf.format(row.quantity)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {row.documentRef ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {row.registeredBy ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openId === row.id ? closeForm() : openForm(row)
                      }
                      disabled={busy && openId !== row.id}
                    >
                      {openId === row.id ? "Fechar" : "Comprovante PDF"}
                    </Button>
                  </td>
                </tr>
                {openId === row.id ? (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={8} className="px-4 py-3">
                      <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <div className="min-w-[220px] flex-1 space-y-1">
                          <Label htmlFor={`entregue-${row.id}`}>
                            Entregue por (quem entrega) *
                          </Label>
                          <Input
                            id={`entregue-${row.id}`}
                            value={entreguePor}
                            onChange={(event) =>
                              setEntreguePor(event.target.value)
                            }
                            maxLength={120}
                            required
                            placeholder="Nome completo"
                            className="h-9"
                          />
                        </div>
                        <div className="min-w-[220px] flex-1 space-y-1">
                          <Label htmlFor={`recebido-${row.id}`}>
                            Recebido por (quem recebe) *
                          </Label>
                          <Input
                            id={`recebido-${row.id}`}
                            value={recebidoPor}
                            onChange={(event) =>
                              setRecebidoPor(event.target.value)
                            }
                            maxLength={120}
                            required
                            placeholder="Nome completo"
                            className="h-9"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={
                              busy ||
                              entreguePor.trim().length < 2 ||
                              recebidoPor.trim().length < 2
                            }
                          >
                            {busy ? "Gerando..." : "Gerar PDF"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={closeForm}
                            disabled={busy}
                          >
                            Cancelar
                          </Button>
                        </div>
                        {error ? (
                          <p
                            className="w-full text-sm text-red-600"
                            role="alert"
                          >
                            {error}
                          </p>
                        ) : null}
                        <p className="w-full text-xs text-slate-500">
                          Os dois nomes ficam registrados na auditoria junto
                          com a emissão do comprovante.
                        </p>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="border-t px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma saída registrada ainda. Use o formulário acima para
          registrar a primeira baixa.
        </p>
      ) : null}
    </section>
  );
}
