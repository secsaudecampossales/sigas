/**
 * Rótulos de perfis e permissões (somente literais de string — seguro para
 * componentes "use client"; não importa o enum gerado do Prisma).
 */
export const ROLE_ORDER = [
  "ADMIN",
  "GESTOR",
  "OPERADOR",
  "SOLICITANTE",
  "CONSULTA",
];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  SOLICITANTE: "Solicitante",
  CONSULTA: "Consulta",
};

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  GESTOR: "bg-sky-100 text-sky-800",
  OPERADOR: "bg-amber-100 text-amber-800",
  SOLICITANTE: "bg-emerald-100 text-emerald-800",
  CONSULTA: "bg-slate-200 text-slate-700",
};

export const PERMISSION_LABELS: Record<string, string> = {
  "users.manage": "Gerenciar usuários",
  "warehouses.manage": "Gerenciar almoxarifados",
  "sectors.manage": "Gerenciar setores",
  "products.manage": "Gerenciar produtos",
  "stock.view": "Ver estoque",
  "stock.view_all_warehouses": "Ver estoque em todos os almoxarifados",
  "stock.move": "Movimentar estoque",
  "requests.create": "Criar solicitações",
  "requests.analyze": "Analisar solicitações",
  "requests.fulfill": "Atender solicitações",
  "transfers.manage": "Gerenciar transferências",
  "inventory.manage": "Gerenciar inventários",
  "reports.view": "Ver relatórios",
  "audit.view": "Ver auditoria",
  "dashboard.view": "Ver dashboard",
};
