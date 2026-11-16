/* Music Muse Tracks — one app script (replaces the 8 injected blocks).
   Data: meta/index.json (slim list) → cards rendered progressively; details from meta/songs/<id>.json on open.
   localStorage keys kept: mm-fav-takes, mm-queue, mm-trash, mm-plays. */
(()=>{"use strict";
const $=i=>document.getElementById(i),D=document,LS=localStorage;
const V=D.body.dataset.v||"";
const SH='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .05.55L8.7 8.2a3 3 0 1 0 0 7.6l6.35 3.65A3 3 0 0 0 15 20a3 3 0 1 0 2.17-2.88l-6.35-3.65a3.05 3.05 0 0 0 0-2.94l6.35-3.65A3 3 0 0 0 18 8z"/></svg>';
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const load=(k,d)=>{try{const v=JSON.parse(LS.getItem(k)||"null");return v==null?d:v}catch(e){return d}};
const rIC=window.requestIdleCallback||(f=>setTimeout(()=>f({timeRemaining:()=>8}),16));
const fmtT=s=>isFinite(s)?Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0"):"0:00";
function toast(msg){const t=$("mmtoast");t.textContent=msg;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),1800)}
function copyText(text,btn,label){const done=()=>{if(btn){const o=label||btn.textContent;btn.textContent="Copied!";setTimeout(()=>btn.textContent=o,1200)}else toast("Link copied")};
 const fb=()=>{const ta=D.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;left:-9999px;top:0";D.body.appendChild(ta);ta.select();try{D.execCommand("copy");done()}catch(e){toast("Copy failed")}ta.remove()};
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done,fb);else fb()}

/* ---------- state ---------- */
let SONGS=[],BY={},SEC={},SITE="",MEDIA="https://pub-e6b0e29159a24a5598dc008fabb2d993.r2.dev/",TAKES=new Set();
let favs=new Set(load("mm-fav-takes",[]));
let trash=new Set(load("mm-trash",[]));
let plays={};{const raw=load("mm-plays",{})||{};Object.keys(raw).forEach(id=>{const v=raw[id];if(v&&typeof v==="object"&&typeof v.count==="number")plays[id]={count:v.count,last:v.last||""};else if(typeof v==="number")plays[id]={count:v,last:""}})}
let Q=load("mm-queue",[]);if(!Array.isArray(Q))Q=[];
const saveFav=()=>LS.setItem("mm-fav-takes",JSON.stringify([...favs]));
const saveTrash=()=>LS.setItem("mm-trash",JSON.stringify([...trash]));
const savePlays=()=>LS.setItem("mm-plays",JSON.stringify(plays));
const saveQ=()=>LS.setItem("mm-queue",JSON.stringify(Q));
const V$={q:"",fo:false,tv:false,sort:"def",dmin:-Infinity,dmax:Infinity,genre:"all",year:"all",pf:"all"};
let searchIdx=null,searchLoading=false;

/* ---------- song helpers ---------- */
const tkid=(s,n)=>s.id+"#"+n;
const score=s=>s.k.reduce((a,k)=>a+((plays[tkid(s,k[0])]||{}).count||0),0);
const lastPlayed=s=>s.k.reduce((a,k)=>{const e=plays[tkid(s,k[0])];const ms=e&&e.last?Date.parse(e.last):0;return ms>a?ms:a},0);
const hasFav=s=>s.k.some(k=>favs.has(tkid(s,k[0])));
const takeOf=id=>{const[sid,n]=id.split("#"),s=BY[sid];if(!s)return null;const k=s.k.find(x=>String(x[0])===n);return k?{s,n:k[0],src:M(k[1]),t:s.t}:null};
const M=p=>/^https?:/.test(p)?p:MEDIA+p;
const pickN=s=>s.p||s.k[0][0];

/* ---------- card rendering ---------- */
function badge(id){const e=plays[id],n=e?e.count||0:0;
 return n>0?`<span class="pcnt" title="${esc(e.last?"Last played "+new Date(e.last).toLocaleString():"")}">▶ ${n} play${n===1?"":"s"}</span>`:'<span class="pcnt new" title="Not played yet"><i class="dot" aria-hidden="true"></i><span class="u">unplayed</span></span>'}
