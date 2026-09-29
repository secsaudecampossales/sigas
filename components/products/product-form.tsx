"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string; code: string };

const TYPE_LABELS: Record<string, string> = {
  INSUMO: "Insumo",
  MEDICAMENTO: "Medicamento",
  MATERIAL_ADMINISTRATIVO: "Material Administrativo",
  OUTRO: "Outro",
};

export function ProductForm({
  categories,
  units,
}: {
  categories: Option[];
  units: Option[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [type, setType] = useState("INSUMO");
  const [minStock, setMinStock] = useState("0");
  const [maxStock, setMaxStock] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [requiresBatch, setRequiresBatch] = useState(false);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          description,
          categoryId,
          unitId,
          type,
          minStock,
          maxStock,
          reorderPoint,
          requiresBatch,
          active,
          notes,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Erro ao salvar o produto.");
        return;
      }

      router.push(`/produtos/${data.product.id}`);
      router.refresh();
    } catch {
      setError("Falha de conexão ao salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Código *</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex.: MED-001"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do produto"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoryId">Categoria *</Label>
          <select
            id="categoryId"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitId">Unidade *</Label>
          <select
            id="unitId"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} - {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo *</Label>
          <select
            id="type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="minStock">Estoque mínimo</Label>
          <Input
            id="minStock"
            type="number"
            min={0}
            step="any"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxStock">Estoque máximo</Label>
          <Input
            id="maxStock"
            type="number"
            min={0}
            step="any"
            value={maxStock}
            onChange={(e) => setMaxStock(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reorderPoint">Ponto de reordenação</Label>
          <Input
            id="reorderPoint"
            type="number"
            min={0}
            step="any"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <textarea
          id="description"
          className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <textarea
          id="notes"
          className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiresBatch}
            onChange={(e) => setRequiresBatch(e.target.checked)}
          />
          Requer controle de lote
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Ativo
        </label>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar produto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/produtos")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
