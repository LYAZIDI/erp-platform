/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CRM — Workflow Definitions
 *
 * Seeds the Lead lifecycle state machine into `wf_definitions`.
 *
 * Lead lifecycle:
 *
 *   OPEN ──qualify──► OPEN (same state, stage move)
 *        ──win────► WON       (final)
 *        ──lose───► LOST      (final, lostReason required)
 *        ──cancel─► CANCELLED (final)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../../../db/prisma';

async function upsertDefinition(
  tenantId: string,
  def: Parameters<typeof prisma.workflowDefinition.create>[0]['data'],
) {
  const existing = await prisma.workflowDefinition.findMany({
    where: { tenantId, entityType: def.entityType as string, version: (def.version as number) ?? 1 },
    select: { id: true },
  });
  const ids = existing.map((d) => d.id);
  if (ids.length > 0) {
    await prisma.workflowInstance.deleteMany({ where: { definitionId: { in: ids } } });
    await prisma.workflowDefinition.deleteMany({ where: { id: { in: ids } } });
  }
  return prisma.workflowDefinition.create({ data: def });
}

// ─── Lead Lifecycle ───────────────────────────────────────────────────────────
//
//  OPEN ──win────► WON       (final)
//       ──lose───► LOST      (final, lostReason required)
//       ──cancel─► CANCELLED (final)
//
async function seedLeadWorkflow(tenantId: string) {
  return upsertDefinition(tenantId, {
    tenantId,
    name:         'Cycle de vie — Lead',
    entityType:   'lead',
    version:      1,
    isActive:     true,
    initialState: 'open',
    description:  'Workflow lead : Ouvert → Gagné / Perdu / Annulé',

    states: {
      create: [
        { key: 'open',      label: 'Ouvert',    color: '#1677ff', isInitial: true },
        { key: 'won',       label: 'Gagné',     color: '#52c41a', isFinal: true   },
        { key: 'lost',      label: 'Perdu',     color: '#ff4d4f', isFinal: true   },
        { key: 'cancelled', label: 'Annulé',    color: '#d9d9d9', isFinal: true   },
      ],
    },

    transitions: {
      create: [
        // ── OPEN → WON ───────────────────────────────────────────────────────
        {
          key:          'win',
          label:        'Marquer comme gagné',
          fromStateKey: 'open',
          toStateKey:   'won',
          requiredPermission: 'crm:UPDATE',
          sortOrder: 1,
          conditions: {
            create: [
              // Must have a contact attached
              { type: 'field_not_empty', config: { field: 'contactId' }, sortOrder: 0 },
            ],
          },
          actions: {
            create: [
              { type: 'set_field',  config: { field: 'wonAt', value: '__NOW__' }, sortOrder: 0 },
              { type: 'emit_event', config: { eventType: 'lead.won' },            sortOrder: 1 },
            ],
          },
        },

        // ── OPEN → LOST ──────────────────────────────────────────────────────
        {
          key:          'lose',
          label:        'Marquer comme perdu',
          fromStateKey: 'open',
          toStateKey:   'lost',
          requiredPermission: 'crm:UPDATE',
          sortOrder: 2,
          conditions: {
            create: [
              // Caller must provide lostReason in payload
              { type: 'payload_field_not_empty', config: { field: 'lostReason' }, sortOrder: 0 },
            ],
          },
          actions: {
            create: [
              { type: 'set_field',        config: { field: 'lostAt', value: '__NOW__' }, sortOrder: 0 },
              { type: 'copy_payload_field', config: { from: 'lostReason', to: 'lostReason' }, sortOrder: 1 },
              { type: 'emit_event',       config: { eventType: 'lead.lost' },              sortOrder: 2 },
            ],
          },
        },

        // ── OPEN → CANCELLED ─────────────────────────────────────────────────
        {
          key:          'cancel',
          label:        'Annuler le lead',
          fromStateKey: 'open',
          toStateKey:   'cancelled',
          requiredPermission: 'crm:DELETE',
          sortOrder: 3,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'lead.cancelled' }, sortOrder: 0 },
            ],
          },
        },
      ],
    },
  });
}

/**
 * Seed all CRM workflow definitions for a tenant.
 * Called from the main seed.ts — idempotent (deletes + recreates on each run).
 */
export async function seedCrmWorkflows(tenantId: string): Promise<void> {
  await seedLeadWorkflow(tenantId);
}
