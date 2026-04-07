import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../../db/prisma';
import { signAccess, generateRefreshToken, hashToken } from './jwt';
import { authMiddleware } from './authMiddleware';
import { auditLog } from '../audit/auditService';

const router = Router();

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  tenant:   z.string().min(1),   // slug du tenant
});

const registerSchema = z.object({
  tenantName: z.string().min(2),
  firstName:  z.string().min(1),
  lastName:   z.string().min(1),
  email:      z.string().email(),
  password:   z.string().min(8),
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  const { email, password, tenant: tenantSlug } = body.data;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant || !tenant.isActive) return res.status(401).json({ error: 'Tenant introuvable ou inactif' });

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() } },
  });

  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { raw, hash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { tenantId: tenant.id, userId: user.id, tokenHash: hash, expiresAt },
  });

  const accessToken  = signAccess({ userId: user.id, tenantId: tenant.id, email: user.email });

  await auditLog({ tenantId: tenant.id, userId: user.id, module: 'kernel', action: 'LOGIN',
    ipAddress: req.ip, userAgent: req.headers['user-agent'] });

  return res.json({
    accessToken,
    refreshToken: raw,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isOwner: user.isOwner },
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, plan: tenant.plan },
  });
});

// ── POST /api/auth/register (crée un nouveau tenant + owner) ─────────────────
router.post('/register', async (req, res) => {
  const body = registerSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  const { tenantName, firstName, lastName, email, password } = body.data;

  // Génère le slug depuis le nom
  const slug = tenantName
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Créer le tenant
      const tenant = await tx.tenant.create({
        data: { slug: `${slug}-${Date.now().toString(36)}`, name: tenantName },
      });

      // Activer le module kernel par défaut
      await tx.tenantModule.create({
        data: { tenantId: tenant.id, moduleId: 'kernel', isEnabled: true },
      });

      // Créer le rôle Admin
      const adminRole = await tx.role.create({
        data: { tenantId: tenant.id, name: 'Administrateur', isSystem: true,
          description: 'Accès complet à tous les modules' },
      });

      // Assigner toutes les permissions au rôle Admin
      const allPerms = await tx.permission.findMany();
      await tx.rolePermission.createMany({
        data: allPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
        skipDuplicates: true,
      });

      // Créer l'utilisateur owner
      const user = await tx.user.create({
        data: { tenantId: tenant.id, email: email.toLowerCase(), passwordHash,
          firstName, lastName, isOwner: true },
      });

      // Assigner le rôle Admin
      await tx.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });

      return { tenant, user };
    });

    const { raw, hash, expiresAt } = generateRefreshToken();
    await prisma.refreshToken.create({
      data: { tenantId: result.tenant.id, userId: result.user.id, tokenHash: hash, expiresAt },
    });

    const accessToken = signAccess({
      userId: result.user.id, tenantId: result.tenant.id, email: result.user.email,
    });

    return res.status(201).json({
      accessToken,
      refreshToken: raw,
      user:   { id: result.user.id, email: result.user.email, firstName, lastName, isOwner: true },
      tenant: { id: result.tenant.id, slug: result.tenant.slug, name: result.tenant.name },
    });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    throw err;
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken manquant' });

  const tokenHash = hashToken(refreshToken);
  const rt = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true, tenant: true },
  });

  if (!rt || rt.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
  }

  // Rotation du refresh token
  await prisma.refreshToken.delete({ where: { id: rt.id } });
  const { raw, hash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { tenantId: rt.tenantId, userId: rt.userId, tokenHash: hash, expiresAt },
  });

  const accessToken = signAccess({ userId: rt.userId, tenantId: rt.tenantId, email: rt.user.email });
  return res.json({ accessToken, refreshToken: raw });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
  }
  return res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: {
      tenant: true,
      userRoles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  // Aplatir les permissions
  const permissions = new Set<string>();
  user.userRoles.forEach((ur) =>
    ur.role.permissions.forEach((rp) =>
      permissions.add(`${rp.permission.module}:${rp.permission.action}`)
    )
  );

  return res.json({
    id:          user.id,
    email:       user.email,
    firstName:   user.firstName,
    lastName:    user.lastName,
    isOwner:     user.isOwner,
    tenant:      { id: user.tenant.id, slug: user.tenant.slug, name: user.tenant.name, plan: user.tenant.plan },
    roles:       user.userRoles.map((ur) => ur.role.name),
    permissions: Array.from(permissions),
  });
});

export default router;
