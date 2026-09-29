"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  userName?: string | null;
  userRole?: string;
};

export function AppHeader({ userName, userRole }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div>
        <Link
          href="/conta"
          className="text-sm font-medium text-slate-900 hover:underline"
          title="Minha conta"
        >
          {userName ?? "Usuário"}
        </Link>
        <p className="text-xs text-slate-500">{userRole ?? "—"}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/conta"
          className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Minha conta
        </Link>
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
