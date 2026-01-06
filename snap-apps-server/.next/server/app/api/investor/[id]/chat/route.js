(()=>{var a={};a.id=541,a.ids=[541],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},82882:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>J,patchFetch:()=>I,routeModule:()=>E,serverHooks:()=>H,workAsyncStorage:()=>F,workUnitAsyncStorage:()=>G});var d={};c.r(d),c.d(d,{GET:()=>z,POST:()=>A,dynamic:()=>C,maxDuration:()=>D,runtime:()=>B});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(94364),w=c(79461);let x=["TinyFish","Statsig","Adaptive ML","Pinecone","Groww","Spotnana","Unit21","Reprise","Highspot","Sendbird"],y={"f47ac10b-58cc-4372-a567-0e02b2c3d479":"Ryan Koh"};async function z(a,{params:b}){try{let{id:a}=await b,c=y[a]||"Investor",d=await (0,w.OQ)(a);return d||(d=await (0,w.EV)(a,c)),u.NextResponse.json({success:!0,data:{messages:d.conversationHistory,stage:d.stage,canCreateSnapApp:(0,w.Ax)(d),searchCount:d.searchCount,snapAppCount:d.snapAppCount}})}catch(a){return console.error("Failed to get chat history:",a),u.NextResponse.json({success:!1,error:"Failed to retrieve conversation"},{status:500})}}async function A(a,{params:b}){try{let{id:c}=await b,{message:d}=await a.json();if(!d||"string"!=typeof d)return u.NextResponse.json({success:!1,error:"Message is required"},{status:400});let e=process.env.GOOGLE_GEMINI_API_KEY||process.env.GEMINI_API_KEY;if(!e)return u.NextResponse.json({success:!1,error:"AI service not configured"},{status:500});let f=y[c]||"Investor";f.split(" ")[0];let g=await (0,w.OQ)(c);g||(g=await (0,w.EV)(c,f));let h=await (0,w.d7)(c);await (0,w.kw)(c,{role:"user",content:d});let i=new v.ij(e),j=i.getGenerativeModel({model:"gemini-2.0-flash-exp",generationConfig:{temperature:.7,maxOutputTokens:2048}}),k=`You are Mino, a portfolio intelligence agent for ${f} at ICONIQ Capital.

Current user state:
- Stage: ${g.stage}
- Search count: ${g.searchCount}
- Can create Snap Apps: ${(0,w.Ax)(g)}
- Current preferences: ${JSON.stringify(h?.briefSchedule||{})}

Portfolio companies: ${x.join(", ")}

The user said: "${d}"

Analyze the intent and respond accordingly:

1. If they want to SEARCH/FIND INFO about companies, news, or market data:
   - Intent: "search"
   - Use Google Search to find relevant information
   - Provide concise, actionable insights

2. If they want to CREATE A SNAP APP (dashboard):
   - Intent: "create_app"
   - If searchCount is 0, gently redirect them to search first
   - Only allow if they've done at least one search

3. If they want to CHANGE SETTINGS (brief time, notifications, etc):
   - Intent: "settings"
   - Parse the requested setting change
   - Confirm the change

4. If they need HELP or general questions:
   - Intent: "help" or "general"
   - Be warm but professional, like a trusted advisor

IMPORTANT STYLE:
- Be concise and direct, like a senior analyst
- Use bullet points for multiple items
- No emojis
- Reference specific companies when relevant
- Sound like Bloomberg Terminal meets a trusted colleague

Respond with JSON:
{
  "intent": "search" | "create_app" | "settings" | "help" | "general",
  "response": "Your message to the user",
  "searchQuery": "If intent is search, the optimized search query",
  "settingsUpdate": { ... } // If intent is settings, the changes to make
}`,l=(await j.generateContent(k)).response.text().match(/\{[\s\S]*\}/),m={intent:"general",response:"I'm here to help. What would you like to know about your portfolio?"};if(l)try{m=JSON.parse(l[0])}catch{console.error("Failed to parse intent JSON")}let n=m.response,o={intent:m.intent,canCreateApp:(0,w.Ax)(g)};if("search"===m.intent&&m.searchQuery){let a=i.getGenerativeModel({model:"gemini-2.0-flash-exp",generationConfig:{temperature:.3,maxOutputTokens:4096}}),b=`Search for recent information about: ${m.searchQuery}

Focus on:
- Recent news and developments (last 7 days)
- Market movements and competitive intelligence
- Key insights relevant for an investor

Portfolio context: ${x.join(", ")}

Provide a concise, bullet-pointed summary with sources. Be direct and analytical.`;n=(await a.generateContent({contents:[{role:"user",parts:[{text:b}]}],tools:[{googleSearch:{}}]})).response.text(),await (0,w.AN)(c,m.searchQuery),g=await (0,w.OQ)(c),o.searchResults={query:m.searchQuery},o.canCreateApp=!!g&&(0,w.Ax)(g),g&&1===g.searchCount&&(n+=`

---

You've completed your first search. You can now create **Snap Apps** - live dashboards that track insights like this automatically. Just say "create a snap app" when you're ready.`)}if("create_app"===m.intent&&(g&&(0,w.Ax)(g)?(n=`Ready to create a Snap App from your recent searches.

**What would you like to track?**

• **Company Monitor** - Track news and developments for specific portfolio companies
• **Competitive Intel** - Monitor competitors and market movements
• **Deal Flow** - Track funding rounds and M&A in your sectors

Describe what you'd like, and I'll set it up.`,await (0,w.g)(c)):(n=`Before creating a Snap App, I'd like to understand what you're interested in tracking.

Try searching for something first - for example:
- "What's happening with Pinecone?"
- "Latest AI infrastructure news"
- "Competitive analysis for Sendbird"

Once I understand your interests, I can help you create a dashboard that updates automatically.`,o.intent="general")),"settings"===m.intent&&m.settingsUpdate){let a={};m.settingsUpdate.briefTime&&(a.briefSchedule={...h?.briefSchedule,time:m.settingsUpdate.briefTime}),void 0!==m.settingsUpdate.briefEnabled&&(a.briefSchedule={...h?.briefSchedule,enabled:m.settingsUpdate.briefEnabled}),void 0!==m.settingsUpdate.criticalAlerts&&(a.notifications={...h?.notifications,criticalAlerts:m.settingsUpdate.criticalAlerts}),Object.keys(a).length>0&&(await (0,w.U_)(c,a),o.settingsChanged=a)}await (0,w.kw)(c,{role:"assistant",content:n,metadata:o});let p=await (0,w.OQ)(c);return u.NextResponse.json({success:!0,data:{response:n,intent:o.intent,canCreateSnapApp:!!p&&(0,w.Ax)(p),searchCount:p?.searchCount||0,stage:p?.stage||"new"}})}catch(a){return console.error("Chat API error:",a),u.NextResponse.json({success:!1,error:a instanceof Error?a.message:"Chat failed"},{status:500})}}let B="nodejs",C="force-dynamic",D=60,E=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/investor/[id]/chat/route",pathname:"/api/investor/[id]/chat",filename:"route",bundlePath:"app/api/investor/[id]/chat/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/marioelysian/imessage-mino-bot/snap-apps-server/src/app/api/investor/[id]/chat/route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:F,workUnitAsyncStorage:G,serverHooks:H}=E;function I(){return(0,g.patchFetch)({workAsyncStorage:F,workUnitAsyncStorage:G})}async function J(a,b,c){var d;let e="/api/investor/[id]/chat/route";"/index"===e&&(e="/");let g=await E.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:C}=g,D=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[D]||y.routes[C]);if(F&&!x){let a=!!y.routes[C],b=y.dynamicRoutes[D];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||E.isDev||x||(G="/index"===(G=C)?"/":G);let H=!0===E.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>E.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>E.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await E.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await E.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await E.onRequestError(a,b,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},96487:()=>{}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[586,692,762,364,461],()=>b(b.s=82882));module.exports=c})();