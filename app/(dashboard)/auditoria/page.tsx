import { getServerSession } from "next-auth";
import Link from "next/link";
import { addDays, endOfDay, isValid, parse, startOfDay, subDays } from "date-fns";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  actionBadgeClasses,
  entityLink,
} from "@/lib/audit/labels";
import { Prisma, UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");
const LIST_SIZE = 100;
const MAX_PERIOD_DAYS = 366;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function parseDay(value: string | undefined, fallback: Date): Date {
  if (value) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
  }
  return fallback;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    de?: string;
    ate?: string;
    usuario?: string;
    entidade?: string;
    acao?: string;
  }>;
}) {
  const sp = await searchParams;

  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  if (!roleHasPermission(role, "audit.view")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode consultar a auditoria do sistema. Fale com a
          coordenação se isso for necessário para o seu trabalho.
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

  // Período: default 30 dias; datas inválidas caem no default; de > ate
  // inverte; máximo de 366 dias.
  const today = new Date();
  let from = startOfDay(parseDay(sp.de, subDays(today, 30)));
  let to = endOfDay(parseDay(sp.ate, today));
  if (from.getTime() > to.getTime()) {
    const oldFrom = from;
    from = startOfDay(to);
    to = endOfDay(oldFrom);
  }
  const maxTo = endOfDay(addDays(from, MAX_PERIOD_DAYS));
  if (to.getTime() > maxTo.getTime()) to = maxTo;

  const [users, entityOptions, actionOptions] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.auditLog.findMany({
      distinct: ["entity"],
      orderBy: { entity: "asc" },
      select: { entity: true },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      orderBy: { action: "asc" },
      select: { action: true },
    }),
  ]);

  // Filtros inválidos são ignorados (mesma filosofia das outras listas).
  const usuario =
    sp.usuario && UUID_RE.test(sp.usuario) && users.some((u) => u.id === sp.usuario)
      ? sp.usuario
      : null;
  const entidade =
    sp.entidade && entityOptions.some((e) => e.entity === sp.entidade)
      ? sp.entidade
      : null;
  const acao =
    sp.acao && actionOptions.some((a) => a.action === sp.acao)
      ? sp.acao
      : null;

  const periodWhere: Prisma.AuditLogWhereInput = {
    createdAt: { gte: from, lte: to },
  };
  const where: Prisma.AuditLogWhereInput = {
    ...periodWhere,
    ...(usuario ? { userId: usuario } : {}),
    ...(entidade ? { entity: entidade } : {}),
    ...(acao ? { action: acao } : {}),
  };

  const since24 = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const [totalGeral, ultimas24, noPeriodo, distinctEntities, logs] =
    await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: since24 } } }),
      prisma.auditLog.count({ where: periodWhere }),
      prisma.auditLog.findMany({
        where: periodWhere,
        distinct: ["entity"],
        select: { entity: true },
      }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
      }),
    ]);

  const userName = new Map(
    users.map((user) => [user.id, user.name || user.email]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Auditoria</h1>
        <p className="text-sm text-slate-600">
          Ações sensíveis registradas no sistema: quem fez, o quê, quando e o
          contexto.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Registros totais" value={nf.format(totalGeral)} />
        <StatCard title="Últimas 24 horas" value={nf.format(ultimas24)} />
        <StatCard title="No período" value={nf.format(noPeriodo)} />
        <StatCard
          title="Entidades no período"
          value={nf.format(distinctEntities.length)}
        />
      </div>

      <form
        method="get"
        action="/auditoria"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="space-y-1">
          <label htmlFor="de" className="text-xs text-slate-600">
            De
          </label>
          <input
            id="de"
            name="de"
            type="date"
            defaultValue={formatInput(from)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ate" className="text-xs text-slate-600">
            Até
          </label>
          <input
            id="ate"
            name="ate"
            type="date"
            defaultValue={formatInput(to)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="usuario" className="text-xs text-slate-600">
            Usuário
          </label>
          <select
            id="usuario"
            name="usuario"
            defaultValue={usuario ?? ""}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="entidade" className="text-xs text-slate-600">
            Entidade
          </label>
          <select
            id="entidade"
            name="entidade"
            defaultValue={entidade ?? ""}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todas</option>
            {entityOptions.map((option) => (
              <option key={option.entity} value={option.entity}>
                {ENTITY_LABELS[option.entity] ?? option.entity}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="acao" className="text-xs text-slate-600">
            Ação
          </label>
          <select
            id="acao"
            name="acao"
            defaultValue={acao ?? ""}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todas</option>
            {actionOptions.map((option) => (
              <option key={option.action} value={option.action}>
                {option.action}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Aplicar
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/auditoria">Limpar</Link>
        </Button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Data / hora
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Usuário
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">Ação</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Entidade
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Registro
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Contexto
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Nenhum registro com os filtros atuais.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const href = entityLink(log.entity, log.entityId);
                  const registry = log.entityId
                    ? `${log.entityId.slice(0, 8)}…`
                    : "—";
                  return (
                    <tr key={log.id} className="border-t align-top">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700">
                        {dateTimeFmt.format(log.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {log.user
                          ? log.user.name || log.user.email
                          : (userName.get(log.userId ?? "") ?? "—")}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionBadgeClasses(log.action)}`}
                          title={log.action}
                        >
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {ENTITY_LABELS[log.entity] ?? log.entity}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {href ? (
                          <Link
                            href={href}
                            className="font-mono text-xs text-sky-700 hover:underline"
                            title={log.entityId ?? undefined}
                          >
                            {registry}
                          </Link>
                        ) : (
                          <span
                            className="font-mono text-xs text-slate-500"
                            title={log.entityId ?? undefined}
                          >
                            {registry}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {log.context ? (
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-sky-700">
                              Ver
                            </summary>
                            <pre className="mt-1 max-h-40 max-w-md overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {logs.length >= LIST_SIZE ? (
          <p className="border-t px-4 py-3 text-xs text-slate-500">
            Exibindo os {LIST_SIZE} registros mais recentes.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function formatInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
