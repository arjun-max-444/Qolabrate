import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/api/gst/verification-status')({server:{handlers:{GET:()=>Response.json({ok:true,status:'unavailable',message:'Official GST verification requires a configured provider.'},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})}}});
