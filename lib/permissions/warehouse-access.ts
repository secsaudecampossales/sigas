import { UserRole } from "@prisma/client";
import { roleHasPermission } from "./roles";

export type WarehouseAccessContext = {
  role: UserRole;
  warehouseIds: string[];
};

export function canAccessWarehouse(
  ctx: WarehouseAccessContext,
  warehouseId: string,
): boolean {
  if (roleHasPermission(ctx.role, "stock.view_all_warehouses")) {
    return true;
  }
  return ctx.warehouseIds.includes(warehouseId);
}

export function assertWarehouseAccess(
  ctx: WarehouseAccessContext,
  warehouseId: string,
): void {
  if (!canAccessWarehouse(ctx, warehouseId)) {
    throw new Error("Acesso negado ao almoxarifado informado.");
  }
}

export function filterAccessibleWarehouseIds(
  ctx: WarehouseAccessContext,
  warehouseIds: string[],
): string[] {
  if (roleHasPermission(ctx.role, "stock.view_all_warehouses")) {
    return warehouseIds;
  }
  const allowed = new Set(ctx.warehouseIds);
  return warehouseIds.filter((id) => allowed.has(id));
}
