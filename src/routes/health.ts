import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/health')({server:{handlers:{GET:()=>Response.json({ok:true,mode:'sample-marketplace',message:'QOLABRATE is ready'},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})}}});
