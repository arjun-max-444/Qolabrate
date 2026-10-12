import { createFileRoute } from '@tanstack/react-router';
import { validateGSTIN } from '@/lib/gstin';
export const Route=createFileRoute('/api/gst/validate-format')({server:{handlers:{GET:({request})=>{const gstin=new URL(request.url).searchParams.get('gstin');return Response.json(gstin?{ok:true,check:'format',...validateGSTIN(gstin),officialVerification:'unavailable'}:{ok:false,error:'GSTIN is required'},{status:gstin?200:400,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})}}}});
