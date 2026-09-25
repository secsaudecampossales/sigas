import bcrypt from "bcryptjs";
import {
  PrismaClient,
  UserRole,
  WarehouseType,
  ProductType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const insumos = await prisma.warehouse.upsert({
    where: { code: "ALM-INS" },
    update: {},
    create: {
      code: "ALM-INS",
      name: "Almoxarifado de Insumos e Medicamentos",
      type: WarehouseType.INSUMOS_MEDICAMENTOS,
      location: "Secretaria Municipal de Saúde",
      responsible: "Equipe de Insumos",
    },
  });

  const adminWarehouse = await prisma.warehouse.upsert({
    where: { code: "ALM-ADM" },
    update: {},
    create: {
      code: "ALM-ADM",
      name: "Almoxarifado Administrativo",
      type: WarehouseType.ADMINISTRATIVO,
      location: "Secretaria Municipal de Saúde",
      responsible: "Equipe Administrativa",
    },
  });

  const sector = await prisma.sector.upsert({
    where: { code: "SMS-GERAL" },
    update: {},
    create: {
      code: "SMS-GERAL",
      name: "Secretaria Municipal de Saúde",
    },
  });

  const category = await prisma.category.upsert({
    where: { code: "GERAL" },
    update: {},
    create: { code: "GERAL", name: "Materiais gerais" },
  });

  const unit = await prisma.unit.upsert({
    where: { code: "UN" },
    update: {},
    create: { code: "UN", name: "Unidade" },
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@saude.local" },
    update: {},
    create: {
      name: "Administrador SIGAS",
      email: "admin@saude.local",
      passwordHash,
      role: UserRole.ADMIN,
      sectorId: sector.id,
      warehouseIds: [insumos.id, adminWarehouse.id],
    },
  });

  await prisma.product.upsert({
    where: { code: "PAPEL-A4" },
    update: {},
    create: {
      code: "PAPEL-A4",
      name: "Papel sulfite A4",
      description: "Resma 500 folhas",
      categoryId: category.id,
      unitId: unit.id,
      type: ProductType.MATERIAL_ADMINISTRATIVO,
      minStock: 20,
      maxStock: 200,
      requiresBatch: false,
    },
  });

  console.log("Seed concluído.");
  console.log("Login: admin@saude.local / admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
