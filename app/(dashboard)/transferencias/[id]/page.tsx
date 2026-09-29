import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { canAccessWarehouse } from "@/lib/permissions/warehouse-access";
import { TransferActions } from "@/components/transfers/transfer-actions";
import {
  TRANSFER_STATUS_BADGE_CLASSES,
  TRANSFER_STATUS_LABELS,
} from "@/lib/transfers/labels";
import {
  ENTRY_TYPE_BADGE_CLASSES as ENTRY_BADGE,
  ENTRY_TYPE_LABELS as ENTRY_LABELS,
} from "@/lib/stock/entry-types";
import {
  EXIT_TYPE_BADGE_CLASSES as EXIT_BADGE,
  EXIT_TYPE_LABELS as EXIT_LABELS,
} from "@/lib/stock/exit-types";
import { UserRole } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const TYPE_LABELS: Record<string, string> = { ...ENTRY_LABELS, ...EXIT_LABELS };
const TYPE_BADGES: Record<string, string> = { ...ENTRY_BADGE, ...EXIT_BADGE };

export default async function TransferenciaDetalhePage({
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

  const canManage = roleHasPermission(role, "transfers.manage");
  const canSeeAll =
    canManage || roleHasPermission(role, "stock.view_all_warehouses");

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
      items: {
        include: { product: { select: { id: true, code: true, name: true } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });
  if (!transfer) notFound();

  const involved =
    canAccessWarehouse(access, transfer.fromWarehouseId) ||
    canAccessWarehouse(access, transfer.toWarehouseId);

  if (!canSeeAll && !involved) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem acesso</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta transferência não envolve almoxarifados do seu perfil. Fale com
          a coordenação se precisar acompanhá-la.
        </p>
        <Link
          href="/transferencias"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar para transferências
        </Link>
      </div>
    );
  }

  const movements = await prisma.stockMovement.findMany({
    where: { referenceType: "Transfer", referenceId: transfer.id },
    include: {
      product: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const canConfirmExit =
    canManage && canAccessWarehouse(access, transfer.fromWarehouseId);
  const canReceive =
    canManage && canAccessWarehouse(access, transfer.toWarehouseId);
  const canCancel = canManage && transfer.status === "PENDENTE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {transfer.number}
          </h1>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              TRANSFER_STATUS_BADGE_CLASSES[transfer.status] ?? "bg-slate-100"
            }`}
          >
            {TRANSFER_STATUS_LABELS[transfer.status] ?? transfer.status}
          </span>
        </div>
        <Link
          href="/transferencias"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Origem
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {transfer.fromWarehouse.name}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Destino
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {transfer.toWarehouse.name}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Criada por
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {transfer.createdBy.name ?? transfer.createdBy.email}
          </p>
          <p className="text-xs text-slate-500">
            {dateFormat.format(transfer.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Confirmações
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Saída:{" "}
            {transfer.exitConfirmedAt
              ? dateFormat.format(transfer.exitConfirmedAt)
              : "pendente"}
          </p>
          <p className="text-sm text-slate-700">
            Recebimento:{" "}
            {transfer.receivedAt
              ? dateFormat.format(transfer.receivedAt)
              : "pendente"}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <h2 className="px-4 pt-4 text-lg font-medium text-slate-900">Itens</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Produto
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Quantidade
                </th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map((item) => (
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
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {item.quantity.toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transfer.notes ? (
          <div className="border-t px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Observações
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {transfer.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-lg font-medium text-slate-900">
            Movimentações geradas
          </h2>
          <span className="text-xs text-slate-500">
            Vinculadas a {transfer.number}
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
                  <th className="px-4 py-2 font-medium text-slate-700">
                    Tipo
                  </th>
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
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          TYPE_BADGES[movement.type] ?? "bg-slate-100"
                        }`}
                      >
                        {TYPE_LABELS[movement.type] ?? movement.type}
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
            Nenhuma movimentação registrada ainda — o estoque muda quando a
            saída (origem) e o recebimento (destino) são confirmados.
          </p>
        )}
      </section>

      <TransferActions
        key={transfer.status}
        transferId={transfer.id}
        status={transfer.status}
        canConfirmExit={canConfirmExit}
        canReceive={canReceive}
        canCancel={canCancel}
        fromName={transfer.fromWarehouse.name}
        toName={transfer.toWarehouse.name}
      />
    </div>
  );
}
