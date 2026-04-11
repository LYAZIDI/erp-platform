/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — Plugin Registry
 *
 * IoC container for the engine's extension points.
 * Domain modules register their adapters + custom conditions/actions here
 * at application startup — the engine never imports them directly.
 *
 * Pattern: Open/Closed Principle
 *   - Open for extension (register new types at will)
 *   - Closed for modification (never edit the engine to add CRM logic)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ConditionEvaluator, ActionExecutor, EntityAdapter } from './types';

class WorkflowRegistry {
  private readonly conditions = new Map<string, ConditionEvaluator>();
  private readonly actions    = new Map<string, ActionExecutor>();
  private readonly adapters   = new Map<string, EntityAdapter>();

  // ── Condition Evaluators ───────────────────────────────────────────────────

  /** Register a pluggable condition type. Throws if the type is already taken. */
  registerCondition(evaluator: ConditionEvaluator): this {
    if (this.conditions.has(evaluator.type)) {
      throw new Error(`[WorkflowRegistry] Condition type "${evaluator.type}" is already registered.`);
    }
    this.conditions.set(evaluator.type, evaluator);
    return this;
  }

  /** Retrieve a condition evaluator by type. Throws if not found. */
  getCondition(type: string): ConditionEvaluator {
    const evaluator = this.conditions.get(type);
    if (!evaluator) {
      throw new Error(`[WorkflowRegistry] Unknown condition type "${type}". Did you register it?`);
    }
    return evaluator;
  }

  // ── Action Executors ───────────────────────────────────────────────────────

  /** Register a pluggable action type. Throws if the type is already taken. */
  registerAction(executor: ActionExecutor): this {
    if (this.actions.has(executor.type)) {
      throw new Error(`[WorkflowRegistry] Action type "${executor.type}" is already registered.`);
    }
    this.actions.set(executor.type, executor);
    return this;
  }

  /** Retrieve an action executor by type. Throws if not found. */
  getAction(type: string): ActionExecutor {
    const executor = this.actions.get(type);
    if (!executor) {
      throw new Error(`[WorkflowRegistry] Unknown action type "${type}". Did you register it?`);
    }
    return executor;
  }

  // ── Entity Adapters ────────────────────────────────────────────────────────

  /**
   * Register a domain entity adapter.
   * Called once per entity type at application startup (server.ts).
   */
  registerAdapter(adapter: EntityAdapter): this {
    this.adapters.set(adapter.entityType, adapter);
    return this;
  }

  /** Retrieve an adapter by entity type. Returns undefined if no adapter is registered. */
  getAdapter(entityType: string): EntityAdapter | undefined {
    return this.adapters.get(entityType);
  }

  /** List all registered entity types (useful for API introspection). */
  listEntityTypes(): string[] {
    return [...this.adapters.keys()];
  }

  /** Diagnostics — returns the registered types for each extension point. */
  summary() {
    return {
      conditions: [...this.conditions.keys()],
      actions:    [...this.actions.keys()],
      adapters:   [...this.adapters.keys()],
    };
  }
}

/** Application-wide singleton registry. */
export const workflowRegistry = new WorkflowRegistry();
