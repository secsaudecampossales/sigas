import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { filterAccessibleWarehouseIds } from "@/lib/permissions/warehouse-access";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { UserRole } from "@/generated/prisma/client";

export default async function NovoInventarioPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const role = user.role as UserRole;

  if (!roleHasPermission(role, "inventory.manage")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode abrir inventários. Fale com a coordenação se isso
          for necessário para o seu trabalho.
        </p>
        <Link
          href="/inventarios"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar para inventários
        </Link>
      </div>
    );
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const allowedIds = filterAccessibleWarehouseIds(
    { role, warehouseIds: user.warehouseIds },
    warehouses.map((warehouse) => warehouse.id),
  );
  const accessible = warehouses.filter((warehouse) =>
    allowedIds.includes(warehouse.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Novo inventário
          </h1>
          <p className="text-sm text-slate-600">
            Ao abrir, o sistema congela o saldo de cada produto do almoxarifado
            como quantidade esperada — a contagem física é comparada a esse
            retrato.
          </p>
        </div>
        <Link
          href="/inventarios"
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      <InventoryForm warehouses={accessible} />
    </div>
  );
}
