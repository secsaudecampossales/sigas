"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

type Product = { id: string; code: string; name: string };

const SHOW_FILTER_ABOVE = 15;

/**
 * Seletor de produto com busca opcional. Com catálogo grande (mais de 15
 * itens) exibe um campo "Filtrar" acima do select para digitar código ou
 * nome — o select nativo com dezenas de opções é difícil de usar. Abaixo
 * disso continua sendo um select simples.
 *
 * O produto selecionado permanece visível na lista mesmo quando o filtro
 * esconde os demais (evita o select "em branco" com valor invisível).
 */
export function ProductSelect({
  id,
  products,
  value,
  onChange,
  required,
  disabledIds,
}: {
  id: string;
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  required?: boolean;
  disabledIds?: Set<string>;
}) {
  const [filter, setFilter] = useState("");
  const showFilter = products.length > SHOW_FILTER_ABOVE;

  const trimmed = filter.trim().toLowerCase();
  const visible = trimmed
    ? products.filter(
        (product) =>
          product.id === value ||
          product.code.toLowerCase().includes(trimmed) ||
          product.name.toLowerCase().includes(trimmed),
      )
    : products;

  return (
    <div className="space-y-2">
      {showFilter ? (
        <Input
          id={`${id}-filter`}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar por código ou nome..."
          aria-label="Filtrar produtos"
        />
      ) : null}
      <select
        id={id}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        <option value="">Selecione...</option>
        {visible.map((product) => (
          <option
            key={product.id}
            value={product.id}
            disabled={disabledIds?.has(product.id)}
          >
            {product.code} - {product.name}
          </option>
        ))}
      </select>
      {showFilter && visible.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nenhum produto corresponde ao filtro.
        </p>
      ) : null}
    </div>
  );
}
