import { getServerSession } from "next-auth";
import { startOfDay, subDays } from "date-fns";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExitForm } from "@/components/stock/exit-form";
import {
  ExitHistory,
  type ExitHistoryRow,
} from "@/components/documents/exit-history";
import { EXIT_TYPES } from "@/lib/stock/exit-types";
import { UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");
const HISTORY_SIZE = 50;

export default async function SaidasPage() {
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
  const exitFilter = {
    type: { in: [...EXIT_TYPES] },
    warehouseFromId: { in: allowedIds },
  };

  const products = canRegister
    ? await prisma.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      })
    : [];

  const entries = await prisma.stockMovement.findMany({
    where: exitFilter,
    include: {
      product: { select: { id: true, code: true, name: true } },
      warehouseFrom: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_SIZE,
  });

  const todayCount = await prisma.stockMovement.count({
    where: { ...exitFilter, createdAt: { gte: today } },
  });

  const last30 = await prisma.stockMovement.aggregate({
    where: { ...exitFilter, createdAt: { gte: since30 } },
    _count: { _all: true },
    _sum: { quantity: true },
  });

  const lastExit = await prisma.stockMovement.findFirst({
    where: exitFilter,
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  // Serializa para o client do histórico (o comprovante busca os dados
  // completos — destino, unidade, orgName — na API de emissão).
  const historyRows: ExitHistoryRow[] = entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    quantity: entry.quantity,
    documentRef: entry.documentRef,
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString(),
    product: {
      id: entry.product.id,
      code: entry.product.code,
      name: entry.product.name,
    },
    warehouseFrom: entry.warehouseFrom?.name ?? null,
    registeredBy: entry.user.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saídas</h1>
        <p className="text-sm text-slate-600">
          Baixas por atendimento, consumo interno, perdas e transferências,
          com validação de saldo disponível no servidor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Saídas hoje" value={nf.format(todayCount)} />
        <StatCard title="Saídas (30 dias)" value={nf.format(last30._count._all)} />
        <StatCard
          title="Un. baixadas (30 dias)"
          value={nf.format(last30._sum?.quantity ?? 0)}
        />
        <StatCard
          title="Última saída"
          value={
            lastExit
              ? lastExit.createdAt.toLocaleString("pt-BR", {
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
          Registrar saída
        </h2>
        {canRegister ? (
          <div className="mt-3">
            <ExitForm products={products} warehouses={accessibleWarehouses} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Seu perfil não tem permissão para registrar saídas. Fale com um
            administrador se isso for necessário para o seu trabalho.
          </p>
        )}
      </section>

      <ExitHistory rows={historyRows} limit={HISTORY_SIZE} />
    </div>
  );
}
