/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow Engine — REST API
 *
 * Mounted at: /api/workflow
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Entity operations (runtime)                                            │
 * │  POST   /api/workflow/:type/:id/transition/:key  → apply transition     │
 * │  GET    /api/workflow/:type/:id/transitions      → available actions    │
 * │  GET    /api/workflow/:type/:id/history          → audit trail          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  Definition management (admin)                                          │
 * │  GET    /api/workflow/definitions                → list definitions     │
 * │  GET    /api/workflow/definitions/:id            → get one definition   │
 * │  POST   /api/workflow/definitions                → create definition    │
 * │  PATCH  /api/workflow/definitions/:id            → update metadata      │
 * │  POST   /api/workflow/definitions/:id/states     → add a state          │
 * │  POST   /api/workflow/definitions/:id/transitions→ add a transition     │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  Registry introspection                                                 │
 * │  GET    /api/workflow/registry                   → list registered types│
 * └─────────────────────────────────────────────────────────────────────────┘
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router }           from 'express';
import { z }                from 'zod';
import prisma               from '../../db/prisma';
import { authMiddleware }   from '../auth/authMiddleware';
import { requirePermission} from '../permissions/rbac';
import { workflowEngine }   from './WorkflowEngine';
import { workflowRegistry } from './WorkflowRegistry';
import { workflowRepository } from './WorkflowRepository';
import { WorkflowError }    from './types';
import { qs, qsReq }        from '../../utils/request';

const router = Router();
router.use(authMiddleware);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Uniform error response for WorkflowError. */
function handleWorkflowError(err: unknown, res: any) {
  if (err instanceof WorkflowError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  throw err; // re-throw for global handler
}

// ══════════════════════════════════════════════════════════════════════════════
// RUNTIME — Entity operations
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/workflow/:type/:id/transition/:key
 * Apply a transition to an entity.
 * Body (optional): { payload: Record<string, unknown> }
 */
router.post('/:type/:id/transition/:key', async (req, res) => {
  try {
    const result = await workflowEngine.applyTransition({
      tenantId:      req.user!.tenantId,
      userId:        req.user!.userId,
      entityType:    qsReq(req.params.type),
      entityId:      qsReq(req.params.id),
      transitionKey: qsReq(req.params.key),
      payload:       (req.body?.payload as Record<string, unknown>) ?? {},
    });
    return res.json(result);
  } catch (err) {
    return handleWorkflowError(err, res);
  }
});

/**
 * GET /api/workflow/:type/:id/transitions
 * List transitions available to the current user from the entity's current state.
 */
router.get('/:type/:id/transitions', async (req, res) => {
  const transitions = await workflowEngine.getAvailableTransitions(
    req.user!.tenantId,
    req.user!.userId,
    qsReq(req.params.type),
    qsReq(req.params.id),
  );
  return res.json(transitions);
});

/**
 * GET /api/workflow/:type/:id/history
 * Full audit trail for one entity.
 */
router.get('/:type/:id/history', async (req, res) => {
  const history = await workflowEngine.getHistory(
    req.user!.tenantId,
    qsReq(req.params.type),
    qsReq(req.params.id),
  );
  return res.json(history ?? { logs: [] });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — Definition management (kernel:MANAGE_MODULES required)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/workflow/definitions
 * List all workflow definitions for the tenant.
 */
router.get('/definitions', requirePermission('kernel', 'READ'), async (req, res) => {
  const defs = await workflowRepository.listDefinitions(req.user!.tenantId);
  return res.json(defs);
});

/**
 * GET /api/workflow/definitions/:id
 * Full definition with states, transitions, conditions, actions.
 */
router.get('/definitions/:id', requirePermission('kernel', 'READ'), async (req, res) => {
  const def = await prisma.workflowDefinition.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
    include: {
      states: { orderBy: { key: 'asc' } },
      transitions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          conditions: { orderBy: { sortOrder: 'asc' } },
          actions:    { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });
  if (!def) return res.status(404).json({ error: 'Définition introuvable' });
  return res.json(def);
});

// ── Create definition ─────────────────────────────────────────────────────────

const createDefSchema = z.object({
  name:         z.string().min(1),
  entityType:   z.string().min(1).regex(/^[a-z_]+$/, 'entityType must be lowercase snake_case'),
  version:      z.number().int().positive().default(1),
  description:  z.string().optional(),
  initialState: z.string().min(1),
});

/**
 * POST /api/workflow/definitions
 * Create a new workflow definition (with optional inline states + transitions).
 */
router.post('/definitions', requirePermission('kernel', 'MANAGE_MODULES'), async (req, res) => {
  const body = createDefSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  try {
    const def = await prisma.workflowDefinition.create({
      data: { ...body.data, tenantId: req.user!.tenantId },
    });
    return res.status(201).json(def);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Une définition existe déjà pour cet entityType / version' });
    throw err;
  }
});

/**
 * PATCH /api/workflow/definitions/:id
 * Toggle isActive, update name/description.
 */
router.patch('/definitions/:id', requirePermission('kernel', 'MANAGE_MODULES'), async (req, res) => {
  const def = await prisma.workflowDefinition.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!def) return res.status(404).json({ error: 'Définition introuvable' });

  const { name, description, isActive } = req.body as {
    name?: string; description?: string; isActive?: boolean;
  };
  const updated = await prisma.workflowDefinition.update({
    where: { id: def.id },
    data:  { name, description, isActive },
  });
  return res.json(updated);
});

// ── States ─────────────────────────────────────────────────────────────────────

const createStateSchema = z.object({
  key:       z.string().min(1),
  label:     z.string().min(1),
  isInitial: z.boolean().default(false),
  isFinal:   z.boolean().default(false),
  color:     z.string().optional(),
  metadata:  z.record(z.unknown()).default({}),
});

/** POST /api/workflow/definitions/:id/states — add a state to an existing definition. */
router.post('/definitions/:id/states', requirePermission('kernel', 'MANAGE_MODULES'), async (req, res) => {
  const def = await prisma.workflowDefinition.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!def) return res.status(404).json({ error: 'Définition introuvable' });

  const body = createStateSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  try {
    const state = await prisma.workflowState.create({
      data: { ...body.data, definitionId: def.id },
    });
    return res.status(201).json(state);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: `L'état "${body.data.key}" existe déjà` });
    throw err;
  }
});

