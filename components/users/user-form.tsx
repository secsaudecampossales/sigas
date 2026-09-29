"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/users/labels";

type Option = { id: string; name: string };

type Initial = {
  id: string;
  name: string;
  email: string;
  role: string;
  sectorId: string | null;
  warehouseIds: string[];
};

export function UserForm({
  mode,
  initial,
  sectors,
  warehouses,
}: {
  mode: "create" | "edit";
  initial?: Initial;
  sectors: Option[];
  warehouses: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [sectorId, setSectorId] = useState(initial?.sectorId ?? "");
  const [warehouseIds, setWarehouseIds] = useState<string[]>(
    initial?.warehouseIds ?? [],
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleWarehouse(id: string) {
    setWarehouseIds((current) =>
      current.includes(id)
        ? current.filter((warehouseId) => warehouseId !== id)
        : [...current, id],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (name.trim().length < 2) {
      setError("Informe o nome (mínimo de 2 caracteres).");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (!role) {
      setError("Selecione o perfil.");
      return;
    }
    if (mode === "create" && password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (mode === "edit" && password.length > 0 && password.length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: normalizedEmail,
        role,
        sectorId: sectorId || null,
        warehouseIds,
        ...(password ? { password } : {}),
      };
      const response = await fetch(
        mode === "create" ? "/api/usuarios" : `/api/usuarios/${initial!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao salvar o usuário.");
        return;
      }
      if (mode === "create") {
        router.push(`/usuarios/${data.user.id}`);
        router.refresh();
      } else {
        setPassword("");
        setSuccess("Alterações salvas.");
        router.refresh();
      }
    } catch {
      setError("Falha de conexão ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">
          Dados de acesso
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@saude.local"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">
            {mode === "create" ? "Senha * (mínimo de 8 caracteres)" : "Nova senha (deixe em branco para manter a atual)"}
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "create" ? "Senha" : "Somente se for redefinir"}
            autoComplete="new-password"
            required={mode === "create"}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">
          Perfil e vínculos
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role">Perfil *</Label>
            <select
              id="role"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {ROLE_ORDER.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sectorId">Setor</Label>
            <select
              id="sectorId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={sectorId}
              onChange={(event) => setSectorId(event.target.value)}
            >
              <option value="">Nenhum</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Almoxarifados</Label>
          {warehouses.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum almoxarifado ativo cadastrado.
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {warehouses.map((warehouse) => (
                <label
                  key={warehouse.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={warehouseIds.includes(warehouse.id)}
                    onChange={() => toggleWarehouse(warehouse.id)}
                  />
                  {warehouse.name}
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            Define quais almoxarifados o usuário pode operar no dia a dia.
          </p>
        </div>
      </section>

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

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving
            ? "Salvando..."
            : mode === "create"
              ? "Criar usuário"
              : "Salvar alterações"}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href="/usuarios">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
