/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — Built-in Condition Evaluators
 *
 * Each evaluator is a stateless object implementing ConditionEvaluator.
 * Register them in server.ts via `workflowRegistry.registerCondition(...)`.
 *
 * Add new condition types here without touching the engine core.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ConditionEvaluator } from '../types';

// ── field_not_empty ───────────────────────────────────────────────────────────
// Passes if the specified entity field is non-null, non-undefined, non-empty-string.
//
// Config shape: { field: string }
// Example:      { field: "contactId" }
export const fieldNotEmptyCondition: ConditionEvaluator = {
  type: 'field_not_empty',

  async evaluate(config, _ctx, entity) {
    const { field } = config as { field: string };
    const value = entity[field];
    return value !== null && value !== undefined && value !== '';
  },
};

// ── field_comparison ──────────────────────────────────────────────────────────
// Passes if the entity field satisfies the comparison against a literal value.
//
// Config shape: { field: string, operator: 'eq'|'ne'|'gt'|'lt'|'gte'|'lte', value: number | string }
// Example:      { field: "total", operator: "gt", value: 0 }
export const fieldComparisonCondition: ConditionEvaluator = {
  type: 'field_comparison',

  async evaluate(config, _ctx, entity) {
    const { field, operator, value } = config as {
      field:    string;
      operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
      value:    number | string;
    };
    const actual = entity[field];

    switch (operator) {
      case 'eq':  return actual === value;
      case 'ne':  return actual !== value;
      case 'gt':  return (actual as number) >  (value as number);
      case 'lt':  return (actual as number) <  (value as number);
      case 'gte': return (actual as number) >= (value as number);
      case 'lte': return (actual as number) <= (value as number);
      default:    return false;
    }
  },
};

// ── state_match ───────────────────────────────────────────────────────────────
// Passes if an entity field equals (or is in) the expected value(s).
// Useful for cross-entity checks (ex: "invoice.orderId must not be null").
//
// Config shape: { field: string, expected: string | string[] }
// Example:      { field: "status", expected: ["confirmed", "delivered"] }
export const stateMatchCondition: ConditionEvaluator = {
  type: 'state_match',

  async evaluate(config, _ctx, entity) {
    const { field, expected } = config as { field: string; expected: string | string[] };
    const actual = entity[field] as string;
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  },
};

// ── payload_field_not_empty ───────────────────────────────────────────────────
// Same as field_not_empty but checks the caller's payload (not the entity).
// Useful to require extra data from the caller (ex: lostReason when refusing a lead).
//
// Config shape: { field: string }
// Example:      { field: "lostReason" }
export const payloadFieldNotEmptyCondition: ConditionEvaluator = {
  type: 'payload_field_not_empty',

  async evaluate(config, ctx, _entity) {
    const { field } = config as { field: string };
    const value = ctx.payload[field];
    return value !== null && value !== undefined && value !== '';
  },
};

/** All built-in conditions — register all of them at startup. */
export const builtInConditions: ConditionEvaluator[] = [
  fieldNotEmptyCondition,
  fieldComparisonCondition,
  stateMatchCondition,
  payloadFieldNotEmptyCondition,
];
