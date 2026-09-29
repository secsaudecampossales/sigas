import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { CATALOGS, type CatalogId } from "@/lib/config/catalogs";
import {
  UUID_RE,
  assertBodyObject,
  assertCode,
  assertName,
  assertOptionalText,
  assertWarehouseType,
} from "@/lib/config/validation";

type PatchBody = {
  code?: unknown;
  name?: unknown;
  type?: unknown;
  location?: unknown;
  responsible?: unknown;
  active?: unknown;
};

type CurrentRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  type?: string;
  location?: string | null;
  responsible?: string | null;
};

/** Só o que veio no corpo (e difere do atual) entra no update. */
function buildPatchData(
  current: CurrentRow,
  body: PatchBody,
  hasType: boolean,
) {
  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if ("code" in body) {
    const code = assertCode(body.code);
    if (code !== current.code.toUpperCase()) {
      data.code = code;
      changes.push("código");
    }
  }
  if ("name" in body) {
    const name = assertName(body.name);
    if (name !== current.name) {
      data.name = name;
      changes.push("nome");
    }
  }
  if (hasType) {
    if ("type" in body) {
      const type = assertWarehouseType(body.type);
      if (type !== current.type) {
        data.type = type;
        changes.push("tipo");
      }
    }
    if ("location" in body) {
      const location = assertOptionalText(body.location, "Localização", 120);
      if (location !== (current.location ?? null)) {
        data.location = location;
        changes.push("localização");
      }
    }
    if ("responsible" in body) {
      const responsible = assertOptionalText(
        body.responsible,
        "Responsável",
        120,
      );
      if (responsible !== (current.responsible ?? null)) {
        data.responsible = responsible;
        changes.push("responsável");
      }
    }
  }
  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      throw new Error("Status inválido.");
    }
    if (body.active !== current.active) {
      data.active = body.active;
      changes.push("status");
    }
  }

  return { data, changes };
}

async function findDuplicateCode(
  catalogId: CatalogId,
  code: string,
  excludeId: string,
) {
  const filter = {
    code: { equals: code, mode: "insensitive" as const },
    id: { not: excludeId },
  };
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recurso: string; id: string }> },
) {
  try {
    const { recurso, id } = await params;
    const catalog = CATALOGS[recurso as CatalogId];
    if (!catalog) {
      return jsonError("Recurso de configuração não encontrado.", 404);
    }

    const actor = await requirePermission(catalog.permission);
    if (!UUID_RE.test(id)) {
      return jsonError("Registro não encontrado.", 404);
    }
    const body = assertBodyObject(await request.json()) as PatchBody;

    let current: CurrentRow | null = null;
    switch (catalog.id) {
      case "almoxarifados":
        current = await prisma.warehouse.findUnique({ where: { id } });
        break;
      case "setores":
        current = await prisma.sector.findUnique({ where: { id } });
        break;
      case "categorias":
        current = await prisma.category.findUnique({ where: { id } });
        break;
      case "unidades":
        current = await prisma.unit.findUnique({ where: { id } });
        break;
    }
    if (!current) {
      return jsonError("Registro não encontrado.", 404);
    }

    const { data, changes } = buildPatchData(current, body, catalog.hasType);
    if (Object.keys(data).length === 0) {
      // Sem mudanças: devolve o estado atual sem gravar auditoria.
      return NextResponse.json({ item: current });
    }

    if (typeof data.code === "string") {
      const duplicate = await findDuplicateCode(
        catalog.id,
        data.code,
        current.id,
      );
      if (duplicate) {
        return jsonError(
          `Já existe um registro com o código ${data.code}.`,
          409,
        );
      }
    }

    let item: unknown;
    switch (catalog.id) {
      case "almoxarifados":
        item = await prisma.warehouse.update({ where: { id }, data });
        break;
      case "setores":
        item = await prisma.sector.update({ where: { id }, data });
        break;
      case "categorias":
        item = await prisma.category.update({ where: { id }, data });
        break;
      case "unidades":
        item = await prisma.unit.update({ where: { id }, data });
        break;
    }

    await writeAuditLog({
      userId: actor.id,
      action: "CATALOG_UPDATE",
      entity: catalog.entity,
      entityId: current.id,
      context: { changes },
    });

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error);
  }
}
