interface LineInput {
  quantity:  number;
  unitPrice: number;
  taxRate:   number;
}

interface LineTotals {
  subtotal:  number;
  taxAmount: number;
  total:     number;
}

export function calcLine(line: LineInput): LineTotals {
  const subtotal  = Math.round(line.quantity * line.unitPrice * 100) / 100;
  const taxAmount = Math.round(subtotal * (line.taxRate / 100) * 100) / 100;
  return { subtotal, taxAmount, total: Math.round((subtotal + taxAmount) * 100) / 100 };
}

export function calcDocument(lines: LineTotals[]) {
  const subtotal  = lines.reduce((s, l) => s + l.subtotal, 0);
  const taxAmount = lines.reduce((s, l) => s + l.taxAmount, 0);
  return {
    subtotal:  Math.round(subtotal  * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total:     Math.round((subtotal + taxAmount) * 100) / 100,
  };
}
