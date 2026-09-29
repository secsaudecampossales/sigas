import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import {
  USER_SELECT,
  assertEmail,
  assertName,
  assertObject,
  assertPassword,
  assertRole,
  assertSector,
  assertWarehouseIds,
} from "@/lib/users/validation";

type CreateBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  sectorId?: unknown;
  warehouseIds?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("users.manage");
    const body = assertObject(await request.json()) as CreateBody;

    const name = assertName(body.name);
    const email = assertEmail(body.email);
    const role = assertRole(body.role);
    const password = assertPassword(body.password, true);
    const sectorId = "sectorId" in body ? await assertSector(body.sectorId) : null;
    const warehouseIds = "warehouseIds" in body
      ? await assertWarehouseIds(body.warehouseIds)
      : [];

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return jsonError("Já existe um usuário com este e-mail.", 409);
    }

    const passwordHash = await bcrypt.hash(password!, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, sectorId, warehouseIds },
      select: USER_SELECT,
    });

    await writeAuditLog({
      userId: actor.id,
      action: "USER_CREATE",
      entity: "User",
      entityId: user.id,
      context: { email: user.email, role: user.role },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
