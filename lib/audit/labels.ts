/**
 * Rótulos de ações/entidades de auditoria (somente literais — seguro para
 * componentes "use client").
 */
export const ACTION_LABELS: Record<string, string> = {
  STOCK_ENTRY: "Entrada de estoque",
  STOCK_EXIT: "Saída de estoque",
  STOCK_RECEIPT: "Comprovante de saída emitido",
  PRODUCT_CREATE: "Produto criado",
  REQUEST_CREATE: "Solicitação criada",
  REQUEST_ANALYZE: "Solicitação analisada",
  REQUEST_APPROVE: "Solicitação aprovada",
  REQUEST_REJECT: "Solicitação rejeitada",
  REQUEST_CANCEL: "Solicitação cancelada",
  REQUEST_FULFILL_START: "Atendimento iniciado",
  REQUEST_FULFILL: "Solicitação atendida",
  REQUEST_FULFILL_REOPEN: "Atendimento reaberto",
  TRANSFER_CREATE: "Transferência criada",
  TRANSFER_EXIT: "Saída confirmada",
  TRANSFER_RECEIPT: "Recebimento confirmado",
  TRANSFER_CANCEL: "Transferência cancelada",
  INVENTORY_CREATE: "Inventário aberto",
  INVENTORY_COUNT_START: "Contagem iniciada",
  INVENTORY_COUNT_SAVE: "Contagem salva",
  INVENTORY_COUNT_FINISH: "Contagem finalizada",
  INVENTORY_RECOUNT: "Recontagem solicitada",
  INVENTORY_ADJUST: "Ajuste aplicado",
  INVENTORY_CLOSE: "Inventário concluído",
  INVENTORY_CANCEL: "Inventário cancelado",
  USER_CREATE: "Usuário criado",
  USER_UPDATE: "Usuário atualizado",
  USER_PASSWORD_RESET: "Senha redefinida",
  USER_ACTIVATE: "Usuário ativado",
  USER_DEACTIVATE: "Usuário desativado",
  CATALOG_CREATE: "Registro criado",
  CATALOG_UPDATE: "Registro atualizado",
  SETTINGS_UPDATE: "Parâmetros atualizados",
};

export const ENTITY_LABELS: Record<string, string> = {
  StockMovement: "Movimentação de estoque",
  Product: "Produto",
  MaterialRequest: "Solicitação",
  Transfer: "Transferência",
  Inventory: "Inventário",
  User: "Usuário",
  Warehouse: "Almoxarifado",
  Sector: "Setor",
  Category: "Categoria",
  Unit: "Unidade",
  SystemSetting: "Parâmetros do sistema",
};

const ACTION_FAMILIES: Array<{ prefix: string; classes: string }> = [
  { prefix: "STOCK_", classes: "bg-sky-100 text-sky-800" },
  { prefix: "PRODUCT_", classes: "bg-emerald-100 text-emerald-800" },
  { prefix: "REQUEST_", classes: "bg-amber-100 text-amber-800" },
  { prefix: "TRANSFER_", classes: "bg-purple-100 text-purple-800" },
  { prefix: "INVENTORY_", classes: "bg-teal-100 text-teal-800" },
  { prefix: "USER_", classes: "bg-rose-100 text-rose-800" },
  { prefix: "CATALOG_", classes: "bg-indigo-100 text-indigo-800" },
  { prefix: "SETTINGS_", classes: "bg-fuchsia-100 text-fuchsia-800" },
];

export function actionBadgeClasses(action: string): string {
  const family = ACTION_FAMILIES.find((item) =>
    action.startsWith(item.prefix),
  );
  return family?.classes ?? "bg-slate-200 text-slate-700";
}

/** Entidades com página de detalhe por ID. */
const ENTITY_DETAIL_ROUTES: Record<string, string> = {
  User: "/usuarios",
  Product: "/produtos",
  MaterialRequest: "/solicitacoes",
  Transfer: "/transferencias",
  Inventory: "/inventarios",
};

/** Entidades gerenciadas por aba (sem rota de detalhe). */
const ENTITY_LIST_ROUTES: Record<string, string> = {
  Warehouse: "/configuracoes?aba=almoxarifados",
  Sector: "/configuracoes?aba=setores",
  Category: "/configuracoes?aba=categorias",
  Unit: "/configuracoes?aba=unidades",
  SystemSetting: "/configuracoes?aba=parametros",
};

/** Link de navegação do registro de auditoria, ou `null` se não houver rota. */
export function entityLink(
  entity: string,
  entityId: string | null,
): string | null {
  if (!entityId) return null;
  const detail = ENTITY_DETAIL_ROUTES[entity];
  if (detail) return `${detail}/${entityId}`;
  return ENTITY_LIST_ROUTES[entity] ?? null;
}
