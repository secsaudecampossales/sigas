"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "sigas:ultimo-almoxarifado";
// Evento próprio: o evento "storage" só dispara em outras abas.
const CHANGE_EVENT = "sigas:almoxarifado-change";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

/**
 * Pré-seleciona o almoxarifado nos formulários para poupar cliques:
 *
 * - **1 opção disponível** → já vem selecionada (valor determinístico,
 *   idêntico no servidor e no cliente — sem risco de hidratação).
 * - **Várias opções** → restaura o último usado via `useSyncExternalStore`
 *   (o servidor renderiza vazio e o cliente assume após a hidratação,
 *   sem divergência); se o registro não existir ou estiver fora do alcance
 *   do usuário, começa vazio como antes.
 *
 * `remember()` grava a seleção após um envio bem-sucedido.
 */
export function useWarehouseSelection(warehouses: { id: string }[]) {
  const [selected, setSelected] = useState<string | null>(null);
  const remembered = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const rememberedValid =
    remembered && warehouses.some((warehouse) => warehouse.id === remembered)
      ? remembered
      : "";

  // Seleção manual tem prioridade; senão, o único disponível ou o último usado.
  const warehouseId =
    selected ?? (warehouses.length === 1 ? warehouses[0].id : rememberedValid);

  const setWarehouseId = useCallback((id: string) => setSelected(id), []);

  const remember = useCallback((id: string) => {
    if (!id) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage indisponível (modo privado/restrito) — apenas ignora.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { warehouseId, setWarehouseId, remember };
}
