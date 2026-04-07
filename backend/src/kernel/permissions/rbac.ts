import { Request, Response, NextFunction } from 'express';
import prisma from '../../db/prisma';

/**
 * Vérifie si un utilisateur possède une permission donnée.
 * Utilise un cache en mémoire pour éviter des requêtes DB répétées.
 */
const permCache = new Map<string, { permissions: Set<string>; expiresAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

export async function getUserPermissions(userId: string, tenantId: string): Promise<Set<string>> {
  const cacheKey = `${tenantId}:${userId}`;
  const cached   = permCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  const permissions = new Set<string>();
  userRoles.forEach((ur) =>
    ur.role.permissions.forEach((rp) =>
      permissions.add(`${rp.permission.module}:${rp.permission.action}`)
    )
  );

  permCache.set(cacheKey, { permissions, expiresAt: Date.now() + CACHE_TTL });
  return permissions;
}

export function invalidatePermCache(userId: string, tenantId: string) {
  permCache.delete(`${tenantId}:${userId}`);
}

/**
 * Middleware de contrôle des permissions.
 * Usage : requirePermission('ventes', 'CONFIRM_ORDER')
 */
export function requirePermission(module: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

    const permissions = await getUserPermissions(req.user.userId, req.user.tenantId);
    const required    = `${module}:${action}`;

    if (!permissions.has(required)) {
      return res.status(403).json({
        error:    'Permission refusée',
        required: required,
      });
    }
    next();
  };
}

/**
 * Middleware : au moins une des permissions
 */
export function requireAnyPermission(checks: { module: string; action: string }[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

    const permissions = await getUserPermissions(req.user.userId, req.user.tenantId);
    const hasAny      = checks.some(({ module, action }) => permissions.has(`${module}:${action}`));

    if (!hasAny) {
      return res.status(403).json({ error: 'Permission refusée' });
    }
    next();
  };
}
