/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — Built-in Action Executors
 *
 * Actions run after all conditions pass, before the DB transaction.
 * They typically populate `context.payload` so the EntityAdapter can read
 * the intended field changes and persist them atomically.
 *
 * Add new action types here without touching the engine core.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ActionExecutor } from '../types';
import { workflowEventBus }    from '../WorkflowEventBus';

// ── set_field ─────────────────────────────────────────────────────────────────
// Writes a value into context.payload[field] so the EntityAdapter can persist it.
//
// Config shape: { field: string, value: '__NOW__' | '__userId__' | any }
// Special values:
//   '__NOW__'    → current ISO timestamp (for confirmedAt, sentAt, paidAt …)
//   '__userId__' → the ID of the user who triggered the transition
//
// Example: { field: "confirmedAt", value: "__NOW__" }
export const setFieldAction: ActionExecutor = {
  type: 'set_field',

  async execute(config, ctx) {
    const { field, value } = config as { field: string; value: unknown };

    const resolved =
      value === '__NOW__'    ? new Date().toISOString() :
      value === '__userId__' ? ctx.userId                :
      value;

    ctx.payload[field] = resolved;
  },
};

// ── emit_event ────────────────────────────────────────────────────────────────
// Publishes a named workflow event on the event bus.
// Listeners registered with workflowEventBus.on() will receive it.
//
// Config shape: { eventType: string }
// Example:      { eventType: "quote.confirmed" }
//
// Note: this re-uses the 'workflow.transition.completed' infrastructure.
// For custom events, extend WorkflowEventType in types.ts or use a separate bus.
export const emitEventAction: ActionExecutor = {
  type: 'emit_event',

  async execute(config, ctx) {
    const { eventType } = config as { eventType: string };
    // Log to console for now — replace with a real message broker in production
    console.log(`[WorkflowEvent] ${eventType} — ${ctx.entityType}:${ctx.entityId} (tenant: ${ctx.tenantId})`);
    // Re-emit on the bus so application listeners can react
    workflowEventBus.emit({
      type:          'workflow.transition.completed',
      tenantId:      ctx.tenantId,
      entityType:    ctx.entityType,
      entityId:      ctx.entityId,
      transitionKey: ctx.transitionKey,
      fromState:     '',     // not available here — emitted again after tx in engine
      toState:       '',
      userId:        ctx.userId,
      payload:       { ...ctx.payload, customEventType: eventType },
      timestamp:     new Date(),
    });
  },
};

// ── copy_payload_field ────────────────────────────────────────────────────────
// Copies a value from ctx.payload to another key in ctx.payload.
// Useful for aliasing caller-provided data before the adapter reads it.
//
// Config shape: { from: string, to: string }
// Example:      { from: "reason", to: "lostReason" }
export const copyPayloadFieldAction: ActionExecutor = {
  type: 'copy_payload_field',

  async execute(config, ctx) {
    const { from, to } = config as { from: string; to: string };
    ctx.payload[to] = ctx.payload[from];
  },
};

/** All built-in actions — register all of them at startup. */
export const builtInActions: ActionExecutor[] = [
  setFieldAction,
  emitEventAction,
  copyPayloadFieldAction,
];
