"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Warehouse = { id: string; name: string };

export function InventoryForm({ warehouses }: { warehouses: Warehouse[] }) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!warehouseId) {
      setError("Selecione o almoxarifado a ser inventariado.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/inventarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao abrir o inventário.");
        return;
      }
      router.push(`/inventarios/${data.inventory.id}`);
      router.refresh();
    } catch {
      setError("Falha de conexão ao abrir o inventário. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (warehouses.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Você não tem acesso a nenhum almoxarifado ativo para abrir um
        inventário.
      </p>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="warehouseId">Almoxarifado *</Label>
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
            <p className="text-xs text-slate-500">
              Só é possível um inventário em aberto por almoxarifado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <textarea
              id="notes"
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Responsáveis pela contagem, seção do almoxarifado..."
            />
          </div>
        </div>

        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Como funciona</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>Abertura congela o saldo esperado de cada produto com saldo.</li>
            <li>Você lança a contagem física item a item.</li>
            <li>
              Divergências exigem justificativa antes de finalizar a contagem.
            </li>
            <li>
              O ajuste gera movimentações de correção (mais ou menos estoque) e o
              inventário é concluído.
            </li>
          </ol>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Abrindo..." : "Abrir inventário"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/inventarios")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