function cardHTML(s){const sec=SEC[s.s]||{},tr=trash.has(s.id);
 let h=`<a class="cov" href="${esc(M(s.cv))}" target="_blank" title="View full cover"><img src="${esc(M(s.th))}" alt="${esc(s.t)} cover" loading="lazy" decoding="async" width="600" height="600"></a><div class="body"><p class="colb">📁 ${esc(sec.title||s.s)}</p>`;
 if(s.n)h+=`<p class="num">${esc(s.n)}</p>`;
 h+=`<h2>${esc(s.t)}</h2><button class="trb" data-id="${esc(s.id)}" aria-pressed="${tr}" title="${tr?"Unmark (keep this song)":"Mark for deletion"}" aria-label="${tr?"Unmark (keep this song)":"Mark for deletion"}">${tr?"↩":"🗑"}</button>`;
 h+=`<button class="shb" type="button" data-id="${esc(s.id)}" title="Share the ⭐ pick take of this song" aria-label="Share this song">${SH} Share</button>`;
 h+=`<p class="dt" title="${esc(s.dt)}">🗓 ${esc(s.dd)}</p>`;
 if(s.a)h+=`<p class="artist">${esc(s.a)}</p>`;
 h+=`<p class="g">${esc(s.l)}</p><p class="gy" aria-label="Genre and year">${s.g?`<span class="chip gnr">${esc(s.g)}</span>`:""}${s.y?`<span class="chip yr">${esc(s.y)}</span>`:""}</p>`;
 if(s.q)h+=`<p class="qa" style="margin:0 0 6px;font-size:.78rem;color:#9ad" title="Automated technical QA (not a listening review)">${esc(s.q)}</p>`;
 for(const[n,src,,dl]of s.k){const id=tkid(s,n),f=favs.has(id),qi=Q.indexOf(id),head=qi===0,pl=head&&!A.paused;
  h+=`<div class="take${f?" favd":""}${head?" curq":""}${pl?" playing":""}" data-n="${n}"><span class="tl">Take ${n}${s.p===n?' <b class="qpk" style="color:#ffd43b;font-weight:600">⭐ QA pick</b>':""}</span>`+
   `<button class="fav${f?" on":""}" data-n="${n}" aria-label="Favorite take ${n}" aria-pressed="${f}">${f?"♥":"♡"}</button>`+
   `<button class="pb${head?" cur":""}" data-n="${n}" title="Play take ${n}">${pl?"⏸ Playing":head?"▶ Resume":"▶ Play"}</button>`+
   `<button class="qb${qi>=0?" on":""}" data-n="${n}" aria-pressed="${qi>=0}" title="Add take ${n} to queue">${qi>=0?"✓ Queued":"+ Queue"}</button>${badge(id)}`+
   `<button class="tsh" type="button" data-n="${n}" title="Share take ${n}" aria-label="Share take ${n}">${SH}</button><i class="tp"></i>`+
   `<a class="btn" href="${esc(M(src))}" download="${esc(dl)}">⬇ Download</a></div>`}
 h+=`<details class="rc"><summary>Lyrics &amp; Suno recipe</summary><div class="rcb ld">Loading…</div></details></div>`;return h}
function el(s){if(s.el)return s.el;const a=D.createElement("article");a.className="card"+(trash.has(s.id)?" trashed":"");a.id=s.id;a.innerHTML=cardHTML(s);s.el=a;return a}
function syncCard(s){/* bring a detached, previously built card up to date */const tr=trash.has(s.id);s.el.classList.toggle("trashed",tr);const b=s.el.querySelector(".trb");if(b){b.classList.remove("arm");b.textContent=tr?"↩":"🗑";b.title=tr?"Unmark (keep this song)":"Mark for deletion";b.setAttribute("aria-label",b.title);b.setAttribute("aria-pressed",tr)}paintTakes(s)}
function refreshCard(s){if(!s.el)return;const open=s.el.querySelector("details.rc[open]");const det=s.el.querySelector("details.rc");s.el.className="card"+(trash.has(s.id)?" trashed":"")+(s.el.classList.contains("flash")?" flash":"");s.el.innerHTML=cardHTML(s);if(det&&det._loaded){s.el.querySelector("details.rc").replaceWith(det)}}

/* details (lazy) */
const detCache={};
function renderDetails(d){const r=d.rows.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")+d.qa.map(([k,v])=>`<tr class="qar"><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
 return (d.insp?`<p class="insp" style="margin:2px 0 6px;font-size:.8rem;color:#c9a0ff">📼 Inspired by ${esc(d.insp)}</p>`:"")+
 `<div class="rh"><b>Style</b><button class="cp" data-t="sty-${esc(d.id)}">Copy style</button></div><pre id="sty-${esc(d.id)}">${esc(d.style)}</pre><table>${r}</table>`+
 `<div class="rh"><b>Lyrics</b>${d.lyrNote?` <small>${esc(d.lyrNote)}</small>`:""}<button class="cp" data-t="lyr-${esc(d.id)}">Copy lyrics</button></div><pre id="lyr-${esc(d.id)}">${esc(d.lyrics)}</pre><a class="mj" href="${esc(d.json)}" target="_blank">Metadata (JSON)</a>`}
function openDetails(det){if(det._loaded||det._busy)return;const c=det.closest(".card");if(!c)return;det._busy=true;const box=det.querySelector(".rcb");
 (detCache[c.id]||(detCache[c.id]=fetch("meta/songs/"+encodeURIComponent(c.id)+".json?v="+V).then(r=>{if(!r.ok)throw 0;return r.json()}))).then(d=>{box.className="rcb";box.innerHTML=renderDetails(d);det._loaded=true}).catch(()=>{delete detCache[c.id];box.textContent="Couldn't load the recipe. Close and reopen to retry."}).finally(()=>det._busy=false)}
D.addEventListener("toggle",e=>{const t=e.target;if(t.matches&&t.matches("details.rc")&&t.open)openDetails(t)},true);

