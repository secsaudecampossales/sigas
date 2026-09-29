"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Warehouse = { id: string; name: string };

/** Filtros rápidos de situação — os problemas do estoque em 1 clique. */
const SITUACOES = [
  { value: "", label: "Todos" },
  { value: "baixo", label: "Abaixo do mínimo" },
  { value: "zerado", label: "Sem estoque" },
] as const;

/**
 * Filtros da página de estoque.
 * Mantém o estado local e navega via router.replace para que o server
 * component revalide a busca (sem recarregar a página inteira).
 * A página passa uma `key` com os filtros atuais: quando ela muda, o
 * componente remonta já com o estado inicial correto (sem useEffect).
 */
export function StockFilters({
  warehouses,
  query,
  warehouseId,
  situacao,
}: {
  warehouses: Warehouse[];
  query: string;
  warehouseId: string;
  situacao: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [almox, setAlmox] = useState(warehouseId);

  function goTo(next: { q: string; almox: string; situacao: string }) {
    const params = new URLSearchParams();
    const trimmed = next.q.trim();
    if (trimmed) params.set("q", trimmed);
    if (next.almox) params.set("almox", next.almox);
    if (next.situacao) params.set("situacao", next.situacao);
    const qs = params.toString();
    router.replace(qs ? `/estoque?${qs}` : "/estoque");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    goTo({ q, almox, situacao });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Situação:</span>
        {SITUACOES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => goTo({ q, almox, situacao: option.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              situacao === option.value
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
            aria-pressed={situacao === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={handleSubmit}
      >
        <div className="min-w-56 flex-1 space-y-1">
          <label htmlFor="q" className="text-sm font-medium text-slate-700">
            Buscar produto
          </label>
          <Input
            id="q"
            placeholder="Nome ou código"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>

        <div className="min-w-56 space-y-1">
          <label htmlFor="almox" className="text-sm font-medium text-slate-700">
            Almoxarifado
          </label>
          <select
            id="almox"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={almox}
            onChange={(event) => {
              setAlmox(event.target.value);
              goTo({ q, almox: event.target.value, situacao });
            }}
          >
            <option value="">Todos</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit">Filtrar</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setQ("");
            setAlmox("");
            goTo({ q: "", almox: "", situacao: "" });
          }}
        >
          Limpar
        </Button>
      </form>
    </div>
  );
}
