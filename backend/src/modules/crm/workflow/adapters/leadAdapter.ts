/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CRM — Lead Entity Adapter
 *
 * Bridges the generic WorkflowEngine to the `crm_leads` table.
 *
 * Workflow state keys → LeadStatus enum mapping:
 *   "open"      → OPEN
 *   "won"       → WON
 *   "lost"      → LOST
 *   "cancelled" → CANCELLED
 *
 * Special payload fields (populated by set_field actions):
 *   wonAt      — datetime: when the lead was won
 *   lostAt     — datetime: when the lead was lost
 *   lostReason — string: reason for losing (required for 'lose' transition)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { EntityAdapter, WorkflowContext, EntityData } from '../../../../kernel/workflow/types';
import type { PrismaClient }                               from '@prisma/client';
import prisma                                              from '../../../../db/prisma';

const STATE_TO_ENUM: Record<string, string> = {
  open:      'OPEN',
  won:       'WON',
  lost:      'LOST',
  cancelled: 'CANCELLED',
};

export const leadAdapter: EntityAdapter = {
  entityType: 'lead',

  async getEntity(tenantId: string, entityId: string): Promise<EntityData | null> {
    const lead = await prisma.lead.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id:          true,
        status:      true,
        value:       true,
        contactId:   true,
        stageId:     true,
        lostReason:  true,
        wonAt:       true,
        lostAt:      true,
        assignedToId:true,
      },
    });
    if (!lead) return null;
    return {
      ...lead,
      value: lead.value ? Number(lead.value) : null,
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

    if (payload.wonAt)     data.wonAt     = new Date(String(payload.wonAt));
    if (payload.lostAt)    data.lostAt    = new Date(String(payload.lostAt));
    if (payload.lostReason !== undefined) data.lostReason = String(payload.lostReason);

    await client.lead.updateMany({ where: { id: entityId, tenantId }, data });
  },
};
