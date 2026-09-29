import { getServerSession } from "next-auth";
import Link from "next/link";
import {
  addDays,
  endOfDay,
  format,
  isValid,
  parse,
  startOfDay,
  subDays,
} from "date-fns";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { getSystemSettings } from "@/lib/config/settings";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { ReportBlocks } from "@/components/reports/report-blocks";
import { ReportPdfButton } from "@/components/reports/report-pdf-button";
import {
  REPORT_TYPES,
  REPORT_TYPE_IDS,
  buildReport,
} from "@/lib/reports/queries";
import { UserRole } from "@/generated/prisma/client";

const MAX_PERIOD_DAYS = 366;

type Search = {
  tipo?: string;
  de?: string;
  ate?: string;
  almox?: string;
};

function parseDay(value: string | undefined, fallback: Date): Date {
  if (value) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
  }
  return fallback;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  if (!roleHasPermission(role, "reports.view")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não tem acesso a relatórios. Fale com a coordenação se
          isso for necessário para o seu trabalho.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const tipo = REPORT_TYPE_IDS.includes(sp.tipo ?? "")
    ? sp.tipo!
    : "movimentacoes";

  const today = new Date();
  let from = startOfDay(parseDay(sp.de, subDays(today, 30)));
  let to = endOfDay(parseDay(sp.ate, today));
  if (from.getTime() > to.getTime()) {
    const oldFrom = from;
    from = startOfDay(to);
    to = endOfDay(oldFrom);
  }
  const maxTo = endOfDay(addDays(from, MAX_PERIOD_DAYS));
  if (to.getTime() > maxTo.getTime()) to = maxTo;

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const allowedIds = filterAccessibleWarehouseIds(
    { role, warehouseIds: user.warehouseIds },
    warehouses.map((warehouse) => warehouse.id),
  );
  const allowedWarehouses = warehouses.filter((warehouse) =>
    allowedIds.includes(warehouse.id),
  );
  const selected = sp.almox
    ? allowedWarehouses.find((warehouse) => warehouse.id === sp.almox) ?? null
    : null;

  const payload = await buildReport(tipo, {
    from,
    to,
    warehouseIds: selected ? [selected.id] : allowedIds,
    warehouseName: selected?.name ?? null,
  });

  // Cabeçalho do PDF com o nome da organização (parâmetro geral).
  const settings = await getSystemSettings();
  payload.title = `${settings.orgName} — ${payload.title}`;

  const linkFor = (nextTipo: string, resetFilters = false) => {
    const params = new URLSearchParams();
    params.set("tipo", nextTipo);
    if (!resetFilters) {
      if (sp.de) params.set("de", sp.de);
      if (sp.ate) params.set("ate", sp.ate);
      if (selected) params.set("almox", selected.id);
    }
    return `/relatorios?${params.toString()}`;
  };

  const filename = `relatorio-${tipo}-${format(today, "yyyy-MM-dd")}.pdf`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-600">{payload.subtitle}</p>
        </div>
        <ReportPdfButton payload={payload} filename={filename} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {REPORT_TYPES.map((report) => (
          <Link
            key={report.id}
            href={linkFor(report.id)}
            className={`border-b-2 px-4 py-2 text-sm ${
              report.id === tipo
                ? "border-sky-600 font-medium text-sky-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {report.label}
          </Link>
        ))}
      </div>

      <form
        method="get"
        action="/relatorios"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input type="hidden" name="tipo" value={tipo} />
        <div className="space-y-1">
          <label htmlFor="de" className="text-xs text-slate-600">
            De
          </label>
          <input
            id="de"
            name="de"
            type="date"
            defaultValue={format(from, "yyyy-MM-dd")}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ate" className="text-xs text-slate-600">
            Até
          </label>
          <input
            id="ate"
            name="ate"
            type="date"
            defaultValue={format(to, "yyyy-MM-dd")}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="almox" className="text-xs text-slate-600">
            Almoxarifado
          </label>
          <select
            id="almox"
            name="almox"
            defaultValue={selected?.id ?? ""}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos os acessíveis</option>
            {allowedWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Aplicar
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={linkFor(tipo, true)}>Limpar</Link>
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {payload.summary.map((item) => (
          <StatCard key={item.label} title={item.label} value={item.value} />
        ))}
      </div>

      <ReportBlocks blocks={payload.blocks} />
    </div>
  );
}
