import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { canAccessWarehouse } from "@/lib/permissions/warehouse-access";
import { InventoryActions } from "@/components/inventory/inventory-actions";
import {
  ADJUSTMENT_BADGE_CLASSES,
  ADJUSTMENT_LABEL,
  INVENTORY_STATUS_BADGE_CLASSES,
  INVENTORY_STATUS_LABELS,
  formatInventoryCode,
} from "@/lib/inventory/labels";
import { UserRole } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const nf = new Intl.NumberFormat("pt-BR");

export default async function InventarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;
  const access = { role, warehouseIds: user.warehouseIds };

  const canManage = roleHasPermission(role, "inventory.manage");
  const canSeeAll =
    canManage || roleHasPermission(role, "stock.view_all_warehouses");

  const inventory = await prisma.inventory.findUnique({
    where: { id },
    include: {
      warehouse: { select: { name: true } },
      responsible: { select: { name: true, email: true } },
      items: {
        include: { product: { select: { id: true, code: true, name: true } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });
  if (!inventory) notFound();

  if (!canSeeAll && !canAccessWarehouse(access, inventory.warehouseId)) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem acesso</h1>
        <p className="mt-2 text-sm text-slate-600">
          Este inventário não pertence a um almoxarifado do seu perfil. Fale
          com a coordenação se precisar acompanhá-lo.
        </p>
        <Link
          href="/inventarios"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar para inventários
        </Link>
      </div>
    );
  }

  const movements = await prisma.stockMovement.findMany({
    where: { referenceType: "Inventory", referenceId: inventory.id },
    include: {
      product: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const counted = inventory.items.filter(
    (item) => item.countedQty !== null,
  ).length;
  const divergences = inventory.items.filter(
    (item) => item.variance !== null && item.variance !== 0,
  );
  const showCountingSummary =
    counted > 0 ||
    ["CONFERIDO", "AJUSTADO", "CONCLUIDO"].includes(inventory.status);

  // Durante a contagem, a tabela editável vive no painel do client — não
  // duplicamos os itens em duas tabelas.
  const isCounting = canManage && inventory.status === "EM_CONTAGEM";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {formatInventoryCode(inventory.id)}
          </h1>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              INVENTORY_STATUS_BADGE_CLASSES[inventory.status] ??
              "bg-slate-100"
            }`}
          >
            {INVENTORY_STATUS_LABELS[inventory.status] ?? inventory.status}
          </span>
        </div>
        <Link
          href="/inventarios"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Almoxarifado
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {inventory.warehouse.name}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Responsável
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {inventory.responsible.name ?? inventory.responsible.email}
          </p>
          <p className="text-xs text-slate-500">
            Iniciado em {dateFormat.format(inventory.startedAt)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Encerrado em
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {inventory.closedAt ? dateFormat.format(inventory.closedAt) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Situação
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {inventory.items.length} item(ns)
            {showCountingSummary ? ` · ${counted} contado(s)` : ""}
            {showCountingSummary
              ? ` · ${divergences.length} divergência(s)`
              : ""}
          </p>
        </div>
      </div>

      {!isCounting ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="px-4 pt-4 text-lg font-medium text-slate-900">
            Itens
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-slate-700">
                    Produto
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Esperado
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Contado
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Divergência
                  </th>
                  <th className="px-4 py-2 font-medium text-slate-700">
                    Justificativa
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventory.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-2">
                      <Link
                        href={`/produtos/${item.product.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {item.product.name}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {item.product.code}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {nf.format(item.expectedQty)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {item.countedQty === null
                        ? "—"
                        : nf.format(item.countedQty)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.variance === null || item.variance === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`font-medium ${
                            item.variance > 0
                              ? "text-emerald-700"
                              : "text-red-600"
                          }`}
                        >
                          {item.variance > 0 ? "+" : ""}
                          {nf.format(item.variance)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {item.justification || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inventory.notes ? (
            <div className="border-t px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Observações
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {inventory.notes}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <InventoryActions
        key={inventory.status}
        inventoryId={inventory.id}
        status={inventory.status}
        canManage={canManage}
        notes={inventory.notes}
        items={inventory.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          code: item.product.code,
          expected: item.expectedQty,
          counted: item.countedQty,
          variance: item.variance,
          justification: item.justification,
        }))}
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-lg font-medium text-slate-900">
            Movimentações de ajuste
          </h2>
          <span className="text-xs text-slate-500">
            {formatInventoryCode(inventory.id)}
          </span>
        </div>

        {movements.length > 0 ? (
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
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Qtd.
                  </th>
                  <th className="px-4 py-2 font-medium text-slate-700">
                    Registrado por
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-t">
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {dateFormat.format(movement.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ADJUSTMENT_BADGE_CLASSES}`}
                      >
                        {ADJUSTMENT_LABEL}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {movement.product.name}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {movement.quantity.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {movement.user.name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">
            Nenhuma movimentação de correção ainda — o ajuste gera uma
            movimentação para cada item divergente.
          </p>
        )}
      </section>
    </div>
  );
}
