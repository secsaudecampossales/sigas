import { prisma } from "@/lib/db";

export type SystemSettings = {
  orgName: string;
  orgContact: string;
};

export const DEFAULT_SETTINGS: SystemSettings = {
  orgName: "SIGAS Saúde",
  orgContact: "",
};

const SETTINGS_KEY = "general";

export async function getSystemSettings(): Promise<SystemSettings> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: SETTINGS_KEY },
  });
  const value = (row?.value ?? {}) as Record<string, unknown>;
  return {
    orgName:
      typeof value.orgName === "string" && value.orgName.trim().length > 0
        ? value.orgName
        : DEFAULT_SETTINGS.orgName,
    orgContact:
      typeof value.orgContact === "string" ? value.orgContact : "",
  };
}

export { SETTINGS_KEY };
