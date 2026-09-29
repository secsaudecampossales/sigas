import { getServerSession } from "next-auth";
import Link from "next/link";
import { subDays } from "date-fns";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  INVENTORY_STATUS_BADGE_CLASSES,
  INVENTORY_STATUS_LABELS,
  INVENTORY_STATUS_ORDER,
  formatInventoryCode,
} from "@/lib/inventory/labels";
import { InventoryStatus, UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");
const LIST_SIZE = 50;

const VALID_STATUSES = new Set<string>(INVENTORY_STATUS_ORDER);

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const DIVERGENCE_STATUSES = ["CONFERIDO", "AJUSTADO", "CONCLUIDO"];

function divergenceCount(inventory: {
  status: string;
  items: Array<{ variance: number | null }>;
}): number | null {
  if (!DIVERGENCE_STATUSES.includes(inventory.status)) return null;
  return inventory.items.filter(
    (item) => item.variance !== null && item.variance !== 0,
  ).length;
}

export default async function InventariosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter =
    sp.status && VALID_STATUSES.has(sp.status)
      ? (sp.status as InventoryStatus)
      : null;

  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  const canManage = roleHasPermission(role, "inventory.manage");
  const canSeeAll =
    canManage || roleHasPermission(role, "stock.view_all_warehouses");
  // Sem visão global, aparecem só inventários de almoxarifados acessíveis.
  const scope = canSeeAll
    ? {}
    : { warehouseId: { in: user.warehouseIds } };

  const since30 = subDays(new Date(), 30);

  const [abertos, emContagem, aguardandoAjuste, concluidos30, inventories] =
    await Promise.all([
      prisma.inventory.count({
        where: { AND: [scope, { status: InventoryStatus.ABERTO }] },
      }),
      prisma.inventory.count({
        where: { AND: [scope, { status: InventoryStatus.EM_CONTAGEM }] },
      }),
      prisma.inventory.count({
        where: { AND: [scope, { status: InventoryStatus.CONFERIDO }] },
      }),
      prisma.inventory.count({
        where: {
          AND: [
            scope,
            { status: InventoryStatus.CONCLUIDO, closedAt: { gte: since30 } },
          ],
        },
      }),
      prisma.inventory.findMany({
        where: {
          AND: [scope, ...(statusFilter ? [{ status: statusFilter }] : [])],
        },
        include: {
          warehouse: { select: { name: true } },
          responsible: { select: { name: true, email: true } },
          items: { select: { variance: true } },
        },
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
      }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventários</h1>
          <p className="text-sm text-slate-600">
            Contagem física, divergências, recontagem e ajustes com justificativa
            e movimentação de correção.
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href="/inventarios/nova">Novo inventário</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Abertos" value={nf.format(abertos)} />
        <StatCard title="Em contagem" value={nf.format(emContagem)} />
        <StatCard title="Aguardando ajuste" value={nf.format(aguardandoAjuste)} />
        <StatCard title="Concluídos (30 dias)" value={nf.format(concluidos30)} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <h2 className="text-lg font-medium text-slate-900">Lista</h2>
          <form
            method="get"
            className="flex items-center gap-2"
            action="/inventarios"
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
              {INVENTORY_STATUS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {INVENTORY_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filtrar
            </Button>
            {statusFilter ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/inventarios">Limpar</Link>
              </Button>
            ) : null}
          </form>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">Código</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Almoxarifado
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Responsável
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Itens
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Diverg.
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">Status</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Iniciado em
                </th>
                <th className="px-4 py-2 font-medium text-slate-700"> </th>
              </tr>
            </thead>
            <tbody>
              {inventories.map((inventory) => (
                <tr key={inventory.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {formatInventoryCode(inventory.id)}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {inventory.warehouse.name}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {inventory.responsible.name ?? inventory.responsible.email}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {inventory.items.length}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {(() => {
                      const divergences = divergenceCount(inventory);
                      return divergences === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`font-medium ${
                            divergences > 0
                              ? "text-amber-700"
                              : "text-slate-900"
                          }`}
                        >
                          {divergences}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        INVENTORY_STATUS_BADGE_CLASSES[inventory.status] ??
                        "bg-slate-100"
                      }`}
                    >
                      {INVENTORY_STATUS_LABELS[inventory.status] ??
                        inventory.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {dateFormat.format(inventory.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/inventarios/${inventory.id}`}
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

        {inventories.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-slate-500">
            {statusFilter
              ? "Nenhum inventário com esse status."
              : canManage
                ? "Nenhum inventário ainda. Clique em “Novo inventário” para abrir o primeiro."
                : "Nenhum inventário nos seus almoxarifados."}
          </p>
        ) : (
          <p className="border-t px-4 py-3 text-xs text-slate-500">
            {inventories.length >= LIST_SIZE
              ? `Exibindo os ${LIST_SIZE} mais recentes`
              : `${inventories.length} registro(s)`}
          </p>
        )}
      </section>
    </div>
  );
}
