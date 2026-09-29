import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { assertWarehouseAccess } from "@/lib/permissions/warehouse-access";
import { writeAuditLog } from "@/lib/audit/log";
import { EXIT_TYPES } from "@/lib/stock/exit-types";
import { getSystemSettings } from "@/lib/config/settings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReceiptBody = {
  movementId?: string;
  entreguePor?: string;
  recebidoPor?: string;
};

/**
 * POST /api/movimentacoes/comprovante
 *
 * Registra a emissão do comprovante de saída com os nomes das duas partes
 * (quem entrega / quem recebe) e grava o evento na auditoria. O PDF é
 * gerado no client com os dados retornados aqui — o servidor é a fonte
 * autoritativa (inclui destino e unidade, que a lista da página não traz).
 *
 * Permissão: `stock.view` (quem enxerga a movimentação pode emitir o
 * comprovante; a emissão não altera estoque).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("stock.view");
    const body = (await request.json()) as ReceiptBody;

    const movementId =
      typeof body.movementId === "string" ? body.movementId.trim() : "";
    const entreguePor =
      typeof body.entreguePor === "string" ? body.entreguePor.trim() : "";
    const recebidoPor =
      typeof body.recebidoPor === "string" ? body.recebidoPor.trim() : "";

    if (!movementId || !entreguePor || !recebidoPor) {
      return NextResponse.json(
        {
          error:
            "Movimentação e os nomes de quem entrega e quem recebe são obrigatórios.",
        },
        { status: 400 },
      );
    }

    if (entreguePor.length < 2 || entreguePor.length > 120) {
      return NextResponse.json(
        { error: "Quem entrega: informe de 2 a 120 caracteres." },
        { status: 400 },
      );
    }
    if (recebidoPor.length < 2 || recebidoPor.length > 120) {
      return NextResponse.json(
        { error: "Quem recebe: informe de 2 a 120 caracteres." },
        { status: 400 },
      );
    }

    if (!UUID_RE.test(movementId)) {
      return NextResponse.json(
        { error: "Movimentação não encontrada." },
        { status: 404 },
      );
    }

    const movement = await prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        product: {
          select: { code: true, name: true, unit: { select: { name: true } } },
        },
        warehouseFrom: { select: { name: true } },
        warehouseTo: { select: { name: true } },
        user: { select: { name: true } },
      },
    });
    if (!movement) {
      return NextResponse.json(
        { error: "Movimentação não encontrada." },
        { status: 404 },
      );
    }

    // Só saídas geram comprovante: uma ENTRADA_* nunca teria quem "entrega".
    if (!(EXIT_TYPES as readonly string[]).includes(movement.type)) {
      return NextResponse.json(
        { error: "Comprovante disponível apenas para saídas de estoque." },
        { status: 400 },
      );
    }

    // `warehouseFromId` é anulável no schema; saídas reais sempre têm
    // almoxarifado de origem — só verifica o acesso quando existe.
    if (movement.warehouseFromId) {
      assertWarehouseAccess(
        { role: user.role, warehouseIds: user.warehouseIds },
        movement.warehouseFromId,
      );
    }

    const now = new Date();
    const receipt = {
      movementId: movement.id,
      entreguePor,
      recebidoPor,
      emittedBy: user.name ?? user.email ?? "—",
      emittedAt: now.toISOString(),
    };

    const payload = {
      orgName: (await getSystemSettings()).orgName,
      movement: {
        id: movement.id,
        type: movement.type,
        quantity: movement.quantity,
        documentRef: movement.documentRef,
        notes: movement.notes,
        createdAt: movement.createdAt.toISOString(),
        product: { code: movement.product.code, name: movement.product.name },
        unit: movement.product.unit?.name ?? null,
        warehouseFrom: movement.warehouseFrom?.name ?? "—",
        warehouseTo: movement.warehouseTo?.name ?? null,
        registeredBy: movement.user.name ?? "—",
      },
      receipt,
    };

    await writeAuditLog({
      userId: user.id,
      action: "STOCK_RECEIPT",
      entity: "StockMovement",
      entityId: movement.id,
      context: {
        entreguePor,
        recebidoPor,
        type: movement.type,
        productId: movement.productId,
        quantity: movement.quantity,
        documentRef: movement.documentRef,
      },
    });

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
