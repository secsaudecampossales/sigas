import { UserRole } from "@prisma/client";

export type Permission =
  | "users.manage"
  | "warehouses.manage"
  | "sectors.manage"
  | "products.manage"
  | "stock.view"
  | "stock.view_all_warehouses"
  | "stock.move"
  | "requests.create"
  | "requests.analyze"
  | "requests.fulfill"
  | "transfers.manage"
  | "inventory.manage"
  | "reports.view"
  | "audit.view"
  | "dashboard.view";

const rolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: [
    "users.manage",
    "warehouses.manage",
    "sectors.manage",
    "products.manage",
    "stock.view",
    "stock.view_all_warehouses",
    "stock.move",
    "requests.create",
    "requests.analyze",
    "requests.fulfill",
    "transfers.manage",
    "inventory.manage",
    "reports.view",
    "audit.view",
    "dashboard.view",
  ],
  GESTOR: [
    "stock.view",
    "stock.view_all_warehouses",
    "requests.analyze",
    "reports.view",
    "audit.view",
    "dashboard.view",
  ],
  OPERADOR: [
    "products.manage",
    "stock.view",
    "stock.move",
    "requests.analyze",
    "requests.fulfill",
    "transfers.manage",
    "inventory.manage",
    "reports.view",
    "dashboard.view",
  ],
  SOLICITANTE: [
    "stock.view",
    "stock.view_all_warehouses",
    "requests.create",
    "dashboard.view",
  ],
  CONSULTA: ["stock.view", "reports.view", "dashboard.view"],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return rolePermissions[role];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
