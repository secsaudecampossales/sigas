"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Ações contextuais da transferência. O pai renderiza com `key={status}`,
 * então a UI sempre reflete o estado atual após um `router.refresh()`.
 */
export function TransferActions({
  transferId,
  status,
  canConfirmExit,
  canReceive,
  canCancel,
  fromName,
  toName,
}: {
  transferId: string;
  status: string;
  canConfirmExit: boolean;
  canReceive: boolean;
  canCancel: boolean;
  fromName: string;
  toName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send(action: string, successMessage: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/transferencias/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao atualizar a transferência.");
        return;
      }
      setSuccess(successMessage);
      router.refresh();
    } catch {
      setError("Falha de conexão ao atualizar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const panel = (children: ReactNode) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-medium text-slate-900">Ações</h2>
      <div className="mt-3">{children}</div>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );

  if (status === "PENDENTE") {
    return panel(
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          O estoque ainda está inteiro em{" "}
          <span className="font-medium">{fromName}</span>. A saída baixa o
          saldo da origem; o destino só recebe quando o recebimento for
          confirmado.
        </p>
        <div className="flex flex-wrap gap-3">
          {canConfirmExit ? (
            <Button
              disabled={saving}
              onClick={() => {
                if (
                  window.confirm(
                    `Confirmar a saída de ${fromName}? O estoque será baixado.`,
                  )
                ) {
                  void send(
                    "CONFIRMAR_SAIDA",
                    "Saída confirmada — transferência em trânsito.",
                  );
                }
              }}
            >
              Confirmar saída
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="outline"
              disabled={saving}
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => {
                if (window.confirm("Cancelar esta transferência?")) {
                  void send("CANCELAR", "Transferência cancelada.");
                }
              }}
            >
              Cancelar transferência
            </Button>
          ) : null}
          {!canConfirmExit && !canCancel ? (
            <p className="text-sm text-slate-600">
              Aguardando confirmação de saída por quem opera{" "}
              {fromName}.
            </p>
          ) : null}
        </div>
      </div>,
    );
  }

  if (status === "SAIDA_CONFIRMADA") {
    return panel(
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Os itens já saíram de{" "}
          <span className="font-medium">{fromName}</span> e estão em trânsito
          para <span className="font-medium">{toName}</span>.
        </p>
        {canReceive ? (
          <Button
            disabled={saving}
            onClick={() => {
              if (
                window.confirm(
                  `Confirmar o recebimento em ${toName}? O estoque será creditado.`,
                )
              ) {
                void send(
                  "RECEBER",
                  "Recebimento confirmado — transferência concluída.",
                );
              }
            }}
          >
            Confirmar recebimento
          </Button>
        ) : (
          <p className="text-sm text-slate-600">
            Aguardando recebimento por quem opera {toName}.
          </p>
        )}
      </div>,
    );
  }

  if (status === "RECEBIDA") {
    return panel(
      <p className="text-sm text-slate-600">
        Transferência concluída: estoque baixado em {fromName} e creditado em{" "}
        {toName}. Nenhuma ação pendente.
      </p>,
    );
  }

  return panel(
    <p className="text-sm text-slate-600">
      Transferência cancelada antes da saída — nenhum estoque foi movimentado.
    </p>,
  );
}
