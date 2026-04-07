import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../../db/prisma';
import { authMiddleware } from '../auth/authMiddleware';
import { requirePermission } from '../permissions/rbac';
import { auditLog } from '../audit/auditService';

const router = Router();

router.use(authMiddleware);

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', requirePermission('kernel', 'MANAGE_USERS'), async (req, res) => {
  const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const searchStr = Array.isArray(search) ? search[0] : search;
  const where: any = { tenantId: req.user!.tenantId };
  if (searchStr) {
    where.OR = [
      { firstName: { contains: searchStr, mode: 'insensitive' } },
      { lastName:  { contains: searchStr, mode: 'insensitive' } },
      { email:     { contains: searchStr, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take: parseInt(limit),
      select: { id: true, email: true, firstName: true, lastName: true,
        isActive: true, isOwner: true, lastLoginAt: true, createdAt: true,
        userRoles: { include: { role: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({ data: users, total, page: parseInt(page), limit: parseInt(limit) });
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', requirePermission('kernel', 'MANAGE_USERS'), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await prisma.user.findFirst({
    where: { id, tenantId: req.user!.tenantId },
    include: {
      userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.json(user);
});

// ── POST /api/users ───────────────────────────────────────────────────────────
const createSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  roleIds:   z.array(z.string()).optional(),
});

router.post('/', requirePermission('kernel', 'MANAGE_USERS'), async (req, res) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  const { email, password, firstName, lastName, roleIds = [] } = body.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        tenantId: req.user!.tenantId,
        email:    email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        userRoles: roleIds.length
          ? { create: roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
    });

    await auditLog({ tenantId: req.user!.tenantId, userId: req.user!.userId,
      module: 'kernel', action: 'CREATE_USER', entityType: 'User', entityId: user.id,
      newValues: { email, firstName, lastName } });

    return res.status(201).json(user);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email déjà utilisé' });
    throw err;
  }
});

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
router.patch('/:id', requirePermission('kernel', 'MANAGE_USERS'), async (req, res) => {
  const patchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await prisma.user.findFirst({
    where: { id: patchId, tenantId: req.user!.tenantId },
  });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const { firstName, lastName, isActive, roleIds } = req.body;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName  !== undefined && { lastName }),
      ...(isActive  !== undefined && { isActive }),
    },
  });

  // Mise à jour des rôles si fournis
  if (Array.isArray(roleIds)) {
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    if (roleIds.length) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId: string) => ({ userId: user.id, roleId })),
      });
    }
  }

  await auditLog({ tenantId: req.user!.tenantId, userId: req.user!.userId,
    module: 'kernel', action: 'UPDATE_USER', entityType: 'User', entityId: user.id });

  return res.json(updated);
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', requirePermission('kernel', 'MANAGE_USERS'), async (req, res) => {
  const delId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await prisma.user.findFirst({
    where: { id: delId, tenantId: req.user!.tenantId },
  });
  if (!user)         return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.isOwner)  return res.status(403).json({ error: "Impossible de supprimer l'owner" });

  await prisma.user.delete({ where: { id: user.id } });

  await auditLog({ tenantId: req.user!.tenantId, userId: req.user!.userId,
    module: 'kernel', action: 'DELETE_USER', entityType: 'User', entityId: user.id });

  return res.json({ ok: true });
});

export default router;
