import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheDel } from '../lib/redis.js';

const router = Router(); router.use(requireAuth);
const schema = z.object({
  date: z.coerce.date(), courtroom: z.string().max(80).optional().nullable(), judgeName: z.string().max(120).optional().nullable(),
  purpose: z.string().min(2).max(500), status: z.enum(['SCHEDULED','COMPLETED','ADJOURNED','CANCELLED']).default('SCHEDULED'),
  outcome: z.string().max(2000).optional().nullable(), notes: z.string().max(3000).optional().nullable()
});

async function refreshNextHearing(caseId:string){const next=await prisma.hearing.findFirst({where:{caseId,status:'SCHEDULED',date:{gte:new Date()}},orderBy:{date:'asc'}});await prisma.case.update({where:{id:caseId},data:{nextHearingDate:next?.date||null}});}
router.get('/', asyncHandler(async (req,res)=>{
  const hearings = await prisma.hearing.findMany({ where: { case: { userId: req.user!.id } }, include: { case: { select: { id:true, caseNumber:true, title:true } } }, orderBy: { date:'desc' } });
  res.json(hearings);
}));
router.post('/case/:caseId', asyncHandler(async (req,res)=>{
  const userId=req.user!.id; const c=await prisma.case.findFirst({where:{id:String(req.params.caseId),userId}}); if(!c) throw new AppError(404,'Case not found');
  const data=schema.parse(req.body);
  const hearing=await prisma.$transaction(async tx=>{
    const h=await tx.hearing.create({data:{...data,caseId:c.id}});
    if(data.status==='SCHEDULED'){
      await tx.case.update({where:{id:c.id},data:{nextHearingDate:data.date,status:c.status==='PENDING'?'SCHEDULED':c.status}});
      if(c.status==='PENDING') await tx.caseStatusEvent.create({data:{caseId:c.id,changedById:userId,fromStatus:'PENDING',toStatus:'SCHEDULED',note:'First hearing scheduled'}});
    }
    return h;
  });
  await refreshNextHearing(c.id);await cacheDel(`dashboard:${userId}`); res.status(201).json(hearing);
}));
router.put('/:id', asyncHandler(async(req,res)=>{
  const h=await prisma.hearing.findFirst({where:{id:String(req.params.id),case:{userId:req.user!.id}}}); if(!h) throw new AppError(404,'Hearing not found');
  const updated=await prisma.hearing.update({where:{id:h.id},data:schema.parse(req.body)}); await refreshNextHearing(h.caseId);await cacheDel(`dashboard:${req.user!.id}`); res.json(updated);
}));
router.delete('/:id', asyncHandler(async(req,res)=>{
  const h=await prisma.hearing.findFirst({where:{id:String(req.params.id),case:{userId:req.user!.id}}}); if(!h) throw new AppError(404,'Hearing not found');
  await prisma.hearing.delete({where:{id:h.id}}); await refreshNextHearing(h.caseId);await cacheDel(`dashboard:${req.user!.id}`); res.status(204).send();
}));
export default router;
