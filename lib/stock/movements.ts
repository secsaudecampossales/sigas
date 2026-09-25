import { MovementType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { availableQuantity } from "./calculations";

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

type StockLineInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
};

type MovementContext = {
  userId: string;
  type: MovementType;
  notes?: string;
  documentRef?: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  warehouseFromId?: string;
  warehouseToId?: string;
};

async function getOrCreateStock(productId: string, warehouseId: string) {
  return prisma.stock.upsert({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
    create: { productId, warehouseId, physicalQty: 0, reservedQty: 0 },
    update: {},
  });
}

export async function applyStockEntry(
  line: StockLineInput,
  ctx: MovementContext,
  tx: Prisma.TransactionClient = prisma,
) {
  if (line.quantity <= 0) {
    throw new StockError("Quantidade de entrada deve ser maior que zero.");
  }

  if (ctx.idempotencyKey) {
    const existing = await tx.stockMovement.findUnique({
      where: { idempotencyKey: ctx.idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  await tx.stock.upsert({
    where: {
      productId_warehouseId: {
        productId: line.productId,
        warehouseId: line.warehouseId,
      },
    },
    create: {
      productId: line.productId,
      warehouseId: line.warehouseId,
      physicalQty: line.quantity,
      reservedQty: 0,
    },
    update: {
      physicalQty: { increment: line.quantity },
    },
  });

  return tx.stockMovement.create({
    data: {
      type: ctx.type,
      productId: line.productId,
      warehouseToId: line.warehouseId,
      warehouseFromId: ctx.warehouseFromId,
      quantity: line.quantity,
      userId: ctx.userId,
      notes: ctx.notes,
      documentRef: ctx.documentRef,
      referenceType: ctx.referenceType,
      referenceId: ctx.referenceId,
      idempotencyKey: ctx.idempotencyKey,
    },
  });
}

export async function applyStockExit(
  line: StockLineInput,
  ctx: MovementContext,
  tx: Prisma.TransactionClient = prisma,
) {
  if (line.quantity <= 0) {
    throw new StockError("Quantidade de saída deve ser maior que zero.");
  }

  if (ctx.idempotencyKey) {
    const existing = await tx.stockMovement.findUnique({
      where: { idempotencyKey: ctx.idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  const stock = await getOrCreateStock(line.productId, line.warehouseId);
  const available = availableQuantity(stock.physicalQty, stock.reservedQty);

  if (line.quantity > available) {
    throw new StockError("Saldo disponível insuficiente para a saída.");
  }

  await tx.stock.update({
    where: { id: stock.id },
    data: { physicalQty: { decrement: line.quantity } },
  });

  return tx.stockMovement.create({
    data: {
      type: ctx.type,
      productId: line.productId,
      warehouseFromId: line.warehouseId,
      warehouseToId: ctx.warehouseToId,
      quantity: line.quantity,
      userId: ctx.userId,
      notes: ctx.notes,
      documentRef: ctx.documentRef,
      referenceType: ctx.referenceType,
      referenceId: ctx.referenceId,
      idempotencyKey: ctx.idempotencyKey,
    },
  });
}
