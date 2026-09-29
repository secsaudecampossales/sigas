"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RequestItemView = {
  id: string;
  name: string;
  requested: number;
  approved: number;
  pending: number;
};

/**
 * Ações contextuais da solicitação. O pai renderiza este componente com
 * `key={status}`, então os rascunhos de quantidade são recalculados a cada
 * transição (nada de efeito colateral de sincronização).
 */
export function RequestActions({
  requestId,
  status,
  canAnalyze,
  canFulfill,
  canCancel,
  originWarehouseId,
  warehouses,
  items,
}: {
  requestId: string;
  status: string;
  canAnalyze: boolean;
  canFulfill: boolean;
  canCancel: boolean;
  originWarehouseId: string | null;
  warehouses: Array<{ id: string; name: string }>;
  items: RequestItemView[];
}) {
  const router = useRouter();
  const [approvals, setApprovals] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, String(item.requested)])),
  );
  const [fulfillQty, setFulfillQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items
        .filter((item) => item.pending > 0)
        .map((item) => [item.id, String(item.pending)]),
    ),
  );
  const [warehouseId, setWarehouseId] = useState(originWarehouseId ?? "");
  const [reason, setReason] = useState("");
  const [partialMode, setPartialMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send(
    action: string,
    payload: Record<string, unknown> = {},
    successMessage = "Solicitação atualizada.",
  ) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/solicitacoes/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao atualizar a solicitação.");
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

  function handleApprovePartial(event: FormEvent) {
    event.preventDefault();
    const entries = items.map((item) => ({
      id: item.id,
      quantityApproved: Number(approvals[item.id] ?? 0),
    }));
    for (const item of items) {
      const quantity = Number(approvals[item.id] ?? 0);
      if (!Number.isFinite(quantity) || quantity < 0) {
        setError(`Quantidade aprovada inválida para ${item.name}.`);
        return;
      }
      if (quantity > item.requested) {
        setError(`Aprovado acima do solicitado para ${item.name}.`);
        return;
      }
    }
    if (!entries.some((entry) => entry.quantityApproved > 0)) {
      setError("Aprove ao menos um item (para recusar tudo, use Rejeitar).");
      return;
    }
    void send(
      "APROVAR_PARCIAL",
      { items: entries },
      "Aprovação parcial registrada.",
    );
  }

  function handleReject(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError("Informe o motivo da rejeição.");
      return;
    }
    void send("REJEITAR", { reason: reason.trim() }, "Solicitação rejeitada.");
  }

  function handleFulfill(event: FormEvent) {
    event.preventDefault();
    const entries: Array<{ id: string; quantity: number }> = [];
    for (const item of items) {
      if (item.pending <= 0) continue;
      const quantity = Number(fulfillQty[item.id] ?? 0);
      if (!Number.isFinite(quantity) || quantity < 0) continue;
      if (quantity === 0) continue;
      if (quantity > item.pending) {
        setError(`Quantidade acima do pendente para ${item.name}.`);
        return;
      }
      entries.push({ id: item.id, quantity });
    }
    if (entries.length === 0) {
      setError("Informe as quantidades a atender.");
      return;
    }
    if (!originWarehouseId && !warehouseId) {
      setError("Selecione o almoxarifado de origem.");
      return;
    }
    void send(
      "ATENDER",
      { items: entries, warehouseId: warehouseId || undefined },
      "Atendimento registrado.",
    );
  }

  function handleCancel() {
    if (!window.confirm("Cancelar esta solicitação?")) return;
    void send("CANCELAR", {}, "Solicitação cancelada.");
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

  const pendingItems = items.filter((item) => item.pending > 0);

  if (status === "PENDENTE" && canAnalyze) {
    return panel(
      <Button
        disabled={saving}
        onClick={() =>
          void send("INICIAR_ANALISE", {}, "Análise iniciada.")
        }
      >
        Iniciar análise
      </Button>,
    );
  }

  if (status === "EM_ANALISE" && canAnalyze) {
    return panel(
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={saving}
            onClick={() =>
              void send(
                "APROVAR",
                {},
                "Solicitação aprovada integralmente.",
              )
            }
          >
            Aprovar tudo
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setPartialMode((current) => !current)}
          >
            {partialMode ? "Fechar aprovação parcial" : "Aprovar parcialmente"}
          </Button>
        </div>

        {partialMode ? (
          <form className="space-y-3" onSubmit={handleApprovePartial}>
            <table className="w-full table-auto text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-slate-700">
                    Produto
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">
                    Solicitado
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">
                    Aprovado
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2 text-slate-700">{item.name}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {item.requested.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        aria-label={`Aprovado para ${item.name}`}
                        type="number"
                        min={0}
                        max={item.requested}
                        step="any"
                        className="ml-auto w-28 text-right"
                        value={approvals[item.id] ?? "0"}
                        onChange={(event) =>
                          setApprovals((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button type="submit" disabled={saving}>
              Confirmar aprovação parcial
            </Button>
          </form>
        ) : null}

        <form className="space-y-2" onSubmit={handleReject}>
          <Label htmlFor="reason">Motivo da rejeição</Label>
          <textarea
            id="reason"
            className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: saldo insuficiente, item fora do padrão..."
            required
          />
          <Button
            type="submit"
            variant="outline"
            disabled={saving}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            Rejeitar solicitação
          </Button>
        </form>
      </div>,
    );
  }

  if (
    (status === "APROVADA" || status === "APROVADA_PARCIALMENTE") &&
    canFulfill
  ) {
    return panel(
      <Button
        disabled={saving}
        onClick={() =>
          void send(
            "INICIAR_ATENDIMENTO",
            {},
            "Atendimento iniciado.",
          )
        }
      >
        Iniciar atendimento
      </Button>,
    );
  }

  if (status === "EM_ATENDIMENTO" && canFulfill) {
    if (pendingItems.length === 0) {
      return panel(
        <p className="text-sm text-slate-600">
          Não há saldo aprovado pendente de atendimento.
        </p>,
      );
    }
    return panel(
      <form className="space-y-4" onSubmit={handleFulfill}>
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-700">
                  Produto
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">
                  Pendente
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">
                  Atender agora
                </th>
              </tr>
            </thead>
            <tbody>
              {pendingItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2 text-slate-700">{item.name}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {item.pending.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      aria-label={`Quantidade a atender de ${item.name}`}
                      type="number"
                      min={0}
                      max={item.pending}
                      step="any"
                      className="ml-auto w-28 text-right"
                      value={fulfillQty[item.id] ?? "0"}
                      onChange={(event) =>
                        setFulfillQty((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!originWarehouseId ? (
          <div className="space-y-2">
            <Label htmlFor="warehouseId">Almoxarifado de origem *</Label>
            <select
              id="warehouseId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <p className="text-xs text-slate-500">
          As saídas são registradas como{" "}
          <span className="font-medium">Atendimento de solicitação</span> no
          histórico de Saídas, com validação de saldo no servidor. Itens com
          saldo insuficiente não são baixados (a operação falha por inteiro).
        </p>

        <Button type="submit" disabled={saving}>
          Confirmar atendimento
        </Button>
      </form>,
    );
  }

  if (status === "ATENDIDA_PARCIALMENTE" && canFulfill) {
    return panel(
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Atendimento parcial registrado. Reabra para baixar o saldo restante.
        </p>
        <Button
          disabled={saving}
          onClick={() =>
            void send("REABRIR", {}, "Atendimento reaberto.")
          }
        >
          Continuar atendimento
        </Button>
      </div>,
    );
  }

  if (canCancel) {
    return panel(
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Esta solicitação ainda não tem itens atendidos e pode ser cancelada.
        </p>
        <Button
          variant="outline"
          disabled={saving}
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={handleCancel}
        >
          Cancelar solicitação
        </Button>
      </div>,
    );
  }

  return null;
}
