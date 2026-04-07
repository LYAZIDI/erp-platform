import { Router } from 'express';
import prisma from '../../db/prisma';
import { authMiddleware } from '../auth/authMiddleware';
import { requirePermission } from '../permissions/rbac';
import { registry } from './moduleRegistry';

const router = Router();

router.use(authMiddleware);

// ── GET /api/modules ──────────────────────────────────────────────────────────
// Retourne tous les modules avec leur statut d'activation pour le tenant
router.get('/', async (req, res) => {
  const tenantModules = await prisma.tenantModule.findMany({
    where: { tenantId: req.user!.tenantId },
    include: { module: true },
  });

  const enabledIds = new Set(
    tenantModules.filter((tm) => tm.isEnabled).map((tm) => tm.moduleId)
  );

  const allModules = await prisma.module.findMany({ orderBy: { category: 'asc' } });

  const result = allModules.map((mod) => ({
    ...mod,
    isEnabled:  enabledIds.has(mod.id),
    manifest:   registry.get(mod.id),
  }));

  return res.json(result);
});

// ── GET /api/modules/menu ─────────────────────────────────────────────────────
// Retourne le menu dynamique selon les modules activés du tenant
router.get('/menu', async (req, res) => {
  const tenantModules = await prisma.tenantModule.findMany({
    where: { tenantId: req.user!.tenantId, isEnabled: true },
    select: { moduleId: true },
  });

  const enabledIds = new Set(tenantModules.map((tm) => tm.moduleId));

  const menuItems = registry.getAll()
    .filter((m) => enabledIds.has(m.id))
    .flatMap((m) => m.menuItems)
    .sort((a, b) => a.order - b.order);

  return res.json(menuItems);
});

// ── POST /api/modules/:id/toggle ──────────────────────────────────────────────
router.post('/:id/toggle', requirePermission('kernel', 'MANAGE_MODULES'), async (req, res) => {
  const modId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const module = await prisma.module.findUnique({ where: { id: modId } });
  if (!module) return res.status(404).json({ error: 'Module introuvable' });
  if (module.isCore) return res.status(403).json({ error: 'Ce module est obligatoire' });

  const tm = await prisma.tenantModule.upsert({
    where: { tenantId_moduleId: { tenantId: req.user!.tenantId, moduleId: modId } },
    update: { isEnabled: req.body.enabled ?? true },
    create: { tenantId: req.user!.tenantId, moduleId: module.id, isEnabled: req.body.enabled ?? true },
  });

  return res.json({ moduleId: module.id, isEnabled: tm.isEnabled });
});

export default router;
