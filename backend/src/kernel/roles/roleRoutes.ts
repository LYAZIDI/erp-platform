import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../db/prisma';
import { authMiddleware } from '../auth/authMiddleware';
import { requirePermission, invalidatePermCache } from '../permissions/rbac';

const router = Router();

router.use(authMiddleware);

// ── GET /api/roles ────────────────────────────────────────────────────────────
router.get('/', requirePermission('kernel', 'MANAGE_ROLES'), async (req, res) => {
  const roles = await prisma.role.findMany({
    where: { tenantId: req.user!.tenantId },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
    orderBy: { name: 'asc' },
  });
  return res.json(roles);
});

// ── GET /api/roles/permissions ────────────────────────────────────────────────
router.get('/permissions', requirePermission('kernel', 'MANAGE_ROLES'), async (req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });

  // Grouper par module
  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {} as Record<string, typeof permissions>);

  return res.json(grouped);
});

// ── POST /api/roles ───────────────────────────────────────────────────────────
const createSchema = z.object({
  name:          z.string().min(1),
  description:   z.string().optional(),
  permissionIds: z.array(z.string()).default([]),
});

router.post('/', requirePermission('kernel', 'MANAGE_ROLES'), async (req, res) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  try {
    const role = await prisma.role.create({
      data: {
        tenantId:    req.user!.tenantId,
        name:        body.data.name,
        description: body.data.description,
        permissions: body.data.permissionIds.length
          ? { create: body.data.permissionIds.map((pid) => ({ permissionId: pid })) }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });
    return res.status(201).json(role);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ce rôle existe déjà' });
    throw err;
  }
});

// ── PATCH /api/roles/:id ──────────────────────────────────────────────────────
router.patch('/:id', requirePermission('kernel', 'MANAGE_ROLES'), async (req, res) => {
  const patchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const role = await prisma.role.findFirst({
    where: { id: patchId, tenantId: req.user!.tenantId },
  });
  if (!role) return res.status(404).json({ error: 'Rôle introuvable' });

  const { name, description, permissionIds } = req.body;

  const updated = await prisma.role.update({
    where: { id: role.id },
    data: {
      ...(name        !== undefined && { name }),
      ...(description !== undefined && { description }),
    },
  });

  if (Array.isArray(permissionIds)) {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((pid: string) => ({ roleId: role.id, permissionId: pid })),
        skipDuplicates: true,
      });
    }
    // Invalider le cache de permissions de tous les utilisateurs ayant ce rôle
    const userRoles = await prisma.userRole.findMany({ where: { roleId: role.id } });
    userRoles.forEach((ur) => invalidatePermCache(ur.userId, req.user!.tenantId));
  }

  return res.json(updated);
});

// ── DELETE /api/roles/:id ─────────────────────────────────────────────────────
router.delete('/:id', requirePermission('kernel', 'MANAGE_ROLES'), async (req, res) => {
  const delId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const role = await prisma.role.findFirst({
    where: { id: delId, tenantId: req.user!.tenantId },
  });
  if (!role)          return res.status(404).json({ error: 'Rôle introuvable' });
  if (role.isSystem)  return res.status(403).json({ error: 'Impossible de supprimer un rôle système' });

  await prisma.role.delete({ where: { id: role.id } });
  return res.json({ ok: true });
});

export default router;
