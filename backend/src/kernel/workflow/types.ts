/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — Core Interfaces
 *
 * Everything here is domain-agnostic.
 * No reference to CRM, Ventes, RH or any other business module.
 * These contracts are the stable API surface that will last 10+ years.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Runtime context ───────────────────────────────────────────────────────────

/**
 * Immutable context injected into every condition evaluator and action executor.
 * Created once per applyTransition() call.
 */
export interface WorkflowContext {
  tenantId:      string;
  userId:        string;
  entityType:    string;            // ex: "quote" | "order" | "leave_request"
  entityId:      string;
  transitionKey: string;            // ex: "send" | "confirm" | "pay"
  /** Mutable bag — actions may populate it; the EntityAdapter reads it to build its update. */
  payload:       Record<string, unknown>;
}

/**
 * Raw entity snapshot fetched by the EntityAdapter for condition evaluation.
 * The engine treats it as an opaque key-value map.
 */
export type EntityData = Record<string, unknown>;

/** Result returned to the caller after a successful transition. */
export interface TransitionResult {
  success:    boolean;
  fromState:  string;
  toState:    string;
  actionsRun: string[];
  durationMs: number;
  logId:      string;
}

// ── Plugin contracts ──────────────────────────────────────────────────────────

/**
 * Guard condition — determines whether a transition may fire.
 *
 * Implement this interface and register it with `workflowRegistry.registerCondition()`
 * to add a new condition type without touching the engine core.
 *
 * @example  Built-in types: "field_not_empty" | "field_comparison" | "state_match"
 */
export interface ConditionEvaluator {
  readonly type: string;
  /**
   * @param config  — The JSON config stored in `wf_condition_configs.config`
   * @param context — The current transition context
   * @param entity  — The entity snapshot (from EntityAdapter.getEntity)
   * @returns true if the condition passes, false if the transition should be blocked
   */
  evaluate(
    config:  Record<string, unknown>,
    context: WorkflowContext,
    entity:  EntityData,
  ): Promise<boolean>;
}

/**
 * Side-effect action — executed after all conditions pass.
 *
 * Implement this interface and register it with `workflowRegistry.registerAction()`
 * to add a new action type without touching the engine core.
 *
 * Convention: actions that only need to set fields on the entity
 * should populate `context.payload` — the EntityAdapter will read it in updateState().
 *
 * @example  Built-in types: "set_field" | "emit_event" | "webhook"
 */
export interface ActionExecutor {
  readonly type: string;
  /**
   * @param config  — The JSON config stored in `wf_action_configs.config`
   * @param context — The current transition context (mutable payload)
   * @param entity  — The entity snapshot before the transition
   */
  execute(
    config:  Record<string, unknown>,
    context: WorkflowContext,
    entity:  EntityData,
  ): Promise<void>;
}

/**
 * Entity adapter — bridges the engine to a specific domain entity type.
 *
 * The engine never imports domain code directly.
 * Each domain module registers its own adapters at startup.
 *
 * Pattern: Open/Closed — add new entity types without modifying the engine.
 */
export interface EntityAdapter {
  readonly entityType: string;

  /**
   * Fetch the entity as a flat key-value map for condition evaluation.
   * Return null if the entity does not exist.
   */
  getEntity(tenantId: string, entityId: string): Promise<EntityData | null>;

  /**
   * Persist the new state after all conditions pass and actions run.
   * Called inside the Prisma transaction — use the `tx` client for atomicity.
   *
   * @param newState  — The target state key (ex: "sent", "paid")
   * @param context   — Contains `payload` populated by actions (ex: { confirmedAt: "..." })
   * @param tx        — Prisma transaction client — always use this for writes
   */
  updateState(
    tenantId:  string,
    entityId:  string,
    newState:  string,
    context:   WorkflowContext,
    tx:        unknown,           // Prisma transaction client — typed `unknown` to avoid cross-import
  ): Promise<void>;
}

// ── Events ────────────────────────────────────────────────────────────────────

export type WorkflowEventType =
  | 'workflow.transition.started'
  | 'workflow.transition.completed'
  | 'workflow.transition.failed'
  | 'workflow.instance.created';

export interface WorkflowEvent {
  type:          WorkflowEventType;
  tenantId:      string;
  entityType:    string;
  entityId:      string;
  transitionKey: string;
  fromState:     string;
  toState:       string;
  userId:        string;
  payload?:      Record<string, unknown>;
  timestamp:     Date;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export type WorkflowErrorCode =
  | 'DEFINITION_NOT_FOUND'
  | 'TRANSITION_NOT_FOUND'
  | 'CONDITION_FAILED'
  | 'PERMISSION_DENIED'
  | 'ENTITY_NOT_FOUND';

/** Typed error thrown by the engine — catch it in route handlers for clean HTTP responses. */
export class WorkflowError extends Error {
  public readonly statusCode: number;

  constructor(message: string, public readonly code: WorkflowErrorCode) {
    super(message);
    this.name = 'WorkflowError';
    this.statusCode =
      code === 'PERMISSION_DENIED'   ? 403 :
      code === 'CONDITION_FAILED'    ? 422 :
      code === 'DEFINITION_NOT_FOUND'|| code === 'TRANSITION_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 :
      400;
  }
}
