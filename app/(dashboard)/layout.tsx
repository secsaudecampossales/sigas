import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import {
  CATALOGS,
  CATALOG_IDS,
  SETTINGS_PERMISSION,
} from "@/lib/config/catalogs";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { UserRole } from "@/generated/prisma/client";

/**
 * Itens do menu que exigem permissão de página. Quem não tem a permissão
 * correspondente não vê o link (a página continua protegida por trás —
 * gate individual + API).
 */
function hiddenNavPaths(role: UserRole): string[] {
  const hidden: string[] = [];
  if (!roleHasPermission(role, "reports.view")) hidden.push("/relatorios");
  if (!roleHasPermission(role, "users.manage")) hidden.push("/usuarios");
  if (!roleHasPermission(role, "audit.view")) hidden.push("/auditoria");
  const canConfig =
    CATALOG_IDS.some((id) => roleHasPermission(role, CATALOGS[id].permission)) ||
    roleHasPermission(role, SETTINGS_PERMISSION);
  if (!canConfig) hidden.push("/configuracoes");
  return hidden;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  // Nome exibido vem do banco: reflete trocas feitas em "Minha conta"
  // sem exigir novo login. Permissões continuam vindo do JWT (mesmo
  // comportamento das páginas).
  const fresh = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  return (
    <AuthSessionProvider>
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar
          hiddenPaths={hiddenNavPaths(session.user.role as UserRole)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            userName={fresh?.name ?? session.user.name}
            userRole={session.user.role}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
