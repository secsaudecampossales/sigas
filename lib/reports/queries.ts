import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { ENTRY_TYPE_LABELS } from "@/lib/stock/entry-types";
import { EXIT_TYPE_LABELS } from "@/lib/stock/exit-types";
import { REQUEST_STATUS_LABELS } from "@/lib/requests/labels";
import { TRANSFER_STATUS_LABELS } from "@/lib/transfers/labels";
import { availableQuantity, isBelowMinimum } from "@/lib/stock/calculations";
import {
  RequestStatus,
  TransferStatus,
} from "@/generated/prisma/client";
import type { ReportBlock, ReportPayload } from "./types";

export const REPORT_TYPES = [
  { id: "movimentacoes", label: "Movimentações" },
  { id: "estoque", label: "Estoque atual" },
  { id: "solicitacoes", label: "Solicitações" },
  { id: "transferencias", label: "Transferências" },
] as const;

export type ReportTypeId = (typeof REPORT_TYPES)[number]["id"];

export const REPORT_TYPE_IDS: string[] = REPORT_TYPES.map(
  (report) => report.id,
);

export type ReportQueryFilters = {
  from: Date;
  to: Date;
  /** Almoxarifados no escopo (já filtrados pelo acesso do usuário). */
  warehouseIds: string[];
  /** Nome do almoxarifado selecionado, quando houver. */
  warehouseName: string | null;
};

const nf = new Intl.NumberFormat("pt-BR");
const dt = (date: Date) => format(date, "dd/MM/yyyy HH:mm");
const day = (date: Date) => format(date, "dd/MM/yyyy");

const MOVEMENT_LABELS: Record<string, string> = {
  ...ENTRY_TYPE_LABELS,
  ...EXIT_TYPE_LABELS,
  AJUSTE_INVENTARIO: "Ajuste de inventário",
  OUTRO: "Outro",
};

function periodLabel(filters: ReportQueryFilters): string {
  return `${day(filters.from)} — ${day(filters.to)} · ${
    filters.warehouseName ?? "Todos os almoxarifados acessíveis"
  }`;
}

export async function buildReport(
  type: string,
  filters: ReportQueryFilters,
): Promise<ReportPayload> {
  switch (type) {
    case "estoque":
      return buildStockReport(filters);
    case "solicitacoes":
      return buildRequestsReport(filters);
    case "transferencias":
      return buildTransfersReport(filters);
    default:
      return buildMovementsReport(filters);
  }
}

