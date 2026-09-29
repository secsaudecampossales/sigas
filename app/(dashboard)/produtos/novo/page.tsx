import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/products/product-form";

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
