import { Router } from 'express';
import { qs, qsReq } from '../../utils/request';
import { z } from 'zod';
import prisma from '../../db/prisma';
import { authMiddleware } from '../../kernel/auth/authMiddleware';
import { requirePermission } from '../../kernel/permissions/rbac';

const router = Router();
router.use(authMiddleware);



const schema = z.object({
  reference:   z.string().min(1),
  name:        z.string().min(1),
  description: z.string().optional(),
  unitPrice:   z.number().min(0),
  unit:        z.string().optional(),
  taxRate:     z.number().min(0).max(100).optional(),
  category:    z.string().optional(),
});

router.get('/', requirePermission('ventes', 'READ'), async (req, res) => {
  const search   = qs(req.query.search);
  const category = qs(req.query.category);
  const where: any = { tenantId: req.user!.tenantId, isActive: true };
  if (search)   where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { reference: { contains: search, mode: 'insensitive' } }];
  if (category) where.category = category;
  const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
  return res.json(products);
});

router.get('/:id', requirePermission('ventes', 'READ'), async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  return res.json(product);
});

router.post('/', requirePermission('ventes', 'CREATE'), async (req, res) => {
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });
  try {
    const product = await prisma.product.create({ data: { ...body.data, tenantId: req.user!.tenantId } });
    return res.status(201).json(product);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Référence déjà utilisée' });
    throw err;
  }
});

router.patch('/:id', requirePermission('ventes', 'UPDATE'), async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  return res.json(await prisma.product.update({ where: { id: product.id }, data: req.body }));
});

router.delete('/:id', requirePermission('ventes', 'DELETE'), async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
  return res.json({ ok: true });
});

export default router;
