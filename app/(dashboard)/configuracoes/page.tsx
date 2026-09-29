import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  CatalogManager,
  type CatalogRow,
  type CatalogDefView,
} from "@/components/config/catalog-manager";
import { SettingsForm } from "@/components/config/settings-form";
import { getSystemSettings } from "@/lib/config/settings";
import {
  CATALOGS,
  CATALOG_IDS,
  SETTINGS_ABA,
  SETTINGS_PERMISSION,
  parseCatalogId,
  type CatalogId,
} from "@/lib/config/catalogs";
import { UserRole } from "@/generated/prisma/client";

const nf = new Intl.NumberFormat("pt-BR");

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

async function countCatalog(id: CatalogId): Promise<number> {
  switch (id) {
    case "almoxarifados":
      return prisma.warehouse.count();
    case "setores":
      return prisma.sector.count();
    case "categorias":
      return prisma.category.count();
    case "unidades":
      return prisma.unit.count();
  }
}

async function loadRows(id: CatalogId): Promise<CatalogRow[]> {
  const base = (row: {
    id: string;
    code: string;
    name: string;
    active: boolean;
    createdAt: Date;
    type?: string;
    location?: string | null;
    responsible?: string | null;
  }): CatalogRow => ({
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type ?? null,
    location: row.location ?? null,
    responsible: row.responsible ?? null,
    active: row.active,
    createdAt: dateFormat.format(row.createdAt),
  });

  switch (id) {
    case "almoxarifados": {
      const rows = await prisma.warehouse.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
      });
      return rows.map((row) => base({ ...row, type: row.type }));
    }
    case "setores": {
      const rows = await prisma.sector.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
      });
      return rows.map(base);
    }
    case "categorias": {
      const rows = await prisma.category.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
      });
      return rows.map(base);
    }
    case "unidades": {
      const rows = await prisma.unit.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
      });
      return rows.map(base);
    }
  }
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const sp = await searchParams;

  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  const permitted = CATALOG_IDS.filter((id) =>
    roleHasPermission(role, CATALOGS[id].permission),
  );
  const canSettings = roleHasPermission(role, SETTINGS_PERMISSION);

  if (permitted.length === 0 && !canSettings) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode gerenciar as configurações do sistema. Fale com
          a coordenação se isso for necessário para o seu trabalho.
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

  const abas: Array<{ id: string; label: string }> = [
    ...permitted.map((id) => ({ id, label: CATALOGS[id].label })),
    ...(canSettings ? [{ id: SETTINGS_ABA, label: "Parâmetros gerais" }] : []),
  ];

  // Aba pedida sem permissão -> painel específico; ausente/inválida -> a
  // primeira aba liberada do perfil.
  const requested = sp.aba ?? "";
  const requestedCatalog = parseCatalogId(requested);
  let denied = false;
  let activeAba = "";
  if (requested === SETTINGS_ABA) {
    if (canSettings) activeAba = SETTINGS_ABA;
    else denied = true;
  } else if (requestedCatalog) {
    if (permitted.includes(requestedCatalog)) activeAba = requestedCatalog;
    else denied = true;
  } else {
    activeAba = abas[0]?.id ?? "";
  }

  const counts = await Promise.all(permitted.map((id) => countCatalog(id)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-600">
          Almoxarifados, setores, categorias, unidades e parâmetros gerais do
          sistema.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {permitted.map((id, index) => (
          <StatCard
            key={id}
            title={CATALOGS[id].label}
            value={nf.format(counts[index])}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {abas.map((aba) => (
          <Link
            key={aba.id}
            href={`/configuracoes?aba=${aba.id}`}
            className={`border-b-2 px-4 py-2 text-sm ${
              !denied && aba.id === activeAba
                ? "border-sky-600 font-medium text-sky-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {aba.label}
          </Link>
        ))}
      </div>

      {denied ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">
            Sem permissão
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Seu perfil não tem acesso a esta área de configuração.
          </p>
          <Link
            href="/configuracoes"
            className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
          >
            Ir para as configurações disponíveis
          </Link>
        </div>
      ) : activeAba === SETTINGS_ABA ? (
        <ConfigSettingsSection />
      ) : activeAba ? (
        <ConfigCatalogSection id={activeAba as CatalogId} />
      ) : null}
    </div>
  );
}

async function ConfigCatalogSection({ id }: { id: CatalogId }) {
  const rows = await loadRows(id);
  const def = CATALOGS[id];
  const view: CatalogDefView = {
    id: def.id,
    label: def.label,
    singular: def.singular,
    hasType: def.hasType,
    article: def.article,
  };
  return <CatalogManager def={view} rows={rows} />;
}

async function ConfigSettingsSection() {
  const settings = await getSystemSettings();
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <SettingsForm initial={settings} />
      </section>
      <p className="text-sm text-slate-600">
        Os parâmetros valem para todo o sistema: o nome é exibido no
        cabeçalho dos PDFs de relatório e na tela de acesso; o contato
        aparece na tela de acesso.
      </p>
    </div>
  );
}
