import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth/options";
import { roleHasPermission } from "@/lib/permissions/roles";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/client";

// Server component to fetch a single product with its relations
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetch a single product by its primary identifier.
 * If `id` is missing or is not a valid UUID (e.g. `/produtos/novo` or any
 * other slug), we return `null` without hitting the database, so the
 * component can render a friendly "not found" UI instead of throwing a
 * Prisma validation error (P2007 - invalid input syntax for type uuid).
 */
async function getProduct(id: string | undefined) {
  if (!id || !UUID_RE.test(id)) {
    return null;
  }
  return await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      unit: { select: { name: true, code: true } },
    },
  });
}

export default async function ProdutoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  const session = await getServerSession(authOptions);
  const canEdit = roleHasPermission(
    session!.user.role as UserRole,
    "products.manage",
  );

  if (!product) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Produto não encontrado</h1>
        <Link href="/produtos" passHref>
          <Button variant="outline">Voltar à lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Detalhes do Produto</h1>
        <div className="flex gap-2">
          {canEdit ? (
            <Link href={`/produtos/${product.id}/editar`} passHref>
              <Button size="sm">Editar</Button>
            </Link>
          ) : null}
          <Link href="/produtos" passHref>
            <Button variant="outline" size="sm">Voltar</Button>
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Código</p>
          <p className="mt-1 text-lg">{product.code}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Nome</p>
          <p className="mt-1 text-lg">{product.name}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Categoria</p>
          <p className="mt-1 text-lg">{product.category?.name ?? "-"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Unidade</p>
          <p className="mt-1 text-lg">
            {product.unit?.code} - {product.unit?.name}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Tipo</p>
          <p className="mt-1 text-lg">{product.type}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Ativo</p>
          <p className="mt-1 text-lg">{product.active ? "Sim" : "Não"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Estoque Mínimo</p>
          <p className="mt-1 text-lg">{product.minStock}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Estoque Máximo</p>
          <p className="mt-1 text-lg">{product.maxStock ?? "-"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Ponto de Reordenação</p>
          <p className="mt-1 text-lg">{product.reorderPoint ?? "-"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium text-gray-600">Requer Lote</p>
          <p className="mt-1 text-lg">{product.requiresBatch ? "Sim" : "Não"}</p>
        </div>
        {product.description && (
          <div className="md:col-span-2 rounded-lg border p-4">
            <p className="font-medium text-gray-600">Descrição</p>
            <p className="mt-1 text-lg whitespace-pre-line">{product.description}</p>
          </div>
        )}
        {product.notes && (
          <div className="md:col-span-2 rounded-lg border p-4">
            <p className="font-medium text-gray-600">Observações</p>
            <p className="mt-1 text-lg whitespace-pre-line">{product.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
