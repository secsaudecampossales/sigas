import { prisma } from "@/lib/db";
import { ROLE_ORDER } from "@/lib/users/labels";
import { UserRole, type Prisma } from "@/generated/prisma/client";

/** Campos seguros do usuário (nunca expõe `passwordHash`). */
export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  sectorId: true,
  warehouseIds: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

/**
 * Validações de usuário compartilhadas por POST /api/usuarios e PATCH
 * /api/usuarios/[id]. Lançam `Error` com mensagem em pt-BR; as rotas
 * convertem em 400 via `handleApiError` (mesmo padrão das state machines).
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set<string>(ROLE_ORDER);

export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;
const MAX_WAREHOUSES = 50;

export function assertObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Corpo da requisição inválido.");
  }
  return body as Record<string, unknown>;
}

export function assertName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Nome inválido.");
  }
  const name = value.trim();
  if (name.length < 2 || name.length > 120) {
    throw new Error("O nome deve ter entre 2 e 120 caracteres.");
  }
  return name;
}

export function assertEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("E-mail inválido.");
  }
  const email = value.trim().toLowerCase();
  if (email.length > 160 || !EMAIL_RE.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  return email;
}

export function assertRole(value: unknown): UserRole {
  if (typeof value !== "string" || !ROLES.has(value)) {
    throw new Error("Perfil inválido.");
  }
  return value as UserRole;
}

/**
 * Senha: `required` exige informar (criação); opcional vazia/ausente
 * mantém a senha atual (edição).
 */
export function assertPassword(
  value: unknown,
  required: boolean,
): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error(`A senha é obrigatória (mínimo de ${MIN_PASSWORD} caracteres).`);
    }
    return null;
  }
  if (
    typeof value !== "string" ||
    value.length < MIN_PASSWORD ||
    value.length > MAX_PASSWORD
  ) {
    throw new Error(
      `A senha deve ter entre ${MIN_PASSWORD} e ${MAX_PASSWORD} caracteres.`,
    );
  }
  return value;
}

/** `null`/`""` limpa o vínculo; string deve ser um setor existente. */
export async function assertSector(value: unknown): Promise<string | null> {
  if (value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error("Setor inválido.");
  }
  const sector = await prisma.sector.findUnique({
    where: { id: value },
    select: { id: true },
  });
  if (!sector) {
    throw new Error("Setor inválido.");
  }
  return sector.id;
}

/** Lista única de IDs de almoxarifados existentes. */
export async function assertWarehouseIds(value: unknown): Promise<string[]> {
  if (!Array.isArray(value)) {
    throw new Error("Lista de almoxarifados inválida.");
  }
  const ids = [...new Set(value)];
  if (ids.length > MAX_WAREHOUSES) {
    throw new Error(`Limite de ${MAX_WAREHOUSES} almoxarifados por usuário.`);
  }
  for (const id of ids) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      throw new Error("Almoxarifado inválido.");
    }
  }
  if (ids.length === 0) {
    return [];
  }
  const warehouses = await prisma.warehouse.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (warehouses.length !== ids.length) {
    throw new Error("Almoxarifado inválido.");
  }
  return warehouses.map((warehouse) => warehouse.id);
}