/* ---------- visibility / sorting / progressive mount ---------- */
function searchText(s){return s._st||(s._st=[s.t,s.n,s.a,s.l,s.g,s.y,s.dd,s.q,(SEC[s.s]||{}).title,"take 1 take 2"].join(" ").toLowerCase())}
function ensureSearch(){if(searchIdx||searchLoading)return;searchLoading=true;fetch("meta/search.json?v="+V).then(r=>r.json()).then(d=>{searchIdx=d;if(V$.q)apply()}).catch(()=>{searchLoading=false})}
function matches(s){const v=V$.q;if(!v)return true;return searchText(s).includes(v)||(searchIdx&&(searchIdx[s.id]||"").includes(v))}
function why(s){/* returns list of reasons a song is hidden */const r=[];
 if(!matches(s))r.push("q");if(V$.fo&&!hasFav(s))r.push("fo");
 const tr=trash.has(s.id);if(V$.tv?!tr:tr)r.push("t");
 if(!(s.ts>=V$.dmin&&s.ts<=V$.dmax))r.push("d");
 if(V$.genre!=="all"&&s.g!==V$.genre)r.push("g");if(V$.year!=="all"&&String(s.y)!==String(V$.year))r.push("y");
 if(V$.pf!=="all"){const p=score(s)>0;if(V$.pf==="played"?!p:p)r.push("p")}return r}
const cmpNew=(a,b)=>(b.ts-a.ts)||(b.o-a.o);
let gen=0,pending=[],mounted=new Set();
/* progressive mount: first 30 cards now, more whenever the sentinel nears the viewport */
const more=D.createElement("div");more.id="mmmore";more.setAttribute("aria-hidden","true");
const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))pump()},{rootMargin:"1500px 0px"});io.observe(more);
let pumping=0;function pump(){if(pumping||!pending.length)return;pumping=requestAnimationFrame(()=>{pumping=0;mountSome(24);const r=more.getBoundingClientRect();if(pending.length&&r.top<innerHeight+1500)pump()})}
function apply(){const vis=SONGS.filter(s=>!why(s).length);let list;const flat=V$.sort!=="def";
 if(!flat)list=vis.slice().sort((a,b)=>a.o-b.o);
 else{list=vis.slice();if(V$.sort==="plays")list.sort((a,b)=>score(b)-score(a)||lastPlayed(b)-lastPlayed(a)||cmpNew(a,b));else if(V$.sort==="year")list.sort((a,b)=>(b.y||0)-(a.y||0)||cmpNew(a,b));else if(V$.sort==="year-old")list.sort((a,b)=>(a.y||0)-(b.y||0)||(a.ts-b.ts)||(a.o-b.o));else{list.sort(cmpNew);if(V$.sort==="old")list.reverse()}}
 D.body.classList.toggle("flat",flat);
 const want=new Set(list);mounted.forEach(s=>{if(!want.has(s)){s.el.remove();mounted.delete(s)}});
 /* detach everything still pending so order is rebuilt exactly */
 list.forEach(s=>{if(s.el&&s.el.parentNode&&!mounted.has(s))s.el.remove()});
 const secHas={};list.forEach(s=>secHas[s.s]=1);
 D.querySelectorAll("section.col").forEach(x=>{x.classList.toggle("dshide",flat||!secHas[x.id]);x.classList.add("pend")});
 gen++;pending=list.map(s=>[s,flat?$("flatv"):SEC[s.s].main]);mounted.forEach(s=>s.el.remove());mounted.clear();mountSome(30);pump();
 const nv=list.length;$("mmcnt").textContent=nv+" of "+SONGS.length+" songs";
 $("favtab").textContent="★ Favorites ("+favs.size+")";$("favtab").classList.toggle("act",V$.fo);
 const nf=V$.fo&&!nv;$("nofav").classList.toggle("hide",!nf);$("nodate").classList.toggle("hide",!!nv||nf)}
function mountSome(n){const part=pending.splice(0,n);let box=null,last=null;part.forEach(([s,b])=>{const had=!!s.el,e=el(s);if(had)syncCard(s);b.appendChild(e);mounted.add(s);box=b;last=e;const sec=b.closest("section.col");if(sec)sec.classList.remove("pend")});
 if(last){if(pending.length)box.appendChild(more);else more.remove()}}
function flushAll(){mountSome(pending.length)}
let applyT=0;const applySoon=()=>{clearTimeout(applyT);applyT=setTimeout(apply,120)};

/* ---------- favorites ---------- */
function toggleFav(id){favs.has(id)?favs.delete(id):favs.add(id);saveFav();const s=BY[id.split("#")[0]];paintTakes(s);if(V$.fo)apply();else $("favtab").textContent="★ Favorites ("+favs.size+")"}
function paintTakes(s){if(!s||!s.el)return;s.el.querySelectorAll(".take").forEach(tk=>{const n=tk.dataset.n,id=tkid(s,n),f=favs.has(id),b=tk.querySelector(".fav");b.classList.toggle("on",f);b.textContent=f?"♥":"♡";b.setAttribute("aria-pressed",f);tk.classList.toggle("favd",f);
 const qi=Q.indexOf(id),qb=tk.querySelector(".qb");qb.classList.toggle("on",qi>=0);qb.textContent=qi>=0?"✓ Queued":"+ Queue";qb.setAttribute("aria-pressed",qi>=0);
 const head=qi===0,pl=head&&!A.paused,pb=tk.querySelector(".pb");pb.classList.toggle("cur",head);pb.textContent=pl?"⏸ Playing":head?"▶ Resume":"▶ Play";tk.classList.toggle("playing",pl);tk.classList.toggle("curq",head);if(!head){const tp=tk.querySelector(".tp");tp.style.width=""}
 const old=tk.querySelector(".pcnt"),tmp=D.createElement("span");tmp.innerHTML=badge(id);old.replaceWith(tmp.firstChild)})}
