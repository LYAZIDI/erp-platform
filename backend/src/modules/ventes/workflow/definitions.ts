/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Ventes — Workflow Definitions
 *
 * This file seeds the state machine blueprints for Quote, Order, and Invoice
 * into the `wf_definitions` table.
 *
 * ⚠️  This is CRM/Ventes business logic — NOT engine code.
 *      The engine is in kernel/workflow/ and knows nothing about this file.
 *
 * Each tenant gets its own copy of the definitions (multi-tenant isolation).
 * Tenants can later customize states, transitions, conditions, and actions
 * via the /api/workflow/definitions REST API — with no redeploy needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../../../db/prisma';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function upsertDefinition(tenantId: string, def: Parameters<typeof prisma.workflowDefinition.create>[0]['data']) {
  // Delete instances + definitions for this entity type + version (clean re-seed)
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

// ─── Quote Lifecycle ──────────────────────────────────────────────────────────
//
//  DRAFT ──send──► SENT ──confirm──► ACCEPTED (final)
//                    │
//                    ├──refuse──► REFUSED  (final)
//                    └──expire──► EXPIRED  (final)
//
async function seedQuoteWorkflow(tenantId: string) {
  return upsertDefinition(tenantId, {
    tenantId,
    name:         'Cycle de vie — Devis',
    entityType:   'quote',
    version:      1,
    isActive:     true,
    initialState: 'draft',
    description:  'Workflow standard devis : Brouillon → Envoyé → Accepté / Refusé / Expiré',

    states: {
      create: [
        { key: 'draft',    label: 'Brouillon', color: '#8c8c8c', isInitial: true  },
        { key: 'sent',     label: 'Envoyé',    color: '#1677ff'                   },
        { key: 'accepted', label: 'Accepté',   color: '#52c41a', isFinal: true   },
        { key: 'refused',  label: 'Refusé',    color: '#ff4d4f', isFinal: true   },
        { key: 'expired',  label: 'Expiré',    color: '#d9d9d9', isFinal: true   },
      ],
    },

    transitions: {
      create: [
        // ── DRAFT → SENT ─────────────────────────────────────────────────────
        {
          key:          'send',
          label:        'Envoyer au client',
          fromStateKey: 'draft',
          toStateKey:   'sent',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 1,
          conditions: {
            create: [
              // Must have a contact attached
              { type: 'field_not_empty',   config: { field: 'contactId' }, sortOrder: 0 },
              // Must have a non-zero total
              { type: 'field_comparison',  config: { field: 'total', operator: 'gt', value: 0 }, sortOrder: 1 },
            ],
          },
          actions: {
            create: [
              // Note: Quote model has no sentAt field — only emit event
              { type: 'emit_event', config: { eventType: 'quote.sent' }, sortOrder: 0 },
            ],
          },
        },

        // ── SENT → ACCEPTED ──────────────────────────────────────────────────
        {
          key:          'confirm',
          label:        'Confirmer (Bon de commande reçu)',
          fromStateKey: 'sent',
          toStateKey:   'accepted',
          requiredPermission: 'ventes:CONFIRM_ORDER',
          sortOrder: 2,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'set_field',  config: { field: 'confirmedAt', value: '__NOW__' }, sortOrder: 0 },
              { type: 'emit_event', config: { eventType: 'quote.confirmed' },           sortOrder: 1 },
            ],
          },
        },

        // ── SENT → REFUSED ───────────────────────────────────────────────────
        {
          key:          'refuse',
          label:        'Marquer comme refusé',
          fromStateKey: 'sent',
          toStateKey:   'refused',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 3,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'quote.refused' }, sortOrder: 0 },
            ],
          },
        },

        // ── SENT → EXPIRED ───────────────────────────────────────────────────
        {
          key:          'expire',
          label:        'Marquer comme expiré',
          fromStateKey: 'sent',
          toStateKey:   'expired',
          sortOrder: 4,           // no requiredPermission — background job can trigger this
          conditions: { create: [] },
          actions:    { create: [] },
        },

        // ── DRAFT → REFUSED (retrait avant envoi) ────────────────────────────
        {
          key:          'withdraw',
          label:        'Retirer (avant envoi)',
          fromStateKey: 'draft',
          toStateKey:   'refused',
          requiredPermission: 'ventes:DELETE',
          sortOrder: 5,
          conditions: { create: [] },
          actions:    { create: [] },
        },
      ],
    },
  });
}

