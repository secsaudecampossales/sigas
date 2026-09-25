"use client";

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
        <p className="text-sm font-medium text-slate-900">
          {userName ?? "Usuário"}
        </p>
        <p className="text-xs text-slate-500">{userRole ?? "—"}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Sair
      </Button>
    </header>
  );
}
