import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions/roles";
import { Button } from "@/components/ui/button";
import { ProductForm, type ProductInitial } from "@/components/products/product-form";
import { UserRole } from "@/generated/prisma/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await getServerSession(authOptions);
  const role = session!.user.role as UserRole;

  if (!roleHasPermission(role, "products.manage")) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-slate-900">Sem permissão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu perfil não pode editar produtos. Fale com a coordenação se isso
          for necessário para o seu trabalho.
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

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

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

  // Mantém a categoria/unidade atuais nos selects mesmo se inativadas.
  if (!categories.some((category) => category.id === product.categoryId)) {
    const current = await prisma.category.findUnique({
      where: { id: product.categoryId },
      select: { id: true, name: true, code: true },
    });
    if (current) categories.push(current);
  }
  if (!units.some((unit) => unit.id === product.unitId)) {
    const current = await prisma.unit.findUnique({
      where: { id: product.unitId },
      select: { id: true, name: true, code: true },
    });
    if (current) units.push(current);
  }

  const initial: ProductInitial = {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    unitId: product.unitId,
    type: product.type,
    minStock: product.minStock,
    maxStock: product.maxStock,
    reorderPoint: product.reorderPoint,
    requiresBatch: product.requiresBatch,
    active: product.active,
    notes: product.notes,
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar Produto</h1>
        <Link href={`/produtos/${product.id}`} passHref>
          <Button variant="outline" size="sm">
            Voltar
          </Button>
        </Link>
      </div>
      <div className="max-w-3xl rounded-lg border bg-white p-6">
        <ProductForm categories={categories} units={units} initial={initial} />
      </div>
    </div>
  );
}
