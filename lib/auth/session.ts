import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import { UserRole } from "@prisma/client";
import { roleHasPermission, type Permission } from "@/lib/permissions/roles";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Não autenticado.");
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireSessionUser();
  if (!roleHasPermission(user.role as UserRole, permission)) {
    throw new Error("Sem permissão para esta operação.");
  }
  return user;
}
