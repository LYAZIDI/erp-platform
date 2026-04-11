import { Router } from 'express';
import { qs, qsReq } from '../../utils/request';
import { z } from 'zod';
import prisma from '../../db/prisma';
import { authMiddleware } from '../../kernel/auth/authMiddleware';
import { requirePermission } from '../../kernel/permissions/rbac';
import { auditLog } from '../../kernel/audit/auditService';

const router = Router();
router.use(authMiddleware);

// Helper : query param string-only


const schema = z.object({
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  email:        z.string().email().optional().or(z.literal('')),
  phone:        z.string().optional(),
  mobile:       z.string().optional(),
  company:      z.string().optional(),
  jobTitle:     z.string().optional(),
  source:       z.enum(['MANUAL','WEBSITE','REFERRAL','LINKEDIN','EMAIL_CAMPAIGN','PHONE','OTHER']).optional(),
  tags:         z.array(z.string()).optional(),
  street:       z.string().optional(),
  city:         z.string().optional(),
  country:      z.string().optional(),
  notes:        z.string().optional(),
  assignedToId: z.string().optional(),
});

// ── GET /api/crm/contacts ─────────────────────────────────────────────────────
router.get('/', requirePermission('crm', 'READ'), async (req, res) => {
  const search = qs(req.query.search);
  const source = qs(req.query.source);
  const city   = qs(req.query.city);
  const page   = parseInt(qs(req.query.page)   || '1');
  const limit  = parseInt(qs(req.query.limit)  || '20');
  const skip   = (page - 1) * limit;

  const where: any = { tenantId: req.user!.tenantId, isActive: true };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
      { email:     { contains: search, mode: 'insensitive' } },
      { company:   { contains: search, mode: 'insensitive' } },
    ];
  }
  if (source) where.source = source;
  if (city)   where.city   = { contains: city, mode: 'insensitive' };

  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where, skip, take: limit,
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contact.count({ where }),
  ]);
  return res.json({ data, total, page, limit });
});

// ── GET /api/crm/contacts/:id ─────────────────────────────────────────────────
router.get('/:id', requirePermission('crm', 'READ'), async (req, res) => {
  const contact = await prisma.contact.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      leads: { include: { stage: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
  return res.json(contact);
});

// ── POST /api/crm/contacts ────────────────────────────────────────────────────
router.post('/', requirePermission('crm', 'CREATE'), async (req, res) => {
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  const contact = await prisma.contact.create({
    data: {
      ...body.data,
      tenantId:   req.user!.tenantId,
      createdById:req.user!.userId,
      email:      body.data.email || undefined,
    },
  });
  await auditLog({ tenantId: req.user!.tenantId, userId: req.user!.userId,
    module: 'crm', action: 'CREATE', entityType: 'Contact', entityId: contact.id });
  return res.status(201).json(contact);
});

// ── PATCH /api/crm/contacts/:id ───────────────────────────────────────────────
router.patch('/:id', requirePermission('crm', 'UPDATE'), async (req, res) => {
  const contact = await prisma.contact.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
  const updated = await prisma.contact.update({ where: { id: contact.id }, data: req.body });
  return res.json(updated);
});

// ── DELETE /api/crm/contacts/:id ──────────────────────────────────────────────
router.delete('/:id', requirePermission('crm', 'DELETE'), async (req, res) => {
  const contact = await prisma.contact.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
  await prisma.contact.update({ where: { id: contact.id }, data: { isActive: false } });
  return res.json({ ok: true });
});

export default router;
