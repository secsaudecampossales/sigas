import { getServerSession } from "next-auth";
import Link from "next/link";
import { subDays } from "date-fns";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  REQUEST_STATUS_BADGE_CLASSES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_ORDER,
} from "@/lib/requests/labels";
import { RequestStatus, UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");
const LIST_SIZE = 50;

const VALID_STATUSES = new Set<string>(REQUEST_STATUS_ORDER);

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter =
    sp.status && VALID_STATUSES.has(sp.status)
      ? (sp.status as RequestStatus)
      : null;

  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  const canAnalyze = roleHasPermission(role, "requests.analyze");
  const canFulfill = roleHasPermission(role, "requests.fulfill");
  const canCreate = roleHasPermission(role, "requests.create");
  // Sem permissão de análise/atendimento, o usuário só enxerga o que pediu.
  const canSeeAll = canAnalyze || canFulfill;
  const scope = canSeeAll ? {} : { requesterId: user.id };

  const since30 = subDays(new Date(), 30);

  const [pendentes, emAnalise, aguardando, atendidas30, requests] =
    await Promise.all([
      prisma.materialRequest.count({
        where: { AND: [scope, { status: RequestStatus.PENDENTE }] },
      }),
      prisma.materialRequest.count({
        where: { AND: [scope, { status: RequestStatus.EM_ANALISE }] },
      }),
      prisma.materialRequest.count({
        where: {
          AND: [
            scope,
            {
              status: {
                in: [
                  RequestStatus.APROVADA,
                  RequestStatus.APROVADA_PARCIALMENTE,
                ],
              },
            },
          ],
        },
      }),
      prisma.materialRequest.count({
        where: {
          AND: [
            scope,
            {
              status: {
                in: [
                  RequestStatus.ATENDIDA,
                  RequestStatus.ATENDIDA_PARCIALMENTE,
                ],
              },
              createdAt: { gte: since30 },
            },
          ],
        },
      }),
      prisma.materialRequest.findMany({
        where: { AND: [scope, ...(statusFilter ? [{ status: statusFilter }] : [])] },
        include: {
          requester: { select: { name: true, email: true } },
          sector: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
      }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Solicitações
          </h1>
          <p className="text-sm text-slate-600">
            {canSeeAll
              ? "Pedidos de materiais de todos os setores, do envio ao atendimento."
              : "Pedidos de materiais que você registrou."}
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/solicitacoes/nova">Nova solicitação</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pendentes" value={nf.format(pendentes)} />
        <StatCard title="Em análise" value={nf.format(emAnalise)} />
        <StatCard
          title="Aguardando atendimento"
          value={nf.format(aguardando)}
        />
        <StatCard title="Atendidas (30 dias)" value={nf.format(atendidas30)} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <h2 className="text-lg font-medium text-slate-900">Lista</h2>
          <form
            method="get"
            className="flex items-center gap-2"
            action="/solicitacoes"
          >
            <label htmlFor="status" className="text-sm text-slate-600">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter ?? ""}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Todos</option>
              {REQUEST_STATUS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {REQUEST_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filtrar
            </Button>
            {statusFilter ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/solicitacoes">Limpar</Link>
              </Button>
            ) : null}
          </form>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">Nº</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Solicitante
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Setor
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Itens
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Status
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Enviada em
                </th>
                <th className="px-4 py-2 font-medium text-slate-700"> </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {item.number}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {item.requester.name ?? item.requester.email}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {item.sector.name}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {item._count.items}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        REQUEST_STATUS_BADGE_CLASSES[item.status] ??
                        "bg-slate-100"
                      }`}
                    >
                      {REQUEST_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {dateFmt.format(item.submittedAt ?? item.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/solicitacoes/${item.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {requests.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-slate-500">
            {statusFilter
              ? "Nenhuma solicitação com esse status."
              : canCreate
                ? "Nenhuma solicitação ainda. Clique em “Nova solicitação” para criar a primeira."
                : "Nenhuma solicitação registrada."}
          </p>
        ) : (
          <p className="border-t px-4 py-3 text-xs text-slate-500">
            {requests.length >= LIST_SIZE
              ? `Exibindo as ${LIST_SIZE} mais recentes`
              : `${requests.length} registro(s)`}
          </p>
        )}
      </section>
    </div>
  );
}
