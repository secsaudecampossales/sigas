import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { availableQuantity, isBelowMinimum } from "@/lib/stock/calculations";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { StatCard } from "@/components/dashboard/stat-card";
import { StockFilters } from "@/components/stock/stock-filters";
import { UserRole } from "@/generated/prisma/client";

const PAGE_SIZE = 25;
const nf = new Intl.NumberFormat("pt-BR");

type PageProps = {
  searchParams: Promise<{
    q?: string;
    almox?: string;
    situacao?: string;
    page?: string;
  }>;
};

function buildHref(input: { q: string; almox: string; page: number }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.almox) params.set("almox", input.almox);
  if (input.page > 1) params.set("page", String(input.page));
  const qs = params.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

function statusBadge(active: boolean, physicalQty: number, minStock: number) {
  if (!active) {
    return { label: "Inativo", className: "bg-slate-100 text-slate-600" };
  }
  if (physicalQty <= 0) {
    return { label: "Sem estoque", className: "bg-red-100 text-red-700" };
  }
  if (isBelowMinimum(physicalQty, minStock)) {
    return { label: "Abaixo do mínimo", className: "bg-amber-100 text-amber-800" };
  }
  return { label: "OK", className: "bg-emerald-100 text-emerald-700" };
}

export default async function EstoquePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const {
    q = "",
    almox = "",
    situacao: situacaoParam = "",
    page: pageParam = "1",
  } = await searchParams;

  const query = q.trim();
  // Chip de situação: só valores conhecidos (o resto é ignorado).
  const situacao =
    situacaoParam === "baixo" || situacaoParam === "zerado"
      ? situacaoParam
      : "";
  const requestedPage = Number.parseInt(pageParam, 10);
  const page = Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const allowedIds = filterAccessibleWarehouseIds(
    {
      role: session!.user.role as UserRole,
      warehouseIds: session!.user.warehouseIds,
    },
    warehouses.map((warehouse) => warehouse.id),
  );

  const accessibleWarehouses = warehouses.filter((warehouse) =>
    allowedIds.includes(warehouse.id),
  );

  // Ignora um almoxarifado fora do alcance do usuário em vez de quebrar a busca.
  const selectedWarehouseId = accessibleWarehouses.some(
    (warehouse) => warehouse.id === almox,
  )
    ? almox
    : "";

  const stocks = await prisma.stock.findMany({
    where: {
      warehouseId: {
        in: selectedWarehouseId ? [selectedWarehouseId] : allowedIds,
      },
      ...(query
        ? {
            product: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { code: { contains: query, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          minStock: true,
          active: true,
        },
      },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeStocks = stocks.filter((stock) => stock.product.active);

  // Chip "situação": recorta a listagem (só produtos ativos, alinhado aos
  // contadores do dashboard). Sem chip, mantém tudo — inclusive inativos.
  const visibleStocks = !situacao
    ? stocks
    : activeStocks.filter((stock) =>
        situacao === "baixo"
          ? isBelowMinimum(stock.physicalQty, stock.product.minStock)
          : stock.physicalQty <= 0,
      );

  const belowMinimum = activeStocks.filter((stock) =>
    isBelowMinimum(stock.physicalQty, stock.product.minStock),
  ).length;
  const outOfStock = activeStocks.filter(
    (stock) => stock.physicalQty <= 0,
  ).length;
  const totalPhysical = activeStocks.reduce(
    (sum, stock) => sum + stock.physicalQty,
    0,
  );
  const totalAvailable = activeStocks.reduce(
    (sum, stock) => sum + availableQuantity(stock.physicalQty, stock.reservedQty),
    0,
  );
  const totalReserved = activeStocks.reduce(
    (sum, stock) => sum + stock.reservedQty,
    0,
  );

  const totalPages = Math.max(1, Math.ceil(visibleStocks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visibleStocks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hrefBase = { q: query, almox: selectedWarehouseId };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Estoque</h1>
        <p className="text-sm text-slate-600">
          Saldo físico, reservado e disponível por produto e almoxarifado,
          com alertas de estoque mínimo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Itens listados"
          value={nf.format(visibleStocks.length)}
          hint={
            situacao
              ? "Resultado do chip de situação"
              : query || selectedWarehouseId
                ? "Resultado do filtro atual"
                : "Com saldo registrado"
          }
        />
        <StatCard
          title="Abaixo do mínimo"
          value={nf.format(belowMinimum)}
          hint={`${nf.format(outOfStock)} sem estoque`}
          href="/estoque?situacao=baixo"
        />
        <StatCard
          title="Saldo físico total (un.)"
          value={nf.format(totalPhysical)}
        />
        <StatCard
          title="Saldo disponível (un.)"
          value={nf.format(totalAvailable)}
          hint={`Reservado: ${nf.format(totalReserved)}`}
        />
      </div>

      <StockFilters
        key={`${query}|${selectedWarehouseId}|${situacao}`}
        warehouses={accessibleWarehouses}
        query={query}
        warehouseId={selectedWarehouseId}
        situacao={situacao}
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-slate-700">Produto</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Almoxarifado
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Físico
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Reservado
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">
                  Disponível
                </th>
                <th className="px-4 py-2 font-medium text-slate-700">Status</th>
                <th className="px-4 py-2 font-medium text-slate-700">
                  Atualizado
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((stock) => {
                const badge = statusBadge(
                  stock.product.active,
                  stock.physicalQty,
                  stock.product.minStock,
                );
                return (
                  <tr key={stock.id} className="border-t align-top">
                    <td className="px-4 py-2">
                      <Link
                        href={`/produtos/${stock.product.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {stock.product.name}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {stock.product.code}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {stock.warehouse.name}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      {nf.format(stock.physicalQty)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {nf.format(stock.reservedQty)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {nf.format(
                        availableQuantity(stock.physicalQty, stock.reservedQty),
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {stock.updatedAt.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visibleStocks.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-slate-500">
            {situacao === "baixo"
              ? "Nenhum item abaixo do mínimo com os filtros atuais."
              : situacao === "zerado"
                ? "Nenhum item sem estoque com os filtros atuais."
                : (
                    <>
                      Nenhum item de estoque encontrado
                      {query ? (
                        <>
                          {" "}
                          para <span className="font-medium">“{query}”</span>
                        </>
                      ) : null}
                      . Ajuste os filtros ou verifique se o produto já possui
                      saldo registrado.
                    </>
                  )}
          </p>
        ) : null}
      </section>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Página {currentPage} de {totalPages} (
            {nf.format(visibleStocks.length)} itens)
          </span>
          <span className="flex gap-2">
            {currentPage > 1 ? (
              <Link
                className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
                href={buildHref({ ...hrefBase, page: currentPage - 1 })}
              >
                Anterior
              </Link>
            ) : null}
            {currentPage < totalPages ? (
              <Link
                className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
                href={buildHref({ ...hrefBase, page: currentPage + 1 })}
              >
                Próxima
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
