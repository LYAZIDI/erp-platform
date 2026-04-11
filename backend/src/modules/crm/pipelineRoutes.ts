import { Router } from 'express';
import { qs, qsReq } from '../../utils/request';
import { z } from 'zod';
import prisma from '../../db/prisma';
import { authMiddleware } from '../../kernel/auth/authMiddleware';
import { requirePermission } from '../../kernel/permissions/rbac';

const router = Router();
router.use(authMiddleware);



// ── GET /api/crm/pipeline ─────────────────────────────────────────────────────
router.get('/pipeline', requirePermission('crm', 'READ'), async (req, res) => {
  const tenantId = req.user!.tenantId;

  const stagesCount = await prisma.pipelineStage.count({ where: { tenantId } });
  if (stagesCount === 0) {
    await prisma.pipelineStage.createMany({
      data: [
        { tenantId, name: 'Nouveau',     color: '#8c8c8c', order: 0, probability: 10 },
        { tenantId, name: 'Contacté',    color: '#1677ff', order: 1, probability: 25 },
        { tenantId, name: 'Qualifié',    color: '#722ed1', order: 2, probability: 50 },
        { tenantId, name: 'Proposition', color: '#fa8c16', order: 3, probability: 75 },
        { tenantId, name: 'Négociation', color: '#eb2f96', order: 4, probability: 90 },
      ],
    });
  }

  const stages = await prisma.pipelineStage.findMany({
    where: { tenantId },
    orderBy: { order: 'asc' },
    include: {
      leads: {
        where: { tenantId, status: 'OPEN' },
        include: {
          contact:    { select: { id: true, firstName: true, lastName: true, company: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  return res.json(stages);
});

// ── GET /api/crm/leads ────────────────────────────────────────────────────────
router.get('/leads', requirePermission('crm', 'READ'), async (req, res) => {
  const search = qs(req.query.search);
  const status = qs(req.query.status);
  const page   = parseInt(qs(req.query.page)  || '1');
  const limit  = parseInt(qs(req.query.limit) || '20');
  const skip   = (page - 1) * limit;

  const where: any = { tenantId: req.user!.tenantId };
  if (status) where.status = status;
  if (search) where.title  = { contains: search, mode: 'insensitive' };

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where, skip, take: limit,
      include: {
        stage:      true,
        contact:    { select: { id: true, firstName: true, lastName: true, company: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ]);
  return res.json({ data, total, page, limit });
});

// ── POST /api/crm/leads ───────────────────────────────────────────────────────
const leadSchema = z.object({
  title:        z.string().min(1),
  contactId:    z.string().optional(),
  stageId:      z.string(),
  value:        z.number().optional(),
  probability:  z.number().min(0).max(100).optional(),
  expectedDate: z.string().optional(),
  assignedToId: z.string().optional(),
  description:  z.string().optional(),
});

router.post('/leads', requirePermission('crm', 'CREATE'), async (req, res) => {
  const body = leadSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Données invalides', details: body.error.flatten() });

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: body.data.stageId, tenantId: req.user!.tenantId },
  });
  if (!stage) return res.status(400).json({ error: 'Stage invalide' });

  const lead = await prisma.lead.create({
    data: {
      tenantId:    req.user!.tenantId,
      createdById: req.user!.userId,
      title:       body.data.title,
      stageId:     body.data.stageId,
      contactId:   body.data.contactId,
      value:       body.data.value,
      probability: body.data.probability ?? stage.probability,
      expectedDate:body.data.expectedDate ? new Date(body.data.expectedDate) : undefined,
      assignedToId:body.data.assignedToId,
      description: body.data.description,
    },
    include: { stage: true, contact: true },
  });

  await prisma.leadActivity.create({
    data: { leadId: lead.id, userId: req.user!.userId, type: 'NOTE', content: 'Lead créé' },
  });
  return res.status(201).json(lead);
});

// ── PATCH /api/crm/leads/:id ──────────────────────────────────────────────────
router.patch('/leads/:id', requirePermission('crm', 'UPDATE'), async (req, res) => {
  const lead = await prisma.lead.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!lead) return res.status(404).json({ error: 'Lead introuvable' });

  const { stageId, status, lostReason, ...rest } = req.body;

  if (stageId && stageId !== lead.stageId) {
    const newStage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
    if (newStage) {
      await prisma.leadActivity.create({
        data: { leadId: lead.id, userId: req.user!.userId, type: 'STAGE_CHANGE',
          content: `Déplacé vers "${newStage.name}"` },
      });
    }
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...rest,
      ...(stageId    && { stageId }),
      ...(status     && { status }),
      ...(lostReason && { lostReason }),
      ...(status === 'WON'  && { wonAt:  new Date() }),
      ...(status === 'LOST' && { lostAt: new Date() }),
    },
    include: { stage: true, contact: true, assignedTo: true },
  });
  return res.json(updated);
});

// ── GET /api/crm/leads/:id/activities ─────────────────────────────────────────
router.get('/leads/:id/activities', requirePermission('crm', 'READ'), async (req, res) => {
  const activities = await prisma.leadActivity.findMany({
    where: { leadId: qsReq(req.params.id) },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(activities);
});

// ── POST /api/crm/leads/:id/activities ───────────────────────────────────────
router.post('/leads/:id/activities', requirePermission('crm', 'CREATE'), async (req, res) => {
  const lead = await prisma.lead.findFirst({
    where: { id: qsReq(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!lead) return res.status(404).json({ error: 'Lead introuvable' });

  const activity = await prisma.leadActivity.create({
    data: { leadId: lead.id, userId: req.user!.userId, type: req.body.type || 'NOTE', content: req.body.content },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  return res.status(201).json(activity);
});

// ── PATCH /api/crm/stages (réordonner) ───────────────────────────────────────
router.patch('/stages', requirePermission('crm', 'UPDATE'), async (req, res) => {
  const { stages } = req.body as { stages: { id: string; order: number }[] };
  await Promise.all(stages.map((s) =>
    prisma.pipelineStage.updateMany({
      where: { id: s.id, tenantId: req.user!.tenantId },
      data:  { order: s.order },
    })
  ));
  return res.json({ ok: true });
});

export default router;