function pack(){return JSON.stringify({v:2,favs:[...favs],plays})}
function mergePlays(inc){if(!inc||typeof inc!=="object"||Array.isArray(inc))return;Object.keys(inc).forEach(id=>{const v=inc[id];if(!v)return;const count=typeof v==="object"?+v.count||0:+v||0,lastTs=typeof v==="object"?(v.last||""):"";if(!count&&!lastTs)return;const cur=plays[id]||{count:0,last:""},nx={count:Math.max(cur.count||0,count),last:cur.last};if(lastTs&&(!nx.last||Date.parse(lastTs)>=Date.parse(nx.last||0)))nx.last=lastTs;plays[id]=nx});savePlays()}
function importPayload(text){const data=JSON.parse(text);let ids=[],po=null;if(Array.isArray(data))ids=data;else if(data&&typeof data==="object"){ids=Array.isArray(data.favs)?data.favs:(Array.isArray(data.favorites)?data.favorites:[]);po=data.plays||null}else throw 0;
 const n=ids.filter(x=>TAKES.has(x));n.forEach(x=>favs.add(x));saveFav();if(po)mergePlays(po);mounted.forEach(paintTakes);top10();apply();alert("Imported "+n.length+" favorites"+(po!=null?" and merged play counts":""))}

/* ---------- queue + single player ---------- */
const A=$("qa");
Q=Q.filter(x=>typeof x==="string");
function stop(){A.pause();A.removeAttribute("src");A.load();$("qpos").value=0;$("qt").textContent="0:00";$("qd").textContent="0:00"}
let lastHead=null;
function head(play,at){saveQ();if(!Q.length){stop();renderQ();return}const it=takeOf(Q[0]);if(A.getAttribute("src")!==it.src)A.src=it.src;if(at)try{A.currentTime=at}catch(e){}renderQ();if(play)A.play().catch(()=>{})}
function addQ(id){const it=takeOf(id);if(!it||trash.has(it.s.id))return;if(!Q.includes(id)){Q.push(id);if(Q.length===1)head(false)}}
function rmQ(i){const play=!A.paused;Q.splice(i,1);if(i===0)head(play);else{saveQ();renderQ()}}
function dropQ(f){const h=Q[0],play=!A.paused;Q=Q.filter(x=>!f(x));if(Q[0]!==h)head(play);else{saveQ();renderQ()}}
let touched=new Set();
function renderQ(){const L=$("qlist");const fr=D.createDocumentFragment();
 Q.forEach((id,i)=>{const it=takeOf(id);if(!it)return;const li=D.createElement("li");if(i===0)li.className="cur";li.innerHTML='<span class="t"></span><button data-a="u" title="Move up">▲</button><button data-a="d" title="Move down">▼</button><button data-a="x" title="Remove">✕</button>';li.dataset.i=i;li.firstChild.textContent=(i===0?"▶ Now: ":i+". ")+it.t+" — Take "+it.n;fr.appendChild(li)});
 L.replaceChildren(fr);
 $("qbar").classList.toggle("hide",!Q.length);D.body.classList.toggle("hasq",!!Q.length);$("qcnt").textContent=Q.length;
 const it=Q[0]&&takeOf(Q[0]);$("qnow").textContent=it?(A.paused?"❚❚ ":"▶ ")+it.t+" — Take "+it.n:"Queue";$("qplay").textContent=A.paused?"▶":"⏸";
 /* only repaint cards whose queue state may have changed (no full-DOM scan) */
 const now=new Set(Q.map(x=>x.split("#")[0]));const all=new Set([...touched,...now]);all.forEach(sid=>paintTakes(BY[sid]));touched=now;
 curTp=null}
$("qlist").addEventListener("click",e=>{const li=e.target.closest("li");if(!li)return;const i=+li.dataset.i;const b=e.target.closest("button");
 if(!b){if(!e.target.closest(".t"))return;if(i===0){A.paused?A.play().catch(()=>{}):A.pause();return}const x=Q.splice(i,1)[0];Q[0]=x;head(true);return}
 const a=b.dataset.a;if(a==="x")return rmQ(i);const j=a==="u"?i-1:i+1;if(j<0||j>=Q.length)return;const play=!A.paused;[Q[i],Q[j]]=[Q[j],Q[i]];if(i===0||j===0)head(play);else{saveQ();renderQ()}});
