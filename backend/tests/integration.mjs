import request from 'supertest';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.env.TEST_DATABASE_URL)throw new Error('Set TEST_DATABASE_URL to a dedicated disposable MongoDB replica-set database. Tests create and remove records.');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;process.env.JWT_SECRET='integration-test-secret-123456789';process.env.ADMIN_EMAIL='test-admin@example.com';process.env.ADMIN_PASSWORD='Admin-Test-Password-123';
const {app}=await import(new URL('../dist/app.js',import.meta.url));const {prisma}=await import(new URL('../dist/lib/prisma.js',import.meta.url));const {bootstrapAdmin}=await import(new URL('../dist/bootstrap.js',import.meta.url));
let checks=0;
async function call(method,url,body,token,status=200){let r=request(app)[method]('/api'+url);if(token)r=r.set('Authorization','Bearer '+token);if(body)r=r.send(body);r=await r;assert.equal(r.status,status,JSON.stringify(r.body));checks++;return r.body;}
try{
if(await prisma.user.count())throw new Error('Test database must be empty.');await bootstrapAdmin();const admin=(await call('post','/auth/signin',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})).token;
await call('post','/auth/signup',{name:'Unauthorized',email:'u@example.com',password:'Password-123',invitationCode:'0'.repeat(48)},null,403);
const i=await call('post','/admin/invitations',{email:'staff@example.com'},admin,201);
const creds={name:'Staff User',email:i.email,password:'Staff-Password-123',invitationCode:i.code};const staff=(await call('post','/auth/signup',creds,null,201)).token;
await call('post','/auth/signup',creds,null,403);await call('get','/admin/users',null,staff,403);
const caseBody={caseNumber:'OS/001',title:'Integration case',courtName:'District Court',caseType:'Civil',filingDate:'2026-10-01',plaintiff:'A',defendant:'B'};
const c=await call('post','/cases',caseBody,staff,201);await call('get','/cases/'+c.id,null,admin,404);
const j=await call('post','/judges',{name:'Judge Example',courtName:'District Court'},staff,201);await call('patch',`/cases/${c.id}/judge`,{judgeId:j.id},staff);
const a=await call('post','/advocates',{name:'Counsel Example',email:'',phone:'',enrollmentNo:'EN123',specialization:'Civil',organization:''},staff,201);await call('post',`/advocates/${a.id}/assign/${c.id}`,{role:'Counsel'},staff,201);
await call('patch',`/cases/${c.id}/status`,{status:'ACTIVE',note:'Started'},staff);
let detail=await call('get','/cases/'+c.id,null,staff);assert.equal(detail.judge.name,j.name);assert.equal(detail.advocates.length,1);assert.equal(detail.status,'ACTIVE');
await call('patch',`/cases/${c.id}/history/${detail.statusHistory[0].id}`,{note:'Corrected note'},staff);
const h=await call('post',`/hearings/case/${c.id}`,{date:'2030-01-01T10:00:00Z',purpose:'First hearing'},staff,201);
await call('put',`/hearings/${h.id}`,{date:'2030-02-01T10:00:00Z',purpose:'Rescheduled',status:'SCHEDULED'},staff);
detail=await call('get','/cases/'+c.id,null,staff);assert.equal(detail.nextHearingDate,'2030-02-01T10:00:00.000Z');
await call('put',`/hearings/${h.id}`,{date:'2030-02-01T10:00:00Z',purpose:'Rescheduled',status:'COMPLETED',outcome:'Heard'},staff);
detail=await call('get','/cases/'+c.id,null,staff);assert.equal(detail.nextHearingDate,null);
await call('put',`/cases/${c.id}`,{...caseBody,title:'Updated title',status:'CLOSED'},staff);
await call('put',`/judgments/case/${c.id}`,{judgmentDate:'2026-10-01',result:'Settled',summary:'Case settled by agreement'},staff);
const users=await call('get','/admin/users',null,admin);const u=users.find(x=>x.email===i.email);
await call('patch','/admin/users/'+u.id,{active:false},admin);await call('get','/cases',null,staff,403);await call('post','/auth/signin',{email:i.email,password:creds.password},null,401);await call('patch','/admin/users/'+u.id,{active:true},admin);
await call('delete','/cases/'+c.id,null,staff,204);
for(const model of ['hearing','judgment','caseAdvocate','caseStatusEvent','evidence'])assert.equal(await prisma[model].count({where:{caseId:c.id}}),0);
const dash=await call('get','/dashboard',null,staff);assert.equal(dash.stats.total,0);
await call('get','/cases/not-an-object-id',null,staff,400);
console.log(`PASS: ${checks} HTTP assertions plus assignment, hearing synchronization, privacy, and cascade assertions.`);
}finally{await prisma.$disconnect();}
