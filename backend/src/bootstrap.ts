import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';
export async function bootstrapAdmin(){
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
 if(!email||!password||password.length<12)throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env');
 if(!await prisma.user.findUnique({where:{email}})) await prisma.user.create({data:{email,name:process.env.ADMIN_NAME||'Court Administrator',passwordHash:await bcrypt.hash(password,12),role:'ADMIN'}});
}
