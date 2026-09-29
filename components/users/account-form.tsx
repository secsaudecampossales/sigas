"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Formulário da própria conta: nome + troca de senha (a senha atual é
 * exigida pelo servidor). A atualização de nome é conferida logo em
 * seguida no cabeçalho (o layout lê o nome direto do banco).
 */
export function AccountForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(null);

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError("Informe a senha atual para trocar a senha.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("A confirmação não confere com a nova senha.");
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = { name };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const response = await fetch("/api/conta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Erro ao salvar a conta.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved("Dados atualizados com sucesso.");
      router.refresh();
    } catch {
      setError("Falha de conexão ao salvar a conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="account-name">Nome *</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome completo"
          required
          maxLength={120}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Alterar senha</p>
        <p className="mt-1 text-xs text-slate-500">
          Preencha os três campos apenas se quiser trocar a senha. Deixe em
          branco para manter a atual.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="account-current">Senha atual</Label>
            <Input
              id="account-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-new">Nova senha</Label>
            <Input
              id="account-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-confirm">Confirmar nova senha</Label>
            <Input
              id="account-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-700" role="status">
          {saved}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard")}
        >
          Voltar ao dashboard
        </Button>
      </div>
    </form>
  );
}
