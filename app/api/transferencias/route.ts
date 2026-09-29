import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { TransferStatus } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CreateBody = {
  fromWarehouseId?: string;
  toWarehouseId?: string;
  notes?: string;
  items?: Array<{ productId?: string; quantity?: number | string }>;
};

/** Gera `TRF-AAAA-0001` único, com nova tentativa em caso de colisão. */
async function nextTransferNumber() {
  const prefix = `TRF-${new Date().getFullYear()}-`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.transfer.count({
      where: { number: { startsWith: prefix } },
    });
    const candidate = `${prefix}${String(count + 1).padStart(4, "0")}`;
    const exists = await prisma.transfer.findFirst({
      where: { number: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new Error("Não foi possível gerar um número único para a transferência.");
}

async function findWarehouse(id: string) {
  return prisma.warehouse.findFirst({
    where: { id, active: true },
    select: { id: true, name: true },
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("transfers.manage");
    const body = (await request.json()) as CreateBody;

    if (!body.fromWarehouseId || !UUID_RE.test(body.fromWarehouseId)) {
      return jsonError("Almoxarifado de origem inválido.", 400);
    }
    if (!body.toWarehouseId || !UUID_RE.test(body.toWarehouseId)) {
      return jsonError("Almoxarifado de destino inválido.", 400);
    }
    if (body.fromWarehouseId === body.toWarehouseId) {
      return jsonError(
        "Origem e destino devem ser almoxarifados diferentes.",
        400,
      );
    }

    const fromWarehouse = await findWarehouse(body.fromWarehouseId);
    if (!fromWarehouse) {
      return jsonError("Almoxarifado de origem inválido ou inativo.", 400);
    }
    assertWarehouseAccess(
      { role: user.role, warehouseIds: user.warehouseIds },
      fromWarehouse.id,
    );

    const toWarehouse = await findWarehouse(body.toWarehouseId);
    if (!toWarehouse) {
      return jsonError("Almoxarifado de destino inválido ou inativo.", 400);
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return jsonError("Adicione ao menos um item à transferência.", 400);
    }
    if (body.items.length > 100) {
      return jsonError("Limite de 100 itens por transferência.", 400);
    }

    const seen = new Set<string>();
    for (const item of body.items) {
      if (!item?.productId || !UUID_RE.test(item.productId)) {
        return jsonError("Produto inválido na lista de itens.", 400);
      }
      if (seen.has(item.productId)) {
        return jsonError("Produto repetido na lista de itens.", 400);
      }
      seen.add(item.productId);
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return jsonError(
          "Todas as quantidades devem ser maiores que zero.",
          400,
        );
      }
    }

    const products = await prisma.product.findMany({
      where: { id: { in: [...seen] }, active: true },
      select: { id: true },
    });
    if (products.length !== seen.size) {
      return jsonError(
        "Todos os produtos precisam existir e estar ativos.",
        400,
      );
    }

    const number = await nextTransferNumber();
    const created = await prisma.transfer.create({
      data: {
        number,
        status: TransferStatus.PENDENTE,
        fromWarehouseId: fromWarehouse.id,
        toWarehouseId: toWarehouse.id,
        createdById: user.id,
        notes: body.notes?.trim() || null,
        items: {
          create: body.items.map((item) => ({
            productId: item.productId!,
            quantity: Number(item.quantity),
          })),
        },
      },
      include: {
        items: true,
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "TRANSFER_CREATE",
      entity: "Transfer",
      entityId: created.id,
      context: {
        number: created.number,
        fromWarehouseId: fromWarehouse.id,
        toWarehouseId: toWarehouse.id,
        items: created.items.length,
      },
    });

    return NextResponse.json({ transfer: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
