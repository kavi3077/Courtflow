import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import crypto from 'crypto';
import { AppError } from '../utils/http.js';
import { asyncHandler } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';

const router = Router();
const authSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: z.string().min(8).max(100),
});

function tokenFor(user: { id: string; email: string; name: string }) {
  return jwt.sign(
    { email: user.email, name: user.name },
    config.jwtSecret,
    { subject: user.id, expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] }
  );
}

router.post('/signup', loginRateLimit, asyncHandler(async (req, res) => {
  const data = authSchema.extend({ name: z.string().min(2).max(80), invitationCode: z.string().min(16).max(200) }).parse(req.body);
  const invitation = await prisma.invitation.findUnique({where:{email:data.email}});
  if(!invitation || invitation.usedAt || invitation.expiresAt < new Date() || invitation.tokenHash !== crypto.createHash('sha256').update(data.invitationCode).digest('hex')) throw new AppError(403,'A valid invitation for this email is required');
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) return res.status(409).json({ message: 'An account with this email already exists' });
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.$transaction(async tx => { const claimed = await tx.invitation.updateMany({where:{id:invitation.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}}); if(claimed.count!==1)throw new AppError(403,'Invitation already used'); return tx.user.create({data:{name:data.name.trim(),email:data.email,passwordHash}}); });
  res.status(201).json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.post('/signin', loginRateLimit, asyncHandler(async (req, res) => {
  const data = authSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.active || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  res.json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, createdAt: true, role: true } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
}));

export default router;
