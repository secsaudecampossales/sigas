import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { assertTransferStatus } from "@/lib/transfers/state-machine";
import { applyStockEntry, applyStockExit } from "@/lib/stock/movements";
import { MovementType, TransferStatus } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PatchBody = { action?: string };

const ACTIONS = new Set(["CONFIRMAR_SAIDA", "RECEBER", "CANCELAR"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonError("Transferência não encontrada.", 404);
    }

    const body = (await request.json()) as PatchBody;
    const action = body.action ?? "";
    if (!ACTIONS.has(action)) {
      return jsonError("Ação inválida.", 400);
    }

    const user = await requirePermission("transfers.manage");

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });
    if (!transfer) {
      return jsonError("Transferência não encontrada.", 404);
    }

    const auditContext = {
      number: transfer.number,
      fromWarehouseId: transfer.fromWarehouseId,
      toWarehouseId: transfer.toWarehouseId,
    };

    if (action === "CONFIRMAR_SAIDA") {
      // Cada lado confirma o próprio fim: saída exige acesso à origem.
      assertWarehouseAccess(
        { role: user.role, warehouseIds: user.warehouseIds },
        transfer.fromWarehouseId,
      );
      assertTransferStatus(transfer.status, TransferStatus.SAIDA_CONFIRMADA);
      if (transfer.items.length === 0) {
        return jsonError("Transferência sem itens.", 400);
      }

      // Transação: ou a saída de TODOS os itens acontece e a transferência
      // sai do estoque da origem, ou nada muda (ex.: saldo insuficiente).
      const updated = await prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          await applyStockExit(
            {
              productId: item.productId,
              warehouseId: transfer.fromWarehouseId,
              quantity: item.quantity,
            },
            {
              userId: user.id,
              type: MovementType.SAIDA_TRANSFERENCIA,
              referenceType: "Transfer",
              referenceId: transfer.id,
              documentRef: transfer.number,
              notes: `Transferência ${transfer.number} enviada`,
              warehouseToId: transfer.toWarehouseId,
            },
            tx,
          );
        }
        return tx.transfer.update({
          where: { id: transfer.id },
          data: { status: TransferStatus.SAIDA_CONFIRMADA, exitConfirmedAt: new Date() },
          include: { items: true },
        });
      });

      await writeAuditLog({
        userId: user.id,
        action: "TRANSFER_EXIT",
        entity: "Transfer",
        entityId: transfer.id,
        context: { ...auditContext, items: transfer.items.length },
      });
      return NextResponse.json({ transfer: updated });
    }

    if (action === "RECEBER") {
      // Recebimento exige acesso ao destino.
      assertWarehouseAccess(
        { role: user.role, warehouseIds: user.warehouseIds },
        transfer.toWarehouseId,
      );
      assertTransferStatus(transfer.status, TransferStatus.RECEBIDA);
      if (transfer.items.length === 0) {
        return jsonError("Transferência sem itens.", 400);
      }

      const updated = await prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          await applyStockEntry(
            {
              productId: item.productId,
              warehouseId: transfer.toWarehouseId,
              quantity: item.quantity,
            },
            {
              userId: user.id,
              type: MovementType.ENTRADA_TRANSFERENCIA,
              warehouseFromId: transfer.fromWarehouseId,
              referenceType: "Transfer",
              referenceId: transfer.id,
              documentRef: transfer.number,
              notes: `Transferência ${transfer.number} recebida`,
            },
            tx,
          );
        }
        return tx.transfer.update({
          where: { id: transfer.id },
          data: { status: TransferStatus.RECEBIDA, receivedAt: new Date() },
          include: { items: true },
        });
      });

      await writeAuditLog({
        userId: user.id,
        action: "TRANSFER_RECEIPT",
        entity: "Transfer",
        entityId: transfer.id,
        context: { ...auditContext, items: transfer.items.length },
      });
      return NextResponse.json({ transfer: updated });
    }

    // CANCELAR: somente enquanto a saída não foi confirmada (depois disso o
    // estoque já saiu da origem e o caminho é concluir o recebimento).
    assertTransferStatus(transfer.status, TransferStatus.CANCELADA);
    const updated = await prisma.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.CANCELADA },
      include: { items: true },
    });
    await writeAuditLog({
      userId: user.id,
      action: "TRANSFER_CANCEL",
      entity: "Transfer",
      entityId: transfer.id,
      context: auditContext,
    });
    return NextResponse.json({ transfer: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
