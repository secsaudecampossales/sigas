import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { InventoryStatus } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CreateBody = {
  warehouseId?: string;
  notes?: string;
  productIds?: string[];
};

const OPEN_STATUSES: InventoryStatus[] = [
  InventoryStatus.ABERTO,
  InventoryStatus.EM_CONTAGEM,
  InventoryStatus.CONFERIDO,
  InventoryStatus.AJUSTADO,
];

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("inventory.manage");
    const body = (await request.json()) as CreateBody;

    if (!body.warehouseId || !UUID_RE.test(body.warehouseId)) {
      return jsonError("Almoxarifado inválido.", 400);
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: body.warehouseId, active: true },
      select: { id: true, name: true },
    });
    if (!warehouse) {
      return jsonError("Almoxarifado inválido ou inativo.", 400);
    }
    assertWarehouseAccess(
      { role: user.role, warehouseIds: user.warehouseIds },
      warehouse.id,
    );

    const open = await prisma.inventory.findFirst({
      where: { warehouseId: warehouse.id, status: { in: OPEN_STATUSES } },
      select: { id: true },
    });
    if (open) {
      return jsonError(
        "Já existe um inventário em aberto para este almoxarifado. Conclua ou cancele-o antes de abrir outro.",
        400,
      );
    }

    // Itens: subset explícito, ou (padrão) todo produto com saldo no
    // almoxarifado. expectedQty congela o saldo do sistema na abertura — é a
    // base da comparação da contagem física.
    let items: Array<{ productId: string; expectedQty: number }> = [];

    if (Array.isArray(body.productIds) && body.productIds.length > 0) {
      if (body.productIds.length > 200) {
        return jsonError("Limite de 200 produtos por inventário.", 400);
      }
      const unique = [...new Set(body.productIds)];
      if (unique.length !== body.productIds.length) {
        return jsonError("Produto repetido na lista.", 400);
      }
      for (const productId of unique) {
        if (!UUID_RE.test(productId)) {
          return jsonError("Produto inválido na lista.", 400);
        }
      }
      const products = await prisma.product.findMany({
        where: { id: { in: unique }, active: true },
        select: { id: true },
      });
      if (products.length !== unique.length) {
        return jsonError(
          "Todos os produtos precisam existir e estar ativos.",
          400,
        );
      }
      const stocks = await prisma.stock.findMany({
        where: { productId: { in: unique }, warehouseId: warehouse.id },
        select: { productId: true, physicalQty: true },
      });
      const stockByProduct = new Map(
        stocks.map((stock) => [stock.productId, stock.physicalQty]),
      );
      items = unique.map((productId) => ({
        productId,
        expectedQty: stockByProduct.get(productId) ?? 0,
      }));
    } else {
      const stocks = await prisma.stock.findMany({
        where: { warehouseId: warehouse.id, physicalQty: { gt: 0 } },
        select: { productId: true, physicalQty: true },
        orderBy: { productId: "asc" },
      });
      items = stocks.map((stock) => ({
        productId: stock.productId,
        expectedQty: stock.physicalQty,
      }));
      if (items.length === 0) {
        return jsonError(
          "Não há produtos com saldo neste almoxarifado para inventariar.",
          400,
        );
      }
    }

    const created = await prisma.inventory.create({
      data: {
        warehouseId: warehouse.id,
        status: InventoryStatus.ABERTO,
        responsibleId: user.id,
        notes: body.notes?.trim() || null,
        items: { create: items },
      },
      include: {
        warehouse: { select: { name: true } },
        responsible: { select: { name: true, email: true } },
        items: { select: { id: true } },
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "INVENTORY_CREATE",
      entity: "Inventory",
      entityId: created.id,
      context: {
        warehouseId: warehouse.id,
        items: created.items.length,
        notes: created.notes,
      },
    });

    return NextResponse.json({ inventory: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
