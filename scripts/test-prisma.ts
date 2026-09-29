import { prisma } from "@/lib/db";

async function main() {
  const count = await prisma.product.count();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
