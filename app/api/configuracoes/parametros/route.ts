import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { getSystemSettings, SETTINGS_KEY } from "@/lib/config/settings";
import { assertBodyObject } from "@/lib/config/validation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SettingsPatchBody = {
  orgName?: unknown;
  orgContact?: unknown;
};

/**
 * Parâmetros gerais (SystemSetting). Rota estática: precede a rota dinâmica
 * `[recurso]` no roteamento do Next.
 */
export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePermission("warehouses.manage");
    const body = assertBodyObject(await request.json()) as SettingsPatchBody;

    const current = await getSystemSettings();
    const next = { ...current };
    const keys: string[] = [];

    if ("orgName" in body) {
      if (typeof body.orgName !== "string") {
        throw new Error("Nome da organização inválido.");
      }
      const orgName = body.orgName.trim();
      if (orgName.length < 2 || orgName.length > 80) {
        throw new Error(
          "O nome da organização deve ter entre 2 e 80 caracteres.",
        );
      }
      if (orgName !== next.orgName) {
        next.orgName = orgName;
        keys.push("orgName");
      }
    }

    if ("orgContact" in body) {
      if (typeof body.orgContact !== "string") {
        throw new Error("E-mail de contato inválido.");
      }
      const orgContact = body.orgContact.trim();
      if (orgContact && !EMAIL_RE.test(orgContact)) {
        throw new Error(
          "Informe um e-mail de contato válido (ou deixe em branco).",
        );
      }
      if (orgContact !== next.orgContact) {
        next.orgContact = orgContact;
        keys.push("orgContact");
      }
    }

    if (keys.length === 0) {
      // Sem mudanças: devolve o estado atual sem gravar auditoria.
      return NextResponse.json({ settings: current });
    }

    const row = await prisma.systemSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: next },
      update: { value: next },
    });

    await writeAuditLog({
      userId: actor.id,
      action: "SETTINGS_UPDATE",
      entity: "SystemSetting",
      entityId: row.id,
      context: { keys, orgName: next.orgName },
    });

    return NextResponse.json({ settings: next });
  } catch (error) {
    return handleApiError(error);
  }
}
