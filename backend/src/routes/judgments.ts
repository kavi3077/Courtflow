import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheDel } from '../lib/redis.js';

const router = Router();
router.use(requireAuth);

const schema = z.object({
  judgmentDate: z.coerce.date(),
  result: z.string().min(2).max(200),
  summary: z.string().min(5).max(8000),
  judgeName: z.string().max(120).optional().nullable(),
  referenceNo: z.string().max(100).optional().nullable(),
});

router.put('/case/:caseId', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const caseId = String(req.params.caseId);
  const c = await prisma.case.findFirst({ where: { id: caseId, userId } });
  if (!c) throw new AppError(404, 'Case not found');

  const data = schema.parse(req.body);
  const judgment = await prisma.judgment.upsert({
    where: { caseId: c.id },
    create: { ...data, caseId: c.id },
    update: data,
  });

  await cacheDel(`dashboard:${userId}`);
  res.json(judgment);
}));

router.delete('/case/:caseId', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const caseId = String(req.params.caseId);

  const judgment = await prisma.judgment.findFirst({
    where: { caseId, case: { userId } },
  });
  if (!judgment) throw new AppError(404, 'Judgment not found');

  await prisma.judgment.delete({ where: { id: judgment.id } });
  await cacheDel(`dashboard:${userId}`);
  res.status(204).send();
}));

export default router;
