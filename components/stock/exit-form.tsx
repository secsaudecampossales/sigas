"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXIT_TYPES, EXIT_TYPE_LABELS } from "@/lib/stock/exit-types";

type Product = { id: string; code: string; name: string };
type Warehouse = { id: string; name: string };

/**
 * Consulta o saldo disponível (físico - reservado) do produto no
 * almoxarifado via /api/estoque. Remontado com `key` quando a seleção
 * muda, então cada montagem faz uma única chamada.
 */
function BalanceHint({
  productId,
  warehouseId,
}: {
  productId: string;
  warehouseId: string;
}) {
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/estoque?productId=${encodeURIComponent(productId)}&warehouseId=${encodeURIComponent(warehouseId)}`,
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) {
          setAvailable(data?.consolidated?.[0]?.availableQty ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, warehouseId]);

  if (available === null) {
    return <p className="text-xs text-slate-500">Consultando saldo...</p>;
  }
  return (
    <p className="text-xs text-slate-600">
      Disponível neste almoxarifado:{" "}
      <span className="font-semibold">
        {available.toLocaleString("pt-BR")}
      </span>{" "}
      un.
    </p>
  );
}

export function ExitForm({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<string>(EXIT_TYPES[0]);
  const [documentRef, setDocumentRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Chave de idempotência: reutilizada em novas tentativas do MESMO envio
  // (evita duplicar se a rede cair) e rotacionada após cada sucesso.
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const qty = Number(quantity);
    if (!productId) {
      setError("Selecione o produto.");
      return;
    }
    if (!warehouseId) {
      setError("Selecione o almoxarifado de origem.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("A quantidade deve ser maior que zero.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/movimentacoes/saida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: qty,
          type,
          documentRef: documentRef.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Erro ao registrar a saída.");
        return;
      }

      idempotencyKey.current = crypto.randomUUID();
      setSuccess(`Saída de ${qty.toLocaleString("pt-BR")} un. registrada.`);
      setQuantity("");
      setDocumentRef("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Falha de conexão ao registrar a saída. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (warehouses.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Nenhum almoxarifado disponível para o seu perfil.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="productId">Produto *</Label>
          <select
            id="productId"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.code} - {product.name}
              </option>
            ))}
          </select>
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="type">Tipo de saída *</Label>
          <select
            id="type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={type}
            onChange={(event) => setType(event.target.value)}
            required
          >
            {EXIT_TYPES.map((exitType) => (
              <option key={exitType} value={exitType}>
                {EXIT_TYPE_LABELS[exitType]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Quantidade *</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            step="any"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="0"
            required
          />
          {productId && warehouseId ? (
            <BalanceHint
              key={`${productId}|${warehouseId}`}
              productId={productId}
              warehouseId={warehouseId}
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentRef">Documento</Label>
          <Input
            id="documentRef"
            value={documentRef}
            onChange={(event) => setDocumentRef(event.target.value)}
            placeholder="Ex.: REQ 42"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Registrando..." : "Registrar saída"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setProductId("");
            setWarehouseId("");
            setQuantity("");
            setDocumentRef("");
            setNotes("");
            setError(null);
            setSuccess(null);
          }}
        >
          Limpar
        </Button>
      </div>
    </form>
  );
}
