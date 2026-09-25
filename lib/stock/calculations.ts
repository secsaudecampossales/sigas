export function availableQuantity(physicalQty: number, reservedQty: number): number {
  return Math.max(0, physicalQty - reservedQty);
}

export function isBelowMinimum(physicalQty: number, minStock: number): boolean {
  return physicalQty < minStock;
}
