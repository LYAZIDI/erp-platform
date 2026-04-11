/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Ventes — Quote Entity Adapter
 *
 * Bridges the generic WorkflowEngine to the `ventes_quotes` table.
 * The engine knows nothing about Quotes — this adapter is the seam.
 *
 * Workflow state keys → QuoteStatus enum mapping:
 *   "draft"    → DRAFT
 *   "sent"     → SENT
 *   "accepted" → ACCEPTED
 *   "refused"  → REFUSED
 *   "expired"  → EXPIRED
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { EntityAdapter, WorkflowContext, EntityData } from '../../../../kernel/workflow/types';
import type { PrismaClient }                               from '@prisma/client';
import prisma                                              from '../../../../db/prisma';

/** Map workflow state keys to the Prisma QuoteStatus enum values. */
const STATE_TO_ENUM: Record<string, string> = {
  draft:    'DRAFT',
  sent:     'SENT',
  accepted: 'ACCEPTED',
  refused:  'REFUSED',
  expired:  'EXPIRED',
};

export const quoteAdapter: EntityAdapter = {
  entityType: 'quote',

  // ── Read ───────────────────────────────────────────────────────────────────

  async getEntity(tenantId: string, entityId: string): Promise<EntityData | null> {
    const quote = await prisma.quote.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id:          true,
        status:      true,
        total:       true,
        subtotal:    true,
        contactId:   true,
        expiryDate:  true,
        confirmedAt: true,
        createdById: true,
      },
    });
    if (!quote) return null;

    // Normalize Decimal to number for condition evaluators
    return {
      ...quote,
      total:    Number(quote.total),
      subtotal: Number(quote.subtotal),
    };
  },

  // ── Write (inside Prisma transaction) ─────────────────────────────────────

  async updateState(
    tenantId:  string,
    entityId:  string,
    newState:  string,
    context:   WorkflowContext,
    tx:        unknown,
  ): Promise<void> {
    const client   = tx as PrismaClient;
    const enumVal  = STATE_TO_ENUM[newState];
    const payload  = context.payload;

    const data: Record<string, unknown> = { status: enumVal };

    // Merge field overrides set by set_field actions
    // Note: Quote schema has confirmedAt and expiryDate but NOT sentAt
    if (payload.confirmedAt) data.confirmedAt = new Date(String(payload.confirmedAt));
    if (payload.expiryDate)  data.expiryDate  = new Date(String(payload.expiryDate));

    await client.quote.updateMany({ where: { id: entityId, tenantId }, data });
  },
};