function takeOver(id,at){const k=Q.indexOf(id);if(k>0)Q.splice(k,1);if(Q.length&&Q[0]!==id)Q[0]=id;else if(!Q.length)Q=[id];head(true,at)}
$("qplay").onclick=()=>{if(!Q.length)return;if(!A.getAttribute("src"))return head(true);A.paused?A.play().catch(()=>{}):A.pause()};
$("qnext").onclick=()=>{if(!Q.length)return;Q.shift();head(true)};
$("qprev").onclick=()=>{if(!Q.length)return;A.currentTime=0;if(A.paused)A.play().catch(()=>{})};
$("qclr").onclick=()=>{if(!confirm("Clear the queue?"))return;Q=[];saveQ();stop();renderQ()};
$("qshuf").onclick=()=>{if(Q.length<3)return;const r=Q.slice(1);for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}Q=[Q[0],...r];saveQ();renderQ()};
$("qtog").onclick=()=>$("qlist").classList.toggle("hide");
$("qfav").onclick=()=>{const F=[...favs].filter(x=>takeOf(x));if(!F.length)return alert("No favorites yet — tap ♡ on a take first.");F.forEach(addQ);saveQ();renderQ();$("qlist").classList.remove("hide")};
const jump=()=>{if(Q.length)go(Q[0].split("#")[0])};
$("qnow").onclick=jump;$("qnow").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();jump()}};
A.addEventListener("ended",()=>{bump();Q.shift();head(Q.length>0)});
["play","pause"].forEach(e=>A.addEventListener(e,renderQ));
const PB=$("qpos");let drag=false;PB.oninput=()=>{drag=true;$("qt").textContent=fmtT(+PB.value)};PB.onchange=()=>{A.currentTime=+PB.value;drag=false};
let curTp=null;
A.addEventListener("timeupdate",()=>{if(!curTp||!curTp.isConnected){const s=Q[0]&&BY[Q[0].split("#")[0]];curTp=s&&s.el?s.el.querySelector(".take.curq .tp"):null}if(curTp&&A.duration)curTp.style.width=(100*A.currentTime/A.duration)+"%";if(!drag){PB.value=A.currentTime;$("qt").textContent=fmtT(A.currentTime)}onTick()});
A.addEventListener("loadedmetadata",()=>{PB.max=A.duration;$("qd").textContent=fmtT(A.duration)});

/* ---------- play counting (30 s of real listening, or reaching the end) ---------- */
let sess={id:null,listened:0,counted:false,lastT:null};
const curId=()=>Q[0]||null;
function reset(id){sess={id,listened:0,counted:false,lastT:null}}
function bump(){const id=curId()||sess.id;if(id&&sess.id!==id)reset(id);if(sess.counted||!sess.id)return;sess.counted=true;record(sess.id)}
function onTick(){if(A.paused){sess.lastT=null;return}const id=curId();if(!id)return;if(sess.id!==id)reset(id);const t=A.currentTime;if(sess.lastT!=null){const d=t-sess.lastT;if(d>=0&&d<2)sess.listened+=d}sess.lastT=t;if(!sess.counted&&sess.listened>=30)bump()}
A.addEventListener("pause",()=>{sess.lastT=null});A.addEventListener("seeked",()=>{sess.lastT=A.currentTime});A.addEventListener("play",()=>{const id=curId();if(id&&sess.id!==id)reset(id);sess.lastT=A.currentTime});
function record(id){const e=plays[id]||{count:0,last:""};e.count=(e.count||0)+1;e.last=new Date().toISOString();plays[id]=e;savePlays();paintTakes(BY[id.split("#")[0]]);top10();if(V$.sort==="plays"||V$.pf!=="all")applySoon()}
function top10(){const L=$("mmtopList");if($("mmtop").classList.contains("hide"))return;L.innerHTML="";const rows=SONGS.map(s=>({s,n:score(s),last:lastPlayed(s)})).filter(x=>x.n>0&&!trash.has(x.s.id)).sort((a,b)=>b.n-a.n||b.last-a.last).slice(0,10);
 if(!rows.length){L.innerHTML='<li class="empty">Play a take for about 30 seconds (or to the end) to start a count.</li>';return}
 rows.forEach(x=>{const li=D.createElement("li");li.innerHTML=`<a href="#${esc(x.s.id)}" data-go="${esc(x.s.id)}"><span class="tt">${esc(x.s.t)}</span><small>${x.n} play${x.n===1?"":"s"}</small></a>`;L.appendChild(li)})}
D.querySelectorAll("#mmplays .pcf").forEach(b=>b.onclick=()=>{V$.pf=b.dataset.p;D.querySelectorAll("#mmplays .pcf").forEach(x=>x.classList.toggle("act",x===b));apply()});
$("mmtopbtn").onclick=()=>{$("mmtop").classList.toggle("hide");top10()};

