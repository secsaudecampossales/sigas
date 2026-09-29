"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; code: string };

/** Produto existente para edição (quando ausente, o formulário cria). */
export type ProductInitial = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string;
  unitId: string;
  type: string;
  minStock: number;
  maxStock: number | null;
  reorderPoint: number | null;
  requiresBatch: boolean;
  active: boolean;
  notes: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  INSUMO: "Insumo",
  MEDICAMENTO: "Medicamento",
  MATERIAL_ADMINISTRATIVO: "Material Administrativo",
  OUTRO: "Outro",
};

export function ProductForm({
  categories,
  units,
  initial,
}: {
  categories: Option[];
  units: Option[];
  initial?: ProductInitial;
}) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [unitId, setUnitId] = useState(initial?.unitId ?? "");
  const [type, setType] = useState(initial?.type ?? "INSUMO");
  const [minStock, setMinStock] = useState(String(initial?.minStock ?? 0));
  const [maxStock, setMaxStock] = useState(
    initial?.maxStock === null || initial?.maxStock === undefined
      ? ""
      : String(initial.maxStock),
  );
  const [reorderPoint, setReorderPoint] = useState(
    initial?.reorderPoint === null || initial?.reorderPoint === undefined
      ? ""
      : String(initial.reorderPoint),
  );
  const [requiresBatch, setRequiresBatch] = useState(
    initial?.requiresBatch ?? false,
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // "Opções avançadas" começa recolhido; abre sozinho na edição quando o
  // produto já usa algum campo avançado (evita esconder dado preenchido).
  const [showAdvanced, setShowAdvanced] = useState(() =>
    Boolean(
      initial &&
        (initial.minStock > 0 ||
          initial.maxStock !== null ||
          initial.reorderPoint !== null ||
          initial.requiresBatch ||
          initial.description ||
          initial.notes ||
          !initial.active),
    ),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        editing ? `/api/produtos/${initial!.id}` : "/api/produtos",
        {
          method: editing ? "PATCH" : "POST",
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
        },
      );

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
          <p className="text-xs text-slate-500">
            Identificador único do produto (aparece em listas, movimentações e
            relatórios).
          </p>
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
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((open) => !open)}
        aria-expanded={showAdvanced}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-sky-700 hover:underline"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            showAdvanced && "rotate-180",
          )}
          aria-hidden
        />
        Opções avançadas
        <span className="font-normal text-slate-500">
          {showAdvanced
            ? "— recolher"
            : "— estoque mínimo/máximo, lote, descrição..."}
        </span>
      </button>

      {showAdvanced ? (
        <section
          aria-label="Opções avançadas"
          className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div className="grid gap-4 md:grid-cols-3">
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
              <p className="text-xs text-slate-500">
                Abaixo desse valor o item aparece como “Abaixo do mínimo” nos
                alertas do dashboard e do estoque.
              </p>
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
              <p className="text-xs text-slate-500">
                Referência de capacidade do almoxarifado (opcional).
              </p>
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
              <p className="text-xs text-slate-500">
                Nível em que vale repor o estoque — apenas informativo.
              </p>
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
          <p className="text-xs text-slate-500">
            “Requer controle de lote” é um indicativo (o controle por lote ainda
            não é cobrado nos fluxos). Produtos inativos somem dos formulários,
            mas mantêm todo o histórico e as movimentações.
          </p>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving
            ? "Salvando..."
            : editing
              ? "Salvar alterações"
              : "Salvar produto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(editing ? `/produtos/${initial!.id}` : "/produtos")
          }
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
