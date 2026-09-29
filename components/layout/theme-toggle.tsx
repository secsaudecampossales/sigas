"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sigas:tema";

/**
 * Alterna o modo escuro SEM estado no React: a classe `.dark` no `<html>`
 * controla todo o CSS (bloco `.dark` em `app/globals.css`) e qual ícone
 * aparece (`dark:hidden` / `hidden dark:block`) — nada para sincronizar na
 * hidratação, portanto sem divergência servidor/cliente.
 *
 * A preferência é gravada em `localStorage` e aplicada antes da primeira
 * pintura pelo script `theme-init` em `app/layout.tsx` (padrão: tema do
 * sistema quando não há escolha salva).
 */
function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // localStorage indisponível (modo privado/restrito) — só não persiste.
  }
}

export function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 px-0"
      onClick={toggleTheme}
      aria-label="Alternar entre modo claro e modo escuro"
      title="Alternar modo escuro"
    >
      <Sun className="h-4 w-4 dark:hidden" aria-hidden />
      <Moon className="hidden h-4 w-4 dark:block" aria-hidden />
    </Button>
  );
}
