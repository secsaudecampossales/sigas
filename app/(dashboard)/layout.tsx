import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AuthSessionProvider } from "@/components/providers/session-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AuthSessionProvider>
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            userName={session.user.name}
            userRole={session.user.role}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
