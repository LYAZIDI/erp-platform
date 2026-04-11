/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Ventes — Invoice Entity Adapter
 *
 * Bridges the generic WorkflowEngine to the `ventes_invoices` table.
 *
 * Workflow state keys → InvoiceStatus enum mapping:
 *   "draft"          → DRAFT
 *   "sent"           → SENT
 *   "paid"           → PAID
 *   "partially_paid" → PARTIALLY_PAID
 *   "overdue"        → OVERDUE
 *   "cancelled"      → CANCELLED
 *
 * Special payload fields (populated by set_field actions):
 *   sentAt    — datetime: when the invoice was sent
 *   paidAt    — datetime: when payment was registered
 *   paidAmount — number: amount paid (for partial payments)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { EntityAdapter, WorkflowContext, EntityData } from '../../../../kernel/workflow/types';
import type { PrismaClient }                               from '@prisma/client';
import prisma                                              from '../../../../db/prisma';

const STATE_TO_ENUM: Record<string, string> = {
  draft:          'DRAFT',
  sent:           'SENT',
  paid:           'PAID',
  partially_paid: 'PARTIALLY_PAID',
  overdue:        'OVERDUE',
  cancelled:      'CANCELLED',
};

export const invoiceAdapter: EntityAdapter = {
  entityType: 'invoice',

  async getEntity(tenantId: string, entityId: string): Promise<EntityData | null> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id:         true,
        status:     true,
        total:      true,
        paidAmount: true,
        contactId:  true,
        orderId:    true,
        dueDate:    true,
        sentAt:     true,
        paidAt:     true,
      },
    });
    if (!invoice) return null;
    return {
      ...invoice,
      total:      Number(invoice.total),
      paidAmount: Number(invoice.paidAmount),
    };
  },

  async updateState(
    tenantId:  string,
    entityId:  string,
    newState:  string,
    context:   WorkflowContext,
    tx:        unknown,
  ): Promise<void> {
    const client  = tx as PrismaClient;
    const enumVal = STATE_TO_ENUM[newState];
    const payload = context.payload;

    const data: Record<string, unknown> = { status: enumVal };

    if (payload.sentAt)     data.sentAt     = new Date(String(payload.sentAt));
    if (payload.paidAt)     data.paidAt     = new Date(String(payload.paidAt));
    if (payload.paidAmount !== undefined) data.paidAmount = Number(payload.paidAmount);

    await client.invoice.updateMany({ where: { id: entityId, tenantId }, data });
  },
};
