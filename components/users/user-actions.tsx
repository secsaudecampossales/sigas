"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UserActions({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const message = active
      ? "Desativar este usuário? Ele não poderá mais entrar no sistema."
      : "Reativar este usuário?";
    if (!window.confirm(message)) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao atualizar o status do usuário.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-medium text-slate-900">Status da conta</h2>
      <p className="text-sm text-slate-600">
        {active
          ? "Ativo: o usuário pode entrar e usar o sistema normalmente."
          : "Inativo: o acesso ao sistema está bloqueado, mas o histórico é preservado."}
      </p>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        variant={active ? "outline" : "default"}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {busy
          ? "Salvando..."
          : active
            ? "Desativar usuário"
            : "Reativar usuário"}
      </Button>
    </section>
  );
}
