"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = { orgName: string; orgContact: string };

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(initial.orgName);
  const [orgContact, setOrgContact] = useState(initial.orgContact);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (orgName.trim().length < 2) {
      setError("Informe o nome da organização (mínimo de 2 caracteres).");
      return;
    }
    const contact = orgContact.trim();
    if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      setError("Informe um e-mail de contato válido ou deixe em branco.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/configuracoes/parametros", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim(), orgContact: contact }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Erro ao salvar os parâmetros.");
        return;
      }
      setOrgName(data.settings.orgName);
      setOrgContact(data.settings.orgContact);
      setSuccess("Parâmetros salvos.");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="orgName">Nome da organização *</Label>
          <Input
            id="orgName"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            placeholder="Ex.: Secretaria Municipal de Saúde"
            required
          />
          <p className="text-xs text-slate-500">
            Aparece no cabeçalho dos PDFs de relatório e na tela de acesso.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="orgContact">E-mail de contato</Label>
          <Input
            id="orgContact"
            type="email"
            value={orgContact}
            onChange={(event) => setOrgContact(event.target.value)}
            placeholder="suporte@saude.local"
          />
          <p className="text-xs text-slate-500">
            Exibido na tela de acesso como canal de suporte (opcional).
          </p>
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

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Salvando..." : "Salvar parâmetros"}
      </Button>
    </form>
  );
}