async function buildMovementsReport(
  filters: ReportQueryFilters,
): Promise<ReportPayload> {
  const { from, to, warehouseIds } = filters;
  const period = { gte: from, lte: to };
  const inScope = {
    OR: [
      { warehouseToId: { in: warehouseIds } },
      { warehouseFromId: { in: warehouseIds } },
    ],
  };

  const [entryAgg, exitAgg, entryTypes, exitTypes, total, recent] =
    await Promise.all([
      prisma.stockMovement.aggregate({
        where: { warehouseToId: { in: warehouseIds }, createdAt: period },
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.aggregate({
        where: { warehouseFromId: { in: warehouseIds }, createdAt: period },
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.groupBy({
        by: ["type"],
        where: { warehouseToId: { in: warehouseIds }, createdAt: period },
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { type: "asc" },
      }),
      prisma.stockMovement.groupBy({
        by: ["type"],
        where: { warehouseFromId: { in: warehouseIds }, createdAt: period },
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { type: "asc" },
      }),
      prisma.stockMovement.count({
        where: { ...inScope, createdAt: period },
      }),
      prisma.stockMovement.findMany({
        where: { ...inScope, createdAt: period },
        include: {
          product: { select: { name: true } },
          warehouseFrom: { select: { name: true } },
          warehouseTo: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

  const typeColumns = [
    { key: "label", label: "Tipo" },
    { key: "count", label: "Movimentos", align: "right" as const },
    { key: "qty", label: "Quantidade (un.)", align: "right" as const },
  ];

  const entryBlock: ReportBlock = {
    title: "Entradas por tipo",
    columns: typeColumns,
    rows: entryTypes.map((row) => ({
      label: MOVEMENT_LABELS[row.type] ?? row.type,
      count: row._count._all,
      qty: nf.format(row._sum.quantity ?? 0),
    })),
  };

  const exitBlock: ReportBlock = {
    title: "Saídas por tipo",
    columns: typeColumns,
    rows: exitTypes.map((row) => ({
      label: MOVEMENT_LABELS[row.type] ?? row.type,
      count: row._count._all,
      qty: nf.format(row._sum.quantity ?? 0),
    })),
  };

  const recentBlock: ReportBlock = {
    title: `Últimos lançamentos (${recent.length})`,
    columns: [
      { key: "date", label: "Data / hora" },
      { key: "type", label: "Tipo" },
      { key: "product", label: "Produto" },
      { key: "qty", label: "Qtd.", align: "right" },
      { key: "route", label: "Trajeto" },
      { key: "document", label: "Documento" },
    ],
    rows: recent.map((movement) => ({
      date: dt(movement.createdAt),
      type: MOVEMENT_LABELS[movement.type] ?? movement.type,
      product: movement.product.name,
      qty: nf.format(movement.quantity),
      route: `${movement.warehouseFrom?.name ?? "—"} → ${movement.warehouseTo?.name ?? "—"}`,
      document: movement.documentRef ?? "—",
    })),
  };

  const entries = entryAgg._sum.quantity ?? 0;
  const exits = exitAgg._sum.quantity ?? 0;

  return {
    type: "movimentacoes",
    title: "Movimentações de estoque",
    subtitle: periodLabel(filters),
    summary: [
      { label: "Entradas (un.)", value: nf.format(entries) },
      { label: "Saídas (un.)", value: nf.format(exits) },
      { label: "Movimentos no período", value: nf.format(total) },
      { label: "Saldo líquido (un.)", value: nf.format(entries - exits) },
    ],
    blocks: [entryBlock, exitBlock, recentBlock],
  };
}

async function buildStockReport(
  filters: ReportQueryFilters,
): Promise<ReportPayload> {
  const stocks = await prisma.stock.findMany({
    where: {
      warehouseId: { in: filters.warehouseIds },
      product: { active: true },
    },
    include: {
      product: {
        select: {
          code: true,
          name: true,
          minStock: true,
          unit: { select: { name: true } },
        },
      },
      warehouse: { select: { name: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { warehouse: { name: "asc" } }],
  });

  let belowMinimum = 0;
  let outOfStock = 0;
  let totalPhysical = 0;

  const rows = stocks.map((stock) => {
    const available = availableQuantity(
      stock.physicalQty,
      stock.reservedQty,
    );
    let situation = "Normal";
    if (stock.physicalQty <= 0) {
      situation = "Sem estoque";
      outOfStock += 1;
    } else if (isBelowMinimum(stock.physicalQty, stock.product.minStock)) {
      situation = "Abaixo do mínimo";
      belowMinimum += 1;
    }
    totalPhysical += stock.physicalQty;
    return {
      code: stock.product.code,
      product: stock.product.name,
      unit: stock.product.unit.name,
      warehouse: stock.warehouse.name,
      physical: nf.format(stock.physicalQty),
      reserved: nf.format(stock.reservedQty),
      available: nf.format(available),
      minimum: nf.format(stock.product.minStock),
      situation,
    };
  });

  return {
    type: "estoque",
    title: "Estoque atual",
    subtitle: `Situação atual · ${filters.warehouseName ?? "Todos os almoxarifados acessíveis"}`,
    summary: [
      { label: "Produtos em estoque", value: nf.format(rows.length) },
      { label: "Saldo físico total (un.)", value: nf.format(totalPhysical) },
      {
        label: "Abaixo do mínimo",
        value: nf.format(belowMinimum),
      },
      { label: "Sem estoque", value: nf.format(outOfStock) },
    ],
    blocks: [
      {
        title: "Saldos por produto e almoxarifado",
        columns: [
          { key: "code", label: "Código" },
          { key: "product", label: "Produto" },
          { key: "unit", label: "Unid." },
          { key: "warehouse", label: "Almoxarifado" },
          { key: "physical", label: "Físico", align: "right" },
          { key: "reserved", label: "Reservado", align: "right" },
          { key: "available", label: "Disponível", align: "right" },
          { key: "minimum", label: "Mínimo", align: "right" },
          { key: "situation", label: "Situação" },
        ],
        rows,
      },
    ],
  };
}

const REQUEST_LIMIT = 300;

async function buildRequestsReport(
  filters: ReportQueryFilters,
): Promise<ReportPayload> {
  const where = {
    createdAt: { gte: filters.from, lte: filters.to },
    originWarehouseId: { in: filters.warehouseIds },
  };

  const [requests, byStatus] = await Promise.all([
    prisma.materialRequest.findMany({
      where,
      include: {
        sector: { select: { name: true } },
        originWarehouse: { select: { name: true } },
        requester: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: REQUEST_LIMIT,
    }),
    prisma.materialRequest.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const statusCount = new Map(
    byStatus.map((row) => [row.status, row._count._all]),
  );
  const countOf = (statuses: RequestStatus[]) =>
    statuses.reduce((sum, status) => sum + (statusCount.get(status) ?? 0), 0);

  return {
    type: "solicitacoes",
    title: "Solicitações de materiais",
    subtitle: periodLabel(filters),
    summary: [
      { label: "Total", value: nf.format(countOf(Object.values(RequestStatus))) },
      {
        label: "Pendentes",
        value: nf.format(
          countOf([RequestStatus.PENDENTE, RequestStatus.EM_ANALISE]),
        ),
      },
      {
        label: "Em atendimento",
        value: nf.format(countOf([RequestStatus.EM_ATENDIMENTO])),
      },
      {
        label: "Atendidas",
        value: nf.format(
          countOf([
            RequestStatus.ATENDIDA,
            RequestStatus.ATENDIDA_PARCIALMENTE,
          ]),
        ),
      },
      {
        label: "Encerradas sem atendimento",
        value: nf.format(
          countOf([RequestStatus.REJEITADA, RequestStatus.CANCELADA]),
        ),
      },
    ],
    blocks: [
      {
        title: `Solicitações do período (${requests.length}${requests.length >= REQUEST_LIMIT ? "+" : ""})`,
        columns: [
          { key: "number", label: "Nº" },
          { key: "sector", label: "Setor" },
          { key: "warehouse", label: "Almoxarifado" },
          { key: "status", label: "Status" },
          { key: "items", label: "Itens", align: "right" },
          { key: "createdAt", label: "Criada em" },
          { key: "requester", label: "Solicitante" },
        ],
        rows: requests.map((request) => ({
          number: request.number,
          sector: request.sector?.name ?? "—",
          warehouse: request.originWarehouse?.name ?? "—",
          status: REQUEST_STATUS_LABELS[request.status] ?? request.status,
          items: request._count.items,
          createdAt: dt(request.createdAt),
          requester: request.requester.name ?? request.requester.email,
        })),
      },
    ],
  };
}

const TRANSFER_LIMIT = 300;

async function buildTransfersReport(
  filters: ReportQueryFilters,
): Promise<ReportPayload> {
  const where = {
    createdAt: { gte: filters.from, lte: filters.to },
    OR: [
      { fromWarehouseId: { in: filters.warehouseIds } },
      { toWarehouseId: { in: filters.warehouseIds } },
    ],
  };

  const [transfers, byStatus] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: TRANSFER_LIMIT,
    }),
    prisma.transfer.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const statusCount = new Map(
    byStatus.map((row) => [row.status, row._count._all]),
  );
  const countOf = (statuses: TransferStatus[]) =>
    statuses.reduce((sum, status) => sum + (statusCount.get(status) ?? 0), 0);

  return {
    type: "transferencias",
    title: "Transferências entre almoxarifados",
    subtitle: periodLabel(filters),
    summary: [
      {
        label: "Total",
        value: nf.format(countOf(Object.values(TransferStatus))),
      },
      { label: "Pendentes", value: nf.format(countOf([TransferStatus.PENDENTE])) },
      {
        label: "Em trânsito",
        value: nf.format(countOf([TransferStatus.SAIDA_CONFIRMADA])),
      },
      {
        label: "Recebidas",
        value: nf.format(countOf([TransferStatus.RECEBIDA])),
      },
      {
        label: "Canceladas",
        value: nf.format(countOf([TransferStatus.CANCELADA])),
      },
    ],
    blocks: [
      {
        title: `Transferências do período (${transfers.length}${transfers.length >= TRANSFER_LIMIT ? "+" : ""})`,
        columns: [
          { key: "number", label: "Nº" },
          { key: "origin", label: "Origem" },
          { key: "destination", label: "Destino" },
          { key: "items", label: "Itens", align: "right" },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Criada em" },
          { key: "exitAt", label: "Saída" },
          { key: "receivedAt", label: "Recebimento" },
        ],
        rows: transfers.map((transfer) => ({
          number: transfer.number,
          origin: transfer.fromWarehouse.name,
          destination: transfer.toWarehouse.name,
          items: transfer._count.items,
          status: TRANSFER_STATUS_LABELS[transfer.status] ?? transfer.status,
          createdAt: dt(transfer.createdAt),
          exitAt: transfer.exitConfirmedAt
            ? dt(transfer.exitConfirmedAt)
            : "—",
          receivedAt: transfer.receivedAt ? dt(transfer.receivedAt) : "—",
        })),
      },
    ],
  };
}
