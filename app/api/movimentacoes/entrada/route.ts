import { MovementType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { applyStockEntry } from "@/lib/stock/movements";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { writeAuditLog } from "@/lib/audit/log";
import { ENTRY_TYPES } from "@/lib/stock/entry-types";

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

    // Guarda de sanidade: `Number("abc")` é NaN e escaparia das comparações
    // de saldo; quantidade também precisa ser positiva.
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Informe uma quantidade numérica maior que zero." },
        { status: 400 },
      );
    }

    // O tipo precisa ser de entrada: um SAIDA_* aqui baixaria o estoque e
    // apareceria na página de saídas com o sinal trocado.
    if (body.type && !(ENTRY_TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json(
        { error: "Tipo de entrada inválido." },
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

    const { movement, created } = await prisma.$transaction((tx) =>
      applyStockEntry(
        {
          productId: body.productId,
          warehouseId: body.warehouseId,
          quantity,
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

    // Replay de idempotência (`created: false`) não gera novo evento de auditoria.
    if (created) {
      await writeAuditLog({
        userId: user.id,
        action: "STOCK_ENTRY",
        entity: "StockMovement",
        entityId: movement.id,
        context: {
          productId: body.productId,
          warehouseId: body.warehouseId,
          quantity,
        },
      });
    }

    return NextResponse.json({ movement }, { status: created ? 201 : 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
