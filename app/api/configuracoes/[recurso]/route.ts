import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { CATALOGS, type CatalogId } from "@/lib/config/catalogs";
import {
  assertBodyObject,
  assertCode,
  assertName,
  assertOptionalText,
  assertWarehouseType,
} from "@/lib/config/validation";

type CreateBody = {
  code?: unknown;
  name?: unknown;
  type?: unknown;
  location?: unknown;
  responsible?: unknown;
};

/** Código duplicado (case-insensitive), exceto o próprio registro. */
async function findDuplicateCode(catalogId: CatalogId, code: string) {
  const filter = { code: { equals: code, mode: "insensitive" as const } };
  switch (catalogId) {
    case "almoxarifados":
      return prisma.warehouse.findFirst({ where: filter, select: { id: true } });
    case "setores":
      return prisma.sector.findFirst({ where: filter, select: { id: true } });
    case "categorias":
      return prisma.category.findFirst({ where: filter, select: { id: true } });
    case "unidades":
      return prisma.unit.findFirst({ where: filter, select: { id: true } });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recurso: string }> },
) {
  try {
    const { recurso } = await params;
    const catalog = CATALOGS[recurso as CatalogId];
    if (!catalog) {
      return jsonError("Recurso de configuração não encontrado.", 404);
    }

    const actor = await requirePermission(catalog.permission);
    const body = assertBodyObject(await request.json()) as CreateBody;

    const code = assertCode(body.code);
    const name = assertName(body.name);

    const duplicate = await findDuplicateCode(catalog.id, code);
    if (duplicate) {
      return jsonError(`Já existe um registro com o código ${code}.`, 409);
    }

    let item: unknown;
    switch (catalog.id) {
      case "almoxarifados": {
        const type = assertWarehouseType(body.type);
        const location = assertOptionalText(body.location, "Localização", 120);
        const responsible = assertOptionalText(
          body.responsible,
          "Responsável",
          120,
        );
        item = await prisma.warehouse.create({
          data: { code, name, type, location, responsible },
        });
        break;
      }
      case "setores":
        item = await prisma.sector.create({ data: { code, name } });
        break;
      case "categorias":
        item = await prisma.category.create({ data: { code, name } });
        break;
      case "unidades":
        item = await prisma.unit.create({ data: { code, name } });
        break;
    }

    const created = item as { id: string };
    await writeAuditLog({
      userId: actor.id,
      action: "CATALOG_CREATE",
      entity: catalog.entity,
      entityId: created.id,
      context: { code, name },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
