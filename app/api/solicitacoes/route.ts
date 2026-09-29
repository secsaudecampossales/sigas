import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { RequestStatus } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CreateBody = {
  sectorId?: string;
  originWarehouseId?: string | null;
  notes?: string;
  items?: Array<{ productId?: string; quantity?: number | string }>;
};

/** Gera `SOL-AAAA-0001` único, com nova tentativa em caso de colisão. */
async function nextRequestNumber() {
  const prefix = `SOL-${new Date().getFullYear()}-`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.materialRequest.count({
      where: { number: { startsWith: prefix } },
    });
    const candidate = `${prefix}${String(count + 1).padStart(4, "0")}`;
    const exists = await prisma.materialRequest.findFirst({
      where: { number: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new Error("Não foi possível gerar um número único para a solicitação.");
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("requests.create");
    const body = (await request.json()) as CreateBody;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return jsonError("Adicione ao menos um item à solicitação.", 400);
    }
    if (body.items.length > 100) {
      return jsonError("Limite de 100 itens por solicitação.", 400);
    }

    // Setor: o do usuário tem prioridade; sem ele, o form deve informar.
    let sectorId: string | null = user.sectorId ?? null;
    if (!sectorId) {
      sectorId = body.sectorId ?? null;
      if (!sectorId || !UUID_RE.test(sectorId)) {
        return jsonError("Selecione o setor de origem.", 400);
      }
      const sector = await prisma.sector.findFirst({
        where: { id: sectorId, active: true },
        select: { id: true },
      });
      if (!sector) {
        return jsonError("Setor inválido ou inativo.", 400);
      }
    }

    let originWarehouseId: string | null = null;
    if (body.originWarehouseId) {
      if (!UUID_RE.test(body.originWarehouseId)) {
        return jsonError("Almoxarifado de origem inválido.", 400);
      }
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: body.originWarehouseId, active: true },
        select: { id: true },
      });
      if (!warehouse) {
        return jsonError("Almoxarifado inválido ou inativo.", 400);
      }
      assertWarehouseAccess(
        { role: user.role, warehouseIds: user.warehouseIds },
        warehouse.id,
      );
      originWarehouseId = warehouse.id;
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
        return jsonError("Todas as quantidades devem ser maiores que zero.", 400);
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

    const number = await nextRequestNumber();
    const created = await prisma.materialRequest.create({
      data: {
        number,
        status: RequestStatus.PENDENTE,
        requesterId: user.id,
        sectorId,
        originWarehouseId,
        notes: body.notes?.trim() || null,
        submittedAt: new Date(),
        items: {
          create: body.items.map((item) => ({
            productId: item.productId!,
            quantityRequested: Number(item.quantity),
            quantityApproved: 0,
            quantityFulfilled: 0,
            quantityPending: 0,
          })),
        },
      },
      include: {
        items: true,
        sector: { select: { name: true } },
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "REQUEST_CREATE",
      entity: "MaterialRequest",
      entityId: created.id,
      context: { number: created.number, items: created.items.length },
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
