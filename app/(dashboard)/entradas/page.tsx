import { getServerSession } from "next-auth";
import Link from "next/link";
import { startOfDay, subDays } from "date-fns";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { StatCard } from "@/components/dashboard/stat-card";
import { EntryForm } from "@/components/stock/entry-form";
import {
  ENTRY_TYPES,
  ENTRY_TYPE_BADGE_CLASSES,
  ENTRY_TYPE_LABELS,
} from "@/lib/stock/entry-types";
import { UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");
const HISTORY_SIZE = 50;

export default async function EntradasPage() {
  const session = await getServerSession(authOptions);
  const access = {
    role: session!.user.role as UserRole,
    warehouseIds: session!.user.warehouseIds,
  };
  const canRegister = roleHasPermission(access.role, "stock.move");

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const allowedIds = filterAccessibleWarehouseIds(
    access,
    warehouses.map((warehouse) => warehouse.id),
  );
  const accessibleWarehouses = warehouses.filter((warehouse) =>
    allowedIds.includes(warehouse.id),
  );

  const since30 = subDays(new Date(), 30);
  const today = startOfDay(new Date());
  const entryFilter = {
    type: { in: [...ENTRY_TYPES] },
    warehouseToId: { in: allowedIds },
  };

  const products = canRegister
    ? await prisma.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      })
    : [];

  const entries = await prisma.stockMovement.findMany({
    where: entryFilter,
    include: {
      product: { select: { id: true, code: true, name: true } },
      warehouseTo: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_SIZE,
  });

  const todayCount = await prisma.stockMovement.count({
    where: { ...entryFilter, createdAt: { gte: today } },
  });

  const last30 = await prisma.stockMovement.aggregate({
    where: { ...entryFilter, createdAt: { gte: since30 } },
    _count: { _all: true },
    _sum: { quantity: true },
  });

  const lastEntry = await prisma.stockMovement.findFirst({
    where: entryFilter,
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Entradas</h1>
        <p className="text-sm text-slate-600">
          Registro de recebimentos, devoluções, transferências recebidas,
          doações e implantação inicial, sempre gerando movimentação rastreável.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Entradas hoje" value={nf.format(todayCount)} />
        <StatCard
          title="Entradas (30 dias)"
          value={nf.format(last30._count._all)}
        />
        <StatCard
          title="Un. recebidas (30 dias)"
          value={nf.format(last30._sum?.quantity ?? 0)}
        />
        <StatCard
          title="Última entrada"
          value={
            lastEntry
              ? lastEntry.createdAt.toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">
          Registrar entrada
        </h2>
        {canRegister ? (
          <div className="mt-3">
            <EntryForm products={products} warehouses={accessibleWarehouses} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Seu perfil não tem permissão para registrar entradas. Fale com um
            administrador se isso for necessário para o seu trabalho.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-lg font-medium text-slate-900">
            Últimas entradas
          </h2>
          <span className="text-xs text-slate-500">
            {entries.length >= HISTORY_SIZE
              ? `Exibindo as ${HISTORY_SIZE} mais recentes`
              : `${entries.length} registro(s)`}
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Data / hora
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">Tipo</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Produto
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Almoxarifado
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Qtd.
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Documento
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Registrado por
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {entry.createdAt.toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        ENTRY_TYPE_BADGE_CLASSES[entry.type] ?? "bg-slate-100"
                      }`}
                    >
                      {ENTRY_TYPE_LABELS[entry.type] ?? entry.type}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/produtos/${entry.product.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {entry.product.name}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {entry.product.code}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {entry.warehouseTo?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {nf.format(entry.quantity)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {entry.documentRef ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {entry.user.name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {entries.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma entrada registrada ainda. Use o formulário acima para
            registrar o primeiro recebimento.
          </p>
        ) : null}
      </section>
    </div>
  );
}
