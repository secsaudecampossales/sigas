"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

/**
 * Layout visual do dashboard (client): sidebar estática no desktop e
 * **drawer com hambúrguer no celular** — antes a sidebar simplesmente
 * sumia em telas pequenas e o usuário ficava preso na página.
 *
 * O drawer fica aberto apenas enquanto a rota em que foi aberto for a
 * atual: ao navegar, a troca de `pathname` o fecha sozinho (sem efeito).
 */
export function DashboardShell({
  userName,
  userRole,
  hiddenPaths,
  children,
}: {
  userName?: string | null;
  userRole?: string;
  hiddenPaths?: string[];
  children: React.ReactNode;
}) {
  // Rota em que o menu foi aberto (null = fechado).
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const pathname = usePathname();
  const menuOpen = menuPath === pathname;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop */}
      <div className="hidden shrink-0 md:flex">
        <AppSidebar hiddenPaths={hiddenPaths} />
      </div>

      {/* Celular: drawer sobreposto */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fechar menu"
            onClick={() => setMenuPath(null)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <AppSidebar hiddenPaths={hiddenPaths} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          userName={userName}
          userRole={userRole}
          onMenu={() => setMenuPath(menuOpen ? null : pathname)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
