import { MovementType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { applyStockEntry } from "@/lib/stock/movements";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { writeAuditLog } from "@/lib/audit/log";

type EntryBody = {
  productId: string;
  warehouseId: string;
  quantity: number;
  type?: MovementType;
  documentRef?: string;
  notes?: string;
  idempotencyKey?: string;
};

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("stock.move");
    const body = (await request.json()) as EntryBody;

    if (!body.productId || !body.warehouseId || !body.quantity) {
      return NextResponse.json(
        { error: "Produto, almoxarifado e quantidade são obrigatórios." },
        { status: 400 },
      );
    }

    assertWarehouseAccess(
      { role: user.role, warehouseIds: user.warehouseIds },
      body.warehouseId,
    );

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
    });
    if (!product || !product.active) {
      return NextResponse.json(
        { error: "Produto inativo ou inexistente." },
        { status: 400 },
      );
    }

    const movement = await prisma.$transaction((tx) =>
      applyStockEntry(
        {
          productId: body.productId,
          warehouseId: body.warehouseId,
          quantity: Number(body.quantity),
        },
        {
          userId: user.id,
          type: body.type ?? MovementType.ENTRADA_COMPRA,
          documentRef: body.documentRef,
          notes: body.notes,
          idempotencyKey: body.idempotencyKey,
        },
        tx,
      ),
    );

    await writeAuditLog({
      userId: user.id,
      action: "STOCK_ENTRY",
      entity: "StockMovement",
      entityId: movement.id,
      context: {
        productId: body.productId,
        warehouseId: body.warehouseId,
        quantity: body.quantity,
      },
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
