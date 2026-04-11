/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Ventes — Order Entity Adapter
 *
 * Bridges the generic WorkflowEngine to the `ventes_orders` table.
 *
 * Workflow state keys → OrderStatus enum mapping:
 *   "confirmed"    → CONFIRMED
 *   "in_progress"  → IN_PROGRESS
 *   "delivered"    → DELIVERED
 *   "cancelled"    → CANCELLED
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { EntityAdapter, WorkflowContext, EntityData } from '../../../../kernel/workflow/types';
import type { PrismaClient }                               from '@prisma/client';
import prisma                                              from '../../../../db/prisma';

const STATE_TO_ENUM: Record<string, string> = {
  confirmed:   'CONFIRMED',
  in_progress: 'IN_PROGRESS',
  delivered:   'DELIVERED',
  cancelled:   'CANCELLED',
};

export const orderAdapter: EntityAdapter = {
  entityType: 'order',

  async getEntity(tenantId: string, entityId: string): Promise<EntityData | null> {
    const order = await prisma.order.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id:          true,
        status:      true,
        total:       true,
        contactId:   true,
        orderDate:   true,
        deliveryDate:true,
        quoteId:     true,
      },
    });
    if (!order) return null;
    return { ...order, total: Number(order.total) };
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

    if (payload.deliveryDate) data.deliveryDate = new Date(String(payload.deliveryDate));

    await client.order.updateMany({ where: { id: entityId, tenantId }, data });
  },
};
