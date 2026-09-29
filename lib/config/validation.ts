import { WarehouseType } from "@/generated/prisma/client";
import { WAREHOUSE_TYPE_ORDER } from "@/lib/config/catalogs";

/**
 * Validações dos catálogos de configuração (POST/PATCH). Lançam `Error`
 * com mensagem em pt-BR; as rotas convertem em 400 via `handleApiError`.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CODE_RE = /^[A-Z0-9._-]+$/;

export function assertBodyObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Corpo da requisição inválido.");
  }
  return body as Record<string, unknown>;
}

/** Código: 2–24 caracteres (letras, números, `.`, `_` ou `-`), maiúsculas. */
export function assertCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Código inválido.");
  }
  const code = value.trim().toUpperCase();
  if (code.length < 2 || code.length > 24 || !CODE_RE.test(code)) {
    throw new Error(
      "O código deve ter 2 a 24 caracteres (letras, números, '.', '_' ou '-').",
    );
  }
  return code;
}

export function assertName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Nome inválido.");
  }
  const name = value.trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error("O nome deve ter entre 2 e 80 caracteres.");
  }
  return name;
}

export function assertWarehouseType(value: unknown): WarehouseType {
  if (
    typeof value !== "string" ||
    !WAREHOUSE_TYPE_ORDER.includes(value)
  ) {
    throw new Error("Tipo de almoxarifado inválido.");
  }
  return value as WarehouseType;
}

/** Texto opcional (localização/responsável): `""`/ausente limpa o campo. */
export function assertOptionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.trim().length > max) {
    throw new Error(`${label}: máximo de ${max} caracteres.`);
  }
  const text = value.trim();
  return text.length > 0 ? text : null;
}
