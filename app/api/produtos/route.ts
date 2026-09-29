import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { Prisma, ProductType } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCT_TYPES = Object.values(ProductType) as string[];

type ProductBody = {
  code?: string;
  name?: string;
  description?: string | null;
  categoryId?: string;
  unitId?: string;
  type?: string;
  minStock?: number | string;
  maxStock?: number | string | null;
  reorderPoint?: number | string | null;
  requiresBatch?: boolean;
  active?: boolean;
  notes?: string | null;
};

/** Converte o valor enviado pelo formulário em número não negativo. */
function parseStock(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("products.manage");
    const body = (await request.json()) as ProductBody;

    const code = body.code?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const description = body.description?.trim() || null;
    const notes = body.notes?.trim() || null;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Código e nome são obrigatórios." },
        { status: 400 },
      );
    }
    if (!body.categoryId || !UUID_RE.test(body.categoryId)) {
      return NextResponse.json(
        { error: "Selecione uma categoria válida." },
        { status: 400 },
      );
    }
    if (!body.unitId || !UUID_RE.test(body.unitId)) {
      return NextResponse.json(
        { error: "Selecione uma unidade válida." },
        { status: 400 },
      );
    }
    if (!body.type || !PRODUCT_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: "Selecione um tipo de produto válido." },
        { status: 400 },
      );
    }

    const minStock = parseStock(body.minStock) ?? 0;
    const maxStock = parseStock(body.maxStock);
    const reorderPoint = parseStock(body.reorderPoint);

    if ([minStock, maxStock, reorderPoint].some((v) => Number.isNaN(v))) {
      return NextResponse.json(
        { error: "Os campos de estoque precisam ser números não negativos." },
        { status: 400 },
      );
    }
    if (maxStock !== null && maxStock < minStock) {
      return NextResponse.json(
        { error: "O estoque máximo deve ser maior ou igual ao estoque mínimo." },
        { status: 400 },
      );
    }

    let product;
    try {
      product = await prisma.product.create({
        data: {
          code,
          name,
          description,
          categoryId: body.categoryId,
          unitId: body.unitId,
          type: body.type as ProductType,
          minStock,
          maxStock,
          reorderPoint,
          requiresBatch: body.requiresBatch === true,
          active: body.active !== false,
          notes,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: `Já existe um produto com o código "${code}".` },
          { status: 409 },
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return NextResponse.json(
          { error: "Categoria ou unidade inexistente." },
          { status: 400 },
        );
      }
      throw error;
    }

    await writeAuditLog({
      userId: user.id,
      action: "PRODUCT_CREATE",
      entity: "Product",
      entityId: product.id,
      context: { code: product.code, name: product.name },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
