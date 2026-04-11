import { Router } from 'express';
import { qs, qsReq } from '../../utils/request';
import { z } from 'zod';
import prisma from '../../db/prisma';
import { authMiddleware } from '../../kernel/auth/authMiddleware';
import { requirePermission } from '../../kernel/permissions/rbac';
import { auditLog } from '../../kernel/audit/auditService';
import { nextReference } from './sequenceService';
import { calcLine, calcDocument } from './totalsService';

const router = Router();
router.use(authMiddleware);



const lineSchema = z.object({
  productId:   z.string().optional(),
  description: z.string().min(1),
  quantity:    z.number().positive(),
  unitPrice:   z.number().min(0),
  taxRate:     z.number().min(0).max(100).default(20),
  sortOrder:   z.number().optional(),
});

const quoteSchema = z.object({
  contactId:  z.string().optional(),
  expiryDate: z.string().optional(),
  notes:      z.string().optional(),
  lines:      z.array(lineSchema).min(1),
});

const INCLUDE = {
  contact:    { select: { id: true, firstName: true, lastName: true, company: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  createdBy:  { select: { id: true, firstName: true, lastName: true } },
  lines: {
    include:  { product: { select: { id: true, name: true, reference: true } } },
    orderBy:  { sortOrder: 'asc' as const },
  },
} as const;

// ── GET /api/ventes/quotes ────────────────────────────────────────────────────
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
    prisma.quote.findMany({ where, skip, take: limit, include: INCLUDE, orderBy: { createdAt: 'desc' } }),
    prisma.quote.count({ where }),
  ]);
  return res.json({ data, total, page, limit });
});

// ── GET /api/ventes/quotes/:id ────────────────────────────────────────────────
router.get('/:id', requirePermission('ventes', 'READ'), async (req, res) => {
  const quote = await prisma.quote.findFirst({
    where:   { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
    include: INCLUDE,
  });
  if (!quote) return res.status(404).json({ error: 'Devis introuvable' });
  return res.json(quote);
});

// ── POST /api/ventes/quotes ───────────────────────────────────────────────────
router.post('/', requirePermission('ventes', 'CREATE'), async (req, res) => {
  const body = quoteSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  const reference  = await nextReference(req.user!.tenantId, 'QUO');
  const lineTotals = body.data.lines.map((l) => calcLine(l));
  const docTotals  = calcDocument(lineTotals);

  const quote = await prisma.quote.create({
    data: {
      tenantId:    req.user!.tenantId,
      createdById: req.user!.userId,
      reference,
      contactId:   body.data.contactId,
      expiryDate:  body.data.expiryDate ? new Date(body.data.expiryDate) : undefined,
      notes:       body.data.notes,
      ...docTotals,
      lines: {
        create: body.data.lines.map((l, i) => ({ ...l, ...lineTotals[i], sortOrder: l.sortOrder ?? i })),
      },
    },
    include: INCLUDE,
  });

  await auditLog({ tenantId: req.user!.tenantId, userId: req.user!.userId,
    module: 'ventes', action: 'CREATE', entityType: 'Quote', entityId: quote.id,
    newValues: { reference, total: Number(quote.total) } });

  return res.status(201).json(quote);
});

// ── PATCH /api/ventes/quotes/:id ──────────────────────────────────────────────
router.patch('/:id', requirePermission('ventes', 'UPDATE'), async (req, res) => {
  const quote = await prisma.quote.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!quote) return res.status(404).json({ error: 'Devis introuvable' });
  if (quote.status !== 'DRAFT') return res.status(400).json({ error: 'Seul un brouillon est modifiable' });

  const { lines, ...rest } = req.body;

  if (lines) {
    const lineTotals = lines.map((l: any) => calcLine(l));
    const docTotals  = calcDocument(lineTotals);
    await prisma.quoteLine.deleteMany({ where: { quoteId: quote.id } });
    await prisma.quote.update({
      where: { id: quote.id },
      data: { ...rest, ...docTotals,
        lines: { create: lines.map((l: any, i: number) => ({ ...l, ...lineTotals[i], sortOrder: i })) } },
    });
  } else {
    await prisma.quote.update({ where: { id: quote.id }, data: rest });
  }

  return res.json(await prisma.quote.findUnique({ where: { id: quote.id }, include: INCLUDE }));
});

// ── POST /api/ventes/quotes/:id/send ──────────────────────────────────────────
router.post('/:id/send', requirePermission('ventes', 'UPDATE'), async (req, res) => {
  const quote = await prisma.quote.findFirst({ where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId } });
  if (!quote) return res.status(404).json({ error: 'Devis introuvable' });
  if (quote.status !== 'DRAFT') return res.status(400).json({ error: 'Devis déjà envoyé' });
  return res.json(await prisma.quote.update({ where: { id: quote.id }, data: { status: 'SENT' }, include: INCLUDE }));
});

// ── POST /api/ventes/quotes/:id/confirm → crée commande ──────────────────────
router.post('/:id/confirm', requirePermission('ventes', 'CONFIRM_ORDER'), async (req, res) => {
  const quote = await prisma.quote.findFirst({
    where:   { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
    include: { lines: true, order: true },
  });
  if (!quote) return res.status(404).json({ error: 'Devis introuvable' });
  if (!['DRAFT', 'SENT'].includes(quote.status)) return res.status(400).json({ error: 'Devis non confirmable' });
  if (quote.order) return res.status(400).json({ error: 'Commande déjà créée' });

  const orderRef = await nextReference(req.user!.tenantId, 'ORD');

  const order = await prisma.$transaction(async (tx) => {
    await tx.quote.update({ where: { id: quote.id }, data: { status: 'ACCEPTED', confirmedAt: new Date() } });
    return tx.order.create({
      data: {
        tenantId:    req.user!.tenantId,
        createdById: req.user!.userId,
        reference:   orderRef,
        quoteId:     quote.id,
        contactId:   quote.contactId,
        subtotal:    quote.subtotal,
        taxAmount:   quote.taxAmount,
        total:       quote.total,
        lines: {
          create: quote.lines.map((l) => ({
            productId: l.productId, description: l.description, quantity: l.quantity,
            unitPrice: l.unitPrice, taxRate: l.taxRate, subtotal: l.subtotal,
            taxAmount: l.taxAmount, total: l.total, sortOrder: l.sortOrder,
          })),
        },
      },
      include: {
        lines:   true,
        contact: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    });
  });

  return res.status(201).json(order);
});

export default router;
