"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Warehouse = { id: string; name: string };

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
}: {
  warehouses: Warehouse[];
  query: string;
  warehouseId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [almox, setAlmox] = useState(warehouseId);

  function goTo(next: { q: string; almox: string }) {
    const params = new URLSearchParams();
    const trimmed = next.q.trim();
    if (trimmed) params.set("q", trimmed);
    if (next.almox) params.set("almox", next.almox);
    const qs = params.toString();
    router.replace(qs ? `/estoque?${qs}` : "/estoque");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    goTo({ q, almox });
  }

  return (
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
            goTo({ q, almox: event.target.value });
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
          goTo({ q: "", almox: "" });
        }}
      >
        Limpar
      </Button>
    </form>
  );
}
