import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission, permissionsForRole } from "@/lib/permissions/roles";
import { UserForm } from "@/components/users/user-form";
import { UserActions } from "@/components/users/user-actions";
import {
  PERMISSION_LABELS,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
} from "@/lib/users/labels";
import { UUID_RE } from "@/lib/users/validation";
import { UserRole } from "@/generated/prisma/client";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function UsuarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

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

  const user = await prisma.user.findUnique({
    where: { id },
    include: { sector: { select: { name: true } } },
  });
  if (!user) notFound();

  const [sectors, warehouses] = await Promise.all([
    prisma.sector.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.warehouse.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Mantém o setor atual no select mesmo que ele tenha sido inativado.
  if (
    user.sectorId &&
    !sectors.some((sector) => sector.id === user.sectorId)
  ) {
    const current = await prisma.sector.findUnique({
      where: { id: user.sectorId },
      select: { id: true, name: true },
    });
    if (current) sectors.push(current);
  }

  const isSelf = user.id === session!.user.id;
  const permissions = permissionsForRole(user.role);
  const warehouseNames = user.warehouseIds.map(
    (warehouseId) =>
      warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ??
      warehouseId,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              {user.name}
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[user.role] ?? "bg-slate-200 text-slate-700"}`}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                user.active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {user.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        </div>
        <Link
          href="/usuarios"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Setor</p>
          <p className="mt-1 text-slate-900">{user.sector?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Almoxarifados</p>
          <p className="mt-1 text-slate-900">
            {warehouseNames.length === 0 ? "—" : warehouseNames.join(", ")}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Criado em</p>
          <p className="mt-1 text-slate-900">
            {dateFormat.format(user.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Última atualização</p>
          <p className="mt-1 text-slate-900">
            {dateFormat.format(user.updatedAt)}
          </p>
        </div>
      </section>

      <UserForm
        mode="edit"
        initial={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sectorId: user.sectorId,
          warehouseIds: user.warehouseIds,
        }}
        sectors={sectors}
        warehouses={warehouses}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {isSelf ? (
          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-medium text-slate-900">
              Status da conta
            </h2>
            <p className="text-sm text-slate-600">
              Você está visualizando o próprio usuário: a desativação da
              própria conta não é permitida.
            </p>
          </section>
        ) : (
          <UserActions userId={user.id} active={user.active} />
        )}

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">
            Permissões do perfil {ROLE_LABELS[user.role] ?? user.role}
          </h2>
          <div className="flex flex-wrap gap-2">
            {permissions.map((permission) => (
              <span
                key={permission}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
              >
                {PERMISSION_LABELS[permission] ?? permission}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            As permissões são sempre validadas no backend, não apenas na
            interface.
          </p>
        </section>
      </div>
    </div>
  );
}
