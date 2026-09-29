import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  ROLE_ORDER,
} from "@/lib/users/labels";
import { Prisma, UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");
const LIST_SIZE = 50;
const VALID_ROLES = new Set<string>(ROLE_ORDER);

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string; status?: string }>;
}) {
  const sp = await searchParams;

  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  if (!roleHasPermission(role, "users.manage")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode gerenciar usuários. Fale com a coordenação se
          isso for necessário para o seu trabalho.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const roleFilter =
    sp.perfil && VALID_ROLES.has(sp.perfil) ? sp.perfil : null;
  const statusFilter =
    sp.status === "ATIVO" ? true : sp.status === "INATIVO" ? false : null;

  const conditions: Prisma.UserWhereInput[] = [];
  if (roleFilter) conditions.push({ role: roleFilter as UserRole });
  if (statusFilter !== null) conditions.push({ active: statusFilter });

  const [total, ativos, inativos, administradores, users, warehouses] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.count({ where: { active: false } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.user.findMany({
        where: { AND: conditions },
        include: { sector: { select: { name: true } } },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        take: LIST_SIZE,
      }),
      prisma.warehouse.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const warehouseNames = new Map(
    warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Usuários e permissões
          </h1>
          <p className="text-sm text-slate-600">
            Cadastro de usuários, perfis e vínculo com setores e almoxarifados.
          </p>
        </div>
        <Button asChild>
          <Link href="/usuarios/novo">Novo usuário</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total de usuários" value={nf.format(total)} />
        <StatCard title="Ativos" value={nf.format(ativos)} />
        <StatCard title="Inativos" value={nf.format(inativos)} />
        <StatCard title="Administradores" value={nf.format(administradores)} />
      </div>

      <form
        method="get"
        action="/usuarios"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="space-y-1">
          <label htmlFor="perfil" className="text-xs text-slate-600">
            Perfil
          </label>
          <select
            id="perfil"
            name="perfil"
            defaultValue={roleFilter ?? ""}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos</option>
            {ROLE_ORDER.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className="text-xs text-slate-600">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={sp.status === "ATIVO" || sp.status === "INATIVO" ? sp.status : ""}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </div>
        <Button type="submit" size="sm">
          Aplicar
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/usuarios">Limpar</Link>
        </Button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">Nome</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  E-mail
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Perfil
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">Setor</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Almoxarifados
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Status
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Criado em
                </th>
                <th className="px-4 py-2 font-medium text-slate-700" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Nenhum usuário com os filtros atuais.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {user.name}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{user.email}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[user.role] ?? "bg-slate-200 text-slate-700"}`}
                      >
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {user.sector?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {user.warehouseIds.length === 0
                        ? "—"
                        : user.warehouseIds
                            .map(
                              (warehouseId) =>
                                warehouseNames.get(warehouseId) ?? warehouseId,
                            )
                            .join(", ")}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {user.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {dateFormat.format(user.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/usuarios/${user.id}`}
                        className="text-sm font-medium text-sky-700 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {users.length >= LIST_SIZE ? (
          <p className="border-t px-4 py-3 text-xs text-slate-500">
            Exibindo os {LIST_SIZE} primeiros usuários.
          </p>
        ) : null}
      </section>
    </div>
  );
}
