import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { TransferForm } from "@/components/transfers/transfer-form";
import { UserRole } from "@/generated/prisma/client";

export default async function NovaTransferenciaPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  if (!roleHasPermission(role, "transfers.manage")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode criar transferências entre almoxarifados. Fale
          com a coordenação se isso for necessário para o seu trabalho.
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

  const [products, allWarehouses] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Origem: só o que o usuário pode operar. Destino: qualquer almoxarifado
  // ativo (a recepção é confirmada por quem tem acesso lá).
  const originIds = filterAccessibleWarehouseIds(
    { role, warehouseIds: user.warehouseIds },
    allWarehouses.map((warehouse) => warehouse.id),
  );
  const originWarehouses = allWarehouses.filter((warehouse) =>
    originIds.includes(warehouse.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Nova transferência
          </h1>
          <p className="text-sm text-slate-600">
            O estoque só sai da origem quando a saída for confirmada e só
            entra no destino quando o recebimento for confirmado.
          </p>
        </div>
        <Link
          href="/transferencias"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <TransferForm
        products={products}
        originWarehouses={originWarehouses}
        allWarehouses={allWarehouses}
      />
    </div>
  );
}
