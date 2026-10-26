/* ================= helpers ================= */
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const seg=(t,a,b)=>clamp((t-a)/(b-a));
const lerp=(a,b,k)=>a+(b-a)*k;
const eOut=k=>1-Math.pow(1-k,3);
const eInOut=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
const eBack=(k,s=1.25)=>{const c=s+1;return 1+c*Math.pow(k-1,3)+s*Math.pow(k-1,2)};
const spring=k=>k<=0?0:k>=1?1:1-Math.exp(-6.5*k)*Math.cos(5.2*k);
const css=getComputedStyle(document.documentElement);
const C=n=>css.getPropertyValue('--'+n).trim();
const NS='http://www.w3.org/2000/svg';
function h(tag,attrs={},parent){const el=document.createElement(tag);
  for(const[k,v]of Object.entries(attrs)){if(k==='style')Object.assign(el.style,v);else if(k==='html')el.innerHTML=v;else el.setAttribute(k,v)}
  if(parent)parent.appendChild(el);return el}
function s(tag,attrs={},parent){const el=document.createElementNS(NS,tag);
  for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(parent)parent.appendChild(el);return el}
function extrude(color,depth=14,amb=.22){const sh=[];for(let i=1;i<=depth;i++)sh.push(`0 ${i}px 0 ${color}`);
  sh.push(`0 ${depth+30}px 60px -18px rgba(0,0,0,${amb})`,`0 ${depth+8}px 18px -6px rgba(0,0,0,${amb*.6})`);return sh.join(',')}
function drawable(p){const L=p.getTotalLength();p.style.strokeDasharray=L;p.style.strokeDashoffset=L;p._L=L;return p}
function draw(p,k){p.style.strokeDashoffset=p._L*(1-clamp(k))}
function rng(seed){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646}}
function smoothPath(pts){let d=`M${pts[0][0]},${pts[0][1]}`;const n=pts.length;
  for(let i=0;i<n-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n-1,i+2)];
    d+=` C${p1[0]+(p2[0]-p0[0])/6},${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6},${p2[1]-(p3[1]-p1[1])/6} ${p2[0]},${p2[1]}`}return d}
// text reveal: fade + rise + blur
function reveal(el,k,dy=26,base=''){el.style.opacity=k;el.style.transform=`${base} translateY(${(1-k)*dy}px)`;el.style.filter=k<1?`blur(${(1-k)*8}px)`:'none'}
function pop(el,k,base=''){el.style.opacity=clamp(k*2);el.style.transform=`${base} scale(${Math.max(0,k)})`}
const cam=document.getElementById('cam');
function root(){return h('div',{class:'abs',style:{inset:0}},cam)}
function camPush(t,amt=.006){cam.style.transform=`scale(${1+t*amt})`}

/* 3D slab */
function slab(parent,{x,y,w,h:hh,color,dark,radius=48,depth=14,floor=true}){
  const wrap=h('div',{class:'abs',style:{left:x-w/2+'px',top:y-hh/2+'px',width:w+'px',height:hh+'px',transformStyle:'preserve-3d'}},parent);
  const fl=floor?h('div',{class:'floor',style:{width:w*1.05+'px',height:'70px',left:-w*.025+'px',top:hh+depth+12+'px'}},wrap):null;
  const card=h('div',{class:'card',style:{inset:0,borderRadius:radius+'px',boxShadow:extrude(dark,depth)}},wrap);
  const face=h('div',{class:'face',style:{background:color}},card);
  return{wrap,floor:fl,card,face}}
// flip-in transform for a slab
function slabIn(sl,t,at,{idle=true,rx0=55,ry0=-25}={}){const k=spring(seg(t,at,at+.85));
  const fl=idle?Math.sin((t+at)*1.5)*5:0;
  sl.wrap.style.opacity=clamp((t-at)/.18);
  sl.wrap.style.transform=`perspective(1800px) translateY(${lerp(120,0,k)+fl}px) rotateX(${lerp(rx0,4,k)}deg) rotateY(${lerp(ry0,-3,k)+(idle?Math.sin(t*.9+at)*1.5:0)}deg) scale(${lerp(.5,1,k)})`;
  if(sl.floor){sl.floor.style.opacity=k;sl.floor.style.transform=`translateY(${-fl+20}px)`}return k}

