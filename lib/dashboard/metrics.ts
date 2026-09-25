import { prisma } from "@/lib/db";
import { RequestStatus, TransferStatus } from "@prisma/client";
import { startOfDay } from "date-fns";
import { availableQuantity, isBelowMinimum } from "@/lib/stock/calculations";
import {
  filterAccessibleWarehouseIds,
  type WarehouseAccessContext,
} from "@/lib/permissions/warehouse-access";

export async function getDashboardMetrics(access: WarehouseAccessContext) {
  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const allowedIds = filterAccessibleWarehouseIds(
    access,
    warehouses.map((w) => w.id),
  );

  const stocks = await prisma.stock.findMany({
    where: { warehouseId: { in: allowedIds } },
    include: {
      product: { select: { minStock: true, active: true } },
      warehouse: { select: { name: true } },
    },
  });

  const activeProducts = await prisma.product.count({ where: { active: true } });

  let belowMinimum = 0;
  let outOfStock = 0;
  let totalPhysical = 0;

  for (const stock of stocks) {
    if (!stock.product.active) continue;
    totalPhysical += stock.physicalQty;
    if (stock.physicalQty <= 0) outOfStock += 1;
    if (isBelowMinimum(stock.physicalQty, stock.product.minStock)) {
      belowMinimum += 1;
    }
  }

  const today = startOfDay(new Date());

  const [
    pendingRequests,
    inProgressRequests,
    pendingTransfers,
    movementsToday,
  ] = await Promise.all([
    prisma.materialRequest.count({
      where: {
        status: { in: [RequestStatus.PENDENTE, RequestStatus.EM_ANALISE] },
      },
    }),
    prisma.materialRequest.count({
      where: { status: RequestStatus.EM_ATENDIMENTO },
    }),
    prisma.transfer.count({
      where: {
        status: { in: [TransferStatus.PENDENTE, TransferStatus.SAIDA_CONFIRMADA] },
        OR: [
          { fromWarehouseId: { in: allowedIds } },
          { toWarehouseId: { in: allowedIds } },
        ],
      },
    }),
    prisma.stockMovement.count({
      where: {
        createdAt: { gte: today },
        OR: [
          { warehouseFromId: { in: allowedIds } },
          { warehouseToId: { in: allowedIds } },
        ],
      },
    }),
  ]);

  const stockByWarehouse = warehouses
    .filter((w) => allowedIds.includes(w.id))
    .map((warehouse) => {
      const lines = stocks.filter((s) => s.warehouseId === warehouse.id);
      const physical = lines.reduce((sum, s) => sum + s.physicalQty, 0);
      const available = lines.reduce(
        (sum, s) => sum + availableQuantity(s.physicalQty, s.reservedQty),
        0,
      );
      return {
        warehouse: warehouse.name,
        physical,
        available,
      };
    });

  return {
    activeProducts,
    belowMinimum,
    outOfStock,
    totalPhysical,
    pendingRequests,
    inProgressRequests,
    pendingTransfers,
    movementsToday,
    stockByWarehouse,
  };
}
