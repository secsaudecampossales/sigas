import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { UserForm } from "@/components/users/user-form";
import { UserRole } from "@/generated/prisma/client";

export default async function NovoUsuarioPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  if (!roleHasPermission(role, "users.manage")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode criar usuários. Fale com a coordenação se isso
          for necessário para o seu trabalho.
        </p>
        <Link
          href="/usuarios"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar para usuários
        </Link>
      </div>
    );
  }

  const [sectors, warehouses] = await Promise.all([
    prisma.sector.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Novo usuário
          </h1>
          <p className="text-sm text-slate-600">
            O perfil define as permissões; os vínculos definem setor e quais
            almoxarifados o usuário pode operar.
          </p>
        </div>
        <Link
          href="/usuarios"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <UserForm mode="create" sectors={sectors} warehouses={warehouses} />
    </div>
  );
}