/* ================= icons (viewBox 0 0 100 100, stroke) ================= */
const ICONS={
  drop:['M50 12 C50 12 24 44 24 60 a26 26 0 0 0 52 0 C76 44 50 12 50 12 Z','M38 62 a12 12 0 0 0 12 12'],
  lock:['M26 46 h48 a4 4 0 0 1 4 4 v34 a4 4 0 0 1 -4 4 h-48 a4 4 0 0 1 -4 -4 v-34 a4 4 0 0 1 4 -4 z','M34 46 v-12 a16 16 0 0 1 32 0 v12','M50 62 v10'],
  tv:['M14 24 h72 a6 6 0 0 1 6 6 v42 a6 6 0 0 1 -6 6 h-72 a6 6 0 0 1 -6 -6 v-42 a6 6 0 0 1 6 -6 z','M36 92 h28','M50 78 v14','M30 60 v-6','M42 60 v-12','M54 60 v-18','M66 60 v-24'],
  pen:['M22 78 L30 62 L68 24 L76 32 L38 70 Z','M62 30 L70 38','M14 92 h30','M80 12 l6 -6','M86 22 l8 -2','M72 8 l2 -6'],
  count:['M18 30 v40','M34 30 v40','M50 30 v40','M66 30 v40','M10 62 L76 38','M86 30 v40'],
  replay:['M14 20 h56 a8 8 0 0 1 8 8 v28 a8 8 0 0 1 -8 8 h-36 l-14 12 v-12 h-6 a8 8 0 0 1 -8 -8 v-28 a8 8 0 0 1 8 -8 z','M58 42 a12 12 0 1 1 -4 -9','M56 26 l-2 8 l8 1'],
  review:['M24 12 h52 v76 h-52 z','M34 30 l5 5 l9 -10','M56 31 h12','M34 50 l5 5 l9 -10','M56 51 h12','M34 70 l5 5 l9 -10','M56 71 h12'],
  ask:['M14 18 h72 a8 8 0 0 1 8 8 v36 a8 8 0 0 1 -8 8 h-44 l-16 14 v-14 h-12 a8 8 0 0 1 -8 -8 v-36 a8 8 0 0 1 8 -8 z','M40 34 a10 10 0 1 1 14 9 c-4 2 -4 5 -4 8','M50 60 v1'],
  dna:['M30 8 C30 34 70 40 70 50 C70 60 30 66 30 92','M70 8 C70 34 30 40 30 50 C30 60 70 66 70 92','M38 22 h24','M36 78 h28','M42 36 h16','M42 64 h16'],
  bolt:['M56 6 L22 56 h26 l-8 38 l38 -54 h-28 z'],
  path:['M8 84 L36 40 L50 58 L70 26 L92 84 Z','M70 26 v-14 l12 5 l-12 5'],
  book:['M50 24 C40 16 22 14 10 18 v62 c12 -4 30 -2 40 6 c10 -8 28 -10 40 -6 v-62 c-12 -4 -30 -2 -40 6 z','M50 24 v62'],
  star:['M50 8 l11 26 l28 3 l-21 19 l6 28 l-24 -14 l-24 14 l6 -28 l-21 -19 l28 -3 z'],
  germ:['M50 30 a20 20 0 1 1 -0.1 0','M50 30 v-14','M50 70 v14','M30 50 h-14','M70 50 h14','M36 36 l-10 -10','M64 64 l10 10','M64 36 l10 -10','M36 64 l-10 10','M44 46 v1','M56 54 v1'],
  warn:['M50 10 L92 86 H8 Z','M50 38 v22','M50 72 v1'],
  heart:['M50 86 C20 64 8 48 8 32 a20 20 0 0 1 42 -6 a20 20 0 0 1 42 6 c0 16 -12 32 -42 54 z','M54 30 l-10 16 l12 6 l-10 18'],
  eye:['M6 50 C22 24 78 24 94 50 C78 76 22 76 6 50 Z','M50 36 a14 14 0 1 1 -0.1 0'],
  ear:['M66 84 C50 90 44 76 40 66 C34 54 22 50 22 34 a28 28 0 0 1 56 0 c0 14 -12 18 -12 30','M38 36 a12 12 0 0 1 24 0 c0 8 -8 10 -8 16'],
  build:['M20 92 V14 h40 v78','M60 40 h22 v52','M10 92 h82','M30 28 h4','M46 28 h4','M30 44 h4','M46 44 h4','M30 60 h4','M46 60 h4','M70 56 h4','M70 72 h4','M36 92 v-16 h8 v16'],
  target:['M50 10 a40 40 0 1 1 -0.1 0','M50 28 a22 22 0 1 1 -0.1 0','M50 46 a4 4 0 1 1 -0.1 0'],
  question:['M50 10 a40 40 0 1 1 -0.1 0','M38 40 a12 12 0 1 1 17 11 c-5 2 -5 6 -5 10','M50 72 v1'],
  noloop:['M50 14 a36 36 0 1 1 -32 20','M14 18 l4 16 l16 -4','M14 86 L86 14'],
  pulse:['M6 52 h22 l8 -22 l12 44 l10 -30 l6 8 h30'],
  clock:['M50 10 a40 40 0 1 1 -0.1 0','M50 26 v24 l16 10'],
  hand:['M30 92 V46 a6 6 0 0 1 12 0 v-24 a6 6 0 0 1 12 0 v22 a6 6 0 0 1 12 0 v6 a6 6 0 0 1 12 0 v24 c0 12 -8 18 -18 18 z'],
  sparkle:['M50 10 v80','M10 50 h80','M22 22 l56 56','M78 22 l-56 56'],
  pill:['M30 70 L70 30 a14 14 0 0 1 20 20 L50 90 a14 14 0 0 1 -20 -20 z','M50 50 l20 20'],
  speaker:['M14 38 h16 l22 -18 v60 l-22 -18 h-16 z'],
};
function icon(parent,name,{size=120,color='#121212',sw=6,x=0,y=0}={}){
  const svg=s('svg',{viewBox:'0 0 100 100',width:size,height:size,style:`position:absolute;left:${x}px;top:${y}px`},parent);
  const g=s('g',{fill:'none',stroke:color,'stroke-width':sw,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  const paths=ICONS[name].map(d=>drawable(s('path',{d},g)));
  return{svg,paths,draw(k){paths.forEach((p,i)=>draw(p,seg(k,i/paths.length*.5,.5+i/paths.length*.5)))}}}

/* ================= scene: big concept card + timed tags ================= */
function concept(o){
  const R=root(),W=620,H=620;
  const sl=slab(R,{x:960,y:470,w:W,h:H,color:C(o.color),dark:C(o.color+'-d'),radius:56,depth:16});
  const ink=o.ink||'#121212';
  const t1=h('div',{class:'title abs',style:{left:'60px',right:'60px',top:'66px',fontSize:'64px',color:ink,textAlign:'center'},html:`${o.l1}<br><b>${o.l2}</b>`},sl.face);
  const svg=s('svg',{viewBox:'-20 -20 240 240',width:380,height:380,style:'position:absolute;left:120px;top:236px'},sl.face);
  const ic=o.icon(svg,ink);
  const kick=o.kicker?h('div',{class:'chip abs',style:{left:'50%',top:'60px',fontSize:'30px',background:C('soft'),color:'#333',boxShadow:extrude(C('soft-d'),4,.08)},html:o.kicker},R):null;
  const tags=(o.tags||[]).map(([txt,at])=>({at,el:h('div',{class:'chip',style:{fontSize:'38px',background:'#121212',color:'#fff',boxShadow:extrude('#000',6,.18)},html:txt})}));
  const row=h('div',{class:'abs',style:{left:0,right:0,top:'905px',display:'flex',justifyContent:'center',gap:'22px'}},R);tags.forEach(x=>row.appendChild(x.el));
  return t=>{
    const k=slabIn(sl,t,0,{rx0:24,ry0:-38});
    reveal(t1,eOut(seg(t,.4,1)));
    if(kick)reveal(kick,eOut(seg(t,.15,.6)),-20,'translateX(-50%)');
    tags.forEach(x=>pop(x.el,eBack(seg(t,x.at,x.at+.35),1.8)));
    o.anim(ic,t);camPush(t)}}
function iconHead(svg,col){
  const g=s('g',{fill:'none',stroke:col,'stroke-width':7,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  const head=drawable(s('path',{d:'M58 168 L58 132 C34 118 24 96 26 72 C30 34 62 10 98 10 C138 10 168 40 168 78 C168 92 174 100 182 112 C186 118 181 122 175 122 L168 122 L168 140 C168 150 160 156 150 156 L132 156 L132 168'},g));
  const r=rng(7),pts=[];for(let i=0;i<26;i++){const a=r()*Math.PI*2,rad=10+r()*40;pts.push([98+Math.cos(a)*rad*1.15,74+Math.sin(a)*rad*.85])}
  const sg=s('g',{},g);const scrib=drawable(s('path',{d:smoothPath(pts),'stroke-width':4.5},sg));return{head,scrib,sg}}
function iconCheck(svg,col){
  const g=s('g',{fill:'none',stroke:col,'stroke-width':7,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  const box=drawable(s('rect',{x:40,y:40,width:120,height:120,rx:26},g));
  const tick=drawable(s('path',{d:'M70 102 L92 124 L132 78'},g));
  const arc=s('g',{},svg);
  const ring=drawable(s('path',{d:'M100 -6 A106 106 0 1 1 6 52',fill:'none',stroke:col,'stroke-width':6,'stroke-linecap':'round'},arc));
  const hd=s('path',{d:'M-6 40 L6 52 L22 42',fill:'none',stroke:col,'stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round'},arc);
  return{box,tick,arc,ring,hd}}

/* ================= scene: tiles (row of 3D tiles appearing on words) ================= */
function tiles(o){
  const R=root(),n=o.items.length;
  const W=n<=2?440:n===3?400:n===4?350:300, H=Math.round(W*1.05), gap=n<=3?60:40;
  const total=n*W+(n-1)*gap, x0=960-total/2+W/2, y=o.title?600:540;
  const title=o.title?h('div',{class:'title abs',style:{left:'80px',right:'80px',top:'95px',fontSize:o.titleSize||'84px',textAlign:'center'},html:o.title}):null;
  if(title)R.appendChild(title);
  const items=o.items.map((it,i)=>{
    const sl=slab(R,{x:x0+i*(W+gap),y,w:W,h:H,color:it.color?C(it.color):'#FFFFFF',dark:it.color?C(it.color+'-d'):C('soft-d'),radius:44,depth:14});
    if(!it.color)sl.face.style.border='3px solid #ECEBE7';
    const ink=it.ink||(it.color&&!['yellow','amber','coral'].includes(it.color)?'#fff':'#121212');
    const ic=icon(sl.face,it.icon,{size:W*.42,color:ink,sw:5.5,x:W*.29,y:H*.14});
    const lb=h('div',{class:'abs',style:{left:'24px',right:'24px',top:H*.62+'px',textAlign:'center',fontSize:(W>=380?40:W>=340?36:31)+'px',fontWeight:800,letterSpacing:'-.02em',lineHeight:1.12,color:ink},html:it.label},sl.face);
    let strike=null;
    if(it.strike!=null){const sv=s('svg',{width:W,height:H,style:'position:absolute;left:0;top:0'},sl.card);
      strike=drawable(s('path',{d:`M${W*.12} ${H*.86} L${W*.88} ${H*.14}`,stroke:C('red'),'stroke-width':16,'stroke-linecap':'round',fill:'none'},sv))}
    return{...it,sl,ic,lb,strike}});
  const banner=o.banner?h('div',{class:'chip abs',style:{left:'50%',top:'930px',fontSize:'40px',background:'#121212',color:'#fff',boxShadow:extrude('#000',6,.2)},html:o.banner[0]},R):null;
  return t=>{
    if(title)reveal(title,eOut(seg(t,o.titleAt||0,(o.titleAt||0)+.55)));
    const nv=Math.max(1,items.reduce((a,it)=>a+eInOut(seg(t,it.at-.1,it.at+.5)),0));
    items.forEach((it,i)=>{it.sl.wrap.style.left=(960+(i-(nv-1)/2)*(W+gap)-W/2)+'px'});
    const shown=items.filter(it=>t>=it.at);const last=shown[shown.length-1];
    items.forEach(it=>{const k=slabIn(it.sl,t,it.at);it.ic.draw(eInOut(seg(t,it.at+.2,it.at+1)));
      reveal(it.lb,eOut(seg(t,it.at+.3,it.at+.8)),16);
      const act=(it===last&&!o.noFocus)?1:0;
      it.sl.card.style.transform=`translateY(${-act*14}px)`;
      if(it.strike){draw(it.strike,eOut(seg(t,it.strike,it.strike+.3)));const d=seg(t,it.strike,it.strike+.4);it.sl.face.style.filter=`saturate(${1-d*.8}) brightness(${1+d*.05})`}});
    if(banner)pop(banner,eBack(seg(t,o.banner[1],o.banner[1]+.4),1.6),'translateX(-50%)');
    camPush(t,.005)}}

/* ================= scene: term definition ================= */
function term(o){
  const R=root();
  const kick=h('div',{class:'cap abs',style:{left:'120px',right:'120px',top:o.kTop||'250px',textAlign:'center',fontSize:'50px',color:'#555'},html:o.kicker},R);
  const tH=o.termH||200;
  const sl=slab(R,{x:960,y:o.termY||470,w:o.termW||1000,h:tH,color:C(o.color),dark:C(o.color+'-d'),radius:tH/2,depth:16});
  h('div',{class:'abs',style:{inset:'0 46px',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',
    fontSize:(o.termSize||110)+'px',fontWeight:800,letterSpacing:'-.03em',lineHeight:1.06,color:o.ink||'#fff'},html:o.term},sl.face);
  const def=o.def?h('div',{class:'title abs',style:{left:'120px',right:'120px',top:o.defTop||'640px',textAlign:'center',fontSize:'56px'},html:o.def[0]},R):null;
  const sub=o.sub?h('div',{class:'cap abs',style:{left:'120px',right:'120px',top:'760px',textAlign:'center',fontSize:'44px'},html:o.sub[0]},R):null;
  const chips=(o.chips||[]).map(([txt,at,c])=>({at,el:h('div',{class:'chip',style:{fontSize:'44px',background:C(c),color:'#fff',boxShadow:extrude(C(c+'-d'),7,.2)},html:txt})}));
  const row=h('div',{class:'abs',style:{left:0,right:0,top:'850px',display:'flex',justifyContent:'center',gap:'28px'}},R);chips.forEach(x=>row.appendChild(x.el));
  return t=>{reveal(kick,eOut(seg(t,o.kAt||0,(o.kAt||0)+.5)));slabIn(sl,t,o.termAt,{idle:true,rx0:70,ry0:0});
    if(def)reveal(def,eOut(seg(t,o.def[1],o.def[1]+.5)));if(sub)reveal(sub,eOut(seg(t,o.sub[1],o.sub[1]+.5)));
    chips.forEach(x=>pop(x.el,eBack(seg(t,x.at,x.at+.35),1.8)));camPush(t,.005)}}

/* ================= scene: steps (horizontal process) ================= */
function steps(o){
  const R=root(),n=o.items.length,span=o.span||1500,x0=960-span/2,dx=span/(n-1),Y=o.y||560;
  const head=h('div',{class:'title abs',style:{left:'80px',right:'80px',top:o.headTop||'110px',textAlign:'center',fontSize:o.headSize||'84px'},html:o.head[0]},R);
  const sub=o.sub?h('div',{class:'cap abs',style:{left:'80px',right:'80px',top:o.subTop||'215px',textAlign:'center',fontSize:'46px'},html:o.sub[0]},R):null;
  const svg=s('svg',{width:1920,height:1080,style:'position:absolute;left:0;top:0'},R);
  const segs=[];for(let i=0;i<n-1;i++)segs.push(drawable(s('path',{d:`M${x0+i*dx+110} ${Y} L${x0+(i+1)*dx-110} ${Y}`,stroke:'#1A1A1A','stroke-width':6,'stroke-linecap':'round','stroke-dasharray':'0','fill':'none'},svg)));
  const items=o.items.map((it,i)=>{const sl=slab(R,{x:x0+i*dx,y:Y,w:190,h:190,color:C(it.color),dark:C(it.color+'-d'),radius:95,depth:12});
    const ink=['yellow','amber','coral'].includes(it.color)?'#121212':'#fff';
    const ic=icon(sl.face,it.icon,{size:100,color:ink,sw:6.5,x:45,y:45});
    const lb=h('div',{class:'abs',style:{left:x0+i*dx-200+'px',width:'400px',top:Y+150+'px',textAlign:'center'}},R);
    h('div',{style:{fontSize:'44px',fontWeight:800,letterSpacing:'-.02em',lineHeight:1.1},html:it.label},lb);
    if(it.sub)h('div',{class:'cap',style:{fontSize:'32px',marginTop:'10px'},html:it.sub},lb);
    return{...it,sl,ic,lb}});
  return t=>{reveal(head,eOut(seg(t,o.head[1],o.head[1]+.5)));if(sub)reveal(sub,eOut(seg(t,o.sub[1],o.sub[1]+.5)));
    items.forEach((it,i)=>{slabIn(it.sl,t,it.at,{rx0:0,ry0:-80});it.ic.draw(eInOut(seg(t,it.at+.15,it.at+.8)));reveal(it.lb,eOut(seg(t,it.at+.2,it.at+.7)));
      if(i>0)draw(segs[i-1],eInOut(seg(t,it.at-.35,it.at+.05)));
      const last=items.filter(x=>t>=x.at).pop();it.sl.wrap.style.opacity=clamp((t-it.at)/.18)*(last===it||o.noDim?1:.7)});
    camPush(t,.005)}}

/* ================= scene: lower third (transparent, over the footage) ================= */
function lowerThird(o){
  const R=root();
  const X=130,Y=790;
  const wrap=h('div',{class:'abs',style:{left:X+'px',top:Y+'px',transformStyle:'preserve-3d'}},R);
  const bar=h('div',{class:'abs',style:{left:'0px',top:'8px',width:'14px',height:'128px',borderRadius:'8px',
    background:C('teal'),boxShadow:extrude(C('teal-d'),5,.25),transformOrigin:'50% 0%'}},wrap);
  const nameW=h('div',{class:'abs',style:{left:'44px',top:'0px',overflow:'hidden'}},wrap);
  const name=h('div',{style:{fontSize:'76px',fontWeight:800,letterSpacing:'-.03em',color:'#fff',
    textShadow:'0 4px 24px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)',whiteSpace:'nowrap',lineHeight:1.1},html:o.name},nameW);
  const role=h('div',{class:'chip abs',style:{left:'46px',top:'102px',fontSize:'34px',letterSpacing:'.01em',
    background:'rgba(18,18,18,.82)',color:'#fff',boxShadow:extrude('rgba(0,0,0,.6)',5,.25)},html:o.role},wrap);
  return t=>{
    const kb=spring(seg(t,0,.7)), kn=eOut(seg(t,.18,.85)), kr=eBack(seg(t,.5,.95),1.6);
    const out=eInOut(seg(t,o.out,o.out+.45));
    bar.style.transform=`scaleY(${kb})`;bar.style.opacity=1-out;
    nameW.style.clipPath=`inset(-30% ${(1-kn)*100}% -30% 0)`;
    name.style.transform=`translateX(${(1-kn)*-26}px)`;
    nameW.style.opacity=1-out;
    role.style.opacity=clamp(kr*2)*(1-out);
    role.style.transform=`translateY(${(1-clamp(kr))*14}px) scale(${Math.max(0,kr)})`;
    wrap.style.transform=`translateX(${-out*40}px)`;
  }}
