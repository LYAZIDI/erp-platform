/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — Event Bus
 *
 * Lightweight pub/sub for workflow lifecycle events.
 * Listeners are always called non-blocking (errors are swallowed to protect the engine).
 *
 * Scale path: replace emit() internals with Redis pub/sub or RabbitMQ
 * without touching the engine or any listener code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { WorkflowEvent, WorkflowEventType } from './types';

type Listener = (event: WorkflowEvent) => void | Promise<void>;

class WorkflowEventBus {
  private readonly listeners = new Map<WorkflowEventType | '*', Listener[]>();

  /** Subscribe to a specific event type. Use '*' to receive all events. */
  on(type: WorkflowEventType | '*', listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, listener]);
  }

  /** Unsubscribe a previously registered listener. */
  off(type: WorkflowEventType | '*', listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, existing.filter((l) => l !== listener));
  }

  /**
   * Emit an event to all matching listeners.
   * Never throws — listener errors are logged and discarded.
   * This ensures workflow failures in listeners never affect the engine transaction.
   */
  emit(event: WorkflowEvent): void {
    const specific  = this.listeners.get(event.type) ?? [];
    const wildcards = this.listeners.get('*') ?? [];

    for (const listener of [...specific, ...wildcards]) {
      Promise.resolve(listener(event)).catch((err) => {
        console.error(`[WorkflowEventBus] Listener error on "${event.type}":`, err);
      });
    }
  }
}

/** Application-wide singleton event bus. */
export const workflowEventBus = new WorkflowEventBus();
