import { MovementType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { applyStockExit } from "@/lib/stock/movements";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { writeAuditLog } from "@/lib/audit/log";
import { EXIT_TYPES } from "@/lib/stock/exit-types";

type ExitBody = {
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
    const body = (await request.json()) as ExitBody;

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

    // O tipo precisa ser de saída: um ENTRADA_* aqui aumentaria o estoque e
    // apareceria na página de entradas com o sinal trocado.
    if (body.type && !(EXIT_TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json(
        { error: "Tipo de saída inválido." },
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
      applyStockExit(
        {
          productId: body.productId,
          warehouseId: body.warehouseId,
          quantity,
        },
        {
          userId: user.id,
          type: body.type ?? MovementType.SAIDA_CONSUMO,
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
        action: "STOCK_EXIT",
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