/* ---------- trash ---------- */
function trashApply(){saveTrash();const tb=$("trtab");tb.textContent="🗑 Marked ("+trash.size+")";tb.classList.toggle("hide",!trash.size&&!V$.tv);tb.classList.toggle("act",V$.tv);$("trx").classList.toggle("hide",!V$.tv);$("trtxt").value=JSON.stringify([...trash]);dropQ(x=>trash.has(x.split("#")[0]));ticker();apply()}
$("trtab").onclick=()=>{V$.tv=!V$.tv;trashApply();scrollTo({top:0})};
$("trclr").onclick=()=>{if(confirm("Unmark all songs?")){const was=[...trash];trash.clear();V$.tv=false;was.forEach(id=>refreshCard(BY[id]));trashApply()}};
$("trcopy").onclick=e=>{const s=JSON.stringify([...trash]),t=$("trtxt");t.value=s;const done=()=>e.target.textContent="✓ Copied";const fb=()=>{t.focus();t.select();try{D.execCommand("copy");done()}catch(x){e.target.textContent="Select & copy the text below"}};navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(s).then(done,fb):fb();setTimeout(()=>e.target.textContent="📋 Copy delete list",2500)};
function trashClick(b){const id=b.dataset.id;if(!trash.has(id)&&!b.classList.contains("arm")){b.classList.add("arm");b.textContent="🗑 Tap again";clearTimeout(b._t);b._t=setTimeout(()=>{b.classList.remove("arm");b.textContent="🗑"},3000);return}
 clearTimeout(b._t);trash.has(id)?trash.delete(id):trash.add(id);if(V$.tv&&!trash.size)V$.tv=false;refreshCard(BY[id]);trashApply()}

/* ---------- share (per take → standalone player page) ---------- */
const link=(id,n)=>SITE+"s/"+id+"-t"+n+".html";
function share(id,n){const s=BY[id];if(!s)return;n=n||pickN(s);const sec=(SEC[s.s]||{}).title||"";const p={title:s.t+" · Machine Sessions",text:(sec?s.t+" · "+sec:s.t)+" (Take "+n+")",url:link(id,n)};
 if(typeof navigator.share==="function")navigator.share(p).catch(e=>{if(e&&e.name==="AbortError")return;copyText(p.url)});else copyText(p.url)}
$("qshare").onclick=e=>{e.preventDefault();const id=Q[0];if(!id){toast("Nothing playing");return}const[sid,n]=id.split("#");share(sid,n)};

/* ---------- go to a card (ticker, top 10, player title, #hash) ---------- */
function go(id,noHash){const s=BY[id];if(!s)return;const r=why(s);
 if(r.includes("t")){V$.tv=trash.has(id);trashApply()}
 if(r.includes("d")){V$.dmin=-Infinity;V$.dmax=Infinity;$("mmfrom").value="";$("mmto").value="";D.querySelectorAll("#mmctl .dc").forEach(b=>b.classList.toggle("act",b.dataset.d==="all"))}
 if(r.includes("g")||r.includes("y")){V$.genre=V$.year="all";$("mmgenre").value="all";$("mmyear").value="all"}
 if(r.includes("p")){V$.pf="all";D.querySelectorAll("#mmplays .pcf").forEach(b=>b.classList.toggle("act",b.dataset.p==="all"))}
 if(r.includes("q")){V$.q="";$("q").value=""}if(r.includes("fo"))V$.fo=false;
 if(r.length)apply();flushAll();
 if(!noHash)history.replaceState(null,"","#"+id);const c=s.el;
 const far=Math.abs(c.getBoundingClientRect().top)>innerHeight*3;c.scrollIntoView({behavior:far?"auto":"smooth",block:"start"});let tries=0;const fix=()=>{const t=c.getBoundingClientRect().top,want=parseFloat(getComputedStyle(c).scrollMarginTop)||0;if(Math.abs(t-want)>40&&tries++<4)c.scrollIntoView({behavior:tries>2?"auto":"smooth",block:"start"});if(tries<4)setTimeout(fix,450)};setTimeout(fix,600);
 c.classList.add("flash");clearTimeout(c._f);c._f=setTimeout(()=>c.classList.remove("flash"),2200)}
function openHash(){const id=decodeURIComponent((location.hash||"").slice(1));if(id&&BY[id])go(id,true);else if(id&&SEC[id]){const x=$(id);x&&x.scrollIntoView()}}
addEventListener("hashchange",openHash);

/* ---------- downloads (media is cross-origin on R2, so save via blob) ---------- */
D.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("a.btn[download]");if(!a||e.ctrlKey||e.metaKey||e.shiftKey)return;const href=a.href;if(new URL(href).origin===location.origin)return;e.preventDefault();if(a._busy)return;a._busy=true;const o=a.textContent;a.textContent="⏳ Saving…";
 fetch(href).then(r=>{if(!r.ok)throw 0;return r.blob()}).then(b=>{const u=URL.createObjectURL(b),x=D.createElement("a");x.href=u;x.download=a.getAttribute("download")||"";D.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}).catch(()=>window.open(href,"_blank")).finally(()=>{a._busy=false;a.textContent=o})},true);
