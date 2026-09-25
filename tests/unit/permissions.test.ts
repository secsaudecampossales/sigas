import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { roleHasPermission } from "@/lib/permissions/roles";
import { canAccessWarehouse } from "@/lib/permissions/warehouse-access";

describe("permissions", () => {
  it("grants stock.move only to roles authorized", () => {
    expect(roleHasPermission(UserRole.OPERADOR, "stock.move")).toBe(true);
    expect(roleHasPermission(UserRole.SOLICITANTE, "stock.move")).toBe(false);
  });

  it("restricts warehouse access by assignment", () => {
    expect(
      canAccessWarehouse(
        { role: UserRole.OPERADOR, warehouseIds: ["w1"] },
        "w1",
      ),
    ).toBe(true);
    expect(
      canAccessWarehouse(
        { role: UserRole.OPERADOR, warehouseIds: ["w1"] },
        "w2",
      ),
    ).toBe(false);
    expect(
      canAccessWarehouse(
        { role: UserRole.ADMIN, warehouseIds: [] },
        "w2",
      ),
    ).toBe(true);
  });
});
