import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
export async function requireAuth(req: Request,res: Response,next: NextFunction){
 const header=req.headers.authorization;
 if(!header?.startsWith('Bearer '))return res.status(401).json({message:'Authentication required'});
 let sub:string;
 try {const payload=jwt.verify(header.slice(7),config.jwtSecret);if(typeof payload==='string'||!payload.sub)throw new Error();sub=payload.sub;}catch{return res.status(401).json({message:'Invalid or expired session'});}
 try {const user=await prisma.user.findUnique({where:{id:sub}});if(!user?.active)return res.status(403).json({message:'Account access is disabled'});req.user={id:user.id,email:user.email,name:user.name};next();}catch(e){next(e);}
}
export async function requireAdmin(req:Request,res:Response,next:NextFunction){try{const user=await prisma.user.findUnique({where:{id:req.user!.id}});if(user?.role!=='ADMIN')return res.status(403).json({message:'Administrator access required'});next();}catch(e){next(e);}}
