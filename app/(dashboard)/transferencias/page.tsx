import { getServerSession } from "next-auth";
import Link from "next/link";
import { subDays } from "date-fns";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  TRANSFER_STATUS_BADGE_CLASSES,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_ORDER,
} from "@/lib/transfers/labels";
import { TransferStatus, UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");
const LIST_SIZE = 50;

const VALID_STATUSES = new Set<string>(TRANSFER_STATUS_ORDER);

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function TransferenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter =
    sp.status && VALID_STATUSES.has(sp.status)
      ? (sp.status as TransferStatus)
      : null;

  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  const canManage = roleHasPermission(role, "transfers.manage");
  const canSeeAll = canManage || roleHasPermission(role, "stock.view_all_warehouses");
  // Sem visão global, aparece apenas transferências que saem de ou chegam em
  // almoxarifados acessíveis ao usuário.
  const scope = canSeeAll
    ? {}
    : {
        OR: [
          { fromWarehouseId: { in: user.warehouseIds } },
          { toWarehouseId: { in: user.warehouseIds } },
        ],
      };

  const since30 = subDays(new Date(), 30);

  const [pendentes, emTransito, recebidas30, total30, transfers] =
    await Promise.all([
      prisma.transfer.count({
        where: { AND: [scope, { status: TransferStatus.PENDENTE }] },
      }),
      prisma.transfer.count({
        where: { AND: [scope, { status: TransferStatus.SAIDA_CONFIRMADA }] },
      }),
      prisma.transfer.count({
        where: {
          AND: [
            scope,
            {
              status: TransferStatus.RECEBIDA,
              receivedAt: { gte: since30 },
            },
          ],
        },
      }),
      prisma.transfer.count({
        where: { AND: [scope, { createdAt: { gte: since30 } }] },
      }),
      prisma.transfer.findMany({
        where: {
          AND: [
            scope,
            ...(statusFilter ? [{ status: statusFilter }] : []),
          ],
        },
        include: {
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          createdBy: { select: { name: true, email: true } },
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
            Transferências
          </h1>
          <p className="text-sm text-slate-600">
            Movimentação entre almoxarifados com confirmação de saída na origem
            e recebimento no destino.
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href="/transferencias/nova">Nova transferência</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pendentes de saída" value={nf.format(pendentes)} />
        <StatCard title="Em trânsito" value={nf.format(emTransito)} />
        <StatCard title="Recebidas (30 dias)" value={nf.format(recebidas30)} />
        <StatCard title="Transferências (30 dias)" value={nf.format(total30)} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <h2 className="text-lg font-medium text-slate-900">Lista</h2>
          <form
            method="get"
            className="flex items-center gap-2"
            action="/transferencias"
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
              {TRANSFER_STATUS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {TRANSFER_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filtrar
            </Button>
            {statusFilter ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/transferencias">Limpar</Link>
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
                  Origem
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Destino
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Itens
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Status
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Criada em
                </th>
                <th className="px-4 py-2 font-medium text-slate-700"> </th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {transfer.number}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {transfer.fromWarehouse.name}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {transfer.toWarehouse.name}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {transfer._count.items}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        TRANSFER_STATUS_BADGE_CLASSES[transfer.status] ??
                        "bg-slate-100"
                      }`}
                    >
                      {TRANSFER_STATUS_LABELS[transfer.status] ??
                        transfer.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {dateFmt.format(transfer.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/transferencias/${transfer.id}`}
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

        {transfers.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-slate-500">
            {statusFilter
              ? "Nenhuma transferência com esse status."
              : canManage
                ? "Nenhuma transferência ainda. Clique em “Nova transferência” para criar a primeira."
                : "Nenhuma transferência nos seus almoxarifados."}
          </p>
        ) : (
          <p className="border-t px-4 py-3 text-xs text-slate-500">
            {transfers.length >= LIST_SIZE
              ? `Exibindo as ${LIST_SIZE} mais recentes`
              : `${transfers.length} registro(s)`}
          </p>
        )}
      </section>
    </div>
  );
}
