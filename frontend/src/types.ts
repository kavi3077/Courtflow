export type CaseStatus='PENDING'|'SCHEDULED'|'ACTIVE'|'ADJOURNED'|'CLOSED'|'DISPOSED';
export type Priority='LOW'|'MEDIUM'|'HIGH'|'URGENT';
export interface User{id:string;name:string;email:string;role?:'ADMIN'|'STAFF'}
export interface CaseItem{id:string;caseNumber:string;title:string;description?:string|null;courtName:string;caseType:string;filingDate:string;nextHearingDate?:string|null;status:CaseStatus;priority:Priority;plaintiff:string;defendant:string;notes?:string|null;createdAt:string;updatedAt:string;_count?:{hearings:number;evidence:number}}
export interface Hearing{id:string;date:string;courtroom?:string;judgeName?:string;purpose:string;status:string;outcome?:string;notes?:string;case?:Pick<CaseItem,'id'|'caseNumber'|'title'>}
export interface Advocate{id:string;name:string;email?:string;phone?:string;enrollmentNo?:string;specialization?:string;organization?:string;_count?:{cases:number}}
