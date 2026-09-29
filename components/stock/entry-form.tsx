"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductSelect } from "@/components/ui/product-select";
import { useWarehouseSelection } from "@/lib/form/warehouse-prefs";
import { ENTRY_TYPES, ENTRY_TYPE_LABELS } from "@/lib/stock/entry-types";

type Product = { id: string; code: string; name: string };
type Warehouse = { id: string; name: string };

export function EntryForm({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  // Pré-seleciona o almoxarifado (único disponível ou último usado).
  const { warehouseId, setWarehouseId, remember } =
    useWarehouseSelection(warehouses);
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<string>(ENTRY_TYPES[0]);
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
      setError("Selecione o almoxarifado de destino.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("A quantidade deve ser maior que zero.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/movimentacoes/entrada", {
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
        setError(data?.error ?? "Erro ao registrar a entrada.");
        return;
      }

      idempotencyKey.current = crypto.randomUUID();
      remember(warehouseId);
      setSuccess(`Entrada de ${qty.toLocaleString("pt-BR")} un. registrada.`);
      setQuantity("");
      setDocumentRef("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Falha de conexão ao registrar a entrada. Tente novamente.");
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
          <ProductSelect
            id="productId"
            products={products}
            value={productId}
            onChange={setProductId}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="warehouseId">Almoxarifado de destino *</Label>
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
          <Label htmlFor="type">Tipo de entrada *</Label>
          <select
            id="type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={type}
            onChange={(event) => setType(event.target.value)}
            required
          >
            {ENTRY_TYPES.map((entryType) => (
              <option key={entryType} value={entryType}>
                {ENTRY_TYPE_LABELS[entryType]}
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentRef">Documento / NF</Label>
          <Input
            id="documentRef"
            value={documentRef}
            onChange={(event) => setDocumentRef(event.target.value)}
            placeholder="Ex.: NF 12345"
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
          {saving ? "Registrando..." : "Registrar entrada"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Mantém o almoxarifado selecionado: quem registra várias
            // entradas seguidas no mesmo local não precisa reselecionar.
            setProductId("");
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
