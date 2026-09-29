/**
 * Registro dos catálogos de configuração (somente literais — seguro para
 * componentes "use client"; nenhuma importação do Prisma aqui).
 */
import type { Permission } from "@/lib/permissions/roles";

export type CatalogId =
  | "almoxarifados"
  | "setores"
  | "categorias"
  | "unidades";

export const CATALOG_IDS: CatalogId[] = [
  "almoxarifados",
  "setores",
  "categorias",
  "unidades",
];

export type CatalogDef = {
  id: CatalogId;
  /** Rótulo plural (abas e cards). */
  label: string;
  /** Rótulo singular (formulários e mensagens). */
  singular: string;
  /** Nome do model Prisma (entidade de auditoria). */
  entity: string;
  permission: Permission;
  /** Somente almoxarifados têm tipo/localização/responsável. */
  hasType: boolean;
  /** Artigo do título do formulário ("Novo" / "Nova"). */
  article: "Novo" | "Nova";
};

export const CATALOGS: Record<CatalogId, CatalogDef> = {
  almoxarifados: {
    id: "almoxarifados",
    label: "Almoxarifados",
    singular: "Almoxarifado",
    entity: "Warehouse",
    permission: "warehouses.manage",
    hasType: true,
    article: "Novo",
  },
  setores: {
    id: "setores",
    label: "Setores",
    singular: "Setor",
    entity: "Sector",
    permission: "sectors.manage",
    hasType: false,
    article: "Novo",
  },
  categorias: {
    id: "categorias",
    label: "Categorias",
    singular: "Categoria",
    entity: "Category",
    permission: "products.manage",
    hasType: false,
    article: "Nova",
  },
  unidades: {
    id: "unidades",
    label: "Unidades",
    singular: "Unidade",
    entity: "Unit",
    permission: "products.manage",
    hasType: false,
    article: "Nova",
  },
};

export function parseCatalogId(value: string | undefined): CatalogId | null {
  return value && (CATALOG_IDS as string[]).includes(value)
    ? (value as CatalogId)
    : null;
}

export const SETTINGS_ABA = "parametros";
export const SETTINGS_PERMISSION: Permission = "warehouses.manage";

export const WAREHOUSE_TYPE_ORDER = [
  "INSUMOS_MEDICAMENTOS",
  "ADMINISTRATIVO",
];

export const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  INSUMOS_MEDICAMENTOS: "Insumos e Medicamentos",
  ADMINISTRATIVO: "Administrativo",
};
