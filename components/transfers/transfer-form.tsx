"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductSelect } from "@/components/ui/product-select";
import { useWarehouseSelection } from "@/lib/form/warehouse-prefs";

type Product = { id: string; code: string; name: string };
type Warehouse = { id: string; name: string };
type Row = { key: number; productId: string; quantity: string };

export function TransferForm({
  products,
  originWarehouses,
  allWarehouses,
}: {
  products: Product[];
  originWarehouses: Warehouse[];
  allWarehouses: Warehouse[];
}) {
  const router = useRouter();
  // Origem pré-selecionada (única disponível ou último uso); destino é sempre manual.
  const {
    warehouseId: fromWarehouseId,
    setWarehouseId: setFromWarehouseId,
    remember,
  } = useWarehouseSelection(originWarehouses);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { key: 1, productId: "", quantity: "" },
  ]);
  const nextKey = useRef(2);
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
      current.length > 1 ? current.filter((row) => row.key !== key) : current,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!fromWarehouseId) {
      setError("Selecione o almoxarifado de origem.");
      return;
    }
    if (!toWarehouseId) {
      setError("Selecione o almoxarifado de destino.");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError("Origem e destino devem ser diferentes.");
      return;
    }

    const items = rows
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
      }));
    if (items.length === 0) {
      setError("Adicione ao menos um item à transferência.");
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
      const response = await fetch("/api/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          notes: notes.trim() || undefined,
          items,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao criar a transferência.");
        return;
      }
      remember(fromWarehouseId);
      router.push(`/transferencias/${data.transfer.id}`);
      router.refresh();
    } catch {
      setError("Falha de conexão ao criar a transferência. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (originWarehouses.length === 0 || allWarehouses.length < 2) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        É preciso ter acesso a ao menos um almoxarifado de origem e dois
        almoxarifados ativos para criar uma transferência.
      </p>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Rota</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fromWarehouseId">Origem *</Label>
            <select
              id="fromWarehouseId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={fromWarehouseId}
              onChange={(event) => setFromWarehouseId(event.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {originWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="toWarehouseId">Destino *</Label>
            <select
              id="toWarehouseId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={toWarehouseId}
              onChange={(event) => setToWarehouseId(event.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {allWarehouses.map((warehouse) => (
                <option
                  key={warehouse.id}
                  value={warehouse.id}
                  disabled={warehouse.id === fromWarehouseId}
                >
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <textarea
            id="notes"
            className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Motivo, responsável pelo transporte..."
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">Itens</h2>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
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
                  <ProductSelect
                    id={`product-${row.key}`}
                    products={products}
                    value={row.productId}
                    onChange={(productId) =>
                      updateRow(row.key, { productId })
                    }
                    required
                    disabledIds={usedElsewhere}
                  />
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
          {saving ? "Criando..." : "Criar transferência"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/transferencias")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
