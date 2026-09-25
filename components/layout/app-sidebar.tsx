"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Truck,
  ScanLine,
  FileText,
  Users,
  Shield,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/entradas", label: "Entradas", icon: ArrowDownToLine },
  { href: "/saidas", label: "Saídas", icon: ArrowUpFromLine },
  { href: "/solicitacoes", label: "Solicitações", icon: ClipboardList },
  { href: "/transferencias", label: "Transferências", icon: Truck },
  { href: "/inventarios", label: "Inventário", icon: ScanLine },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/auditoria", label: "Auditoria", icon: Shield },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          SIGAS Saúde
        </p>
        <p className="text-sm text-slate-600">Gestão de Almoxarifado</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sky-50 text-sky-900"
                  : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
