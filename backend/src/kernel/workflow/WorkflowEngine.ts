/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — Core State Machine
 *
 * The ONLY file in the engine that orchestrates a transition.
 * It is intentionally domain-agnostic: no Quote, no Order, no HR entity here.
 *
 * Transition lifecycle (applyTransition):
 *   1. Load definition (from DB)
 *   2. Find or bootstrap entity instance
 *   3. Resolve the requested transition from current state
 *   4. RBAC gate
 *   5. Load entity via adapter (for condition evaluation)
 *   6. Evaluate conditions (pluggable)
 *   7. Execute actions (pluggable) — populate context.payload
 *   8. ── BEGIN TRANSACTION ──
 *        a. Update wf_instance state
 *        b. updateState() via EntityAdapter (domain write, uses tx)
 *        c. Persist execution log
 *     ── COMMIT ──
 *   9. Emit completion event (non-blocking, after tx)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../../db/prisma';
import type { WorkflowContext, TransitionResult } from './types';
import { WorkflowError } from './types';
import { workflowRegistry } from './WorkflowRegistry';
import { workflowRepository } from './WorkflowRepository';
import { workflowEventBus } from './WorkflowEventBus';

export class WorkflowEngine {

  /**
   * Apply a named transition to an entity.
   * This is the SINGLE entry point for all state machine operations.
   *
   * @throws WorkflowError with typed code and HTTP status for clean route handling
   */
  async applyTransition(ctx: WorkflowContext): Promise<TransitionResult> {
    const start = Date.now();
    const { tenantId, userId, entityType, entityId, transitionKey } = ctx;

    // ── 1. Load definition ───────────────────────────────────────────────────
    const definition = await workflowRepository.findDefinition(tenantId, entityType);
    if (!definition) {
      throw new WorkflowError(
        `No active workflow definition for entity type "${entityType}" in this tenant.`,
        'DEFINITION_NOT_FOUND',
      );
    }

    // ── 2. Find or bootstrap instance ────────────────────────────────────────
    const instance = await workflowRepository.findOrCreateInstance(
      tenantId, definition.id, entityType, entityId, definition.initialState,
    );
    const fromState = instance.currentStateKey;

    // ── 3. Resolve transition ─────────────────────────────────────────────────
    const transition = definition.transitions.find(
      (t) => t.key === transitionKey && t.fromStateKey === fromState,
    );
    if (!transition) {
      throw new WorkflowError(
        `Transition "${transitionKey}" is not allowed from state "${fromState}" for entity type "${entityType}".`,
        'TRANSITION_NOT_FOUND',
      );
    }
    const toState = transition.toStateKey;

    // ── 4. RBAC gate ─────────────────────────────────────────────────────────
    if (transition.requiredPermission) {
      const perms = await workflowRepository.getUserPermissions(userId, tenantId);
      if (!perms.has(transition.requiredPermission)) {
        throw new WorkflowError(
          `Missing permission "${transition.requiredPermission}" to apply transition "${transitionKey}".`,
          'PERMISSION_DENIED',
        );
      }
    }

    // ── 5. Load entity via adapter ───────────────────────────────────────────
    const adapter = workflowRegistry.getAdapter(entityType);
    const entity  = adapter ? await adapter.getEntity(tenantId, entityId) : {};

    if (adapter && !entity) {
      throw new WorkflowError(
        `Entity "${entityType}" with id "${entityId}" not found.`,
        'ENTITY_NOT_FOUND',
      );
    }

    const entityData = entity ?? {};

    // ── 6. Evaluate conditions ────────────────────────────────────────────────
    const failedConditions: string[] = [];
    for (const condCfg of transition.conditions) {
      const evaluator = workflowRegistry.getCondition(condCfg.type);
      const passed    = await evaluator.evaluate(
        condCfg.config as Record<string, unknown>,
        ctx,
        entityData,
      );
      if (!passed) failedConditions.push(condCfg.type);
    }

    if (failedConditions.length > 0) {
      // Log the failed attempt before throwing
      await workflowRepository.createLog({
        instanceId:    instance.id,
        tenantId, transitionKey, fromState, toState, userId,
        payload:       ctx.payload,
        actionsRun:    [],
        durationMs:    Date.now() - start,
        success:       false,
        errorMessage:  `Conditions not satisfied: [${failedConditions.join(', ')}]`,
      });
      throw new WorkflowError(
        `Transition "${transitionKey}" blocked — conditions not met: ${failedConditions.join(', ')}.`,
        'CONDITION_FAILED',
      );
    }

    // ── 7. Execute actions (pre-transaction: populate context.payload) ────────
    const actionsRun: string[] = [];
    for (const actionCfg of transition.actions) {
      const executor = workflowRegistry.getAction(actionCfg.type);
      await executor.execute(actionCfg.config as Record<string, unknown>, ctx, entityData);
      actionsRun.push(actionCfg.type);
    }

    // Signal the start (before transaction — for monitoring / tracing hooks)
    workflowEventBus.emit({
      type: 'workflow.transition.started',
      tenantId, entityType, entityId,
      transitionKey, fromState, toState,
      userId, payload: ctx.payload, timestamp: new Date(),
    });

    // ── 8. Atomic transaction: instance state + entity update + audit log ─────
    const log = await prisma.$transaction(async (tx) => {
      // a. Update workflow tracking table
      await workflowRepository.updateInstanceState(instance.id, toState, tx);

      // b. Domain entity update via adapter (uses tx for atomicity)
      if (adapter) {
        await adapter.updateState(tenantId, entityId, toState, ctx, tx);
      }

      // c. Immutable audit trail
      return workflowRepository.createLog({
        instanceId: instance.id,
        tenantId, transitionKey, fromState, toState, userId,
        payload:    ctx.payload,
        actionsRun, durationMs: Date.now() - start,
        success:    true,
      }, tx);
    });

    // ── 9. Post-transaction event (non-blocking) ──────────────────────────────
    workflowEventBus.emit({
      type: 'workflow.transition.completed',
      tenantId, entityType, entityId,
      transitionKey, fromState, toState,
      userId, payload: ctx.payload, timestamp: new Date(),
    });

    return { success: true, fromState, toState, actionsRun, durationMs: Date.now() - start, logId: log.id };
  }

  /**
   * Returns the list of transitions available to a user from the entity's current state.
   * Useful for rendering dynamic action buttons in the UI.
   */
  async getAvailableTransitions(
    tenantId:   string,
    userId:     string,
    entityType: string,
    entityId:   string,
  ): Promise<{ key: string; label: string; toState: string }[]> {
    const definition = await workflowRepository.findDefinition(tenantId, entityType);
    if (!definition) return [];

    const instance = await workflowRepository.findOrCreateInstance(
      tenantId, definition.id, entityType, entityId, definition.initialState,
    );

    const perms   = await workflowRepository.getUserPermissions(userId, tenantId);
    const current = instance.currentStateKey;

    return definition.transitions
      .filter((t) => t.fromStateKey === current)
      .filter((t) => !t.requiredPermission || perms.has(t.requiredPermission))
      .map((t)    => ({ key: t.key, label: t.label, toState: t.toStateKey }));
  }

  /**
   * Returns the full execution history for one entity.
   */
  async getHistory(tenantId: string, entityType: string, entityId: string) {
    return workflowRepository.getHistory(tenantId, entityType, entityId);
  }
}

/** Application-wide singleton engine. */
export const workflowEngine = new WorkflowEngine();