// ─── Order Lifecycle ──────────────────────────────────────────────────────────
//
//  CONFIRMED ──start──► IN_PROGRESS ──deliver──► DELIVERED (final)
//      │                     │
//      └──cancel─────────────┴──cancel──► CANCELLED (final)
//
async function seedOrderWorkflow(tenantId: string) {
  return upsertDefinition(tenantId, {
    tenantId,
    name:         'Cycle de vie — Commande',
    entityType:   'order',
    version:      1,
    isActive:     true,
    initialState: 'confirmed',
    description:  'Workflow commande : Confirmée → En cours → Livrée / Annulée',

    states: {
      create: [
        { key: 'confirmed',   label: 'Confirmée',   color: '#1677ff', isInitial: true },
        { key: 'in_progress', label: 'En cours',     color: '#fa8c16'                 },
        { key: 'delivered',   label: 'Livrée',       color: '#52c41a', isFinal: true  },
        { key: 'cancelled',   label: 'Annulée',      color: '#ff4d4f', isFinal: true  },
      ],
    },

    transitions: {
      create: [
        // ── CONFIRMED → IN_PROGRESS ───────────────────────────────────────────
        {
          key:          'start',
          label:        'Démarrer la préparation',
          fromStateKey: 'confirmed',
          toStateKey:   'in_progress',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 1,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'order.started' }, sortOrder: 0 },
            ],
          },
        },

        // ── IN_PROGRESS → DELIVERED ───────────────────────────────────────────
        {
          key:          'deliver',
          label:        'Marquer comme livré',
          fromStateKey: 'in_progress',
          toStateKey:   'delivered',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 2,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'set_field',  config: { field: 'deliveryDate', value: '__NOW__' }, sortOrder: 0 },
              { type: 'emit_event', config: { eventType: 'order.delivered' },            sortOrder: 1 },
            ],
          },
        },

        // ── CONFIRMED → CANCELLED ─────────────────────────────────────────────
        {
          key:          'cancel_confirmed',
          label:        'Annuler la commande',
          fromStateKey: 'confirmed',
          toStateKey:   'cancelled',
          requiredPermission: 'ventes:CANCEL_ORDER',
          sortOrder: 3,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'order.cancelled' }, sortOrder: 0 },
            ],
          },
        },

        // ── IN_PROGRESS → CANCELLED ───────────────────────────────────────────
        {
          key:          'cancel_in_progress',
          label:        'Annuler (en cours)',
          fromStateKey: 'in_progress',
          toStateKey:   'cancelled',
          requiredPermission: 'ventes:CANCEL_ORDER',
          sortOrder: 4,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'order.cancelled' }, sortOrder: 0 },
            ],
          },
        },
      ],
    },
  });
}

