import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { availableQuantity } from "@/lib/stock/calculations";
import {
  filterAccessibleWarehouseIds,
  canAccessWarehouse,
} from "@/lib/permissions/warehouse-access";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("stock.view");
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const warehouseId = searchParams.get("warehouseId");
    const q = searchParams.get("q")?.trim();

    const warehouses = await prisma.warehouse.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true },
    });

    const allowedWarehouseIds = filterAccessibleWarehouseIds(
      { role: user.role, warehouseIds: user.warehouseIds },
      warehouses.map((w) => w.id),
    );

    if (productId) {
      const stocks = await prisma.stock.findMany({
        where: {
          productId,
          warehouseId: warehouseId
            ? canAccessWarehouse(
                { role: user.role, warehouseIds: user.warehouseIds },
                warehouseId,
              )
              ? warehouseId
              : "__denied__"
            : { in: allowedWarehouseIds },
        },
        include: {
          product: {
            select: {
              code: true,
              name: true,
              minStock: true,
              maxStock: true,
              active: true,
            },
          },
          warehouse: { select: { name: true, type: true } },
        },
      });

      return NextResponse.json({
        consolidated: stocks.map((stock) => ({
          warehouseId: stock.warehouseId,
          warehouseName: stock.warehouse.name,
          warehouseType: stock.warehouse.type,
          physicalQty: stock.physicalQty,
          reservedQty: stock.reservedQty,
          availableQty: availableQuantity(
            stock.physicalQty,
            stock.reservedQty,
          ),
          minStock: stock.product.minStock,
        })),
      });
    }

    const stocks = await prisma.stock.findMany({
      where: {
        warehouseId: { in: allowedWarehouseIds },
        ...(q
          ? {
              product: {
                OR: [{ name: { contains: q } }, { code: { contains: q } }],
              },
            }
          : {}),
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
            minStock: true,
            active: true,
          },
        },
        warehouse: { select: { name: true } },
      },
      take: 100,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      items: stocks.map((stock) => ({
        id: stock.id,
        productCode: stock.product.code,
        productName: stock.product.name,
        warehouseName: stock.warehouse.name,
        physicalQty: stock.physicalQty,
        reservedQty: stock.reservedQty,
        availableQty: availableQuantity(stock.physicalQty, stock.reservedQty),
        belowMinimum: stock.physicalQty < stock.product.minStock,
        productActive: stock.product.active,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
