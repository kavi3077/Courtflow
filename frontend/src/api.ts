import axios from 'axios';
export const api=axios.create({baseURL:'/api'});
api.interceptors.request.use(config=>{const token=localStorage.getItem('courtflow_token');if(token)config.headers.Authorization=`Bearer ${token}`;return config});
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401){localStorage.removeItem('courtflow_token');localStorage.removeItem('courtflow_user');if(!location.pathname.includes('/signin')&&!location.pathname.includes('/signup'))location.href='/signin'}return Promise.reject(e)});
export function messageOf(e:any){return e?.response?.data?.message||e?.message||'Something went wrong'}
