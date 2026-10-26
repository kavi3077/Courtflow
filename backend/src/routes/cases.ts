import fs from 'node:fs/promises';import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheDel } from '../lib/redis.js';

const router = Router();
router.use(requireAuth);

const statuses = ['PENDING','SCHEDULED','ACTIVE','ADJOURNED','CLOSED','DISPOSED'] as const;
const priorities = ['LOW','MEDIUM','HIGH','URGENT'] as const;
const caseSchema = z.object({
  caseNumber: z.string().min(2).max(60),
  title: z.string().min(3).max(180),
  description: z.string().max(5000).optional().nullable(),
  courtName: z.string().min(2).max(150),
  caseType: z.string().min(2).max(100),
  filingDate: z.coerce.date(),
  nextHearingDate: z.coerce.date().optional().nullable(),
  status: z.enum(statuses).default('PENDING'),
  priority: z.enum(priorities).default('MEDIUM'),
  plaintiff: z.string().min(1).max(180),
  defendant: z.string().min(1).max(180),
  notes: z.string().max(5000).optional().nullable(),
});

router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '');
  const where: any = { userId };
  if (status && statuses.includes(status as any)) where.status = status;
  if (search) where.OR = [
    { caseNumber: { contains: search, mode: 'insensitive' } },
    { title: { contains: search, mode: 'insensitive' } },
    { courtName: { contains: search, mode: 'insensitive' } },
    { plaintiff: { contains: search, mode: 'insensitive' } },
    { defendant: { contains: search, mode: 'insensitive' } },
  ];
  const [items, total] = await Promise.all([
    prisma.case.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: { _count: { select: { hearings: true, evidence: true } } } }),
    prisma.case.count({ where })
  ]);
  res.json({ items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = caseSchema.parse(req.body);
  const userId = req.user!.id;
  const created = await prisma.$transaction(async tx => {
    const c = await tx.case.create({ data: { ...data, userId } });
    await tx.caseStatusEvent.create({ data: { caseId: c.id, changedById: userId, toStatus: c.status, note: 'Case registered' } });
    return c;
  });
  await cacheDel(`dashboard:${userId}`);
  res.status(201).json(created);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const item = await prisma.case.findFirst({
    where: { id: String(req.params.id), userId: req.user!.id },
    include: {
      hearings: { orderBy: { date: 'desc' } },
      evidence: { orderBy: { uploadedAt: 'desc' } },
      judgment: true, judge: true,
      advocates: { include: { advocate: true } },
      statusHistory: { orderBy: { createdAt: 'desc' }, include: { changedBy: { select: { name: true } } } }
    }
  });
  if (!item) throw new AppError(404, 'Case not found');
  res.json(item);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const existing = await prisma.case.findFirst({ where: { id: String(req.params.id), userId } });
  if (!existing) throw new AppError(404, 'Case not found');
  const data = caseSchema.parse(req.body);
  const updated = await prisma.$transaction(async tx => {
    const c = await tx.case.update({ where: { id: existing.id }, data });
    if (data.status !== existing.status) {
      await tx.caseStatusEvent.create({ data: { caseId: c.id, changedById: userId, fromStatus: existing.status, toStatus: data.status, note: 'Status changed while editing case' } });
    }
    return c;
  });
  await cacheDel(`dashboard:${userId}`);
  res.json(updated);
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const data = z.object({ status: z.enum(statuses), note: z.string().max(500).optional() }).parse(req.body);
  const existing = await prisma.case.findFirst({ where: { id: String(req.params.id), userId } });
  if (!existing) throw new AppError(404, 'Case not found');
  if (existing.status === data.status) return res.json(existing);
  const updated = await prisma.$transaction(async tx => {
    const c = await tx.case.update({ where: { id: existing.id }, data: { status: data.status } });
    await tx.caseStatusEvent.create({ data: { caseId: c.id, changedById: userId, fromStatus: existing.status, toStatus: data.status, note: data.note } });
    return c;
  });
  await cacheDel(`dashboard:${userId}`);
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const existing = await prisma.case.findFirst({ where: { id: String(req.params.id), userId } });
  if (!existing) throw new AppError(404, 'Case not found');
  const files=await prisma.evidence.findMany({where:{caseId:existing.id}});
  await prisma.$transaction(async tx=>{await tx.hearing.deleteMany({where:{caseId:existing.id}});await tx.evidence.deleteMany({where:{caseId:existing.id}});await tx.judgment.deleteMany({where:{caseId:existing.id}});await tx.caseAdvocate.deleteMany({where:{caseId:existing.id}});await tx.caseStatusEvent.deleteMany({where:{caseId:existing.id}});await tx.case.delete({where:{id:existing.id}});});
  for(const file of files) await fs.unlink(path.resolve('uploads',file.storedName)).catch(()=>{});
  await cacheDel(`dashboard:${userId}`);
  res.status(204).send();
}));

router.patch('/:id/judge',asyncHandler(async(req,res)=>{const userId=req.user!.id;const {judgeId}=z.object({judgeId:z.string().nullable()}).parse(req.body);const c=await prisma.case.findFirst({where:{id:String(req.params.id),userId}});if(!c)throw new AppError(404,'Case not found');if(judgeId&&!await prisma.judge.findFirst({where:{id:judgeId,userId}}))throw new AppError(404,'Judge not found');res.json(await prisma.case.update({where:{id:c.id},data:{judgeId}}));}));
router.patch('/:id/history/:eventId',asyncHandler(async(req,res)=>{const {note}=z.object({note:z.string().max(500)}).parse(req.body);const event=await prisma.caseStatusEvent.findFirst({where:{id:String(req.params.eventId),caseId:String(req.params.id),case:{userId:req.user!.id}}});if(!event)throw new AppError(404,'History entry not found');res.json(await prisma.caseStatusEvent.update({where:{id:event.id},data:{note}}));}));
export default router;
