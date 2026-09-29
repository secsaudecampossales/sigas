import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import {
  USER_SELECT,
  assertName,
  assertObject,
  assertPassword,
} from "@/lib/users/validation";

type PatchBody = {
  name?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

/**
 * PATCH /api/conta — edição da própria conta (qualquer perfil autenticado).
 *
 * - `name`: altera o nome próprio (mesma regra do cadastro, 2–120).
 * - `newPassword`: exige `currentPassword` correta (verificada com bcrypt);
 *   a troca gera o evento `USER_PASSWORD_RESET` com `self: true`.
 * - Auditoria `USER_UPDATE` só quando o nome muda; corpo sem mudanças
 *   devolve 200 sem gravar evento (padrão dos demais PATCHs).
 */
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser();
    const body = assertObject(await request.json()) as PatchBody;

    const target = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: USER_SELECT,
    });
    if (!target) {
      return jsonError("Usuário não encontrado.", 404);
    }
    if (!target.active) {
      return jsonError("Conta desativada. Contate o administrador.", 403);
    }

    const data: Record<string, unknown> = {};
    const changes: string[] = [];

    if ("name" in body) {
      const name = assertName(body.name);
      if (name !== target.name) {
        data.name = name;
        changes.push("nome");
      }
    }

    let passwordChanged = false;
    if ("newPassword" in body) {
      const newPassword = assertPassword(body.newPassword, true);
      if (!newPassword) {
        return jsonError(
          "A senha é obrigatória (mínimo de 8 caracteres).",
          400,
        );
      }
      const currentPassword =
        typeof body.currentPassword === "string"
          ? body.currentPassword
          : "";

      if (!currentPassword) {
        return jsonError(
          "Informe a senha atual para trocar a senha.",
          400,
        );
      }

      const row = await prisma.user.findUnique({
        where: { id: target.id },
        select: { passwordHash: true },
      });
      if (!row) {
        return jsonError("Usuário não encontrado.", 404);
      }
      const valid = await bcrypt.compare(currentPassword, row.passwordHash);
      if (!valid) {
        return jsonError("Senha atual incorreta.", 400);
      }
      if (newPassword === currentPassword) {
        return jsonError(
          "A nova senha deve ser diferente da atual.",
          400,
        );
      }

      data.passwordHash = await bcrypt.hash(newPassword, 10);
      passwordChanged = true;
    }

    if (Object.keys(data).length === 0) {
      // Sem mudanças: devolve o estado atual sem gravar auditoria.
      return NextResponse.json({ user: target });
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data,
      select: USER_SELECT,
    });

    if (changes.length > 0) {
      await writeAuditLog({
        userId: user.id,
        action: "USER_UPDATE",
        entity: "User",
        entityId: user.id,
        context: { changes, email: user.email, self: true },
      });
    }
    if (passwordChanged) {
      await writeAuditLog({
        userId: user.id,
        action: "USER_PASSWORD_RESET",
        entity: "User",
        entityId: user.id,
        context: { email: user.email, self: true },
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
