"use client";
import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import {HubConnectionBuilder,LogLevel,HubConnection} from "@microsoft/signalr";
import {createChart,ColorType,CrosshairMode} from "lightweight-charts";

type Quote={symbol:string;bid:number;ask:number;mid:number;spread:number;dayDiffPercent?:number;marketState?:string;quoteAgeSeconds?:number;stale?:boolean};
type Bar={time:number;open:number;high:number;low:number;close:number;volume:number;tickVolume:number};
type TF="1s"|"1m"|"5m"|"15m"|"1h"|"4h"|"1d";
const GROUPS:[string,string[]][]=[["Forex",["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD"]],["Metals",["XAUUSD","XAGUSD"]],["Indices",["US500","NAS100","US30"]],["Stocks",["AAPL","MSFT","NVDA","TSLA"]]];
const SYMBOLS=GROUPS.flatMap(g=>g[1]);
const TFS:TF[]=["1s","1m","5m","15m","1h","4h","1d"];
const API_TF:Record<string,string>={"1m":"1m","5m":"5m","15m":"15m","1h":"1h","4h":"4h","1d":"1d"};
const SECS:Record<TF,number>={"1s":1,"1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400};
const PROGRAMS=["High Stakes — New","High Stakes — Classic","Hyper Growth","Pro Growth","Bootcamp","Futures"];
const SIZES=[5000,10000,25000,50000,100000,250000,500000];
const alias=(s:string)=>s==="NAS100"?"USTEC":s;
const num=(v:number|undefined,d=2)=>v===undefined||!Number.isFinite(v)?"—":v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const price=(s:string,v:number|undefined)=>num(v,s.includes("JPY")||s.startsWith("XAU")||s.startsWith("XAG")||s.startsWith("US")?2:5);
const timeOf=(v:any)=>{if(typeof v==="number")return Math.floor(v>1e12?v/1000:v);if(typeof v==="string"){const n=Date.parse(v);if(Number.isFinite(n))return Math.floor(n/1000);}return Math.floor(Date.now()/1000);};
function ema(v:number[],p:number){if(!v.length)return[];const k=2/(p+1);let x=v[0];return v.map((n,i)=>{x=i===0?n:n*k+x*(1-k);return x;});}
function sma(v:number[],p:number){return v.map((_,i)=>i+1<p?NaN:v.slice(i+1-p,i+1).reduce((a,b)=>a+b,0)/p);}
function bb(v:number[]){const m=sma(v,20),u:number[]=[],l:number[]=[];v.forEach((_,i)=>{if(i<19){u.push(NaN);l.push(NaN);return;}const a=v.slice(i-19,i+1),sd=Math.sqrt(a.reduce((x,n)=>x+Math.pow(n-m[i],2),0)/20);u.push(m[i]+2*sd);l.push(m[i]-2*sd);});return{m,u,l};}
function rsi(v:number[]){if(v.length<15)return NaN;let g=0,l=0;for(let i=v.length-14;i<v.length;i++){const d=v[i]-v[i-1];if(d>0)g+=d;else l-=d;}return l===0?100:100-100/(1+(g/14)/(l/14));}
function macd(v:number[]){if(v.length<26)return{line:NaN,signal:NaN};const a=ema(v,12),b=ema(v,26),line=a.map((x,i)=>x-b[i]),sig=ema(line,9),i=v.length-1;return{line:line[i],signal:sig[i]};}

function CandleChart({symbol,tf,onTf,onStream}:{symbol:string;tf:TF;onTf:(t:TF)=>void;onStream:(s:string)=>void}) {
 const host=useRef<HTMLDivElement|null>(null),chart=useRef<any>(null),candle=useRef<any>(null),vol=useRef<any>(null);
 const e20=useRef<any>(null),s50=useRef<any>(null),bu=useRef<any>(null),bl=useRef<any>(null),bm=useRef<any>(null);
 const dataRef=useRef<Bar[]>([]);
 const [bars,setBars]=useState<Bar[]>([]),[loading,setLoading]=useState(true),[status,setStatus]=useState("CONNECTING"),[error,setError]=useState("");
 const [ind,setInd]=useState({ema:true,sma:false,bb:false,rsi:true,macd:true});
 const closes=useMemo(()=>bars.map(b=>b.close),[bars]),ev=useMemo(()=>ema(closes,20),[closes]),sv=useMemo(()=>sma(closes,50),[closes]),bands=useMemo(()=>bb(closes),[closes]),rv=useMemo(()=>rsi(closes),[closes]),mv=useMemo(()=>macd(closes),[closes]);
 const realVol=bars.some(b=>b.volume>0);
 useEffect(()=>{if(!host.current||chart.current)return;const c=createChart(host.current,{width:host.current.clientWidth,height:390,layout:{background:{type:ColorType.Solid,color:"#0a1220"},textColor:"#91a4bd",fontFamily:"Inter,system-ui,sans-serif"},grid:{vertLines:{color:"#172438"},horzLines:{color:"#172438"}},crosshair:{mode:CrosshairMode.Normal},rightPriceScale:{borderColor:"#22334a"},timeScale:{borderColor:"#22334a",timeVisible:true,secondsVisible:tf==="1s"}});chart.current=c;candle.current=c.addCandlestickSeries({upColor:"#20c997",downColor:"#f05d6c",borderUpColor:"#20c997",borderDownColor:"#f05d6c",wickUpColor:"#20c997",wickDownColor:"#f05d6c"});vol.current=c.addHistogramSeries({priceFormat:{type:"volume"},priceScaleId:"volume",lastValueVisible:false,priceLineVisible:false});c.priceScale("volume").applyOptions({scaleMargins:{top:.82,bottom:0}});e20.current=c.addLineSeries({color:"#f6bd60",lineWidth:2,title:"EMA 20",priceLineVisible:false,lastValueVisible:false});s50.current=c.addLineSeries({color:"#65a9ff",lineWidth:2,title:"SMA 50",priceLineVisible:false,lastValueVisible:false});bu.current=c.addLineSeries({color:"#b48ead",lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false});bl.current=c.addLineSeries({color:"#b48ead",lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false});bm.current=c.addLineSeries({color:"#8d79b8",lineWidth:1,priceLineVisible:false,lastValueVisible:false});const ro=new ResizeObserver(es=>{const w=es[0]?.contentRect.width;if(w)chart.current?.applyOptions({width:w});});ro.observe(host.current);return()=>{ro.disconnect();c.remove();chart.current=null;};},[]);
 useEffect(()=>{const c=chart.current;if(!c)return;const cd=bars.map(b=>({time:b.time as any,open:b.open,high:b.high,low:b.low,close:b.close}));const vd=bars.map(b=>({time:b.time as any,value:b.volume>0?b.volume:b.tickVolume,color:b.close>=b.open?"rgba(32,201,151,.38)":"rgba(240,93,108,.38)"}));const line=(a:number[])=>bars.map((b,i)=>({time:b.time as any,value:a[i]})).filter(p=>Number.isFinite(p.value));candle.current.setData(cd);vol.current.setData(vd);e20.current.setData(ind.ema?line(ev):[]);s50.current.setData(ind.sma?line(sv):[]);bu.current.setData(ind.bb?line(bands.u):[]);bl.current.setData(ind.bb?line(bands.l):[]);bm.current.setData(ind.bb?line(bands.m):[]);},[bars,ind,ev,sv,bands]);
 useEffect(()=>{
  let alive=true;
  let timer:ReturnType<typeof setTimeout>|null=null;
  let lastTickKey="";
  const sym=alias(symbol);
  dataRef.current=[];
  setBars([]);
  setError("");
  setLoading(true);
  setStatus("CONNECTING");
  onStream("CONNECTING");
  const addTick=(tick:any)=>{
   if(!alive||(tick.symbol&&tick.symbol!==sym&&tick.symbol!==symbol))return;
   const bid=Number(tick.bid),ask=Number(tick.ask);
   const p=Number(tick.mid??(bid>0&&ask>0?(bid+ask)/2:tick.price??tick.last));
   if(!Number.isFinite(p)||p<=0)return;
   const stamp=timeOf(tick.timestamp??tick.time);
   const key=String(tick.timestamp??stamp)+"|"+p;
   if(key===lastTickKey)return;
   lastTickKey=key;
   const sec=SECS[tf],bucket=Math.floor(stamp/sec)*sec,old=dataRef.current,last=old[old.length-1];
   let next:Bar[];
   if(!last||bucket>last.time)next=[...old,{time:bucket,open:p,high:p,low:p,close:p,volume:0,tickVolume:1}].slice(-500);
   else if(bucket===last.time)next=[...old.slice(0,-1),{...last,high:Math.max(last.high,p),low:Math.min(last.low,p),close:p,tickVolume:last.tickVolume+1}];
   else return;
   dataRef.current=next;
   setBars(next);
  };
  const seedSeconds=(ticks:any[])=>{
   const bySecond=new Map<number,Bar>();
   ticks.forEach(t=>{
    const p=Number(t.mid??(Number(t.bid)>0&&Number(t.ask)>0?(Number(t.bid)+Number(t.ask))/2:t.price??t.last));
    if(!Number.isFinite(p)||p<=0)return;
    const stamp=timeOf(t.timestamp??t.time),bucket=stamp;
    const found=bySecond.get(bucket);
    if(!found)bySecond.set(bucket,{time:bucket,open:p,high:p,low:p,close:p,volume:0,tickVolume:1});
    else{found.high=Math.max(found.high,p);found.low=Math.min(found.low,p);found.close=p;found.tickVolume+=1;}
   });
   const seeded=Array.from(bySecond.values()).sort((a,b)=>a.time-b.time).slice(-500);
   dataRef.current=seeded;
   setBars(seeded);
  };
  const load=async(includeHistory:boolean)=>{
   const response=await fetch("/api/ticks/"+symbol+"?history="+(includeHistory?"1":"0"),{cache:"no-store"});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||"Tick snapshot unavailable");
   if(includeHistory&&tf==="1s")seedSeconds(payload.ticks||[]);
   if(payload.latest)addTick(payload.latest);
  };
  const poll=async()=>{
   if(!alive)return;
   try{
    await load(false);
    if(alive){setStatus("POLLING");onStream("POLLING");}
   }catch(e){
    if(alive){setStatus("DEGRADED");onStream("DEGRADED");setError(e instanceof Error?e.message:"Market tick request failed");}
   }finally{
    if(alive)timer=setTimeout(poll,1000);
   }
  };
  (async()=>{
   try{
    if(tf!=="1s"){
     const response=await fetch("/api/candles/"+symbol+"?interval="+API_TF[tf]+"&limit=300",{cache:"no-store"});
     const payload=await response.json();
     if(!response.ok)throw new Error(payload.error||"Candle history unavailable");
     const parsed:Bar[]=(payload.bars||[]).map((b:any)=>({time:Math.floor(Date.parse(b.openTime)/1000),open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume||0),tickVolume:Number(b.tickVolume||0)})).filter((b:Bar)=>Number.isFinite(b.time)&&Number.isFinite(b.close)).sort((a:Bar,b:Bar)=>a.time-b.time);
     if(alive){dataRef.current=parsed;setBars(parsed);}
    }
    await load(tf==="1s");
    if(alive){setLoading(false);setStatus("POLLING");onStream("POLLING");}
   }catch(e){
    if(alive){setLoading(false);setStatus("DEGRADED");onStream("DEGRADED");setError(e instanceof Error?e.message:"Unable to load market data");}
   }
   poll();
  })();
  return()=>{alive=false;if(timer)clearTimeout(timer);};
 },[symbol,tf,onStream]);
 const lineToggle=(key:keyof typeof ind)=>setInd(v=>({...v,[key]:!v[key]}));
 return <div className="chart-shell">
  <div className="chart-toolbar"><div className="chart-toolbar-left"><b className="symbol-big">{symbol}</b><span className={"stream-pill "+(status==="STREAMING"?"good":status==="RECONNECTING"?"warn":"muted")}><i/>{status}</span>{tf==="1s"&&<small className="micro-note">1-second bars aggregated from provider tick history</small>}</div><div className="timeframes">{TFS.map(t=><button key={t} className={tf===t?"active":""} onClick={()=>onTf(t)}>{t.toUpperCase()}</button>)}</div></div>
  <div className="indicator-row"><button className={ind.ema?"indicator active":"indicator"} onClick={()=>lineToggle("ema")}>EMA 20</button><button className={ind.sma?"indicator active":"indicator"} onClick={()=>lineToggle("sma")}>SMA 50</button><button className={ind.bb?"indicator active":"indicator"} onClick={()=>lineToggle("bb")}>Bollinger</button><i className="indicator-divider"/><span className="indicator-value">RSI(14) <b>{Number.isFinite(rv)?num(rv,1):"—"}</b></span><span className="indicator-value">MACD <b>{Number.isFinite(mv.line)?num(mv.line,4):"—"}</b></span><span className="indicator-value">Signal <b>{Number.isFinite(mv.signal)?num(mv.signal,4):"—"}</b></span></div>
  <div className="chart-meta"><span>{bars.length} candles loaded</span><span>{realVol?"Provider volume":"Tick count only · traded volume not supplied"}</span><span>Biquote MT5 feed</span></div>
  <div className="chart-stage"><div ref={host} className="chart-canvas"/>{loading&&<div className="chart-overlay">Loading historical candles…</div>}{!loading&&tf==="1s"&&!bars.length&&<div className="chart-overlay">Waiting for first live tick to build 1-second candles…</div>}{!loading&&error&&<div className="chart-error">{error}</div>}</div>
  <div className="chart-footer"><span><i className="dot green"/>Up candle</span><span><i className="dot red"/>Down candle</span><span>Mid-price snapshots · provider timestamps</span></div>
 </div>;
}

