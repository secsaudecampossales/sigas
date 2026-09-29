import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Server component to fetch product data
async function getProducts() {
  return await prisma.product.findMany({
    include: {
      category: { select: { name: true } },
      unit: { select: { name: true, code: true } },
    },
    orderBy: { name: "asc" },
  });
}

export default async function ProdutosPage() {
  const products = await getProducts();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Link href="/produtos/novo" passHref>
          <Button variant="outline" size="sm">
            Novo Produto
          </Button>
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-auto text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2 text-left">Código</th>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">Categoria</th>
              <th className="px-4 py-2 text-left">Unidade</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Ativo</th>
              <th className="px-4 py-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: { id: string; code: string; name: string; category: { name: string } | null; unit: { code: string; name: string } | null; type: string; active: boolean }) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.code}</td>
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">{p.category?.name ?? "-"}</td>
                <td className="px-4 py-2">
                  {p.unit?.code} - {p.unit?.name}
                </td>
                <td className="px-4 py-2">{p.type}</td>
                <td className="px-4 py-2">
                  {p.active ? "Sim" : "Não"}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/produtos/${p.id}`} passHref>
                    <Button variant="ghost" size="sm">
                      Ver
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