/* ---------- delegated clicks ---------- */
D.addEventListener("click",e=>{const t=e.target;
 const a=t.closest&&t.closest("[data-go]");if(a){e.preventDefault();go(a.dataset.go);return}
 const card=t.closest&&t.closest(".card");const sid=card&&card.id;
 const b=t.closest&&t.closest("button");
 if(b&&card){const n=b.dataset.n;
  if(b.classList.contains("fav"))return toggleFav(sid+"#"+n);
  if(b.classList.contains("pb")){const id=sid+"#"+n;if(Q[0]===id&&A.getAttribute("src"))A.paused?A.play().catch(()=>{}):A.pause();else takeOver(id,0);return}
  if(b.classList.contains("qb")){const id=sid+"#"+n,i=Q.indexOf(id);if(i>=0)rmQ(i);else{addQ(id);saveQ();renderQ()}return}
  if(b.classList.contains("trb")){e.stopPropagation();return trashClick(b)}
  if(b.classList.contains("shb")){e.preventDefault();return share(sid)}
  if(b.classList.contains("tsh")){e.preventDefault();return share(sid,n)}
  if(b.classList.contains("cp")){const p=$(b.dataset.t);if(p)copyText(p.textContent,b);return}}
 if(b&&b.classList.contains("qcol")){const sec=b.dataset.sec;SONGS.filter(s=>s.s===sec).forEach(s=>s.k.forEach(k=>addQ(tkid(s,k[0]))));saveQ();renderQ();$("qlist").classList.remove("hide")}});

/* ---------- search / favorites / export ---------- */
const qi=$("q");qi.addEventListener("focus",ensureSearch);qi.addEventListener("input",()=>{ensureSearch();V$.q=qi.value.toLowerCase().trim();applySoon()});
$("favtab").onclick=()=>{V$.fo=!V$.fo;apply();scrollTo({top:D.querySelector("nav").offsetTop})};
const fx=$("favx"),ft=$("favtxt");
$("favio").onclick=()=>{fx.classList.toggle("hide");ft.value=pack()};
$("favcopy").onclick=e=>{const t=pack();ft.value=t;copyText(t,e.target)};
$("favimp").onclick=()=>{try{importPayload(ft.value)}catch(e){alert("Paste a JSON list of favorites, or an export that includes play counts")}};

/* ---------- sort + filters ---------- */
$("mmsort").onchange=e=>{V$.sort=e.target.value;apply()};
$("mmgenre").onchange=e=>{V$.genre=e.target.value;apply()};$("mmyear").onchange=e=>{V$.year=e.target.value;apply()};
function setRange(k){D.querySelectorAll("#mmctl .dc").forEach(b=>b.classList.toggle("act",b.dataset.d===k));$("mmfrom").value="";$("mmto").value="";
 if(k==="all"){V$.dmin=-Infinity;V$.dmax=Infinity}else{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(+k===0?0:+k-1));V$.dmin=d.getTime();V$.dmax=Infinity}apply()}
function custom(){D.querySelectorAll("#mmctl .dc").forEach(b=>b.classList.remove("act"));const f=$("mmfrom").value,t=$("mmto").value;V$.dmin=f?new Date(f+"T00:00:00").getTime():-Infinity;V$.dmax=t?new Date(t+"T23:59:59.999").getTime():Infinity;if(!f&&!t)D.querySelector('#mmctl .dc[data-d="all"]').classList.add("act");apply()}
D.querySelectorAll("#mmctl .dc").forEach(b=>b.onclick=()=>setRange(b.dataset.d));$("mmfrom").onchange=custom;$("mmto").onchange=custom;
function fillFilters(){const fill=(sel,lab,vals)=>{sel.innerHTML="";const o=D.createElement("option");o.value="all";o.textContent=lab;sel.appendChild(o);vals.forEach(v=>{const x=D.createElement("option");x.value=v;x.textContent=v;sel.appendChild(x)});sel.value="all"};
 fill($("mmgenre"),"All genres",[...new Set(SONGS.map(s=>s.g).filter(Boolean))].sort((a,b)=>a.localeCompare(b)));fill($("mmyear"),"All years",[...new Set(SONGS.map(s=>s.y).filter(Boolean))].sort((a,b)=>b-a))}

/* ---------- ticker (latest 15, pinned, continuous, clickable, swipe) ---------- */
const fmtD=t=>new Date(t).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
function ticker(){const v=$("mmtr");const L=SONGS.filter(s=>!trash.has(s.id)).sort(cmpNew).slice(0,15);let h="";
 for(const dup of[false,true])L.forEach((s,i)=>{h+=`<a href="#${esc(s.id)}" data-go="${esc(s.id)}"${dup?' aria-hidden="true" tabindex="-1"':""}><span class="nw">${i===0?"NEW":""}</span><span class="tt">${esc(s.t)}</span><i>${esc((SEC[s.s]||{}).title||"")}</i><small>${s.ts?fmtD(s.ts):""}</small></a>`});v.innerHTML=h}