export default function Home(){
 const [tab,setTab]=useState("Terminal"),[selected,setSelected]=useState("XAUUSD"),[tf,setTf]=useState<TF>("1m"),[quotes,setQuotes]=useState<Record<string,Quote>>({}),[market,setMarket]=useState("CONNECTING"),[stream,setStream]=useState("CONNECTING"),[side,setSide]=useState<"BUY"|"SELL">("BUY"),[lots,setLots]=useState("0.10"),[orders,setOrders]=useState<any[]>([]),[size,setSize]=useState(5000),[program,setProgram]=useState(PROGRAMS[0]),[notice,setNotice]=useState(""),[mobile,setMobile]=useState(false);
 const quote=quotes[selected],streamCb=useCallback((s:string)=>setStream(s),[]);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch("/api/market",{cache:"no-store"});const d=await r.json();if(!active)return;if(d.ok){setQuotes(d.quotes||{});setMarket("CONNECTED");}else setMarket("DEGRADED");}catch{if(active)setMarket("OFFLINE");}};load();const id=setInterval(load,1500);return()=>{active=false;clearInterval(id);};},[]);
 const place=()=>{if(!quote?.mid){setNotice("No current quote for this instrument.");return;}setOrders(a=>[{id:Date.now(),side,symbol:selected,price:quote.mid,lots,time:new Date().toLocaleTimeString()},...a].slice(0,20));setNotice("Demo practice order saved locally. No broker order was sent.");};
 const group=GROUPS.find(g=>g[1].includes(selected))?.[0]||"Markets";
 return <main className="app">
 <header className="topbar"><button className="mobile-menu" onClick={()=>setMobile(!mobile)}>☰</button><div className="brand-mark">A</div><div className="brand-copy"><strong>AGMT <span>APEX</span></strong><small>AI & GLOBAL MARKET TRADER</small></div><div className="top-spacer"/><div className="demo-chip"><i/>DEMO ENVIRONMENT</div><div className="top-divider"/><div className="market-chip"><i className={market==="CONNECTED"?"status-dot live":"status-dot"}/>MARKET API {market}</div></header>
 <div className="app-layout"><aside className={"sidebar "+(mobile?"open":"")}><div className="nav-label">WORKSPACE</div>{["Terminal","Challenges","My Account","Rules"].map(x=><button key={x} className={"nav-item "+(tab===x?"selected":"")} onClick={()=>{setTab(x);setMobile(false);}}><span className="nav-icon">{x==="Terminal"?"⌁":x==="Challenges"?"◇":x==="My Account"?"◎":"≡"}</span>{x}{x==="Terminal"&&<span className="nav-live">LIVE</span>}</button>)}<div className="sidebar-bottom"><div className="side-card"><div className="side-card-kicker">MARKET FEED</div><strong>{market}</strong><small>Biquote · MetaTrader 5</small><small>Indicative third-party quotes</small></div><div className="sidebar-version">AGMT APEX · BUILD 02</div></div></aside>
 <section className="main-content">
 {tab==="Terminal"&&<><div className="page-heading"><div><div className="eyebrow">MARKET WORKSPACE / {group.toUpperCase()}</div><h1>Trading Terminal</h1><p>Analyse global markets with live indicative quotes and demo practice tools.</p></div><div className="heading-right"><span className="market-live"><i/>MARKET DATA {market}</span><small>Market watch refreshes every ~1.5s</small></div></div>
 <div className="market-strip"><div><span>SELECTED INSTRUMENT</span><strong>{selected}</strong><small>{quote?.marketState==="closed"?"MARKET CLOSED · LAST PRICE":"INDICATIVE MT5 QUOTE"}</small></div><div><span>MID PRICE</span><strong>{price(selected,quote?.mid)}</strong><small className={(quote?.dayDiffPercent||0)>=0?"positive":"negative"}>{quote?.dayDiffPercent===undefined?"—":(quote.dayDiffPercent>=0?"+":"")+num(quote.dayDiffPercent,2)+"% today"}</small></div><div><span>BID / ASK</span><strong>{price(selected,quote?.bid)} / {price(selected,quote?.ask)}</strong><small>Spread {num(quote?.spread,5)}</small></div><div><span>CHART STREAM</span><strong className="stream-text">{stream}</strong><small>REST snapshot polling · ~1s</small></div></div>
 <div className="terminal-grid"><div className="left-column"><div className="panel market-watch"><div className="panel-head"><div><h2>Market Watch</h2><small>16 instruments · select to chart</small></div><span className="live-label"><i/>LIVE</span></div><div className="watch-groups">{GROUPS.map(([g,items])=><div key={g}><div className="watch-group-title">{g}</div>{items.map(s=>{const q=quotes[s];return <button key={s} className={"watch-row "+(selected===s?"active":"")} onClick={()=>setSelected(s)}><span className="watch-symbol">{s}</span><span className="watch-price">{price(s,q?.mid)}</span><span className={(q?.dayDiffPercent||0)>=0?"positive":"negative"}>{q?.dayDiffPercent===undefined?"—":(q.dayDiffPercent>=0?"+":"")+num(q.dayDiffPercent,2)+"%"}</span></button>;})}</div>)}</div></div>
 <div className="panel order-panel"><div className="panel-head"><div><h2>Demo Order Ticket</h2><small>Practice only · no broker execution</small></div><span className="demo-tag">DEMO</span></div><div className="order-symbol"><span>{selected}</span><strong>{price(selected,quote?.mid)}</strong></div><div className="side-switch"><button className={side==="BUY"?"buy selected":"buy"} onClick={()=>setSide("BUY")}>BUY</button><button className={side==="SELL"?"sell selected":"sell"} onClick={()=>setSide("SELL")}>SELL</button></div><label className="field-label">VOLUME (LOTS)</label><input value={lots} onChange={e=>setLots(e.target.value)} inputMode="decimal"/><button className="place-order" onClick={place}>Place demo {side}</button><p className="fine-print">Orders remain in this browser session and are not sent to a broker.</p>{notice&&<div className="notice">{notice}</div>}</div></div>
 <div className="right-column"><div className="panel chart-panel"><CandleChart symbol={selected} tf={tf} onTf={setTf} onStream={streamCb}/></div><div className="panel recent-orders"><div className="panel-head"><div><h2>Recent Demo Orders</h2><small>Local practice activity</small></div><span className="order-count">{orders.length} orders</span></div>{!orders.length?<div className="empty-state">No demo orders yet. Choose BUY or SELL to practise.</div>:<div className="order-table"><div className="order-table-head"><span>Side / Symbol</span><span>Lots</span><span>Entry</span><span>Time</span></div>{orders.slice(0,6).map(o=><div className="order-table-row" key={o.id}><span className={o.side==="BUY"?"positive":"negative"}>{o.side} · {o.symbol}</span><span>{o.lots}</span><span>{price(o.symbol,o.price)}</span><span>{o.time}</span></div>)}</div>}</div></div></div></>}
 {tab==="Challenges"&&<div className="content-page"><div className="page-heading"><div><div className="eyebrow">AGMT PROGRAMS</div><h1>Trading Challenges</h1><p>Explore evaluation formats and account sizes. Checkout is disabled pending payment and legal verification.</p></div><span className="pending-tag">CHECKOUT PENDING</span></div><div className="challenge-controls"><div><label>PROGRAM</label><select value={program} onChange={e=>setProgram(e.target.value)}>{PROGRAMS.map(p=><option key={p}>{p}</option>)}</select></div><div><label>ACCOUNT SIZE</label><select value={size} onChange={e=>setSize(Number(e.target.value))}>{SIZES.map(s=><option key={s} value={s}>{"$"+s.toLocaleString("en-US")}</option>)}</select></div></div><div className="challenge-grid">{PROGRAMS.map((p,i)=><div className={"challenge-card "+(program===p?"chosen":"")} key={p} onClick={()=>setProgram(p)}><div className="challenge-index">0{i+1}</div><h3>{p}</h3><p>{["Two-step evaluation structure","Classic evaluation pathway","Accelerated growth model","Professional growth pathway","Structured bootcamp evaluation","Futures-focused evaluation format"][i]}</p><div className="challenge-size">Selected size <strong>{"$"+size.toLocaleString("en-US")}</strong></div><button disabled>Purchase unavailable</button></div>)}</div><div className="notice wide">Program names and risk rules are draft configuration. No paid challenge, funded account or payout is currently offered through this demo.</div></div>}
 {tab==="My Account"&&<div className="content-page"><div className="page-heading"><div><div className="eyebrow">ACCOUNT OVERVIEW</div><h1>My Account</h1><p>Demo account summary and practice activity.</p></div><span className="demo-tag large">DEMO ACCOUNT</span></div><div className="account-grid"><div className="account-card balance"><span>DEMO BALANCE</span><strong>$10,000.00</strong><small>Simulated starting balance</small></div><div className="account-card"><span>DAILY LOSS LIMIT</span><strong>5%</strong><small>$500 from starting balance</small></div><div className="account-card"><span>MAXIMUM LOSS LIMIT</span><strong>10%</strong><small>$1,000 from starting balance</small></div><div className="account-card"><span>DEMO ORDERS</span><strong>{orders.length}</strong><small>Local session activity</small></div></div><div className="panel account-history"><div className="panel-head"><div><h2>Practice History</h2><small>Orders created in this browser session</small></div></div>{!orders.length?<div className="empty-state">Your demo activity will appear here.</div>:orders.map(o=><div className="history-row" key={o.id}><b className={o.side==="BUY"?"positive":"negative"}>{o.side}</b><span>{o.symbol}</span><span>{o.lots} lots</span><span>{price(o.symbol,o.price)}</span><span>{o.time}</span></div>)}</div></div>}
 {tab==="Rules"&&<div className="content-page"><div className="page-heading"><div><div className="eyebrow">RISK & PLATFORM DISCLOSURE</div><h1>Trading Rules</h1><p>Demo configuration for education and practice. Not a live funding agreement.</p></div><span className="demo-tag large">DRAFT RULES</span></div><div className="rules-grid"><div className="rule-card"><span>01 · DAILY LOSS</span><strong>5%</strong><p>Demo daily loss threshold. Production calculations must define equity/balance basis, reset timezone and floating-loss treatment.</p></div><div className="rule-card"><span>02 · MAXIMUM LOSS</span><strong>10%</strong><p>Demo maximum loss threshold. Production rules require a documented static or trailing drawdown method.</p></div><div className="rule-card"><span>03 · EXECUTION</span><strong>DEMO ONLY</strong><p>Practice orders are local UI records. No broker account is connected and no real trades are placed.</p></div><div className="rule-card"><span>04 · PAYMENTS</span><strong>DISABLED</strong><p>Challenge checkout and payouts are unavailable pending payment provider, KYC/AML and legal review.</p></div></div><div className="notice wide">Market prices are indicative third-party MT5 quotes for analysis and demo practice. They are not AGMT broker execution prices or an offer of investment services.</div></div>}
 <footer className="app-footer"><span>AGMT APEX · LEARN · ANALYSE · PRACTISE</span><span>Indicative third-party market data · Demo environment only</span></footer>
 </section></div></main>;
}