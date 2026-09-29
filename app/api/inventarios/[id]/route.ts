import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { assertInventoryTransition } from "@/lib/inventory/state-machine";
import { applyStockEntry, applyStockExit } from "@/lib/stock/movements";
import { InventoryStatus, MovementType } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CountItem = {
  id?: string;
  countedQty?: number | string;
  justification?: string | null;
};

type PatchBody = {
  action?: string;
  items?: CountItem[];
};

const ACTIONS = new Set([
  "INICIAR_CONTAGEM",
  "LANCAR_CONTAGEM",
  "FINALIZAR_CONTAGEM",
  "RECONTAR",
  "APLICAR_AJUSTE",
  "CONCLUIR",
  "CANCELAR",
]);

const MIN_JUSTIFICATION = 3;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonError("Inventário não encontrado.", 404);
    }

    const body = (await request.json()) as PatchBody;
    const action = body.action ?? "";
    if (!ACTIONS.has(action)) {
      return jsonError("Ação inválida.", 400);
    }

    const user = await requirePermission("inventory.manage");

    const inventory = await prisma.inventory.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!inventory) {
      return jsonError("Inventário não encontrado.", 404);
    }
    assertWarehouseAccess(
      { role: user.role, warehouseIds: user.warehouseIds },
      inventory.warehouseId,
    );

    const auditContext = {
      warehouseId: inventory.warehouseId,
      items: inventory.items.length,
    };

    if (action === "INICIAR_CONTAGEM") {
      assertInventoryTransition(
        inventory.status,
        InventoryStatus.EM_CONTAGEM,
      );
      const updated = await prisma.inventory.update({
        where: { id },
        data: { status: InventoryStatus.EM_CONTAGEM },
        include: { items: true },
      });
      await writeAuditLog({
        userId: user.id,
        action: "INVENTORY_COUNT_START",
        entity: "Inventory",
        entityId: id,
        context: auditContext,
      });
      return NextResponse.json({ inventory: updated });
    }

    if (action === "LANCAR_CONTAGEM") {
      // Recontagem: pode ser chamada várias vezes enquanto estiver em
      // contagem — sobrescreve o que já havia sido lançado.
      if (inventory.status !== InventoryStatus.EM_CONTAGEM) {
        return jsonError("A contagem só pode ser lançada em andamento.", 400);
      }
      const items = body.items;
      if (!Array.isArray(items) || items.length === 0) {
        return jsonError("Nenhum item informado para contagem.", 400);
      }
      if (items.length > inventory.items.length) {
        return jsonError("Mais itens que os do inventário.", 400);
      }

      const byId = new Map(inventory.items.map((item) => [item.id, item]));
      const seen = new Set<string>();
      const updates: Array<{
        itemId: string;
        countedQty: number;
        variance: number;
        justification: string | null;
      }> = [];

      for (const entry of items) {
        if (!entry?.id || !UUID_RE.test(entry.id) || !byId.has(entry.id)) {
          return jsonError("Item de contagem inválido.", 400);
        }
        if (seen.has(entry.id)) {
          return jsonError("Item de contagem repetido.", 400);
        }
        seen.add(entry.id);

        const countedQty = Number(entry.countedQty);
        if (!Number.isFinite(countedQty) || countedQty < 0) {
          return jsonError(
            "A quantidade contada deve ser um número maior ou igual a zero.",
            400,
          );
        }
        const justification = entry.justification?.trim() || null;
        if (justification && justification.length > 500) {
          return jsonError("Justificativa muito longa (máx. 500 caracteres).", 400);
        }

        const item = byId.get(entry.id)!;
        updates.push({
          itemId: item.id,
          countedQty,
          // Divergência relativa ao snapshot da abertura.
          variance: countedQty - item.expectedQty,
          justification,
        });
      }

      await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          await tx.inventoryItem.update({
            where: { id: update.itemId },
            data: {
              countedQty: update.countedQty,
              variance: update.variance,
              justification: update.justification,
            },
          });
        }
      });

      await writeAuditLog({
        userId: user.id,
        action: "INVENTORY_COUNT_SAVE",
        entity: "Inventory",
        entityId: id,
        context: { ...auditContext, launched: updates.length },
      });

      const refreshed = await prisma.inventory.findUnique({
        where: { id },
        include: { items: true },
      });
      return NextResponse.json({ inventory: refreshed });
    }

    if (action === "FINALIZAR_CONTAGEM") {
      assertInventoryTransition(inventory.status, InventoryStatus.CONFERIDO);

      const pending = inventory.items.filter((item) => item.countedQty === null);
      if (pending.length > 0) {
        return jsonError(
          `Lance a contagem de todos os itens antes de finalizar (${pending.length} pendente(s)).`,
          400,
        );
      }
      const withoutJustification = inventory.items.filter((item) => {
        const divergent = item.variance !== null && item.variance !== 0;
        const justification = item.justification?.trim() ?? "";
        return divergent && justification.length < MIN_JUSTIFICATION;
      });
      if (withoutJustification.length > 0) {
        return jsonError(
          `Informe a justificativa de todas as divergências (${withoutJustification.length} pendente(s)).`,
          400,
        );
      }

      const updated = await prisma.inventory.update({
        where: { id },
        data: { status: InventoryStatus.CONFERIDO },
        include: { items: true },
      });
      await writeAuditLog({
        userId: user.id,
        action: "INVENTORY_COUNT_FINISH",
        entity: "Inventory",
        entityId: id,
        context: {
          ...auditContext,
          divergences: inventory.items.filter(
            (item) => item.variance !== null && item.variance !== 0,
          ).length,
        },
      });
      return NextResponse.json({ inventory: updated });
    }

    if (action === "RECONTAR") {
      // Volta para contagem mantendo os lançamentos — o time pode revisar.
      assertInventoryTransition(inventory.status, InventoryStatus.EM_CONTAGEM);
      const updated = await prisma.inventory.update({
        where: { id },
        data: { status: InventoryStatus.EM_CONTAGEM },
        include: { items: true },
      });
      await writeAuditLog({
        userId: user.id,
        action: "INVENTORY_RECOUNT",
        entity: "Inventory",
        entityId: id,
        context: auditContext,
      });
      return NextResponse.json({ inventory: updated });
    }

    if (action === "APLICAR_AJUSTE") {
      assertInventoryTransition(inventory.status, InventoryStatus.AJUSTADO);

      const divergent = inventory.items.filter(
        (item) => item.variance !== null && item.variance !== 0,
      );
      if (divergent.length === 0) {
        return jsonError(
          "Nenhuma divergência para ajustar. Conclua o inventário.",
          400,
        );
      }

      // Movimento de correção por item: positivo credita, negativo debita.
      // Mesma transação da mudança de status — ou tudo ajusta, ou nada.
      const updated = await prisma.$transaction(async (tx) => {
        for (const item of divergent) {
          const variance = item.variance!;
          const context = {
            userId: user.id,
            type: MovementType.AJUSTE_INVENTARIO,
            referenceType: "Inventory",
            referenceId: inventory.id,
            notes: `Contagem ${item.countedQty} vs esperado ${item.expectedQty}${item.justification ? ` — ${item.justification}` : ""}`,
          };
          if (variance > 0) {
            await applyStockEntry(
              {
                productId: item.productId,
                warehouseId: inventory.warehouseId,
                quantity: variance,
              },
              context,
              tx,
            );
          } else {
            await applyStockExit(
              {
                productId: item.productId,
                warehouseId: inventory.warehouseId,
                quantity: Math.abs(variance),
              },
              context,
              tx,
            );
          }
        }
        return tx.inventory.update({
          where: { id },
          data: { status: InventoryStatus.AJUSTADO },
          include: { items: true },
        });
      });

      await writeAuditLog({
        userId: user.id,
        action: "INVENTORY_ADJUST",
        entity: "Inventory",
        entityId: id,
        context: {
          ...auditContext,
          adjusted: divergent.map((item) => ({
            productId: item.productId,
            variance: item.variance,
          })),
        },
      });
      return NextResponse.json({ inventory: updated });
    }

    if (action === "CONCLUIR") {
      assertInventoryTransition(inventory.status, InventoryStatus.CONCLUIDO);

      if (inventory.status === InventoryStatus.CONFERIDO) {
        const pending = inventory.items.filter(
          (item) => item.variance !== null && item.variance !== 0,
        );
        if (pending.length > 0) {
          return jsonError(
            `Aplique o ajuste de ${pending.length} divergência(s) antes de concluir.`,
            400,
          );
        }
      }

      const updated = await prisma.inventory.update({
        where: { id },
        data: { status: InventoryStatus.CONCLUIDO, closedAt: new Date() },
        include: { items: true },
      });
      await writeAuditLog({
        userId: user.id,
        action: "INVENTORY_CLOSE",
        entity: "Inventory",
        entityId: id,
        context: auditContext,
      });
      return NextResponse.json({ inventory: updated });
    }

    // CANCELAR — só antes de qualquer ajuste (validado pela máquina).
    assertInventoryTransition(inventory.status, InventoryStatus.CANCELADO);
    const updated = await prisma.inventory.update({
      where: { id },
      data: { status: InventoryStatus.CANCELADO, closedAt: new Date() },
      include: { items: true },
    });
    await writeAuditLog({
      userId: user.id,
      action: "INVENTORY_CANCEL",
      entity: "Inventory",
      entityId: id,
      context: auditContext,
    });
    return NextResponse.json({ inventory: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
