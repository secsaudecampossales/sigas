"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type AppHeaderProps = {
  userName?: string | null;
  userRole?: string;
  /** Abre/fecha o menu lateral no celular (drawer). Só no viewport pequeno. */
  onMenu?: () => void;
};

export function AppHeader({ userName, userRole, onMenu }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onMenu ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 md:hidden"
            onClick={onMenu}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
        ) : null}
        <div className="min-w-0">
          <Link
            href="/conta"
            className="block truncate text-sm font-medium text-slate-900 hover:underline"
            title="Minha conta"
          >
            {userName ?? "Usuário"}
          </Link>
          <p className="truncate text-xs text-slate-500">{userRole ?? "—"}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/ajuda"
          className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Ajuda
        </Link>
        <Link
          href="/conta"
          className="hidden text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline sm:inline"
        >
          Minha conta
        </Link>
        <ThemeToggle />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sair
        </Button>
      </div>
    </header>
  );
}
