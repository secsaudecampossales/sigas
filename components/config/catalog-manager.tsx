"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WAREHOUSE_TYPE_LABELS, WAREHOUSE_TYPE_ORDER } from "@/lib/config/catalogs";

export type CatalogRow = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  location: string | null;
  responsible: string | null;
  active: boolean;
  createdAt: string;
};

export type CatalogDefView = {
  id: string;
  label: string;
  singular: string;
  hasType: boolean;
  article: "Novo" | "Nova";
};

async function callApi(path: string, method: string, payload: object) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, error: data?.error as string | undefined };
}

function CatalogForm({
  def,
  initial,
  onSaved,
}: {
  def: CatalogDefView;
  initial: CatalogRow | null;
  onSaved: (created: boolean) => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [responsible, setResponsible] = useState(initial?.responsible ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (code.trim().length < 2) {
      setError("Informe o código (mínimo de 2 caracteres).");
      return;
    }
    if (name.trim().length < 2) {
      setError("Informe o nome (mínimo de 2 caracteres).");
      return;
    }
    if (def.hasType && !type) {
      setError("Selecione o tipo do almoxarifado.");
      return;
    }

    const payload = {
      code,
      name,
      ...(def.hasType ? { type, location, responsible } : {}),
    };

    setSaving(true);
    try {
      const { ok, error: apiError } = await callApi(
        initial
          ? `/api/configuracoes/${def.id}/${initial.id}`
          : `/api/configuracoes/${def.id}`,
        initial ? "PATCH" : "POST",
        payload,
      );
      if (!ok) {
        setError(apiError ?? "Erro ao salvar o registro.");
        return;
      }
      if (initial) {
        onSaved(false);
      } else {
        setCode("");
        setName("");
        setLocation("");
        setResponsible("");
        onSaved(true);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-medium text-slate-900">
        {initial
          ? `Editando: ${initial.name}`
          : `${def.article} ${def.singular.toLowerCase()}`}
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="catalog-code">Código *</Label>
          <Input
            id="catalog-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Ex.: CAT-01"
            required
          />
          <p className="text-xs text-slate-500">
            2 a 24 caracteres: letras, números, ponto, hífen ou sublinhado.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="catalog-name">Nome *</Label>
          <Input
            id="catalog-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do registro"
            required
          />
        </div>
      </div>

      {def.hasType ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="catalog-type">Tipo *</Label>
            <select
              id="catalog-type"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={type}
              onChange={(event) => setType(event.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {WAREHOUSE_TYPE_ORDER.map((value) => (
                <option key={value} value={value}>
                  {WAREHOUSE_TYPE_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-location">Localização</Label>
            <Input
              id="catalog-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ex.: Bloco A, sala 3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-responsible">Responsável</Label>
            <Input
              id="catalog-responsible"
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
              placeholder="Nome do responsável"
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving
            ? "Salvando..."
            : initial
              ? "Salvar alterações"
              : `Criar ${def.singular.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}

export function CatalogManager({
  def,
  rows,
}: {
  def: CatalogDefView;
  rows: CatalogRow[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const editing = editingId
    ? (rows.find((row) => row.id === editingId) ?? null)
    : null;

  async function toggle(row: CatalogRow) {
    if (row.active) {
      const message = `Desativar "${row.name}"? Novos vínculos deixam de oferecê-lo, mas o histórico é preservado.`;
      if (!window.confirm(message)) return;
    }

    setToggling(row.id);
    setError(null);
    try {
      const { ok, error: apiError } = await callApi(
        `/api/configuracoes/${def.id}/${row.id}`,
        "PATCH",
        { active: !row.active },
      );
      if (!ok) {
        setError(apiError ?? "Erro ao atualizar o status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <CatalogForm
          key={editingId ?? "new"}
          def={def}
          initial={editing}
          onSaved={(created) => {
            if (!created) setEditingId(null);
            router.refresh();
          }}
        />
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">Código</th>
                <th className="px-4 py-2 font-medium text-slate-700">Nome</th>
                {def.hasType ? (
                  <th className="px-4 py-2 font-medium text-slate-700">
                    Tipo
                  </th>
                ) : null}
                <th className="px-4 py-2 font-medium text-slate-700">
                  Status
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Criado em
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={def.hasType ? 6 : 5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Nenhum registro. Crie o primeiro abaixo.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs text-slate-700">
                      {row.code}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {row.name}
                      {row.location ? (
                        <span className="block text-xs font-normal text-slate-500">
                          {row.location}
                          {row.responsible ? ` · ${row.responsible}` : ""}
                        </span>
                      ) : row.responsible ? (
                        <span className="block text-xs font-normal text-slate-500">
                          {row.responsible}
                        </span>
                      ) : null}
                    </td>
                    {def.hasType ? (
                      <td className="px-4 py-2 text-slate-700">
                        {row.type
                          ? (WAREHOUSE_TYPE_LABELS[row.type] ?? row.type)
                          : "—"}
                      </td>
                    ) : null}
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {row.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.createdAt}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="inline-flex gap-3">
                        <button
                          type="button"
                          className="text-sm font-medium text-sky-700 hover:underline"
                          onClick={() => setEditingId(row.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-slate-600 hover:underline disabled:opacity-50"
                          disabled={toggling === row.id}
                          onClick={() => void toggle(row)}
                        >
                          {toggling === row.id
                            ? "..."
                            : row.active
                              ? "Desativar"
                              : "Reativar"}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
