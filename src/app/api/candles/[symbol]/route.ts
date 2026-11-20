import { NextResponse } from "next/server";
const ALLOWED=new Set(["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","XAUUSD","XAGUSD","US500","NAS100","US30","AAPL","MSFT","NVDA","TSLA"]);
const alias=(s:string)=>s==="NAS100"?"USTEC":s;
const intervals=new Set(["1m","5m","15m","30m","1h","4h","1d"]);
export async function GET(request:Request,context:{params:Promise<{symbol:string}>}) {
 try {
  const {symbol:raw}=await context.params; const symbol=raw.toUpperCase();
  if(!ALLOWED.has(symbol)) return NextResponse.json({error:"Unsupported symbol"},{status:400});
  const url=new URL(request.url); const interval=url.searchParams.get("interval")||"1m";
  const limit=Math.max(20,Math.min(1000,Number(url.searchParams.get("limit")||300)));
  if(!intervals.has(interval)) return NextResponse.json({error:"Unsupported candle interval"},{status:400});
  const upstream=new URL("https://biquote.io/api/"+alias(symbol)+"/ohlc");
  upstream.searchParams.set("interval",interval); upstream.searchParams.set("limit",String(limit));
  const response=await fetch(upstream.toString(),{cache:"no-store",headers:{"Accept":"application/json"}});
  if(!response.ok) return NextResponse.json({error:"Candle provider returned "+response.status,bars:[]},{status:502});
  const data=await response.json();
  return NextResponse.json({symbol,interval,bars:Array.isArray(data.bars)?data.bars:[],provider:"Biquote · MetaTrader 5 (Broker 1)"},{headers:{"Cache-Control":"no-store, max-age=0"}});
 } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:"Candle data unavailable",bars:[]},{status:502}); }
}