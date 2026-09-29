import { LoginForm } from "@/components/auth/login-form";
import { getSystemSettings } from "@/lib/config/settings";

// Os parâmetros gerais mudam em runtime; a página não pode ser pré-renderizada.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await getSystemSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            {settings.orgName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Acesso ao sistema
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gerenciamento integrado dos almoxarifados da Secretaria de Saúde.
          </p>
        </div>

        <LoginForm />

        {settings.orgContact ? (
          <p className="mt-4 text-center text-xs text-slate-500">
            Suporte: {settings.orgContact}
          </p>
        ) : null}
      </div>
    </div>
  );
}
