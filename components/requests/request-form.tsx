"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = { id: string; code: string; name: string };
type Warehouse = { id: string; name: string };
type Sector = { id: string; name: string };
type Row = { key: number; productId: string; quantity: string };

export function RequestForm({
  products,
  warehouses,
  sectors,
  fixedSector,
}: {
  products: Product[];
  warehouses: Warehouse[];
  sectors: Sector[];
  fixedSector: Sector | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([
    { key: 1, productId: "", quantity: "" },
  ]);
  const nextKey = useRef(2);
  const [sectorId, setSectorId] = useState("");
  const [originWarehouseId, setOriginWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey.current++, productId: "", quantity: "" },
    ]);
  }

  function removeRow(key: number) {
    setRows((current) =>
      current.length > 1
        ? current.filter((row) => row.key !== key)
        : current,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!fixedSector && !sectorId) {
      setError("Selecione o setor de origem.");
      return;
    }

    const items = rows
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
      }));
    if (items.length === 0) {
      setError("Adicione ao menos um item à solicitação.");
      return;
    }
    const seen = new Set<string>();
    for (const item of items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        setError("Todas as quantidades devem ser maiores que zero.");
        return;
      }
      if (seen.has(item.productId)) {
        setError("Produto repetido na lista de itens.");
        return;
      }
      seen.add(item.productId);
    }

    setSaving(true);
    try {
      const response = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorId: fixedSector ? undefined : sectorId,
          originWarehouseId: originWarehouseId || undefined,
          notes: notes.trim() || undefined,
          items,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao criar a solicitação.");
        return;
      }
      router.push(`/solicitacoes/${data.request.id}`);
      router.refresh();
    } catch {
      setError("Falha de conexão ao criar a solicitação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Dados gerais</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sectorId">Setor de origem *</Label>
            {fixedSector ? (
              <p
                id="sectorId"
                className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
              >
                {fixedSector.name}
              </p>
            ) : (
              <select
                id="sectorId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={sectorId}
                onChange={(event) => setSectorId(event.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="originWarehouseId">Almoxarifado de origem</Label>
            <select
              id="originWarehouseId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={originWarehouseId}
              onChange={(event) => setOriginWarehouseId(event.target.value)}
            >
              <option value="">A definir no atendimento</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Definir agora trava a origem no atendimento.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <textarea
            id="notes"
            className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Justificativa, urgência, local de entrega..."
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">Itens</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
          >
            Adicionar item
          </Button>
        </div>

        <div className="space-y-3">
          {rows.map((row) => {
            const usedElsewhere = new Set(
              rows
                .filter((other) => other.key !== row.key && other.productId)
                .map((other) => other.productId),
            );
            return (
              <div
                key={row.key}
                className="grid gap-3 md:grid-cols-[1fr_9rem_auto] md:items-end"
              >
                <div className="space-y-2">
                  <Label htmlFor={`product-${row.key}`}>Produto *</Label>
                  <select
                    id={`product-${row.key}`}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={row.productId}
                    onChange={(event) =>
                      updateRow(row.key, { productId: event.target.value })
                    }
                    required
                  >
                    <option value="">Selecione...</option>
                    {products.map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                        disabled={usedElsewhere.has(product.id)}
                      >
                        {product.code} - {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`quantity-${row.key}`}>Quantidade *</Label>
                  <Input
                    id={`quantity-${row.key}`}
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(row.key, { quantity: event.target.value })
                    }
                    placeholder="0"
                    required
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  className="text-red-600 hover:bg-red-50"
                >
                  Remover
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Enviando..." : "Enviar solicitação"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/solicitacoes")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
