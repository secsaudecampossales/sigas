import { getServerSession } from "next-auth";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Package,
  ScanLine,
  Truck,
} from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { getDashboardMetrics } from "@/lib/dashboard/metrics";
import { roleHasPermission } from "@/lib/permissions/roles";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/client";

type QuickAction = { href: string; label: string; icon: typeof Package };

/** Atalhos do dia a dia — cada um aparece só para quem tem a permissão. */
function quickActions(role: UserRole): QuickAction[] {
  const actions: (QuickAction | null)[] = [
    roleHasPermission(role, "stock.move")
      ? { href: "/entradas", label: "Nova entrada", icon: ArrowDownToLine }
      : null,
    roleHasPermission(role, "stock.move")
      ? { href: "/saidas", label: "Nova saída", icon: ArrowUpFromLine }
      : null,
    roleHasPermission(role, "requests.create")
      ? { href: "/solicitacoes/nova", label: "Nova solicitação", icon: ClipboardList }
      : null,
    roleHasPermission(role, "transfers.manage")
      ? { href: "/transferencias/nova", label: "Nova transferência", icon: Truck }
      : null,
    roleHasPermission(role, "inventory.manage")
      ? { href: "/inventarios/nova", label: "Novo inventário", icon: ScanLine }
      : null,
    roleHasPermission(role, "products.manage")
      ? { href: "/produtos/novo", label: "Novo produto", icon: Package }
      : null,
  ];
  return actions.filter((action): action is QuickAction => action !== null);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  const metrics = await getDashboardMetrics({
    role,
    warehouseIds: session!.user.warehouseIds,
  });

  const actions = quickActions(role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Visão operacional dos almoxarifados e pendências do dia. Clique em um
          card para ver o detalhe.
        </p>
      </div>

      {actions.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700">Ações rápidas</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link key={action.href} href={action.href} passHref>
                <Button variant="outline" size="sm">
                  <action.icon className="mr-1.5 h-4 w-4" aria-hidden />
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Produtos ativos"
          value={metrics.activeProducts}
          href="/produtos"
        />
        <StatCard
          title="Itens abaixo do mínimo"
          value={metrics.belowMinimum}
          href="/estoque?situacao=baixo"
        />
        <StatCard
          title="Itens sem estoque"
          value={metrics.outOfStock}
          href="/estoque?situacao=zerado"
        />
        <StatCard
          title="Movimentações hoje"
          value={metrics.movementsToday}
        />
        <StatCard
          title="Solicitações pendentes"
          value={metrics.pendingRequests}
          href="/solicitacoes"
        />
        <StatCard
          title="Solicitações em atendimento"
          value={metrics.inProgressRequests}
          href="/solicitacoes?status=EM_ATENDIMENTO"
        />
        <StatCard
          title="Transferências pendentes"
          value={metrics.pendingTransfers}
          href="/transferencias"
        />
        <StatCard
          title="Saldo físico total (un.)"
          value={metrics.totalPhysical.toLocaleString("pt-BR")}
          href="/estoque"
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
