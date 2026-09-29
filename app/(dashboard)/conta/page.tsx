import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { AccountForm } from "@/components/users/account-form";
import {
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
} from "@/lib/users/labels";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function ContaPage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">
          Usuário não encontrado
        </h1>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              Minha conta
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                ROLE_BADGE_CLASSES[user.role] ?? "bg-slate-200 text-slate-700"
              }`}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                user.active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {user.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Perfil</p>
          <p className="mt-1 text-slate-900">
            {ROLE_LABELS[user.role] ?? user.role}
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

      <section className="max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Dados pessoais</h2>
        <p className="mt-1 text-sm text-slate-600">
          Altere o seu nome e a sua senha. Para outras alterações (perfil,
          almoxarifados, status), fale com um administrador.
        </p>
        <div className="mt-4">
          <AccountForm initialName={user.name} />
        </div>
      </section>
    </div>
  );
}
