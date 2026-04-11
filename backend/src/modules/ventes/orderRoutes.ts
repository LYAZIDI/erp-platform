import { Router } from 'express';
import { qs, qsReq } from '../../utils/request';
import prisma from '../../db/prisma';
import { authMiddleware } from '../../kernel/auth/authMiddleware';
import { requirePermission } from '../../kernel/permissions/rbac';
import { auditLog } from '../../kernel/audit/auditService';
import { nextReference } from './sequenceService';

const router = Router();
router.use(authMiddleware);



const INCLUDE = {
  contact:    { select: { id: true, firstName: true, lastName: true, company: true } },
  quote:      { select: { id: true, reference: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  lines:      { include: { product: { select: { id: true, name: true, reference: true } } }, orderBy: { sortOrder: 'asc' as const } },
  invoices:   { select: { id: true, reference: true, status: true, total: true } },
} as const;

// ── GET /api/ventes/orders ────────────────────────────────────────────────────
router.get('/', requirePermission('ventes', 'READ'), async (req, res) => {
  const status = qs(req.query.status);
  const search = qs(req.query.search);
  const page   = parseInt(qs(req.query.page)  || '1');
  const limit  = parseInt(qs(req.query.limit) || '20');
  const skip   = (page - 1) * limit;

  const where: any = { tenantId: req.user!.tenantId };
  if (status) where.status    = status;
  if (search) where.reference = { contains: search, mode: 'insensitive' };

  const [data, total] = await Promise.all([
    prisma.order.findMany({ where, skip, take: limit, include: INCLUDE, orderBy: { createdAt: 'desc' } }),
    prisma.order.count({ where }),
  ]);
  return res.json({ data, total, page, limit });
});

// ── GET /api/ventes/orders/:id ────────────────────────────────────────────────
router.get('/:id', requirePermission('ventes', 'READ'), async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId }, include: INCLUDE,
  });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  return res.json(order);
});

// ── PATCH /api/ventes/orders/:id ──────────────────────────────────────────────
router.patch('/:id', requirePermission('ventes', 'UPDATE'), async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Commande annulée' });
  return res.json(await prisma.order.update({ where: { id: order.id }, data: req.body, include: INCLUDE }));
});

// ── POST /api/ventes/orders/:id/cancel ───────────────────────────────────────
router.post('/:id/cancel', requirePermission('ventes', 'CANCEL_ORDER'), async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  return res.json(await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' }, include: INCLUDE }));
});

// ── POST /api/ventes/orders/:id/invoice ──────────────────────────────────────
router.post('/:id/invoice', requirePermission('ventes', 'CREATE_INVOICE'), async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
    include: { lines: true },
  });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const invRef  = await nextReference(req.user!.tenantId, 'INV');
  const dueDate = req.body.dueDate
    ? new Date(req.body.dueDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const invoice = await prisma.invoice.create({
    data: {
      tenantId:    req.user!.tenantId,
      createdById: req.user!.userId,
      reference:   invRef,
      orderId:     order.id,
      contactId:   order.contactId,
      dueDate,
      subtotal:    order.subtotal,
      taxAmount:   order.taxAmount,
      total:       order.total,
      notes:       req.body.notes,
      lines: {
        create: order.lines.map((l) => ({
          description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
          taxRate: l.taxRate, subtotal: l.subtotal, taxAmount: l.taxAmount,
          total: l.total, sortOrder: l.sortOrder,
        })),
      },
    },
    include: {
      lines:   true,
      order:   { select: { id: true, reference: true } },
      contact: { select: { id: true, firstName: true, lastName: true, company: true } },
    },
  });

  await auditLog({ tenantId: req.user!.tenantId, userId: req.user!.userId,
    module: 'ventes', action: 'CREATE_INVOICE', entityType: 'Invoice', entityId: invoice.id });

  return res.status(201).json(invoice);
});

export default router;
