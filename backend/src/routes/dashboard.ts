import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheGet, cacheSet } from '../lib/redis.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const key = `dashboard:${userId}`;
  const cached = await cacheGet(key);
  if (cached) return res.json(cached);

  const [total, pending, scheduled, active, closed, disposed, urgent, upcomingHearings, recentCases] = await Promise.all([
    prisma.case.count({ where: { userId } }),
    prisma.case.count({ where: { userId, status: 'PENDING' } }),
    prisma.case.count({ where: { userId, status: 'SCHEDULED' } }),
    prisma.case.count({ where: { userId, status: 'ACTIVE' } }),
    prisma.case.count({ where: { userId, status: 'CLOSED' } }),
    prisma.case.count({ where: { userId, status: 'DISPOSED' } }),
    prisma.case.count({ where: { userId, priority: 'URGENT', status: { notIn: ['CLOSED', 'DISPOSED'] } } }),
    prisma.hearing.findMany({
      where: { case: { userId }, date: { gte: new Date() }, status: 'SCHEDULED' },
      include: { case: { select: { id: true, caseNumber: true, title: true } } },
      orderBy: { date: 'asc' }, take: 5
    }),
    prisma.case.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 5, select: {
      id: true, caseNumber: true, title: true, courtName: true, status: true, priority: true, updatedAt: true, nextHearingDate: true
    }})
  ]);
  const payload = { stats: { total, pending, scheduled, active, closed, disposed, urgent }, upcomingHearings, recentCases };
  await cacheSet(key, payload, 45);
  res.json(payload);
}));

export default router;
