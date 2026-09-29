import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import {
  USER_SELECT,
  UUID_RE,
  assertEmail,
  assertName,
  assertObject,
  assertPassword,
  assertRole,
  assertSector,
  assertWarehouseIds,
} from "@/lib/users/validation";

type PatchBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  active?: unknown;
  sectorId?: unknown;
  warehouseIds?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return jsonError("Usuário não encontrado.", 404);
    }

    const body = assertObject(await request.json()) as PatchBody;
    const actor = await requirePermission("users.manage");

    const target = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!target) {
      return jsonError("Usuário não encontrado.", 404);
    }

    // Cada campo é opcional: só o que vier no corpo é validado e atualizado.
    const data: Record<string, unknown> = {};
    const changes: string[] = [];

    if ("name" in body) {
      const name = assertName(body.name);
      if (name !== target.name) {
        data.name = name;
        changes.push("nome");
      }
    }

    if ("email" in body) {
      const email = assertEmail(body.email);
      if (email !== target.email.toLowerCase()) {
        const existing = await prisma.user.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
            id: { not: target.id },
          },
          select: { id: true },
        });
        if (existing) {
          return jsonError("Já existe um usuário com este e-mail.", 409);
        }
        data.email = email;
        changes.push("e-mail");
      }
    }

    if ("role" in body) {
      const role = assertRole(body.role);
      if (role !== target.role) {
        data.role = role;
        changes.push("perfil");
      }
    }

    if ("active" in body) {
      if (typeof body.active !== "boolean") {
        throw new Error("Status inválido.");
      }
      if (body.active !== target.active) {
        data.active = body.active;
        changes.push("status");
      }
    }

    if ("sectorId" in body) {
      const sectorId = await assertSector(body.sectorId);
      if (sectorId !== target.sectorId) {
        data.sectorId = sectorId;
        changes.push("setor");
      }
    }

    if ("warehouseIds" in body) {
      const warehouseIds = await assertWarehouseIds(body.warehouseIds);
      const same =
        warehouseIds.length === target.warehouseIds.length &&
        warehouseIds.every((warehouseId) =>
          target.warehouseIds.includes(warehouseId),
        );
      if (!same) {
        data.warehouseIds = warehouseIds;
        changes.push("almoxarifados");
      }
    }

    const password =
      "password" in body ? assertPassword(body.password, false) : null;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
      changes.push("senha");
    }

    if (Object.keys(data).length === 0) {
      // Sem mudanças: devolve o estado atual sem gravar auditoria.
      return NextResponse.json({ user: target });
    }

    const nextRole = "role" in data ? (data.role as string) : target.role;
    const nextActive = "active" in data ? (data.active as boolean) : target.active;

    // Proteções de integridade: nunca sem administrador ativo e nunca
    // desativar a própria conta.
    if (target.id === actor.id && nextActive === false) {
      return jsonError(
        "Você não pode desativar o seu próprio usuário.",
        400,
      );
    }
    const wasActiveAdmin = target.role === "ADMIN" && target.active;
    const isActiveAdmin = nextRole === "ADMIN" && nextActive;
    if (wasActiveAdmin && !isActiveAdmin) {
      const otherAdmins = await prisma.user.count({
        where: { role: "ADMIN", active: true, id: { not: target.id } },
      });
      if (otherAdmins === 0) {
        return jsonError(
          "Obrigatório manter pelo menos um administrador ativo.",
          400,
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data,
      select: USER_SELECT,
    });

    await writeAuditLog({
      userId: actor.id,
      action: "USER_UPDATE",
      entity: "User",
      entityId: user.id,
      context: { changes, email: user.email, role: user.role },
    });
    if (password) {
      await writeAuditLog({
        userId: actor.id,
        action: "USER_PASSWORD_RESET",
        entity: "User",
        entityId: user.id,
        context: { email: user.email },
      });
    }
    if ("active" in data) {
      await writeAuditLog({
        userId: actor.id,
        action: user.active ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        entity: "User",
        entityId: user.id,
        context: { email: user.email },
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
