import { Router } from 'express';
import { qs, qsReq } from '../../utils/request';
import prisma from '../../db/prisma';
import { authMiddleware } from '../../kernel/auth/authMiddleware';
import { requirePermission } from '../../kernel/permissions/rbac';
import { auditLog } from '../../kernel/audit/auditService';

const router = Router();
router.use(authMiddleware);



const INCLUDE = {
  contact:   { select: { id: true, firstName: true, lastName: true, company: true, email: true } },
  order:     { select: { id: true, reference: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines:     { orderBy: { sortOrder: 'asc' as const } },
} as const;

// ── GET /api/ventes/invoices ──────────────────────────────────────────────────
router.get('/', requirePermission('ventes', 'READ'), async (req, res) => {
  const status = qs(req.query.status);
  const search = qs(req.query.search);
  const page   = parseInt(qs(req.query.page)  || '1');
  const limit  = parseInt(qs(req.query.limit) || '20');
  const skip   = (page - 1) * limit;
  const tenantId = req.user!.tenantId;

  // Auto-marquer les factures en retard
  await prisma.invoice.updateMany({
    where: { tenantId, status: { in: ['DRAFT', 'SENT'] }, dueDate: { lt: new Date() } },
    data:  { status: 'OVERDUE' },
  });

  const where: any = { tenantId };
  if (status) where.status    = status;
  if (search) where.reference = { contains: search, mode: 'insensitive' };

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({ where, skip, take: limit, include: INCLUDE, orderBy: { createdAt: 'desc' } }),
    prisma.invoice.count({ where }),
  ]);
  return res.json({ data, total, page, limit });
});

// ── GET /api/ventes/invoices/stats/summary ────────────────────────────────────
router.get('/stats/summary', requirePermission('ventes', 'READ'), async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [total, paid, overdue, pending] = await Promise.all([
    prisma.invoice.aggregate({ where: { tenantId }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { tenantId, status: 'PAID' }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { tenantId, status: 'OVERDUE' }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { tenantId, status: { in: ['DRAFT', 'SENT'] } }, _sum: { total: true }, _count: true }),
  ]);
  return res.json({
    total:   { count: total._count,   amount: Number(total._sum.total   ?? 0) },
    paid:    { count: paid._count,    amount: Number(paid._sum.total    ?? 0) },
    overdue: { count: overdue._count, amount: Number(overdue._sum.total ?? 0) },
    pending: { count: pending._count, amount: Number(pending._sum.total ?? 0) },
  });
});

// ── GET /api/ventes/invoices/:id ──────────────────────────────────────────────
router.get('/:id', requirePermission('ventes', 'READ'), async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId }, include: INCLUDE,
  });
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });
  return res.json(invoice);
});

// ── POST /api/ventes/invoices/:id/send ───────────────────────────────────────
router.post('/:id/send', requirePermission('ventes', 'UPDATE'), async (req, res) => {
  const inv = await prisma.invoice.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!inv) return res.status(404).json({ error: 'Facture introuvable' });
  return res.json(await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'SENT', sentAt: new Date() }, include: INCLUDE }));
});

// ── POST /api/ventes/invoices/:id/pay ────────────────────────────────────────
router.post('/:id/pay', requirePermission('ventes', 'UPDATE'), async (req, res) => {
  const inv = await prisma.invoice.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!inv) return res.status(404).json({ error: 'Facture introuvable' });

  const paidAmount = Number(req.body.amount ?? inv.total);
  const newPaid    = Number(inv.paidAmount) + paidAmount;
  const status     = newPaid >= Number(inv.total) ? 'PAID' : 'PARTIALLY_PAID';

  const updated = await prisma.invoice.update({
    where: { id: inv.id },
    data:  { paidAmount: newPaid, status, ...(status === 'PAID' && { paidAt: new Date() }) },
    include: INCLUDE,
  });

  await auditLog({ tenantId: req.user!.tenantId, userId: req.user!.userId,
    module: 'ventes', action: 'UPDATE', entityType: 'Invoice', entityId: inv.id,
    newValues: { paidAmount, status } });

  return res.json(updated);
});

export default router;
