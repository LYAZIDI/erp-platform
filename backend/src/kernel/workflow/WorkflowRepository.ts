/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — Data Access Layer
 *
 * All Prisma calls for the wf_* tables live here.
 * The engine imports this module, not Prisma directly — one seam to swap the DB.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../../db/prisma';

// ── Return types (typed subsets of Prisma models) ────────────────────────────

export interface WFDefinition {
  id:           string;
  entityType:   string;
  initialState: string;
  states:       { key: string; label: string; color: string | null; isFinal: boolean; isInitial: boolean }[];
  transitions:  WFTransition[];
}

export interface WFTransition {
  id:                 string;
  key:                string;
  label:              string;
  fromStateKey:       string;
  toStateKey:         string;
  requiredPermission: string | null;
  sortOrder:          number;
  conditions:         { type: string; config: unknown; sortOrder: number }[];
  actions:            { type: string; config: unknown; sortOrder: number }[];
}

// ── Repository ────────────────────────────────────────────────────────────────

export const workflowRepository = {

  // ── Definitions ─────────────────────────────────────────────────────────────

  /** Load the active workflow definition for an entity type in a tenant. */
  async findDefinition(tenantId: string, entityType: string): Promise<WFDefinition | null> {
    return prisma.workflowDefinition.findFirst({
      where:   { tenantId, entityType, isActive: true },
      orderBy: { version: 'desc' },
      select: {
        id: true, entityType: true, initialState: true,
        states: {
          select: { key: true, label: true, color: true, isFinal: true, isInitial: true },
        },
        transitions: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, key: true, label: true,
            fromStateKey: true, toStateKey: true,
            requiredPermission: true, sortOrder: true,
            conditions: {
              orderBy: { sortOrder: 'asc' },
              select:  { type: true, config: true, sortOrder: true },
            },
            actions: {
              orderBy: { sortOrder: 'asc' },
              select:  { type: true, config: true, sortOrder: true },
            },
          },
        },
      },
    }) as WFDefinition | null;
  },

  /** List all definitions for a tenant (for the management API). */
  async listDefinitions(tenantId: string) {
    return prisma.workflowDefinition.findMany({
      where:   { tenantId },
      orderBy: { entityType: 'asc' },
      select: {
        id: true, name: true, entityType: true,
        version: true, isActive: true, description: true, initialState: true,
        _count: { select: { states: true, transitions: true, instances: true } },
      },
    });
  },

  // ── Instances ────────────────────────────────────────────────────────────────

  /** Get or create the workflow tracking record for an entity. */
  async findOrCreateInstance(
    tenantId:     string,
    definitionId: string,
    entityType:   string,
    entityId:     string,
    initialState: string,
    tx:           typeof prisma | any = prisma,
  ) {
    const existing = await tx.workflowInstance.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    });
    if (existing) return existing;

    return tx.workflowInstance.create({
      data: { tenantId, definitionId, entityType, entityId, currentStateKey: initialState },
    });
  },

  /** Move an instance to a new state (must run inside a transaction). */
  async updateInstanceState(instanceId: string, newState: string, tx: typeof prisma | any = prisma) {
    return tx.workflowInstance.update({
      where: { id: instanceId },
      data:  { currentStateKey: newState, updatedAt: new Date() },
    });
  },

  // ── Execution Logs ───────────────────────────────────────────────────────────

  /** Persist an immutable audit record for a transition attempt. */
  async createLog(
    data: {
      instanceId:    string;
      tenantId:      string;
      transitionKey: string;
      fromState:     string;
      toState:       string;
      userId?:       string;
      payload?:      Record<string, unknown>;
      actionsRun:    string[];
      durationMs?:   number;
      success:       boolean;
      errorMessage?: string;
    },
    tx: typeof prisma | any = prisma,
  ) {
    return tx.workflowExecutionLog.create({
      data: {
        instanceId:   data.instanceId,
        tenantId:     data.tenantId,
        transitionKey: data.transitionKey,
        fromState:    data.fromState,
        toState:      data.toState,
        userId:       data.userId,
        payload:      data.payload ?? {},
        actionsRun:   data.actionsRun,
        durationMs:   data.durationMs,
        success:      data.success,
        errorMessage: data.errorMessage,
      },
    });
  },

  /** Get the transition history for an entity (most recent first). */
  async getHistory(tenantId: string, entityType: string, entityId: string, limit = 50) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
      select: {
        id: true, currentStateKey: true, createdAt: true, updatedAt: true,
        logs: {
          orderBy: { createdAt: 'desc' },
          take:    limit,
          select: {
            id: true, transitionKey: true, fromState: true, toState: true,
            userId: true, actionsRun: true, durationMs: true,
            success: true, errorMessage: true, createdAt: true,
          },
        },
      },
    });
    return instance;
  },

  // ── RBAC ─────────────────────────────────────────────────────────────────────

  /** Load the permission set for a user (used to gate transitions). */
  async getUserPermissions(userId: string, tenantId: string): Promise<Set<string>> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            permissions: {
              select: { permission: { select: { module: true, action: true } } },
            },
          },
        },
      },
    });
    const perms = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        perms.add(`${rp.permission.module}:${rp.permission.action}`);
      }
    }
    return perms;
  },
};