(()=>{const v=$("mmtv"),tr=$("mmtr");let x=0,hold=false,until=0,last=0,drag=null,moved=false;const rm=matchMedia("(prefers-reduced-motion: reduce)").matches,SP=rm?0.02:0.05;
 let half=0;const measure=()=>{half=tr.scrollWidth/2};new ResizeObserver(measure).observe(tr);
 const wrap=()=>{if(half>0){while(x<=-half)x+=half;while(x>0)x-=half}tr.style.transform="translate3d("+x+"px,0,0)"};
 v.addEventListener("mouseenter",()=>hold=true);v.addEventListener("mouseleave",()=>{hold=false;until=performance.now()+800});
 const down=cx=>{drag={cx,x0:x};moved=false;hold=true},move=cx=>{if(!drag)return;const dx=cx-drag.cx;if(Math.abs(dx)>6)moved=true;x=drag.x0+dx;wrap()},up=()=>{if(!drag)return;drag=null;hold=false;until=performance.now()+2000;setTimeout(()=>moved=false,300)};
 v.addEventListener("touchstart",e=>down(e.touches[0].clientX),{passive:true});v.addEventListener("touchmove",e=>move(e.touches[0].clientX),{passive:true});v.addEventListener("touchend",up);v.addEventListener("touchcancel",up);
 v.addEventListener("mousedown",e=>{down(e.clientX);e.preventDefault()});addEventListener("mousemove",e=>drag&&move(e.clientX));addEventListener("mouseup",()=>{if(drag){up();hold=v.matches(":hover")}});
 v.addEventListener("click",e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false}},true);
 function step(ts){if(last&&!hold&&!drag&&ts>=until){x-=Math.min(ts-last,100)*SP;wrap()}last=ts;requestAnimationFrame(step)}requestAnimationFrame(step);
 window.MMTick={get x(){return x}}})();

/* ---------- lightbox ---------- */
(()=>{const lb=$("lb"),im=$("lbi"),ld=$("lbl"),cap=$("lbc");let open=false,sy=0,pushed=false,ty=null;
 function show(src,alt){if(open)return;open=true;sy=scrollY;const b=D.body.style;b.position="fixed";b.top=-sy+"px";b.left="0";b.right="0";b.width="100%";im.classList.remove("ok");im.style.transform="";ld.style.display="";im.onload=()=>{ld.style.display="none";im.classList.add("ok")};im.onerror=()=>{ld.textContent="Couldn't load image"};ld.textContent="Loading…";im.src=src;im.alt=alt||"";cap.textContent=alt||"";lb.classList.remove("hide");try{history.pushState({mmlb:1},"");pushed=true}catch(e){pushed=false}$("lbx").focus({preventScroll:true})}
 function close(fromPop){if(!open)return;open=false;lb.classList.add("hide");im.removeAttribute("src");const b=D.body.style;b.position=b.top=b.left=b.right=b.width="";scrollTo(0,sy);if(pushed&&!fromPop){pushed=false;history.back()}pushed=false}
 D.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("a.cov,a.acov");if(!a||e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();e.stopPropagation();const img=a.querySelector("img");show(a.getAttribute("href"),img&&img.alt||a.title||"")},true);
 $("lbx").onclick=e=>{e.stopPropagation();close()};lb.addEventListener("click",e=>{if(e.target===lb||e.target===cap||e.target===ld)close()});
 addEventListener("keydown",e=>{if(open&&e.key==="Escape")close()});addEventListener("popstate",()=>{if(open)close(true)});
 lb.addEventListener("touchstart",e=>{ty=e.touches[0].clientY},{passive:true});lb.addEventListener("touchmove",e=>{if(ty==null)return;const d=Math.max(0,e.touches[0].clientY-ty);im.style.transform="translateY("+d+"px)"},{passive:true});lb.addEventListener("touchend",e=>{if(ty==null)return;const d=(e.changedTouches[0]||{}).clientY-ty;ty=null;if(d>90)close();else im.style.transform=""});
 window.MMLightbox={get open(){return open},close}})();

/* ---------- pinned ticker / sticky nav offsets ---------- */
(()=>{const r=D.documentElement,t=$("mmtick"),n=D.querySelector("nav");let raf=0;
 const fit=()=>{raf=0;const tk=t.offsetHeight,st=getComputedStyle(n).position==="sticky"?n.offsetHeight:0;r.style.setProperty("--tk",tk+"px");r.style.setProperty("--stk",(tk+st)+"px")};
 fit();addEventListener("resize",()=>{if(!raf)raf=requestAnimationFrame(fit)})})();

/* ---------- boot ---------- */
D.querySelectorAll("section.col").forEach(x=>{SEC[x.id]={id:x.id,title:(x.querySelector(".h2")||{}).textContent||x.id,main:x.querySelector("main")}});
fetch("meta/index.json?v="+V,{credentials:"same-origin",mode:"cors"}).then(r=>r.json()).then(d=>{SITE=d.site||(location.origin+location.pathname.replace(/[^/]*$/,""));if(typeof d.media==="string")MEDIA=d.media;
 SONGS=d.songs;SONGS.forEach((s,i)=>{s.o=i;BY[s.id]=s;s.k.forEach(k=>TAKES.add(tkid(s,k[0])))});
 trash=new Set([...trash].filter(x=>BY[x]));Q=Q.filter(x=>takeOf(x));
 $("loading").remove();fillFilters();ticker();
 if(Q.length)A.src=takeOf(Q[0]).src;renderQ();trashApply();
 if(location.hash)openHash();
 window.MM={go,apply,share,link,get Q(){return Q.slice()},get songs(){return SONGS},get mountedCount(){return mounted.size},get pending(){return pending.length},plays:()=>plays,pack,A};
}).catch(e=>{$("loading").textContent="Couldn't load the song list. Pull to refresh.";console.error(e)});
})();
