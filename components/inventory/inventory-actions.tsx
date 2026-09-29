"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CountedItem = {
  id: string;
  name: string;
  code: string;
  expected: number;
  counted: number | null;
  variance: number | null;
  justification: string | null;
};

type CountPayload = {
  id: string;
  countedQty: number;
  justification: string | null;
};

type SendResult = { ok: boolean; error?: string; message?: string };

const MIN_JUSTIFICATION = 3;
const nf = new Intl.NumberFormat("pt-BR");

/**
 * Painel de ações por status do inventário. O pai renderiza com
 * `key={status}`, então a UI reflete o estado atual após `router.refresh()`.
 * Em EM_CONTAGEM o painel também é a tabela de contagem editável (e mostra
 * seus próprios mensagens — por isso `send` devolve o resultado em vez de
 * gravar estado).
 */
export function InventoryActions({
  inventoryId,
  status,
  canManage,
  notes,
  items,
}: {
  inventoryId: string;
  status: string;
  canManage: boolean;
  notes: string | null;
  items: CountedItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send(
    action: string,
    successMessage: string,
    payloadItems?: CountPayload[],
  ): Promise<SendResult> {
    try {
      const response = await fetch(`/api/inventarios/${inventoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          payloadItems ? { action, items: payloadItems } : { action },
        ),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          error: data?.error ?? "Erro ao atualizar o inventário.",
        };
      }
      router.refresh();
      return { ok: true, message: successMessage };
    } catch {
      return {
        ok: false,
        error: "Falha de conexão ao atualizar. Tente novamente.",
      };
    }
  }

  async function run(action: string, successMessage: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await send(action, successMessage);
    setSaving(false);
    if (result.ok) setSuccess(result.message ?? "OK.");
    else setError(result.error ?? "Erro ao atualizar o inventário.");
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

  if (!canManage) return null;

  if (status === "ABERTO") {
    return panel(
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          O saldo esperado de {items.length} item(ns) está congelado. Inicie a
          contagem física para lançar as quantidades contadas.
        </p>
        {notes ? (
          <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            {notes}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={saving}
            onClick={() => void run("INICIAR_CONTAGEM", "Contagem iniciada.")}
          >
            Iniciar contagem
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            className="border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => {
              if (window.confirm("Cancelar este inventário?")) {
                void run("CANCELAR", "Inventário cancelado.");
              }
            }}
          >
            Cancelar inventário
          </Button>
        </div>
      </div>,
    );
  }

  if (status === "EM_CONTAGEM") {
    return <CountingPanel items={items} send={send} />;
  }

  if (status === "CONFERIDO") {
    const divergences = items.filter(
      (item) => item.variance !== null && item.variance !== 0,
    );
    if (divergences.length > 0) {
      const totalVariance = divergences.reduce(
        (sum, item) => sum + Math.abs(item.variance!),
        0,
      );
      return panel(
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Contagem finalizada com{" "}
            <span className="font-medium text-amber-700">
              {divergences.length} divergência(s)
            </span>{" "}
            (±{nf.format(totalVariance)} un. no total). O ajuste gera uma
            movimentação de correção por item.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={saving}
              onClick={() => {
                if (
                  window.confirm(
                    "Aplicar o ajuste? O estoque será corrigido conforme a contagem.",
                  )
                ) {
                  void run(
                    "APLICAR_AJUSTE",
                    "Ajuste aplicado — estoque corrigido.",
                  );
                }
              }}
            >
              Aplicar ajuste
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void run("RECONTAR", "Recontagem liberada.")}
            >
              Recontar
            </Button>
          </div>
        </div>,
      );
    }
    return panel(
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Contagem conferida sem divergências — nada a ajustar.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={saving}
            onClick={() => void run("CONCLUIR", "Inventário concluído.")}
          >
            Concluir inventário
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => void run("RECONTAR", "Recontagem liberada.")}
          >
            Recontar
          </Button>
        </div>
      </div>,
    );
  }

  if (status === "AJUSTADO") {
    return panel(
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Ajuste aplicado com sucesso. Conclua para encerrar o inventário.
        </p>
        <Button
          disabled={saving}
          onClick={() => void run("CONCLUIR", "Inventário concluído.")}
        >
          Concluir inventário
        </Button>
      </div>,
    );
  }

  if (status === "CONCLUIDO") {
    return panel(
      <p className="text-sm text-slate-600">
        Inventário concluído. Nenhuma ação pendente.
      </p>,
    );
  }

  return panel(
    <p className="text-sm text-slate-600">
      Inventário cancelado — nenhuma contagem ou ajuste foi aplicado ao estoque.
    </p>,
  );
}

function CountingPanel({
  items,
  send,
}: {
  items: CountedItem[];
  send: (
    action: string,
    successMessage: string,
    payloadItems?: CountPayload[],
  ) => Promise<SendResult>;
}) {
  const initialCounts: Record<string, string> = {};
  const initialJustifications: Record<string, string> = {};
  for (const item of items) {
    initialCounts[item.id] = item.counted === null ? "" : String(item.counted);
    initialJustifications[item.id] = item.justification ?? "";
  }

  const [counts, setCounts] = useState<Record<string, string>>(initialCounts);
  const [justifications, setJustifications] = useState<
    Record<string, string>
  >(initialJustifications);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function varianceOf(item: CountedItem): number | null {
    const raw = counts[item.id];
    if (raw === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value - item.expected;
  }

  const filled = items.filter((item) => counts[item.id] !== "").length;

  function collectPayload(): CountPayload[] {
    return items
      .filter((item) => counts[item.id] !== "")
      .map((item) => ({
        id: item.id,
        countedQty: Number(counts[item.id]),
        justification: justifications[item.id]?.trim() || null,
      }));
  }

  function applyResult(result: SendResult) {
    if (result.ok) setSuccess(result.message ?? "OK.");
    else setError(result.error ?? "Erro ao atualizar o inventário.");
  }

  async function save() {
    setError(null);
    setSuccess(null);
    const payload = collectPayload();
    if (payload.length === 0) {
      setError("Lance ao menos um item antes de salvar.");
      return;
    }
    for (const entry of payload) {
      if (!Number.isFinite(entry.countedQty) || entry.countedQty < 0) {
        setError("As quantidades contadas devem ser maiores ou iguais a zero.");
        return;
      }
    }
    setSaving(true);
    applyResult(
      await send(
        "LANCAR_CONTAGEM",
        `Contagem salva (${payload.length} item(ns)).`,
        payload,
      ),
    );
    setSaving(false);
  }

  async function finish() {
    setError(null);
    setSuccess(null);
    const pending = items.filter((item) => counts[item.id] === "");
    if (pending.length > 0) {
      setError(
        `Lance a contagem de todos os itens antes de finalizar (${pending.length} pendente(s)).`,
      );
      return;
    }
    const withoutJustification = items.filter((item) => {
      const variance = varianceOf(item);
      const justification = justifications[item.id]?.trim() ?? "";
      return (
        variance !== null &&
        variance !== 0 &&
        justification.length < MIN_JUSTIFICATION
      );
    });
    if (withoutJustification.length > 0) {
      setError(
        `Informe a justificativa de todas as divergências (${withoutJustification.length} pendente(s)).`,
      );
      return;
    }
    setSaving(true);
    applyResult(await send("FINALIZAR_CONTAGEM", "Contagem finalizada."));
    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Contagem</h2>
          <p className="text-xs text-slate-500">
            {filled} de {items.length} item(ns) lançado(s) · divergências
            exigem justificativa
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => {
            const next: Record<string, string> = {};
            for (const item of items) next[item.id] = String(item.expected);
            setCounts(next);
            setError(null);
            setSuccess("Todos os campos preenchidos com o esperado.");
          }}
        >
          Preencher com o esperado
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const variance = varianceOf(item);
          const divergent = variance !== null && variance !== 0;
          return (
            <div key={item.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-slate-900">
                    {item.name}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {item.code}
                  </span>
                </div>
                <span className="text-xs text-slate-600">
                  Esperado:{" "}
                  <span className="font-medium text-slate-900">
                    {nf.format(item.expected)}
                  </span>
                </span>
              </div>

              <div className="mt-2 grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-center">
                <div className="space-y-1">
                  <Label htmlFor={`count-${item.id}`} className="text-xs">
                    Contado *
                  </Label>
                  <Input
                    id={`count-${item.id}`}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={counts[item.id]}
                    onChange={(event) => {
                      setError(null);
                      setSuccess(null);
                      setCounts((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }));
                    }}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1">
                  {divergent ? (
                    <>
                      <Label
                        htmlFor={`justification-${item.id}`}
                        className="text-xs"
                      >
                        Justificativa da divergência *
                      </Label>
                      <Input
                        id={`justification-${item.id}`}
                        value={justifications[item.id] ?? ""}
                        onChange={(event) => {
                          setError(null);
                          setJustifications((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }));
                        }}
                        placeholder="Ex.: avaria, erro de lançamento, perda não registrada..."
                        maxLength={500}
                      />
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {variance === null ? (
                        "Aguardando contagem."
                      ) : (
                        <span className="font-medium text-emerald-700">
                          Sem divergência.
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {variance !== null ? (
                <p
                  className={`mt-2 text-xs font-medium ${
                    variance === 0
                      ? "text-emerald-700"
                      : variance > 0
                        ? "text-sky-700"
                        : "text-red-600"
                  }`}
                >
                  {variance === 0
                    ? "Contagem igual ao esperado."
                    : `Divergência: ${variance > 0 ? "+" : ""}${nf.format(variance)} un. (${variance > 0 ? "sobra" : "falta"} no estoque)`}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : "Salvar contagens"}
        </Button>
        <Button type="button" disabled={saving} onClick={() => void finish()}>
          Finalizar contagem
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => {
            if (window.confirm("Cancelar este inventário?")) {
              setError(null);
              setSuccess(null);
              setSaving(true);
              send("CANCELAR", "Inventário cancelado.").then((result) => {
                setSaving(false);
                applyResult(result);
              });
            }
          }}
        >
          Cancelar inventário
        </Button>
      </div>

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
}
