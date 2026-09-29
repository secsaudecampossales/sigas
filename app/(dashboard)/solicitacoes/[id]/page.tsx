import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { RequestActions } from "@/components/requests/request-actions";
import {
  REQUEST_STATUS_BADGE_CLASSES,
  REQUEST_STATUS_LABELS,
} from "@/lib/requests/labels";
import { UserRole } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nf = new Intl.NumberFormat("pt-BR");

const CANCELLABLE = new Set([
  "RASCUNHO",
  "PENDENTE",
  "EM_ANALISE",
  "APROVADA",
  "APROVADA_PARCIALMENTE",
  "EM_ATENDIMENTO",
]);

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function SolicitacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  const canAnalyze = roleHasPermission(role, "requests.analyze");
  const canFulfill = roleHasPermission(role, "requests.fulfill");
  const canCreate = roleHasPermission(role, "requests.create");
  const canSeeAll = canAnalyze || canFulfill;

  const request = await prisma.materialRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      sector: { select: { name: true } },
      originWarehouse: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, code: true, name: true } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });
  if (!request) notFound();

  if (!canSeeAll && request.requesterId !== user.id) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem acesso</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta solicitação pertence a outro usuário. Fale com a coordenação se
          precisar acompanhá-la.
        </p>
        <Link
          href="/solicitacoes"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar para solicitações
        </Link>
      </div>
    );
  }

  const isOwner = request.requesterId === user.id;
  const fulfilledTotal = request.items.reduce(
    (sum, item) => sum + item.quantityFulfilled,
    0,
  );
  const canCancel =
    (isOwner || canAnalyze) &&
    CANCELLABLE.has(request.status) &&
    fulfilledTotal === 0;

  const totals = request.items.reduce(
    (acc, item) => ({
      requested: acc.requested + item.quantityRequested,
      approved: acc.approved + item.quantityApproved,
      fulfilled: acc.fulfilled + item.quantityFulfilled,
    }),
    { requested: 0, approved: 0, fulfilled: 0 },
  );

  const actionItems = request.items.map((item) => ({
    id: item.id,
    name: item.product.name,
    requested: item.quantityRequested,
    approved: item.quantityApproved,
    pending: item.quantityApproved - item.quantityFulfilled,
  }));

  // Almoxarifados que o usuário pode baixar (só faz sentido para quem atende
  // e para o caso de a solicitação não ter origem definida).
  let warehouses: Array<{ id: string; name: string }> = [];
  if (canFulfill) {
    const allowedIds = filterAccessibleWarehouseIds(
      { role, warehouseIds: user.warehouseIds },
      (
        await prisma.warehouse.findMany({
          where: { active: true },
          select: { id: true },
        })
      ).map((row) => row.id),
    );
    warehouses = await prisma.warehouse.findMany({
      where: { id: { in: allowedIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {request.number}
          </h1>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              REQUEST_STATUS_BADGE_CLASSES[request.status] ?? "bg-slate-100"
            }`}
          >
            {REQUEST_STATUS_LABELS[request.status] ?? request.status}
          </span>
        </div>
        <Link
          href="/solicitacoes"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Solicitante
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {request.requester.name ?? request.requester.email}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Setor
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {request.sector.name}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Almoxarifado de origem
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {request.originWarehouse?.name ?? "A definir no atendimento"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Enviada em
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {dateFormat.format(request.submittedAt ?? request.createdAt)}
          </p>
          {request.completedAt ? (
            <p className="text-xs text-slate-500">
              Concluída em {dateFormat.format(request.completedAt)}
            </p>
          ) : null}
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
                  Solicitado
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Aprovado
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Atendido
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Pendente
                </th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((item) => {
                const pending =
                  item.quantityApproved - item.quantityFulfilled;
                return (
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
                      {nf.format(item.quantityRequested)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {item.quantityApproved > 0
                        ? nf.format(item.quantityApproved)
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {item.quantityFulfilled > 0
                        ? nf.format(item.quantityFulfilled)
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {pending > 0 ? nf.format(pending) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50 text-slate-700">
                <td className="px-4 py-2 font-medium">Total</td>
                <td className="px-4 py-2 text-right font-medium">
                  {nf.format(totals.requested)}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {totals.approved > 0 ? nf.format(totals.approved) : "—"}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {totals.fulfilled > 0 ? nf.format(totals.fulfilled) : "—"}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {totals.approved - totals.fulfilled > 0
                    ? nf.format(totals.approved - totals.fulfilled)
                    : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {request.notes ? (
          <div className="border-t px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Observações
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {request.notes}
            </p>
          </div>
        ) : null}
      </section>

      <RequestActions
        key={request.status}
        requestId={request.id}
        status={request.status}
        canAnalyze={canAnalyze}
        canFulfill={canFulfill}
        canCancel={canCancel}
        originWarehouseId={request.originWarehouseId}
        warehouses={warehouses}
        items={actionItems}
      />

      {!canCreate && !canAnalyze && !canFulfill ? (
        <p className="text-xs text-slate-500">
          Seu perfil acompanha o andamento das próprias solicitações.
        </p>
      ) : null}
    </div>
  );
}
