import prisma from '../../db/prisma';

type SequenceType = 'QUO' | 'ORD' | 'INV';

const counters: Record<string, number> = {};

/**
 * Génère une référence unique par tenant : QUO-2026-00001
 */
export async function nextReference(tenantId: string, type: SequenceType): Promise<string> {
  const year = new Date().getFullYear();
  const key  = `${tenantId}:${type}:${year}`;

  if (!counters[key]) {
    // Compter les documents existants pour cette année
    const model  = type === 'QUO' ? prisma.quote : type === 'ORD' ? prisma.order : prisma.invoice;
    const prefix = `${type}-${year}-`;
    const count  = await (model as any).count({
      where: { tenantId, reference: { startsWith: prefix } },
    });
    counters[key] = count;
  }

  counters[key]++;
  return `${type}-${year}-${String(counters[key]).padStart(5, '0')}`;
}
