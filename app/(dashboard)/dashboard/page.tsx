import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getDashboardMetrics } from "@/lib/dashboard/metrics";
import { StatCard } from "@/components/dashboard/stat-card";
import { UserRole } from "@prisma/client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  const metrics = await getDashboardMetrics({
    role,
    warehouseIds: session!.user.warehouseIds,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Visão operacional dos almoxarifados e pendências do dia.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Produtos ativos" value={metrics.activeProducts} />
        <StatCard
          title="Itens abaixo do mínimo"
          value={metrics.belowMinimum}
        />
        <StatCard title="Itens sem estoque" value={metrics.outOfStock} />
        <StatCard
          title="Movimentações hoje"
          value={metrics.movementsToday}
        />
        <StatCard
          title="Solicitações pendentes"
          value={metrics.pendingRequests}
        />
        <StatCard
          title="Solicitações em atendimento"
          value={metrics.inProgressRequests}
        />
        <StatCard
          title="Transferências pendentes"
          value={metrics.pendingTransfers}
        />
        <StatCard
          title="Saldo físico total (un.)"
          value={metrics.totalPhysical.toLocaleString("pt-BR")}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-medium text-slate-900">
          Estoque por almoxarifado
        </h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {metrics.stockByWarehouse.map((row) => (
            <li
              key={row.warehouse}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="font-medium text-slate-800">{row.warehouse}</span>
              <span className="text-slate-600">
                Físico: {row.physical.toLocaleString("pt-BR")} · Disponível:{" "}
                {row.available.toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