// ── Transitions ───────────────────────────────────────────────────────────────

const createTransitionSchema = z.object({
  key:                z.string().min(1),
  label:              z.string().min(1),
  fromStateKey:       z.string().min(1),
  toStateKey:         z.string().min(1),
  requiredPermission: z.string().optional().nullable(),
  sortOrder:          z.number().int().default(0),
  conditions: z.array(z.object({
    type:      z.string(),
    config:    z.record(z.unknown()),
    sortOrder: z.number().int().default(0),
  })).default([]),
  actions: z.array(z.object({
    type:      z.string(),
    config:    z.record(z.unknown()),
    sortOrder: z.number().int().default(0),
  })).default([]),
});

/** POST /api/workflow/definitions/:id/transitions — add a transition with conditions + actions. */
router.post('/definitions/:id/transitions', requirePermission('kernel', 'MANAGE_MODULES'), async (req, res) => {
  const def = await prisma.workflowDefinition.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!def) return res.status(404).json({ error: 'Définition introuvable' });

  const body = createTransitionSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  const { conditions, actions, ...transitionData } = body.data;

  try {
    const transition = await prisma.workflowTransition.create({
      data: {
        ...transitionData,
        definitionId: def.id,
        conditions: { create: conditions },
        actions:    { create: actions },
      },
      include: { conditions: true, actions: true },
    });
    return res.status(201).json(transition);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: `La transition "${body.data.key}" existe déjà` });
    throw err;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// REGISTRY — Introspection (dev/admin utility)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/workflow/registry
 * Returns all registered condition types, action types, and entity adapters.
 * Useful for building the definition editor UI.
 */
router.get('/registry', requirePermission('kernel', 'READ'), (_req, res) => {
  return res.json(workflowRegistry.summary());
});

export default router;
