/**
 * Tipos do comprovante de saída em PDF (somente literais — seguro para
 * componentes "use client"; sem dependência do jsPDF).
 */
export type ExitReceiptMovement = {
  id: string;
  type: string;
  quantity: number;
  documentRef: string | null;
  notes: string | null;
  createdAt: string;
  product: { code: string; name: string };
  unit: string | null;
  warehouseFrom: string;
  warehouseTo: string | null;
  registeredBy: string;
};

export type ExitReceipt = {
  movementId: string;
  entreguePor: string;
  recebidoPor: string;
  emittedBy: string;
  emittedAt: string;
};

export type ExitReceiptPayload = {
  orgName: string;
  movement: ExitReceiptMovement;
  receipt: ExitReceipt;
};
