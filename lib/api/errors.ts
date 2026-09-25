import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof Error) {
    const status =
      error.message === "Não autenticado."
        ? 401
        : error.message === "Sem permissão para esta operação." ||
            error.message.startsWith("Acesso negado")
          ? 403
          : 400;
    return jsonError(error.message, status);
  }
  return jsonError("Erro interno.", 500);
}
