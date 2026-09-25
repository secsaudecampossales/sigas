import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function writeAuditLog(input: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  context?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      context: input.context,
    },
  });
}
