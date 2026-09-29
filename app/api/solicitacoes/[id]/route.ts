import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireSessionUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { assertRequestTransition } from "@/lib/requests/state-machine";
import { applyStockExit } from "@/lib/stock/movements";
import { roleHasPermission, type Permission } from "@/lib/permissions/roles";
import { MovementType, RequestStatus } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PatchBody = {
  action?: string;
  reason?: string;
  warehouseId?: string;
  items?: Array<{
    id?: string;
    quantity?: number | string;
    quantityApproved?: number | string;
  }>;
};

/**
 * Ação → permissão exigida. `CANCELAR` fica de fora: dono da solicitação ou
 * quem pode analisar pode cancelar (enquanto nada tiver sido atendido).
 */
const ACTION_PERMISSIONS: Record<string, Permission | null> = {
  INICIAR_ANALISE: "requests.analyze",
  APROVAR: "requests.analyze",
  APROVAR_PARCIAL: "requests.analyze",
  REJEITAR: "requests.analyze",
  CANCELAR: null,
  INICIAR_ATENDIMENTO: "requests.fulfill",
  ATENDER: "requests.fulfill",
  REABRIR: "requests.fulfill",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonError("Solicitação não encontrada.", 404);
    }

    const body = (await request.json()) as PatchBody;
    const action = body.action ?? "";
    if (!(action in ACTION_PERMISSIONS)) {
      return jsonError("Ação inválida.", 400);
    }

    const permission = ACTION_PERMISSIONS[action];
    const user = permission
      ? await requirePermission(permission)
      : await requireSessionUser();

    const existing = await prisma.materialRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!existing) {
      return jsonError("Solicitação não encontrada.", 404);
    }

    const auditContext = { number: existing.number };

    switch (action) {
      case "INICIAR_ANALISE": {
        assertRequestTransition(existing.status, RequestStatus.EM_ANALISE);
        const updated = await prisma.materialRequest.update({
          where: { id },
          data: { status: RequestStatus.EM_ANALISE },
          include: { items: true },
        });
        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_ANALYZE",
          entity: "MaterialRequest",
          entityId: id,
          context: auditContext,
        });
        return NextResponse.json({ request: updated });
      }

      case "APROVAR": {
        assertRequestTransition(existing.status, RequestStatus.APROVADA);
        const updated = await prisma.$transaction(async (tx) => {
          for (const item of existing.items) {
            await tx.requestItem.update({
              where: { id: item.id },
              data: {
                quantityApproved: item.quantityRequested,
                quantityPending:
                  item.quantityRequested - item.quantityFulfilled,
              },
            });
          }
          return tx.materialRequest.update({
            where: { id },
            data: { status: RequestStatus.APROVADA },
            include: { items: true },
          });
        });
        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_APPROVE",
          entity: "MaterialRequest",
          entityId: id,
          context: { ...auditContext, mode: "total" },
        });
        return NextResponse.json({ request: updated });
      }

      case "APROVAR_PARCIAL": {
        assertRequestTransition(
          existing.status,
          RequestStatus.APROVADA_PARCIALMENTE,
        );

        const approvals = new Map<string, number>();
        for (const entry of body.items ?? []) {
          if (!entry?.id || !UUID_RE.test(entry.id)) {
            return jsonError("Item inválido.", 400);
          }
          if (approvals.has(entry.id)) {
            return jsonError("Item repetido na lista.", 400);
          }
          const quantityApproved = Number(entry.quantityApproved);
          if (!Number.isFinite(quantityApproved) || quantityApproved < 0) {
            return jsonError(
              "Quantidade aprovada deve ser maior ou igual a zero.",
              400,
            );
          }
          approvals.set(entry.id, quantityApproved);
        }

        for (const item of existing.items) {
          const quantityApproved = approvals.get(item.id);
          if (quantityApproved === undefined) {
            return jsonError(
              "Informe a quantidade aprovada de todos os itens.",
              400,
            );
          }
          if (quantityApproved > item.quantityRequested) {
            return jsonError(
              `Aprovado acima do solicitado para ${item.product.name}.`,
              400,
            );
          }
        }
        if (![...approvals.values()].some((quantity) => quantity > 0)) {
          return jsonError(
            "Aprove ao menos um item (para recusar tudo, use Rejeitar).",
            400,
          );
        }

        const updated = await prisma.$transaction(async (tx) => {
          for (const item of existing.items) {
            const quantityApproved = approvals.get(item.id)!;
            await tx.requestItem.update({
              where: { id: item.id },
              data: {
                quantityApproved,
                quantityPending: quantityApproved - item.quantityFulfilled,
              },
            });
          }
          return tx.materialRequest.update({
            where: { id },
            data: { status: RequestStatus.APROVADA_PARCIALMENTE },
            include: { items: true },
          });
        });
        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_APPROVE",
          entity: "MaterialRequest",
          entityId: id,
          context: {
            ...auditContext,
            mode: "parcial",
            approvals: Object.fromEntries(approvals),
          },
        });
        return NextResponse.json({ request: updated });
      }

      case "REJEITAR": {
        assertRequestTransition(existing.status, RequestStatus.REJEITADA);
        const reason = body.reason?.trim();
        if (!reason || reason.length < 3) {
          return jsonError("Informe o motivo da rejeição.", 400);
        }
        const notes = existing.notes
          ? `${existing.notes}\n[Rejeição] ${reason}`
          : `[Rejeição] ${reason}`;
        const updated = await prisma.materialRequest.update({
          where: { id },
          data: { status: RequestStatus.REJEITADA, notes },
          include: { items: true },
        });
        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_REJECT",
          entity: "MaterialRequest",
          entityId: id,
          context: { ...auditContext, reason },
        });
        return NextResponse.json({ request: updated });
      }

      case "CANCELAR": {
        const isOwner = existing.requesterId === user.id;
        const canAnalyze = roleHasPermission(user.role, "requests.analyze");
        if (!isOwner && !canAnalyze) {
          return jsonError(
            "Sem permissão para cancelar esta solicitação.",
            403,
          );
        }
        const fulfilled = existing.items.reduce(
          (sum, item) => sum + item.quantityFulfilled,
          0,
        );
        if (fulfilled > 0) {
          return jsonError(
            "Não é possível cancelar: há itens já atendidos.",
            400,
          );
        }
        assertRequestTransition(existing.status, RequestStatus.CANCELADA);
        const updated = await prisma.materialRequest.update({
          where: { id },
          data: { status: RequestStatus.CANCELADA },
          include: { items: true },
        });
        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_CANCEL",
          entity: "MaterialRequest",
          entityId: id,
          context: auditContext,
        });
        return NextResponse.json({ request: updated });
      }

      case "INICIAR_ATENDIMENTO": {
        assertRequestTransition(existing.status, RequestStatus.EM_ATENDIMENTO);
        const approved = existing.items.reduce(
          (sum, item) => sum + item.quantityApproved,
          0,
        );
        if (approved <= 0) {
          return jsonError(
            "Nenhum item aprovado para atendimento.",
            400,
          );
        }
        const updated = await prisma.materialRequest.update({
          where: { id },
          data: { status: RequestStatus.EM_ATENDIMENTO },
          include: { items: true },
        });
        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_FULFILL_START",
          entity: "MaterialRequest",
          entityId: id,
          context: auditContext,
        });
        return NextResponse.json({ request: updated });
      }

      case "ATENDER": {
        // Almoxarifado: o de origem da solicitação ou o informado agora.
        const warehouseId =
          existing.originWarehouseId ?? body.warehouseId ?? null;
        if (!warehouseId || !UUID_RE.test(warehouseId)) {
          return jsonError(
            "Informe o almoxarifado de origem do atendimento.",
            400,
          );
        }
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: warehouseId, active: true },
          select: { id: true },
        });
        if (!warehouse) {
          return jsonError("Almoxarifado inválido ou inativo.", 400);
        }
        assertWarehouseAccess(
          { role: user.role, warehouseIds: user.warehouseIds },
          warehouseId,
        );

        const quantities = new Map<string, number>();
        for (const entry of body.items ?? []) {
          if (!entry?.id || !UUID_RE.test(entry.id)) {
            return jsonError("Item inválido.", 400);
          }
          if (quantities.has(entry.id)) {
            return jsonError("Item repetido na lista.", 400);
          }
          const quantity = Number(entry.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return jsonError(
              "As quantidades atendidas devem ser maiores que zero.",
              400,
            );
          }
          quantities.set(entry.id, quantity);
        }
        if (quantities.size === 0) {
          return jsonError("Informe as quantidades a atender.", 400);
        }
        for (const [itemId, quantity] of quantities) {
          const item = existing.items.find((candidate) => candidate.id === itemId);
          if (!item) {
            return jsonError("Item não pertence a esta solicitação.", 400);
          }
          const pending = item.quantityApproved - item.quantityFulfilled;
          if (quantity > pending) {
            return jsonError(
              `Quantidade acima do pendente para ${item.product.name} (pendente: ${pending}).`,
              400,
            );
          }
        }

        // Tudo numa transação: ou baixa o estoque de todos os itens e muda o
        // status, ou não acontece nada.
        const updated = await prisma.$transaction(async (tx) => {
          const items = await tx.requestItem.findMany({
            where: { requestId: id },
            include: { product: { select: { name: true } } },
          });

          for (const [itemId, quantity] of quantities) {
            const item = items.find((candidate) => candidate.id === itemId)!;
            const pending = item.quantityApproved - item.quantityFulfilled;
            if (quantity > pending) {
              throw new Error(
                `Quantidade acima do pendente para ${item.product.name}.`,
              );
            }
            await applyStockExit(
              { productId: item.productId, warehouseId, quantity },
              {
                userId: user.id,
                type: MovementType.SAIDA_ATENDIMENTO,
                referenceType: "MaterialRequest",
                referenceId: id,
                documentRef: existing.number,
                notes: `Atendimento da solicitação ${existing.number}`,
              },
              tx,
            );
            await tx.requestItem.update({
              where: { id: item.id },
              data: {
                quantityFulfilled: { increment: quantity },
                quantityPending: pending - quantity,
              },
            });
          }

          const after = await tx.requestItem.findMany({
            where: { requestId: id },
          });
          const allDone = after.every(
            (item) => item.quantityApproved - item.quantityFulfilled <= 0,
          );
          const target = allDone
            ? RequestStatus.ATENDIDA
            : RequestStatus.ATENDIDA_PARCIALMENTE;
          assertRequestTransition(existing.status, target);

          return tx.materialRequest.update({
            where: { id },
            data: {
              status: target,
              completedAt: allDone ? new Date() : null,
            },
            include: { items: true },
          });
        });

        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_FULFILL",
          entity: "MaterialRequest",
          entityId: id,
          context: {
            ...auditContext,
            warehouseId,
            items: quantities.size,
            status: updated.status,
          },
        });
        return NextResponse.json({ request: updated });
      }

      case "REABRIR": {
        assertRequestTransition(
          existing.status,
          RequestStatus.EM_ATENDIMENTO,
        );
        const updated = await prisma.materialRequest.update({
          where: { id },
          data: { status: RequestStatus.EM_ATENDIMENTO, completedAt: null },
          include: { items: true },
        });
        await writeAuditLog({
          userId: user.id,
          action: "REQUEST_FULFILL_REOPEN",
          entity: "MaterialRequest",
          entityId: id,
          context: auditContext,
        });
        return NextResponse.json({ request: updated });
      }

      default:
        return jsonError("Ação inválida.", 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
