import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { Prisma, ProductType } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCT_TYPES = Object.values(ProductType) as string[];

type PatchBody = {
  code?: unknown;
  name?: unknown;
  description?: unknown;
  categoryId?: unknown;
  unitId?: unknown;
  type?: unknown;
  minStock?: unknown;
  maxStock?: unknown;
  reorderPoint?: unknown;
  requiresBatch?: unknown;
  active?: unknown;
  notes?: unknown;
};

/** Converte o valor enviado pelo formulário em número não negativo. */
function parseStock(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return parsed;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} inválido.`);
  }
  return value.trim();
}

type Change = { from: Scalar; to: Scalar };
type Scalar = string | number | boolean | null;

/**
 * PATCH /api/produtos/[id] — edição de cadastro de produto (inclusive
 * ativar/desativar). Somente campos enviados são validados e alterados;
 * sem mudanças devolve 200 sem gravar auditoria (mesmo padrão do PATCH de
 * usuários/configurações).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonError("Produto não encontrado.", 404);
    }

    const user = await requirePermission("products.manage");
    const body = (await request.json()) as PatchBody;

    const target = await prisma.product.findUnique({ where: { id } });
    if (!target) {
      return jsonError("Produto não encontrado.", 404);
    }

    const data: Record<string, unknown> = {};
    const changes: Record<string, Change> = {};

    if ("code" in body) {
      const code = assertString(body.code, "Código");
      if (!code) {
        return jsonError("O código é obrigatório.", 400);
      }
      if (code !== target.code) {
        data.code = code;
        changes.code = { from: target.code, to: code };
      }
    }

    if ("name" in body) {
      const name = assertString(body.name, "Nome");
      if (!name) {
        return jsonError("O nome é obrigatório.", 400);
      }
      if (name !== target.name) {
        data.name = name;
        changes.name = { from: target.name, to: name };
      }
    }

    if ("description" in body) {
      const description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
      if (description !== target.description) {
        data.description = description;
        changes.description = { from: target.description, to: description };
      }
    }

    if ("notes" in body) {
      const notes =
        typeof body.notes === "string" ? body.notes.trim() || null : null;
      if (notes !== target.notes) {
        data.notes = notes;
        changes.notes = { from: target.notes, to: notes };
      }
    }

    if ("categoryId" in body) {
      const categoryId = assertString(body.categoryId, "Categoria");
      if (!UUID_RE.test(categoryId)) {
        return jsonError("Selecione uma categoria válida.", 400);
      }
      if (categoryId !== target.categoryId) {
        data.categoryId = categoryId;
        changes.categoryId = { from: target.categoryId, to: categoryId };
      }
    }

    if ("unitId" in body) {
      const unitId = assertString(body.unitId, "Unidade");
      if (!UUID_RE.test(unitId)) {
        return jsonError("Selecione uma unidade válida.", 400);
      }
      if (unitId !== target.unitId) {
        data.unitId = unitId;
        changes.unitId = { from: target.unitId, to: unitId };
      }
    }

    if ("type" in body) {
      const type = assertString(body.type, "Tipo");
      if (!PRODUCT_TYPES.includes(type)) {
        return jsonError("Selecione um tipo de produto válido.", 400);
      }
      if (type !== target.type) {
        data.type = type;
        changes.type = { from: target.type, to: type };
      }
    }

    if ("requiresBatch" in body) {
      if (typeof body.requiresBatch !== "boolean") {
        return jsonError("Valor inválido para controle de lote.", 400);
      }
      if (body.requiresBatch !== target.requiresBatch) {
        data.requiresBatch = body.requiresBatch;
        changes.requiresBatch = {
          from: target.requiresBatch,
          to: body.requiresBatch,
        };
      }
    }

    if ("active" in body) {
      if (typeof body.active !== "boolean") {
        return jsonError("Status inválido.", 400);
      }
      if (body.active !== target.active) {
        data.active = body.active;
        changes.active = { from: target.active, to: body.active };
      }
    }

    // Campos numéricos de estoque: validados em conjunto no final.
    let minStock: number | null = null;
    let maxStock: number | null = null;
    let reorderPoint: number | null = null;

    if ("minStock" in body) {
      minStock = parseStock(body.minStock) ?? 0;
    }
    if ("maxStock" in body) {
      maxStock = parseStock(body.maxStock);
    }
    if ("reorderPoint" in body) {
      reorderPoint = parseStock(body.reorderPoint);
    }

    if (
      [minStock, maxStock, reorderPoint].some(
        (value) => value !== null && Number.isNaN(value),
      )
    ) {
      return jsonError(
        "Os campos de estoque precisam ser números não negativos.",
        400,
      );
    }

    if (minStock !== null && minStock !== target.minStock) {
      data.minStock = minStock;
      changes.minStock = { from: target.minStock, to: minStock };
    }
    if ("maxStock" in body && maxStock !== target.maxStock) {
      data.maxStock = maxStock;
      changes.maxStock = { from: target.maxStock, to: maxStock };
    }
    if ("reorderPoint" in body && reorderPoint !== target.reorderPoint) {
      data.reorderPoint = reorderPoint;
      changes.reorderPoint = { from: target.reorderPoint, to: reorderPoint };
    }

    const effectiveMin = minStock !== null ? minStock : target.minStock;
    const effectiveMax = "maxStock" in body ? maxStock : target.maxStock;
    if (effectiveMax !== null && effectiveMax < effectiveMin) {
      return jsonError(
        "O estoque máximo deve ser maior ou igual ao estoque mínimo.",
        400,
      );
    }

    if (Object.keys(data).length === 0) {
      // Sem mudanças: devolve o estado atual sem gravar auditoria.
      return NextResponse.json({ product: target });
    }

    let product;
    try {
      product = await prisma.product.update({ where: { id: target.id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return jsonError(
          `Já existe um produto com o código "${data.code ?? target.code}".`,
          409,
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return jsonError("Categoria ou unidade inexistente.", 400);
      }
      throw error;
    }

    await writeAuditLog({
      userId: user.id,
      action: "PRODUCT_UPDATE",
      entity: "Product",
      entityId: product.id,
      context: { code: product.code, changes },
    });

    return NextResponse.json({ product });
  } catch (error) {
    return handleApiError(error);
  }
}
