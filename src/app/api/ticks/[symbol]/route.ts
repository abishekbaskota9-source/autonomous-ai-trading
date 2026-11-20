import { NextResponse } from "next/server";
const ALLOWED=new Set(["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","XAUUSD","XAGUSD","US500","NAS100","US30","AAPL","MSFT","NVDA","TSLA"]);
const alias=(s:string)=>s==="NAS100"?"USTEC":s;
export async function GET(request:Request,context:{params:Promise<{symbol:string}>}) {
 try {
  const {symbol:raw}=await context.params;
  const symbol=raw.toUpperCase();
  if(!ALLOWED.has(symbol))return NextResponse.json({error:"Unsupported symbol"},{status:400});
  const url=new URL(request.url);
  const includeHistory=url.searchParams.get("history")!=="0";
  const upstreamSymbol=alias(symbol);
  const latestUrl="https://biquote.io/api/"+upstreamSymbol;
  const latestPromise=fetch(latestUrl,{cache:"no-store",headers:{"Accept":"application/json"}});
  const historyPromise=includeHistory?fetch("https://biquote.io/api/"+upstreamSymbol+"/history?count=1000",{cache:"no-store",headers:{"Accept":"application/json"}}):Promise.resolve(null);
  const [latestResponse,historyResponse]=await Promise.all([latestPromise,historyPromise]);
  if(!latestResponse.ok)return NextResponse.json({error:"Latest tick provider returned "+latestResponse.status},{status:502});
  const latest=await latestResponse.json();
  let ticks:unknown[]=[];
  if(historyResponse?.ok){const data=await historyResponse.json();if(Array.isArray(data))ticks=data;}
  return NextResponse.json({symbol,latest:{...latest,symbol},ticks,provider:"Biquote · MetaTrader 5 (Broker 1)",pollIntervalMs:1000},{headers:{"Cache-Control":"no-store, max-age=0"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Tick feed unavailable"},{status:502});}
}