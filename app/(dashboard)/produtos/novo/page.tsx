import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/products/product-form";
import { UserRole } from "@/generated/prisma/client";

async function getOptions() {
  const [categories, units] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.unit.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);
  return { categories, units };
}

export default async function NovoProdutoPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  if (!roleHasPermission(role, "products.manage")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode cadastrar produtos. Fale com a coordenação se
          isso for necessário para o seu trabalho.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const { categories, units } = await getOptions();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Novo Produto</h1>
        <Link href="/produtos" passHref>
          <Button variant="outline" size="sm">
            Voltar
          </Button>
        </Link>
      </div>
      <div className="max-w-3xl rounded-lg border bg-white p-6">
        <ProductForm categories={categories} units={units} />
      </div>
    </div>
  );
}
