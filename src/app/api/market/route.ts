import { NextResponse } from "next/server";
const DEFAULT_SYMBOLS=["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","XAUUSD","XAGUSD","US500","NAS100","US30","AAPL","MSFT","NVDA","TSLA"];
const alias=(s:string)=>s==="NAS100"?"USTEC":s;
export async function GET(request:Request) {
 try {
  const url=new URL(request.url);
  const requested=url.searchParams.getAll("symbols");
  const symbols=(requested.length?requested:DEFAULT_SYMBOLS).filter(s=>DEFAULT_SYMBOLS.includes(s)).slice(0,30);
  const upstream=new URL("https://biquote.io/api/latest");
  symbols.forEach(s=>upstream.searchParams.append("symbols",alias(s)));
  const response=await fetch(upstream.toString(),{cache:"no-store",headers:{"Accept":"application/json"}});
  if(!response.ok) return NextResponse.json({ok:false,error:"Market provider returned "+response.status,quotes:{}},{status:502});
  const raw=await response.json();
  const quotes:Record<string,unknown>={};
  symbols.forEach(s=>{const key=alias(s);if(raw[key])quotes[s]={...raw[key],symbol:s};});
  return NextResponse.json({ok:true,provider:"Biquote · MetaTrader 5 (Broker 1)",quotes,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store, max-age=0"}});
 } catch(e) { return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Market data unavailable",quotes:{}},{status:502}); }
}