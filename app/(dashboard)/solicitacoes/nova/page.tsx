import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { RequestForm } from "@/components/requests/request-form";
import { UserRole } from "@/generated/prisma/client";

export default async function NovaSolicitacaoPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  if (!roleHasPermission(role, "requests.create")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">
          Sem permissão
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode criar solicitações de materiais. Fale com a
          coordenação se isso for necessário para o seu trabalho.
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

  const fixedSectorId = user.sectorId ?? null;

  const [products, sectors, allWarehouses] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    fixedSectorId
      ? []
      : prisma.sector.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
    prisma.warehouse.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const allowedIds = filterAccessibleWarehouseIds(
    { role, warehouseIds: user.warehouseIds },
    allWarehouses.map((warehouse) => warehouse.id),
  );
  const warehouses = allWarehouses.filter((warehouse) =>
    allowedIds.includes(warehouse.id),
  );

  const fixedSector = fixedSectorId
    ? await prisma.sector.findUnique({
        where: { id: fixedSectorId },
        select: { id: true, name: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Nova solicitação
          </h1>
          <p className="text-sm text-slate-600">
            Pedido de materiais do seu setor. Após o envio, ela entra na fila
            de análise.
          </p>
        </div>
        <Link
          href="/solicitacoes"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <RequestForm
        products={products}
        warehouses={warehouses}
        sectors={sectors}
        fixedSector={fixedSector}
      />
    </div>
  );
}