// ─── Invoice Lifecycle ────────────────────────────────────────────────────────
//
//  DRAFT ──send──► SENT ──pay──► PAID (final)
//    │               │
//    │               ├──pay_partial──► PARTIALLY_PAID ──pay──► PAID (final)
//    │               └──mark_overdue──► OVERDUE ──pay──► PAID (final)
//    └──cancel────────────────────────────────────────────► CANCELLED (final)
//
async function seedInvoiceWorkflow(tenantId: string) {
  return upsertDefinition(tenantId, {
    tenantId,
    name:         'Cycle de vie — Facture',
    entityType:   'invoice',
    version:      1,
    isActive:     true,
    initialState: 'draft',
    description:  'Workflow facture : Brouillon → Envoyée → Payée / Partiellement / Impayée / Annulée',

    states: {
      create: [
        { key: 'draft',          label: 'Brouillon',          color: '#8c8c8c', isInitial: true },
        { key: 'sent',           label: 'Envoyée',            color: '#1677ff'                  },
        { key: 'partially_paid', label: 'Partiellement payée',color: '#fa8c16'                  },
        { key: 'overdue',        label: 'Impayée (échue)',    color: '#ff4d4f'                  },
        { key: 'paid',           label: 'Payée',              color: '#52c41a', isFinal: true   },
        { key: 'cancelled',      label: 'Annulée',            color: '#d9d9d9', isFinal: true   },
      ],
    },

    transitions: {
      create: [
        // ── DRAFT → SENT ─────────────────────────────────────────────────────
        {
          key:          'send',
          label:        'Envoyer la facture',
          fromStateKey: 'draft',
          toStateKey:   'sent',
          requiredPermission: 'ventes:CREATE_INVOICE',
          sortOrder: 1,
          conditions: {
            create: [
              { type: 'field_not_empty',  config: { field: 'contactId' }, sortOrder: 0 },
              { type: 'field_comparison', config: { field: 'total', operator: 'gt', value: 0 }, sortOrder: 1 },
            ],
          },
          actions: {
            create: [
              { type: 'set_field',  config: { field: 'sentAt', value: '__NOW__' }, sortOrder: 0 },
              { type: 'emit_event', config: { eventType: 'invoice.sent' },         sortOrder: 1 },
            ],
          },
        },

        // ── SENT → PAID ───────────────────────────────────────────────────────
        {
          key:          'pay',
          label:        'Enregistrer le paiement total',
          fromStateKey: 'sent',
          toStateKey:   'paid',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 2,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'set_field',  config: { field: 'paidAt', value: '__NOW__' }, sortOrder: 0 },
              { type: 'emit_event', config: { eventType: 'invoice.paid' },         sortOrder: 1 },
            ],
          },
        },

        // ── SENT → PARTIALLY_PAID ─────────────────────────────────────────────
        {
          key:          'pay_partial',
          label:        'Enregistrer un paiement partiel',
          fromStateKey: 'sent',
          toStateKey:   'partially_paid',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 3,
          // Caller must provide paidAmount in payload
          conditions: {
            create: [
              { type: 'payload_field_not_empty', config: { field: 'paidAmount' }, sortOrder: 0 },
            ],
          },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'invoice.partially_paid' }, sortOrder: 0 },
            ],
          },
        },

        // ── PARTIALLY_PAID → PAID ─────────────────────────────────────────────
        {
          key:          'pay_remaining',
          label:        'Solder la facture',
          fromStateKey: 'partially_paid',
          toStateKey:   'paid',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 4,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'set_field',  config: { field: 'paidAt', value: '__NOW__' }, sortOrder: 0 },
              { type: 'emit_event', config: { eventType: 'invoice.paid' },         sortOrder: 1 },
            ],
          },
        },

        // ── SENT → OVERDUE ────────────────────────────────────────────────────
        {
          key:          'mark_overdue',
          label:        'Marquer comme impayée',
          fromStateKey: 'sent',
          toStateKey:   'overdue',
          sortOrder: 5,  // no permission — background job can call this
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'invoice.overdue' }, sortOrder: 0 },
            ],
          },
        },

        // ── OVERDUE → PAID ────────────────────────────────────────────────────
        {
          key:          'pay_overdue',
          label:        'Enregistrer le paiement (facture échue)',
          fromStateKey: 'overdue',
          toStateKey:   'paid',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 6,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'set_field',  config: { field: 'paidAt', value: '__NOW__' }, sortOrder: 0 },
              { type: 'emit_event', config: { eventType: 'invoice.paid' },         sortOrder: 1 },
            ],
          },
        },

        // ── DRAFT → CANCELLED ─────────────────────────────────────────────────
        {
          key:          'cancel',
          label:        'Annuler la facture',
          fromStateKey: 'draft',
          toStateKey:   'cancelled',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 7,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'invoice.cancelled' }, sortOrder: 0 },
            ],
          },
        },

        // ── SENT → CANCELLED ──────────────────────────────────────────────────
        {
          key:          'cancel_sent',
          label:        'Annuler la facture envoyée',
          fromStateKey: 'sent',
          toStateKey:   'cancelled',
          requiredPermission: 'ventes:UPDATE',
          sortOrder: 8,
          conditions: { create: [] },
          actions: {
            create: [
              { type: 'emit_event', config: { eventType: 'invoice.cancelled' }, sortOrder: 0 },
            ],
          },
        },
      ],
    },
  });
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Seed all Ventes workflow definitions for a tenant.
 * Called from the main seed.ts — idempotent (deletes + recreates on each run).
 */
export async function seedVentesWorkflows(tenantId: string): Promise<void> {
  await seedQuoteWorkflow(tenantId);
  await seedOrderWorkflow(tenantId);
  await seedInvoiceWorkflow(tenantId);
}
