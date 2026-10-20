/* Agent Bus original district renderer. Three.js MIT: vendor/THREE-LICENSE.txt */
(()=>{var Bf=Object.create;var lu=Object.defineProperty;var zf=Object.getOwnPropertyDescriptor;var kf=Object.getOwnPropertyNames;var Hf=Object.getPrototypeOf,Vf=Object.prototype.hasOwnProperty;var cu=(s,e)=>()=>(e||s((e={exports:{}}).exports,e),e.exports);var Gf=(s,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of kf(e))!Vf.call(s,i)&&i!==t&&lu(s,i,{get:()=>e[i],enumerable:!(n=zf(e,i))||n.enumerable});return s};var hu=(s,e,t)=>(t=s!=null?Bf(Hf(s)):{},Gf(e||!s||!s.__esModule?lu(t,"default",{value:s,enumerable:!0}):t,s));var jh=cu((YS,yf)=>{"use strict";var Yl={test:[-18,.95,7],build:[9,.95,-6.5],research:[-11,.95,-8.6],review:[-10,.95,18.5],preview:[18,.95,11.7],hub:[0,.95,6]};function sv(s,e){if(s?.kind==="smoke"&&s.building==="test")return"test";if(e&&e.projectId===s?.projectId&&e.runId===s?.id&&!e.stale&&e.status!=="stale"&&!["passed","failed","cancelled","interrupted","timed_out","termination_unknown"].includes(s.state)){let t=e.phase==="edit"?"build":e.phase;if(Object.hasOwn(Yl,t))return t}return s?.state==="building"?"build":["testing","passed"].includes(s?.state)||s?.kind==="visual"||s?.state==="failed"&&s?.checks?.length?"test":"hub"}function rv(s,e){let t=Yl[e]||Yl.hub,n=[[...s]],i=(r,o)=>n.push([r,.95,o]);return s[2]<6&&i(s[0],7),e==="test"?i(1,7):e==="build"?(i(6,7),i(6,-6.5)):e==="research"?(i(-4,7),i(-4,-7)):e==="review"?(i(-4,7),i(-4,18.5)):e==="preview"&&(i(6,7),i(6,12),i(18,12)),n.push([...t]),n.filter((r,o)=>!o||Math.hypot(...r.map((a,l)=>a-n[o-1][l]))>.01)}function ov(s,e){let t=s.slice(1).map((r,o)=>Math.hypot(...r.map((a,l)=>a-s[o][l]))),n=t.reduce((r,o)=>r+o,0),i=Math.max(0,Math.min(1,e))*n;for(let r=0;r<t.length;r++){if(i<=t[r]||r===t.length-1){let o=s[r],a=s[r+1],l=t[r]?Math.min(1,i/t[r]):1;return{position:o.map((c,h)=>c+(a[h]-c)*l),heading:Math.atan2(a[0]-o[0],a[2]-o[2]),distance:n}}i-=t[r]}return{position:[...s[0]],heading:0,distance:0}}yf.exports={TARGETS:Yl,facilityFor:sv,routeFor:rv,sampleRoute:ov}});var Ef=cu((KS,Tf)=>{"use strict";var{routeFor:Mf,sampleRoute:av,TARGETS:Sf}=jh(),Kl=new Set(["assigned","starting_agent","agent_working","running","agent_review","queued","starting","working","testing"]),Qh=new Set(["passed","failed","cancelled","interrupted","timed_out","stopping","termination_unknown"]),Zl=(s,e,t)=>{let n=Math.max(0,Math.min(1,(t-s)/(e-s)));return n*n*(3-2*n)},Jl=s=>s?.artifact?.candidateHash||s?.source?.hash||"",eu=s=>s&&JSON.stringify([s.projectId||"",s.root||"",s.id,s.created,s.sha||"",s.manifest||{}]),bf=s=>s&&JSON.stringify([eu(s),Jl(s)]);function lv(){let s="",e=null,t=0,n=100,i=!1,r=!0,o=!1,a=null,l="test",c=7.5,h=[5,.95,12];function d(f,{follow:g=!1,unavailable:x=!1,startPosition:p}={}){if(r=!x,!f){e=null,s="",t=0,i=!1,n=100,o=!1,a=null;return}let m=bf(f),S=e&&eu(e)===eu(f)&&!Jl(e)&&Jl(f),T=m!==s&&!S;T?(s=m,t=0,n=100,i=!1,o=g||Kl.has(f.state),i=g&&Qh.has(f.state),o||(t=12),h=Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)?[...p]:[5,.95,12],l=f.presentationFacility||"test",a=f.projectId?Mf(h,l):null,c=7.5):r&&e&&Kl.has(e.state)&&Qh.has(f.state)&&o&&(i=!0),!T&&f.projectId&&f.presentationFacility&&f.presentationFacility!==l&&(l=f.presentationFacility,a=Mf(h,l),c=Math.max(7.5,t)),s=m,e={...f,steps:Array.isArray(f.steps)?f.steps:Array.isArray(f.checks)?f.checks:[]}}function u(f=0,g=!1){let x=["cancelled","stopping","interrupted","timed_out","termination_unknown"].includes(e?.state);r&&e&&!x&&(t+=Math.max(0,Math.min(.1,f))),g&&e&&(t=Math.max(t,12));let p=a?Zl(c,c+4.5,t):Zl(7.5,12,t),m=a?av(a,p):null;m&&(h=m.position);let S=!!e&&p>=1;r&&i&&S?(n=0,i=!1):n+=Math.max(0,Math.min(.1,f));let T=r?e?.state||"idle":"unknown",y=e?r?x?"stopped":o?t<.75?"notice":t<2.2?"uncertain":t<3.4?"deploy":t<5.8?"search":t<6.4?"lock":t<7.5?"turn":S?Kl.has(T)?"watch":"result":"travel":"inspect":"unknown":"ready",E=e?p:0,M=e?.steps.filter(I=>I.state==="passed").length||0,A=Array.isArray(e?.checkPlan)&&e.checkPlan.length?e.checkPlan.length:Number.isInteger(e?.total)&&e.total>0?e.total:e?.projectId?Qh.has(T)&&e.steps.length?e.steps.length:null:6,_=e?.kind==="visual"?"Browser checks":e?.kind==="smoke"?"Smoke checks":e?.projectId?"Source checks":"Smoke checks",w=r&&n<1.8&&!g?T==="passed"?"relief":T==="failed"?"concern":"settle":null;return{phase:y,age:t,state:T,arrived:S,live:o,available:r,reaction:w,reactionAge:n,travel:E,position:m?.position||[5-4*Math.min(E/.25,1)-19*Math.max(0,(E-.25)/.75),.95,12-5*Math.min(E/.25,1)],heading:m?.heading,facility:l,basis:e?.presentationBasis||"observed",target:Sf[l]||Sf.test,passed:M,total:A,checkKind:_,candidateHash:Jl(e),projectId:e?.projectId||"",current:r&&e?.steps.find(I=>I.state==="running")?.name||"",runId:e?.id??null,root:e?.root||"",sha:e?.sha||"",extension:e?Zl(2.2,3,t):0,open:e?Zl(2.75,3.4,t):0,locked:r&&!!e&&t>=5.8,scanning:r&&y==="search",active:r&&Kl.has(T),label:r?e?`${A?M+"/"+A:M} ${_.toLowerCase()} \xB7 ${T.replaceAll("_"," ")}`:"Ready for an assignment":"Status unavailable"}}return{setRun:d,sample:u}}Tf.exports={createTestPerformance:lv,keyOf:bf}});var $u=0,kc=1,ju=2;var uo=1,Va=2,sr=3,ii=0,Wt=1,Ht=2,Nn=0,rr=1,si=2,Hc=3,Vc=4,Qu=5;var ps=100,ed=101,td=102,nd=103,id=104,sd=200,rd=201,od=202,ad=203,Gc=204,Wc=205,ld=206,cd=207,hd=208,ud=209,dd=210,fd=211,pd=212,md=213,gd=214,da=0,fa=1,pa=2,ks=3,ma=4,ga=5,_a=6,xa=7,Ga=0,_d=1,xd=2,Yn=0,fo=1,po=2,mo=3,ms=4,go=5,_o=6,xo=7,Rc="attached",vd="detached",Xc=300,Wi=301,gs=302,Wa=303,Xa=304,vo=306,zi=1e3,Cn=1001,Hs=1002,Pt=1003,qa=1004;var _s=1005;var Lt=1006,or=1007;var Kn=1008;var vn=1009,qc=1010,Yc=1011,ar=1012,Ya=1013,Zn=1014,bn=1015,en=1016,Ka=1017,Za=1018,lr=1020,Kc=35902,Zc=35899,Jc=1021,$c=1022,Tn=1023,Qn=1026,Xi=1027,Ja=1028,$a=1029,qi=1030,ja=1031;var Qa=1033,yo=33776,Mo=33777,So=33778,bo=33779,el=35840,tl=35841,nl=35842,il=35843,sl=36196,rl=37492,ol=37496,al=37488,ll=37489,To=37490,cl=37491,hl=37808,ul=37809,dl=37810,fl=37811,pl=37812,ml=37813,gl=37814,_l=37815,xl=37816,vl=37817,yl=37818,Ml=37819,Sl=37820,bl=37821,Tl=36492,El=36494,wl=36495,Al=36283,Rl=36284,Eo=36285,Cl=36286;var ss=2300,rs=2301,ca=2302,Cc=2303,Ic=2400,Pc=2401,Lc=2402,yd=2500;var jc=0,wo=1,cr=2,Md=3200;var Ao=0,Sd=1,Ei="",It="srgb",cn="srgb-linear",Fr="linear",ot="srgb";var ha=7680;var bd=519,Td=512,Ed=513,wd=514,Il=515,Ad=516,Rd=517,Pl=518,Cd=519,Qc=35044,Ro=35048;var eh="300 es",Xn=2e3,Vs=2001;function Wf(s){for(let e=s.length-1;e>=0;--e)if(s[e]>=65535)return!0;return!1}function Xf(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}function Gs(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function Id(){let s=Gs("canvas");return s.style.display="block",s}var uu={},Ws=null;function Or(...s){let e="THREE."+s.shift();Ws?Ws("log",e,...s):console.log(e,...s)}function Pd(s){let e=s[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=s[1];t&&t.isStackTrace?s[0]+=" "+t.getLocation():s[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return s}function De(...s){s=Pd(s);let e="THREE."+s.shift();if(Ws)Ws("warn",e,...s);else{let t=s[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...s)}}function ke(...s){s=Pd(s);let e="THREE."+s.shift();if(Ws)Ws("error",e,...s);else{let t=s[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...s)}}function is(...s){let e=s.join(" ");e in uu||(uu[e]=!0,De(...s))}function Ld(s,e,t){return new Promise(function(n,i){function r(){switch(s.clientWaitSync(e,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:i();break;case s.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}var Nd={[da]:fa,[pa]:_a,[ma]:xa,[ks]:ga,[fa]:da,[_a]:pa,[xa]:ma,[ga]:ks},ei=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let i=n[e];if(i!==void 0){let r=i.indexOf(t);r!==-1&&i.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,o=i.length;r<o;r++)i[r].call(this,e);e.target=null}}},nn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],du=1234567,Lr=Math.PI/180,os=180/Math.PI;function qn(){let s=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(nn[s&255]+nn[s>>8&255]+nn[s>>16&255]+nn[s>>24&255]+"-"+nn[e&255]+nn[e>>8&255]+"-"+nn[e>>16&15|64]+nn[e>>24&255]+"-"+nn[t&63|128]+nn[t>>8&255]+"-"+nn[t>>16&255]+nn[t>>24&255]+nn[n&255]+nn[n>>8&255]+nn[n>>16&255]+nn[n>>24&255]).toLowerCase()}function qe(s,e,t){return Math.max(e,Math.min(t,s))}function th(s,e){return(s%e+e)%e}function qf(s,e,t,n,i){return n+(s-e)*(i-n)/(t-e)}function Yf(s,e,t){return s!==e?(t-s)/(e-s):0}function Nr(s,e,t){return(1-t)*s+t*e}function Kf(s,e,t,n){return Nr(s,e,1-Math.exp(-t*n))}function Zf(s,e=1){return e-Math.abs(th(s,e*2)-e)}function Jf(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*(3-2*s))}function $f(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*s*(s*(s*6-15)+10))}function jf(s,e){return s+Math.floor(Math.random()*(e-s+1))}function Qf(s,e){return s+Math.random()*(e-s)}function ep(s){return s*(.5-Math.random())}function tp(s){s!==void 0&&(du=s);let e=du+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function np(s){return s*Lr}function ip(s){return s*os}function sp(s){return s>0&&Number.isInteger(s)&&2**Math.round(Math.log2(s))===s}function rp(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function op(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function ap(s,e,t,n,i){let r=Math.cos,o=Math.sin,a=r(t/2),l=o(t/2),c=r((e+n)/2),h=o((e+n)/2),d=r((e-n)/2),u=o((e-n)/2),f=r((n-e)/2),g=o((n-e)/2);switch(i){case"XYX":s.set(a*h,l*d,l*u,a*c);break;case"YZY":s.set(l*u,a*h,l*d,a*c);break;case"ZXZ":s.set(l*d,l*u,a*h,a*c);break;case"XZX":s.set(a*h,l*g,l*f,a*c);break;case"YXY":s.set(l*f,a*h,l*g,a*c);break;case"ZYZ":s.set(l*g,l*f,a*h,a*c);break;default:De("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function Wn(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:case Uint8ClampedArray:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function ft(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var at={DEG2RAD:Lr,RAD2DEG:os,generateUUID:qn,clamp:qe,euclideanModulo:th,mapLinear:qf,inverseLerp:Yf,lerp:Nr,damp:Kf,pingpong:Zf,smoothstep:Jf,smootherstep:$f,randInt:jf,randFloat:Qf,randFloatSpread:ep,seededRandom:tp,degToRad:np,radToDeg:ip,isPowerOfTwo:sp,ceilPowerOfTwo:rp,floorPowerOfTwo:op,setQuaternionFromProperEuler:ap,normalize:ft,denormalize:Wn},ae=class s{static{s.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=qe(this.x,e.x,t.x),this.y=qe(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=qe(this.x,e,t),this.y=qe(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(qe(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(qe(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*n-o*i+e.x,this.y=r*i+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},zt=class{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,o,a){let l=n[i+0],c=n[i+1],h=n[i+2],d=n[i+3],u=r[o+0],f=r[o+1],g=r[o+2],x=r[o+3];if(d!==x||l!==u||c!==f||h!==g){let p=l*u+c*f+h*g+d*x;p<0&&(u=-u,f=-f,g=-g,x=-x,p=-p);let m=1-a;if(p<.9995){let S=Math.acos(p),T=Math.sin(S);m=Math.sin(m*S)/T,a=Math.sin(a*S)/T,l=l*m+u*a,c=c*m+f*a,h=h*m+g*a,d=d*m+x*a}else{l=l*m+u*a,c=c*m+f*a,h=h*m+g*a,d=d*m+x*a;let S=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=S,c*=S,h*=S,d*=S}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,i,r,o){let a=n[i],l=n[i+1],c=n[i+2],h=n[i+3],d=r[o],u=r[o+1],f=r[o+2],g=r[o+3];return e[t]=a*g+h*d+l*f-c*u,e[t+1]=l*g+h*u+c*d-a*f,e[t+2]=c*g+h*f+a*u-l*d,e[t+3]=h*g-a*d-l*u-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,i=e._y,r=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(i/2),d=a(r/2),u=l(n/2),f=l(i/2),g=l(r/2);switch(o){case"XYZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"YXZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"ZXY":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"ZYX":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"YZX":this._x=u*h*d+c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d-u*f*g;break;case"XZY":this._x=u*h*d-c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d+u*f*g;break;default:De("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],d=t[10],u=n+a+d;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(o-i)*f}else if(n>a&&n>d){let f=2*Math.sqrt(1+n-a-d);this._w=(h-l)/f,this._x=.25*f,this._y=(i+o)/f,this._z=(r+c)/f}else if(a>d){let f=2*Math.sqrt(1+a-n-d);this._w=(r-c)/f,this._x=(i+o)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+d-n-a);this._w=(o-i)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(qe(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,r=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+o*a+i*c-r*l,this._y=i*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-i*a,this._w=o*h-n*a-i*l-r*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,i=e._y,r=e._z,o=e._w,a=this.dot(e);a<0&&(n=-n,i=-i,r=-r,o=-o,a=-a);let l=1-t;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+r*t,this._w=this._w*l+o*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+r*t,this._w=this._w*l+o*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},C=class s{static{s.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(fu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(fu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,o=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*o,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*o,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,r=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*i-a*n),h=2*(a*t-r*i),d=2*(r*n-o*t);return this.x=t+l*c+o*d-a*h,this.y=n+l*h+a*c-r*d,this.z=i+l*d+r*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=qe(this.x,e.x,t.x),this.y=qe(this.y,e.y,t.y),this.z=qe(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=qe(this.x,e,t),this.y=qe(this.y,e,t),this.z=qe(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(qe(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,r=e.z,o=t.x,a=t.y,l=t.z;return this.x=i*l-r*a,this.y=r*o-n*l,this.z=n*a-i*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return tc.copy(this).projectOnVector(e),this.sub(tc)}reflect(e){return this.sub(tc.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(qe(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},tc=new C,fu=new zt,He=class s{static{s.prototype.isMatrix3=!0}constructor(e,t,n,i,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,l,c)}set(e,t,n,i,r,o,a,l,c){let h=this.elements;return h[0]=e,h[1]=i,h[2]=a,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],d=n[7],u=n[2],f=n[5],g=n[8],x=i[0],p=i[3],m=i[6],S=i[1],T=i[4],y=i[7],E=i[2],M=i[5],A=i[8];return r[0]=o*x+a*S+l*E,r[3]=o*p+a*T+l*M,r[6]=o*m+a*y+l*A,r[1]=c*x+h*S+d*E,r[4]=c*p+h*T+d*M,r[7]=c*m+h*y+d*A,r[2]=u*x+f*S+g*E,r[5]=u*p+f*T+g*M,r[8]=u*m+f*y+g*A,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-n*r*h+n*a*l+i*r*c-i*o*l}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],d=h*o-a*c,u=a*l-h*r,f=c*r-o*l,g=t*d+n*u+i*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/g;return e[0]=d*x,e[1]=(i*c-h*n)*x,e[2]=(a*n-i*o)*x,e[3]=u*x,e[4]=(h*t-i*l)*x,e[5]=(i*r-a*t)*x,e[6]=f*x,e[7]=(n*l-c*t)*x,e[8]=(o*t-n*r)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+e,-i*c,i*l,-i*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return is("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(nc.makeScale(e,t)),this}rotate(e){return is("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(nc.makeRotation(-e)),this}translate(e,t){return is("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(nc.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},nc=new He,pu=new He().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),mu=new He().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function lp(){let s={enabled:!0,workingColorSpace:cn,spaces:{},convert:function(i,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===ot&&(i.r=_i(i.r),i.g=_i(i.g),i.b=_i(i.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(i.applyMatrix3(this.spaces[r].toXYZ),i.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ot&&(i.r=zs(i.r),i.g=zs(i.g),i.b=zs(i.b))),i},workingToColorSpace:function(i,r){return this.convert(i,this.workingColorSpace,r)},colorSpaceToWorking:function(i,r){return this.convert(i,r,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Ei?Fr:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,r=this.workingColorSpace){return i.fromArray(this.spaces[r].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,r,o){return i.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(i,r){return is("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),s.workingToColorSpace(i,r)},toWorkingColorSpace:function(i,r){return is("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),s.colorSpaceToWorking(i,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return s.define({[cn]:{primaries:e,whitePoint:n,transfer:Fr,toXYZ:pu,fromXYZ:mu,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:It},outputColorSpaceConfig:{drawingBufferColorSpace:It}},[It]:{primaries:e,whitePoint:n,transfer:ot,toXYZ:pu,fromXYZ:mu,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:It}}}),s}var Ge=lp();function _i(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function zs(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}var Es,va=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Es===void 0&&(Es=Gs("canvas")),Es.width=e.width,Es.height=e.height;let i=Es.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),n=Es}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Gs("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let o=0;o<r.length;o++)r[o]=_i(r[o]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(_i(t[n]/255)*255):t[n]=_i(t[n]);return{data:t,width:e.width,height:e.height}}else return De("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},cp=0,Xs=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:cp++}),this.uuid=qn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let o=0,a=i.length;o<a;o++)i[o].isDataTexture?r.push(ic(i[o].image)):r.push(ic(i[o]))}else r=ic(i);n.url=r}return t||(e.images[this.uuid]=n),n}};function ic(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?va.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(De("Texture: Unable to serialize Texture."),{})}var hp=0,sc=new C,Zt=class s extends ei{constructor(e=s.DEFAULT_IMAGE,t=s.DEFAULT_MAPPING,n=Cn,i=Cn,r=Lt,o=Kn,a=Tn,l=vn,c=s.DEFAULT_ANISOTROPY,h=Ei){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:hp++}),this.uuid=qn(),this.name="",this.source=new Xs(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new ae(0,0),this.repeat=new ae(1,1),this.center=new ae(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new He,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(sc).x}get height(){return this.source.getSize(sc).y}get depth(){return this.source.getSize(sc).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){De(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){De(`Texture.setValues(): property '${t}' does not exist.`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Xc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case zi:e.x=e.x-Math.floor(e.x);break;case Cn:e.x=e.x<0?0:1;break;case Hs:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case zi:e.y=e.y-Math.floor(e.y);break;case Cn:e.y=e.y<0?0:1;break;case Hs:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Zt.DEFAULT_IMAGE=null;Zt.DEFAULT_MAPPING=Xc;Zt.DEFAULT_ANISOTROPY=1;var pt=class s{static{s.prototype.isVector4=!0}constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*i+o[12]*r,this.y=o[1]*t+o[5]*n+o[9]*i+o[13]*r,this.z=o[2]*t+o[6]*n+o[10]*i+o[14]*r,this.w=o[3]*t+o[7]*n+o[11]*i+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,l=e.elements,c=l[0],h=l[4],d=l[8],u=l[1],f=l[5],g=l[9],x=l[2],p=l[6],m=l[10];if(Math.abs(h-u)<.01&&Math.abs(d-x)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+x)<.1&&Math.abs(g+p)<.1&&Math.abs(c+f+m-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let T=(c+1)/2,y=(f+1)/2,E=(m+1)/2,M=(h+u)/4,A=(d+x)/4,_=(g+p)/4;return T>y&&T>E?T<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(T),i=M/n,r=A/n):y>E?y<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(y),n=M/i,r=_/i):E<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(E),n=A/r,i=_/r),this.set(n,i,r,t),this}let S=Math.sqrt((p-g)*(p-g)+(d-x)*(d-x)+(u-h)*(u-h));return Math.abs(S)<.001&&(S=1),this.x=(p-g)/S,this.y=(d-x)/S,this.z=(u-h)/S,this.w=Math.acos((c+f+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=qe(this.x,e.x,t.x),this.y=qe(this.y,e.y,t.y),this.z=qe(this.z,e.z,t.z),this.w=qe(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=qe(this.x,e,t),this.y=qe(this.y,e,t),this.z=qe(this.z,e,t),this.w=qe(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(qe(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},ya=class extends ei{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Lt,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new pt(0,0,e,t),this.scissorTest=!1,this.viewport=new pt(0,0,e,t),this.textures=[];let i={width:e,height:t,depth:n.depth},r=new Zt(i),o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:Lt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0&&(this.textures[i].isArrayTexture=this.textures[i].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let i=Object.assign({},e.textures[t].image);this.textures[t].source=new Xs(i)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},kt=class extends ya{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Br=class extends Zt{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Pt,this.minFilter=Pt,this.wrapR=Cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var Ma=class extends Zt{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Pt,this.minFilter=Pt,this.wrapR=Cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var Oe=class s{static{s.prototype.isMatrix4=!0}constructor(e,t,n,i,r,o,a,l,c,h,d,u,f,g,x,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,l,c,h,d,u,f,g,x,p)}set(e,t,n,i,r,o,a,l,c,h,d,u,f,g,x,p){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=r,m[5]=o,m[9]=a,m[13]=l,m[2]=c,m[6]=h,m[10]=d,m[14]=u,m[3]=f,m[7]=g,m[11]=x,m[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new s().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,i=1/ws.setFromMatrixColumn(e,0).length(),r=1/ws.setFromMatrixColumn(e,1).length(),o=1/ws.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,i=e.y,r=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(r),d=Math.sin(r);if(e.order==="XYZ"){let u=o*h,f=o*d,g=a*h,x=a*d;t[0]=l*h,t[4]=-l*d,t[8]=c,t[1]=f+g*c,t[5]=u-x*c,t[9]=-a*l,t[2]=x-u*c,t[6]=g+f*c,t[10]=o*l}else if(e.order==="YXZ"){let u=l*h,f=l*d,g=c*h,x=c*d;t[0]=u+x*a,t[4]=g*a-f,t[8]=o*c,t[1]=o*d,t[5]=o*h,t[9]=-a,t[2]=f*a-g,t[6]=x+u*a,t[10]=o*l}else if(e.order==="ZXY"){let u=l*h,f=l*d,g=c*h,x=c*d;t[0]=u-x*a,t[4]=-o*d,t[8]=g+f*a,t[1]=f+g*a,t[5]=o*h,t[9]=x-u*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let u=o*h,f=o*d,g=a*h,x=a*d;t[0]=l*h,t[4]=g*c-f,t[8]=u*c+x,t[1]=l*d,t[5]=x*c+u,t[9]=f*c-g,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let u=o*l,f=o*c,g=a*l,x=a*c;t[0]=l*h,t[4]=x-u*d,t[8]=g*d+f,t[1]=d,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=f*d+g,t[10]=u-x*d}else if(e.order==="XZY"){let u=o*l,f=o*c,g=a*l,x=a*c;t[0]=l*h,t[4]=-d,t[8]=c*h,t[1]=u*d+x,t[5]=o*h,t[9]=f*d-g,t[2]=g*d-f,t[6]=a*h,t[10]=x*d+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(up,e,dp)}lookAt(e,t,n){let i=this.elements;return Mn.subVectors(e,t),Mn.lengthSq()===0&&(Mn.z=1),Mn.normalize(),Li.crossVectors(n,Mn),Li.lengthSq()===0&&(Math.abs(n.z)===1?Mn.x+=1e-4:Mn.z+=1e-4,Mn.normalize(),Li.crossVectors(n,Mn)),Li.normalize(),Bo.crossVectors(Mn,Li),i[0]=Li.x,i[4]=Bo.x,i[8]=Mn.x,i[1]=Li.y,i[5]=Bo.y,i[9]=Mn.y,i[2]=Li.z,i[6]=Bo.z,i[10]=Mn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],d=n[5],u=n[9],f=n[13],g=n[2],x=n[6],p=n[10],m=n[14],S=n[3],T=n[7],y=n[11],E=n[15],M=i[0],A=i[4],_=i[8],w=i[12],I=i[1],L=i[5],U=i[9],O=i[13],N=i[2],B=i[6],q=i[10],G=i[14],j=i[3],X=i[7],$=i[11],ne=i[15];return r[0]=o*M+a*I+l*N+c*j,r[4]=o*A+a*L+l*B+c*X,r[8]=o*_+a*U+l*q+c*$,r[12]=o*w+a*O+l*G+c*ne,r[1]=h*M+d*I+u*N+f*j,r[5]=h*A+d*L+u*B+f*X,r[9]=h*_+d*U+u*q+f*$,r[13]=h*w+d*O+u*G+f*ne,r[2]=g*M+x*I+p*N+m*j,r[6]=g*A+x*L+p*B+m*X,r[10]=g*_+x*U+p*q+m*$,r[14]=g*w+x*O+p*G+m*ne,r[3]=S*M+T*I+y*N+E*j,r[7]=S*A+T*L+y*B+E*X,r[11]=S*_+T*U+y*q+E*$,r[15]=S*w+T*O+y*G+E*ne,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],d=e[6],u=e[10],f=e[14],g=e[3],x=e[7],p=e[11],m=e[15],S=l*f-c*u,T=a*f-c*d,y=a*u-l*d,E=o*f-c*h,M=o*u-l*h,A=o*d-a*h;return t*(x*S-p*T+m*y)-n*(g*S-p*E+m*M)+i*(g*T-x*E+m*A)-r*(g*y-x*M+p*A)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[1],o=e[5],a=e[9],l=e[2],c=e[6],h=e[10];return t*(o*h-a*c)-n*(r*h-a*l)+i*(r*c-o*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],d=e[9],u=e[10],f=e[11],g=e[12],x=e[13],p=e[14],m=e[15],S=t*a-n*o,T=t*l-i*o,y=t*c-r*o,E=n*l-i*a,M=n*c-r*a,A=i*c-r*l,_=h*x-d*g,w=h*p-u*g,I=h*m-f*g,L=d*p-u*x,U=d*m-f*x,O=u*m-f*p,N=S*O-T*U+y*L+E*I-M*w+A*_;if(N===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let B=1/N;return e[0]=(a*O-l*U+c*L)*B,e[1]=(i*U-n*O-r*L)*B,e[2]=(x*A-p*M+m*E)*B,e[3]=(u*M-d*A-f*E)*B,e[4]=(l*I-o*O-c*w)*B,e[5]=(t*O-i*I+r*w)*B,e[6]=(p*y-g*A-m*T)*B,e[7]=(h*A-u*y+f*T)*B,e[8]=(o*U-a*I+c*_)*B,e[9]=(n*I-t*U-r*_)*B,e[10]=(g*M-x*y+m*S)*B,e[11]=(d*y-h*M-f*S)*B,e[12]=(a*w-o*L-l*_)*B,e[13]=(t*L-n*w+i*_)*B,e[14]=(x*T-g*E-p*S)*B,e[15]=(h*E-d*T+u*S)*B,this}scale(e){let t=this.elements,n=e.x,i=e.y,r=e.z;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,o=e.x,a=e.y,l=e.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-i*l,c*l+i*a,0,c*a+i*l,h*a+n,h*l-i*o,0,c*l-i*a,h*l+i*o,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,o){return this.set(1,n,r,0,e,1,o,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,r=t._x,o=t._y,a=t._z,l=t._w,c=r+r,h=o+o,d=a+a,u=r*c,f=r*h,g=r*d,x=o*h,p=o*d,m=a*d,S=l*c,T=l*h,y=l*d,E=n.x,M=n.y,A=n.z;return i[0]=(1-(x+m))*E,i[1]=(f+y)*E,i[2]=(g-T)*E,i[3]=0,i[4]=(f-y)*M,i[5]=(1-(u+m))*M,i[6]=(p+S)*M,i[7]=0,i[8]=(g+T)*A,i[9]=(p-S)*A,i[10]=(1-(u+x))*A,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let o=ws.set(i[0],i[1],i[2]).length(),a=ws.set(i[4],i[5],i[6]).length(),l=ws.set(i[8],i[9],i[10]).length();r<0&&(o=-o),kn.copy(this);let c=1/o,h=1/a,d=1/l;return kn.elements[0]*=c,kn.elements[1]*=c,kn.elements[2]*=c,kn.elements[4]*=h,kn.elements[5]*=h,kn.elements[6]*=h,kn.elements[8]*=d,kn.elements[9]*=d,kn.elements[10]*=d,t.setFromRotationMatrix(kn),n.x=o,n.y=a,n.z=l,this}makePerspective(e,t,n,i,r,o,a=Xn,l=!1){let c=this.elements,h=2*r/(t-e),d=2*r/(n-i),u=(t+e)/(t-e),f=(n+i)/(n-i),g,x;if(l)g=r/(o-r),x=o*r/(o-r);else if(a===Xn)g=-(o+r)/(o-r),x=-2*o*r/(o-r);else if(a===Vs)g=-o/(o-r),x=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=d,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,i,r,o,a=Xn,l=!1){let c=this.elements,h=2/(t-e),d=2/(n-i),u=-(t+e)/(t-e),f=-(n+i)/(n-i),g,x;if(l)g=1/(o-r),x=o/(o-r);else if(a===Xn)g=-2/(o-r),x=-(o+r)/(o-r);else if(a===Vs)g=-1/(o-r),x=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=d,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},ws=new C,kn=new Oe,up=new C(0,0,0),dp=new C(1,1,1),Li=new C,Bo=new C,Mn=new C,gu=new Oe,_u=new zt,In=class s{constructor(e=0,t=0,n=0,i=s.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],o=i[4],a=i[8],l=i[1],c=i[5],h=i[9],d=i[2],u=i[6],f=i[10];switch(t){case"XYZ":this._y=Math.asin(qe(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-qe(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(qe(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-qe(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(qe(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-qe(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:De("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return gu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(gu,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return _u.setFromEuler(this),this.setFromQuaternion(_u,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};In.DEFAULT_ORDER="XYZ";var zr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},fp=0,xu=new C,As=new zt,ui=new Oe,zo=new C,Tr=new C,pp=new C,mp=new zt,vu=new C(1,0,0),yu=new C(0,1,0),Mu=new C(0,0,1),Su={type:"added"},gp={type:"removed"},Rs={type:"childadded",child:null},rc={type:"childremoved",child:null},bt=class s extends ei{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:fp++}),this.uuid=qn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=s.DEFAULT_UP.clone();let e=new C,t=new In,n=new zt,i=new C(1,1,1);function r(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Oe},normalMatrix:{value:new He}}),this.matrix=new Oe,this.matrixWorld=new Oe,this.matrixAutoUpdate=s.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=s.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new zr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return As.setFromAxisAngle(e,t),this.quaternion.multiply(As),this}rotateOnWorldAxis(e,t){return As.setFromAxisAngle(e,t),this.quaternion.premultiply(As),this}rotateX(e){return this.rotateOnAxis(vu,e)}rotateY(e){return this.rotateOnAxis(yu,e)}rotateZ(e){return this.rotateOnAxis(Mu,e)}translateOnAxis(e,t){return xu.copy(e).applyQuaternion(this.quaternion),this.position.add(xu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(vu,e)}translateY(e){return this.translateOnAxis(yu,e)}translateZ(e){return this.translateOnAxis(Mu,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(ui.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?zo.copy(e):zo.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),Tr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?ui.lookAt(Tr,zo,this.up):ui.lookAt(zo,Tr,this.up),this.quaternion.setFromRotationMatrix(ui),i&&(ui.extractRotation(i.matrixWorld),As.setFromRotationMatrix(ui),this.quaternion.premultiply(As.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(ke("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Su),Rs.child=e,this.dispatchEvent(Rs),Rs.child=null):ke("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(gp),rc.child=e,this.dispatchEvent(rc),rc.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),ui.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),ui.multiply(e.parent.matrixWorld)),e.applyMatrix4(ui),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Su),Rs.child=e,this.dispatchEvent(Rs),Rs.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let i=this.children;for(let r=0,o=i.length;r<o;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Tr,e,pp),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Tr,mp,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,i=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*i,r[13]+=n-r[1]*t-r[5]*n-r[9]*i,r[14]+=i-r[2]*t-r[6]*n-r[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,i.name=this.name,i.castShadow=this.castShadow,i.receiveShadow=this.receiveShadow,i.visible=this.visible,i.frustumCulled=this.frustumCulled,i.renderOrder=this.renderOrder,i.static=this.static,i.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null&&(i.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(i.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(a=>({...a})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let d=l[c];r(e.shapes,d)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(e.materials,this.material[l]));i.material=a}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];i.animations.push(r(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),d=o(e.shapes),u=o(e.skeletons),f=o(e.animations),g=o(e.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=i,n;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};bt.DEFAULT_UP=new C(0,1,0);bt.DEFAULT_MATRIX_AUTO_UPDATE=!0;bt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Ze=class extends bt{constructor(){super(),this.isGroup=!0,this.type="Group"}},_p={type:"move"},qs=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Ze,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Ze,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new C,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new C),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Ze,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new C,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new C,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let x of e.hand.values()){let p=t.getJointPose(x,n),m=this._getHandJoint(c,x);p!==null&&(m.matrix.fromArray(p.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=p.radius),m.visible=p!==null}let h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],u=h.position.distanceTo(d.position),f=.02,g=.005;c.inputState.pinching&&u>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(_p)))}return a!==null&&(a.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Ze;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},Dd={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ni={h:0,s:0,l:0},ko={h:0,s:0,l:0};function oc(s,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?s+(e-s)*6*t:t<1/2?e:t<2/3?s+(e-s)*6*(2/3-t):s}var Ce=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=It){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ge.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=Ge.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ge.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=Ge.workingColorSpace){if(e=th(e,1),t=qe(t,0,1),n=qe(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,o=2*n-r;this.r=oc(o,r,e+1/3),this.g=oc(o,r,e),this.b=oc(o,r,e-1/3)}return Ge.colorSpaceToWorking(this,i),this}setStyle(e,t=It){function n(r){r!==void 0&&parseFloat(r)<1&&De("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,o=i[1],a=i[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:De("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);De("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=It){let n=Dd[e.toLowerCase()];return n!==void 0?this.setHex(n,t):De("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=_i(e.r),this.g=_i(e.g),this.b=_i(e.b),this}copyLinearToSRGB(e){return this.r=zs(e.r),this.g=zs(e.g),this.b=zs(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=It){return Ge.workingToColorSpace(sn.copy(this),e),Math.round(qe(sn.r*255,0,255))*65536+Math.round(qe(sn.g*255,0,255))*256+Math.round(qe(sn.b*255,0,255))}getHexString(e=It){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ge.workingColorSpace){Ge.workingToColorSpace(sn.copy(this),t);let n=sn.r,i=sn.g,r=sn.b,o=Math.max(n,i,r),a=Math.min(n,i,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let d=o-a;switch(c=h<=.5?d/(o+a):d/(2-o-a),o){case n:l=(i-r)/d+(i<r?6:0);break;case i:l=(r-n)/d+2;break;case r:l=(n-i)/d+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Ge.workingColorSpace){return Ge.workingToColorSpace(sn.copy(this),t),e.r=sn.r,e.g=sn.g,e.b=sn.b,e}getStyle(e=It){Ge.workingToColorSpace(sn.copy(this),e);let t=sn.r,n=sn.g,i=sn.b;return e!==It?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(Ni),this.setHSL(Ni.h+e,Ni.s+t,Ni.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Ni),e.getHSL(ko);let n=Nr(Ni.h,ko.h,t),i=Nr(Ni.s,ko.s,t),r=Nr(Ni.l,ko.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},sn=new Ce;Ce.NAMES=Dd;var kr=class s{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new Ce(e),this.density=t}clone(){return new s(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var as=class extends bt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new In,this.environmentIntensity=1,this.environmentRotation=new In,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Hn=new C,di=new C,ac=new C,fi=new C,Cs=new C,Is=new C,bu=new C,lc=new C,cc=new C,hc=new C,uc=new pt,dc=new pt,fc=new pt,Bi=class s{constructor(e=new C,t=new C,n=new C){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),Hn.subVectors(e,t),i.cross(Hn);let r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(e,t,n,i,r){Hn.subVectors(i,t),di.subVectors(n,t),ac.subVectors(e,t);let o=Hn.dot(Hn),a=Hn.dot(di),l=Hn.dot(ac),c=di.dot(di),h=di.dot(ac),d=o*c-a*a;if(d===0)return r.set(0,0,0),null;let u=1/d,f=(c*l-a*h)*u,g=(o*h-a*l)*u;return r.set(1-f-g,g,f)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,fi)===null?!1:fi.x>=0&&fi.y>=0&&fi.x+fi.y<=1}static getInterpolation(e,t,n,i,r,o,a,l){return this.getBarycoord(e,t,n,i,fi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,fi.x),l.addScaledVector(o,fi.y),l.addScaledVector(a,fi.z),l)}static getInterpolatedAttribute(e,t,n,i,r,o){return uc.setScalar(0),dc.setScalar(0),fc.setScalar(0),uc.fromBufferAttribute(e,t),dc.fromBufferAttribute(e,n),fc.fromBufferAttribute(e,i),o.setScalar(0),o.addScaledVector(uc,r.x),o.addScaledVector(dc,r.y),o.addScaledVector(fc,r.z),o}static isFrontFacing(e,t,n,i){return Hn.subVectors(n,t),di.subVectors(e,t),Hn.cross(di).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Hn.subVectors(this.c,this.b),di.subVectors(this.a,this.b),Hn.cross(di).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return s.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return s.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return s.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return s.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return s.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,o,a;Cs.subVectors(i,n),Is.subVectors(r,n),lc.subVectors(e,n);let l=Cs.dot(lc),c=Is.dot(lc);if(l<=0&&c<=0)return t.copy(n);cc.subVectors(e,i);let h=Cs.dot(cc),d=Is.dot(cc);if(h>=0&&d<=h)return t.copy(i);let u=l*d-h*c;if(u<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(n).addScaledVector(Cs,o);hc.subVectors(e,r);let f=Cs.dot(hc),g=Is.dot(hc);if(g>=0&&f<=g)return t.copy(r);let x=f*c-l*g;if(x<=0&&c>=0&&g<=0)return a=c/(c-g),t.copy(n).addScaledVector(Is,a);let p=h*g-f*d;if(p<=0&&d-h>=0&&f-g>=0)return bu.subVectors(r,i),a=(d-h)/(d-h+(f-g)),t.copy(i).addScaledVector(bu,a);let m=1/(p+x+u);return o=x*m,a=u*m,t.copy(n).addScaledVector(Cs,o).addScaledVector(Is,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},hn=class{constructor(e=new C(1/0,1/0,1/0),t=new C(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Vn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Vn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Vn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,Vn):Vn.fromBufferAttribute(r,o),Vn.applyMatrix4(e.matrixWorld),this.expandByPoint(Vn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Ho.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ho.copy(n.boundingBox)),Ho.applyMatrix4(e.matrixWorld),this.union(Ho)}let i=e.children;for(let r=0,o=i.length;r<o;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Vn),Vn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Er),Vo.subVectors(this.max,Er),Ps.subVectors(e.a,Er),Ls.subVectors(e.b,Er),Ns.subVectors(e.c,Er),Di.subVectors(Ls,Ps),Ui.subVectors(Ns,Ls),Qi.subVectors(Ps,Ns);let t=[0,-Di.z,Di.y,0,-Ui.z,Ui.y,0,-Qi.z,Qi.y,Di.z,0,-Di.x,Ui.z,0,-Ui.x,Qi.z,0,-Qi.x,-Di.y,Di.x,0,-Ui.y,Ui.x,0,-Qi.y,Qi.x,0];return!pc(t,Ps,Ls,Ns,Vo)||(t=[1,0,0,0,1,0,0,0,1],!pc(t,Ps,Ls,Ns,Vo))?!1:(Go.crossVectors(Di,Ui),t=[Go.x,Go.y,Go.z],pc(t,Ps,Ls,Ns,Vo))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Vn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Vn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(pi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),pi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),pi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),pi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),pi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),pi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),pi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),pi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(pi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},pi=[new C,new C,new C,new C,new C,new C,new C,new C],Vn=new C,Ho=new hn,Ps=new C,Ls=new C,Ns=new C,Di=new C,Ui=new C,Qi=new C,Er=new C,Vo=new C,Go=new C,es=new C;function pc(s,e,t,n,i){for(let r=0,o=s.length-3;r<=o;r+=3){es.fromArray(s,r);let a=i.x*Math.abs(es.x)+i.y*Math.abs(es.y)+i.z*Math.abs(es.z),l=e.dot(es),c=t.dot(es),h=n.dot(es);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var Ot=new C,Wo=new ae,xp=0,Vt=class extends ei{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:xp++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Qc,this.updateRanges=[],this.gpuType=bn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Wo.fromBufferAttribute(this,t),Wo.applyMatrix3(e),this.setXY(t,Wo.x,Wo.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.applyMatrix3(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.applyMatrix4(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.applyNormalMatrix(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.transformDirection(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Wn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=ft(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Wn(t,this.array)),t}setX(e,t){return this.normalized&&(t=ft(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Wn(t,this.array)),t}setY(e,t){return this.normalized&&(t=ft(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Wn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=ft(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Wn(t,this.array)),t}setW(e,t){return this.normalized&&(t=ft(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=ft(t,this.array),n=ft(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=ft(t,this.array),n=ft(n,this.array),i=ft(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=ft(t,this.array),n=ft(n,this.array),i=ft(i,this.array),r=ft(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}};var Hr=class extends Vt{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Vr=class extends Vt{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var $e=class extends Vt{constructor(e,t,n){super(new Float32Array(e),t,n)}},vp=new hn,wr=new C,mc=new C,pn=class{constructor(e=new C,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):vp.setFromPoints(e).getCenter(n);let i=0;for(let r=0,o=e.length;r<o;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;wr.subVectors(e,this.center);let t=wr.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(wr,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(mc.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(wr.copy(e.center).add(mc)),this.expandByPoint(wr.copy(e.center).sub(mc))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},yp=0,Rn=new Oe,gc=new bt,Ds=new C,Sn=new hn,Ar=new hn,Kt=new C,gt=class s extends ei{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:yp++}),this.uuid=qn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Wf(e)?Vr:Hr)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new He().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Rn.makeRotationFromQuaternion(e),this.applyMatrix4(Rn),this}rotateX(e){return Rn.makeRotationX(e),this.applyMatrix4(Rn),this}rotateY(e){return Rn.makeRotationY(e),this.applyMatrix4(Rn),this}rotateZ(e){return Rn.makeRotationZ(e),this.applyMatrix4(Rn),this}translate(e,t,n){return Rn.makeTranslation(e,t,n),this.applyMatrix4(Rn),this}scale(e,t,n){return Rn.makeScale(e,t,n),this.applyMatrix4(Rn),this}lookAt(e){return gc.lookAt(e),gc.updateMatrix(),this.applyMatrix4(gc.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ds).negate(),this.translate(Ds.x,Ds.y,Ds.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,r=e.length;i<r;i++){let o=e[i];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new $e(n,3))}else{let n=Math.min(e.length,t.count);for(let i=0;i<n;i++){let r=e[i];t.setXYZ(i,r.x,r.y,r.z||0)}e.length>t.count&&De("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new hn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){ke("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new C(-1/0,-1/0,-1/0),new C(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];Sn.setFromBufferAttribute(r),this.morphTargetsRelative?(Kt.addVectors(this.boundingBox.min,Sn.min),this.boundingBox.expandByPoint(Kt),Kt.addVectors(this.boundingBox.max,Sn.max),this.boundingBox.expandByPoint(Kt)):(this.boundingBox.expandByPoint(Sn.min),this.boundingBox.expandByPoint(Sn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&ke('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new pn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){ke("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new C,1/0);return}if(e){let n=this.boundingSphere.center;if(Sn.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){let a=t[r];Ar.setFromBufferAttribute(a),this.morphTargetsRelative?(Kt.addVectors(Sn.min,Ar.min),Sn.expandByPoint(Kt),Kt.addVectors(Sn.max,Ar.max),Sn.expandByPoint(Kt)):(Sn.expandByPoint(Ar.min),Sn.expandByPoint(Ar.max))}Sn.getCenter(n);let i=0;for(let r=0,o=e.count;r<o;r++)Kt.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Kt));if(t)for(let r=0,o=t.length;r<o;r++){let a=t[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Kt.fromBufferAttribute(a,c),l&&(Ds.fromBufferAttribute(e,c),Kt.add(Ds)),i=Math.max(i,n.distanceToSquared(Kt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&ke('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){ke("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,i=t.normal,r=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new Vt(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let _=0;_<n.count;_++)a[_]=new C,l[_]=new C;let c=new C,h=new C,d=new C,u=new ae,f=new ae,g=new ae,x=new C,p=new C;function m(_,w,I){c.fromBufferAttribute(n,_),h.fromBufferAttribute(n,w),d.fromBufferAttribute(n,I),u.fromBufferAttribute(r,_),f.fromBufferAttribute(r,w),g.fromBufferAttribute(r,I),h.sub(c),d.sub(c),f.sub(u),g.sub(u);let L=1/(f.x*g.y-g.x*f.y);isFinite(L)&&(x.copy(h).multiplyScalar(g.y).addScaledVector(d,-f.y).multiplyScalar(L),p.copy(d).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(L),a[_].add(x),a[w].add(x),a[I].add(x),l[_].add(p),l[w].add(p),l[I].add(p))}let S=this.groups;S.length===0&&(S=[{start:0,count:e.count}]);for(let _=0,w=S.length;_<w;++_){let I=S[_],L=I.start,U=I.count;for(let O=L,N=L+U;O<N;O+=3)m(e.getX(O+0),e.getX(O+1),e.getX(O+2))}let T=new C,y=new C,E=new C,M=new C;function A(_){E.fromBufferAttribute(i,_),M.copy(E);let w=a[_];T.copy(w),T.sub(E.multiplyScalar(E.dot(w))).normalize(),y.crossVectors(M,w);let L=y.dot(l[_])<0?-1:1;o.setXYZW(_,T.x,T.y,T.z,L)}for(let _=0,w=S.length;_<w;++_){let I=S[_],L=I.start,U=I.count;for(let O=L,N=L+U;O<N;O+=3)A(e.getX(O+0)),A(e.getX(O+1)),A(e.getX(O+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Vt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let u=0,f=n.count;u<f;u++)n.setXYZ(u,0,0,0);let i=new C,r=new C,o=new C,a=new C,l=new C,c=new C,h=new C,d=new C;if(e)for(let u=0,f=e.count;u<f;u+=3){let g=e.getX(u+0),x=e.getX(u+1),p=e.getX(u+2);i.fromBufferAttribute(t,g),r.fromBufferAttribute(t,x),o.fromBufferAttribute(t,p),h.subVectors(o,r),d.subVectors(i,r),h.cross(d),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,p),a.add(h),l.add(h),c.add(h),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let u=0,f=t.count;u<f;u+=3)i.fromBufferAttribute(t,u+0),r.fromBufferAttribute(t,u+1),o.fromBufferAttribute(t,u+2),h.subVectors(o,r),d.subVectors(i,r),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Kt.fromBufferAttribute(e,t),Kt.normalize(),e.setXYZ(t,Kt.x,Kt.y,Kt.z)}toNonIndexed(){function e(a,l){let c=a.array,h=a.itemSize,d=a.normalized,u=new c.constructor(l.length*h),f=0,g=0;for(let x=0,p=l.length;x<p;x++){a.isInterleavedBufferAttribute?f=l[x]*a.data.stride+a.offset:f=l[x]*h;for(let m=0;m<h;m++)u[g++]=c[f++]}return new Vt(u,h,d)}if(this.index===null)return De("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new s,n=this.index.array,i=this.attributes;for(let a in i){let l=i[a],c=e(l,n);t.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,d=c.length;h<d;h++){let u=c[h],f=e(u,n);l.push(f)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let i={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let d=0,u=c.length;d<u;d++){let f=c[d];h.push(f.toJSON(e.data))}h.length>0&&(i[l]=h,r=!0)}r&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let i=e.attributes;for(let c in i){let h=i[c];this.setAttribute(c,h.clone(t))}let r=e.morphAttributes;for(let c in r){let h=[],d=r[c];for(let u=0,f=d.length;u<f;u++)h.push(d[u].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,h=o.length;c<h;c++){let d=o[c];this.addGroup(d.start,d.count,d.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},Ys=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Qc,this.updateRanges=[],this.version=0,this.uuid=qn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=qn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=qn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer)));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}},ln=new C,Ks=class s{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)ln.fromBufferAttribute(this,t),ln.applyMatrix4(e),this.setXYZ(t,ln.x,ln.y,ln.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)ln.fromBufferAttribute(this,t),ln.applyNormalMatrix(e),this.setXYZ(t,ln.x,ln.y,ln.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)ln.fromBufferAttribute(this,t),ln.transformDirection(e),this.setXYZ(t,ln.x,ln.y,ln.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=Wn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=ft(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=ft(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=ft(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=ft(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=ft(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=Wn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=Wn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=Wn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=Wn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=ft(t,this.array),n=ft(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=ft(t,this.array),n=ft(n,this.array),i=ft(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=ft(t,this.array),n=ft(n,this.array),i=ft(i,this.array),r=ft(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){Or("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new Vt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new s(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Or("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},_c=new C,Mp=new C,Sp=new He,Gn=class{constructor(e=new C(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=_c.subVectors(n,t).cross(Mp.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let i=e.delta(_c),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(i,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Sp.getNormalMatrix(e),i=this.coplanarPoint(_c).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},bp=0,un=class extends ei{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:bp++}),this.uuid=qn(),this.name="",this.type="Material",this.blending=rr,this.side=ii,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Gc,this.blendDst=Wc,this.blendEquation=ps,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ce(0,0,0),this.blendAlpha=0,this.depthFunc=ks,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=bd,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ha,this.stencilZFail=ha,this.stencilZPass=ha,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){De(`Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){De(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector2&&n&&n.isVector2||i&&i.isEuler&&n&&n.isEuler||i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(t){let r=i(e.textures),o=i(e.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Ce().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new Gn().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new ae().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ae().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var mi=new C,xc=new C,Xo=new C,qo=new C,ls=class{constructor(e=new C,t=new C(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,mi)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=mi.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(mi.copy(this.origin).addScaledVector(this.direction,t),mi.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){xc.copy(e).add(t).multiplyScalar(.5),Xo.copy(t).sub(e).normalize(),qo.copy(this.origin).sub(xc);let r=e.distanceTo(t)*.5,o=-this.direction.dot(Xo),a=qo.dot(this.direction),l=-qo.dot(Xo),c=qo.lengthSq(),h=Math.abs(1-o*o),d,u,f,g;if(h>0)if(d=o*l-a,u=o*a-l,g=r*h,d>=0)if(u>=-g)if(u<=g){let x=1/h;d*=x,u*=x,f=d*(d+o*u+2*a)+u*(o*d+u+2*l)+c}else u=r,d=Math.max(0,-(o*u+a)),f=-d*d+u*(u+2*l)+c;else u=-r,d=Math.max(0,-(o*u+a)),f=-d*d+u*(u+2*l)+c;else u<=-g?(d=Math.max(0,-(-o*r+a)),u=d>0?-r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c):u<=g?(d=0,u=Math.min(Math.max(-r,-l),r),f=u*(u+2*l)+c):(d=Math.max(0,-(o*r+a)),u=d>0?r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c);else u=o>0?-r:r,d=Math.max(0,-(o*u+a)),f=-d*d+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),i&&i.copy(xc).addScaledVector(Xo,u),f}intersectSphere(e,t){if(e.radius<0)return null;mi.subVectors(e.center,this.origin);let n=mi.dot(this.direction),i=mi.dot(mi)-n*n,r=e.radius*e.radius;if(i>r)return null;let o=Math.sqrt(r-i),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return c>=0?(n=(e.min.x-u.x)*c,i=(e.max.x-u.x)*c):(n=(e.max.x-u.x)*c,i=(e.min.x-u.x)*c),h>=0?(r=(e.min.y-u.y)*h,o=(e.max.y-u.y)*h):(r=(e.max.y-u.y)*h,o=(e.min.y-u.y)*h),n>o||r>i||((r>n||isNaN(n))&&(n=r),(o<i||isNaN(i))&&(i=o),d>=0?(a=(e.min.z-u.z)*d,l=(e.max.z-u.z)*d):(a=(e.max.z-u.z)*d,l=(e.min.z-u.z)*d),n>l||a>i)||((a>n||n!==n)&&(n=a),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,mi)!==null}intersectTriangle(e,t,n,i,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,h=a.z,d=e.x-o.x,u=e.y-o.y,f=e.z-o.z,g=t.x-o.x,x=t.y-o.y,p=t.z-o.z,m=n.x-o.x,S=n.y-o.y,T=n.z-o.z,y=Math.abs(l),E=Math.abs(c),M=Math.abs(h),A,_,w,I,L,U,O,N,B,q,G,j;if(y>=E&&y>=M?(w=l,U=d,B=g,j=m,l>=0?(A=c,_=h,I=u,L=f,O=x,N=p,q=S,G=T):(A=h,_=c,I=f,L=u,O=p,N=x,q=T,G=S)):E>=M?(w=c,U=u,B=x,j=S,c>=0?(A=h,_=l,I=f,L=d,O=p,N=g,q=T,G=m):(A=l,_=h,I=d,L=f,O=g,N=p,q=m,G=T)):(w=h,U=f,B=p,j=T,h>=0?(A=l,_=c,I=d,L=u,O=g,N=x,q=m,G=S):(A=c,_=l,I=u,L=d,O=x,N=g,q=S,G=m)),w===0)return null;let X=A/w,$=_/w,ne=1/w,Te=I-X*U,le=L-$*U,Fe=O-X*B,Be=N-$*B,Qe=q-X*j,K=G-$*j,ee=Qe*Be-K*Fe,ye=Te*K-le*Qe,Ue=Fe*le-Be*Te;if(i){if(ee<0||ye<0||Ue<0)return null}else if((ee<0||ye<0||Ue<0)&&(ee>0||ye>0||Ue>0))return null;let ie=ee+ye+Ue;if(ie===0)return null;let ce=ne*(ee*U+ye*B+Ue*j);return(ie>0?ce<0:ce>0)?null:this.at(ce/ie,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Gt=class extends un{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ce(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new In,this.combine=Ga,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Tu=new Oe,ts=new ls,Yo=new pn,Eu=new C,Ko=new C,Zo=new C,Jo=new C,vc=new C,$o=new C,wu=new C,jo=new C,nt=class extends bt{constructor(e=new gt,t=new Gt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let a=this.morphTargetInfluences;if(r&&a){$o.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],d=r[l];h!==0&&(vc.fromBufferAttribute(d,e),o?$o.addScaledVector(vc,h):$o.addScaledVector(vc.sub(t),h))}t.add($o)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Yo.copy(n.boundingSphere),Yo.applyMatrix4(r),ts.copy(e.ray).recast(e.near),!(Yo.containsPoint(ts.origin)===!1&&(ts.intersectSphere(Yo,Eu)===null||ts.origin.distanceToSquared(Eu)>(e.far-e.near)**2))&&(Tu.copy(r).invert(),ts.copy(e.ray).applyMatrix4(Tu),!(n.boundingBox!==null&&ts.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,ts)))}_computeIntersections(e,t,n){let i,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,d=r.attributes.normal,u=r.groups,f=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,x=u.length;g<x;g++){let p=u[g],m=o[p.materialIndex],S=Math.max(p.start,f.start),T=Math.min(a.count,Math.min(p.start+p.count,f.start+f.count));for(let y=S,E=T;y<E;y+=3){let M=a.getX(y),A=a.getX(y+1),_=a.getX(y+2);i=Qo(this,m,e,n,c,h,d,M,A,_),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=p.materialIndex,t.push(i))}}else{let g=Math.max(0,f.start),x=Math.min(a.count,f.start+f.count);for(let p=g,m=x;p<m;p+=3){let S=a.getX(p),T=a.getX(p+1),y=a.getX(p+2);i=Qo(this,o,e,n,c,h,d,S,T,y),i&&(i.faceIndex=Math.floor(p/3),t.push(i))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,x=u.length;g<x;g++){let p=u[g],m=o[p.materialIndex],S=Math.max(p.start,f.start),T=Math.min(l.count,Math.min(p.start+p.count,f.start+f.count));for(let y=S,E=T;y<E;y+=3){let M=y,A=y+1,_=y+2;i=Qo(this,m,e,n,c,h,d,M,A,_),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=p.materialIndex,t.push(i))}}else{let g=Math.max(0,f.start),x=Math.min(l.count,f.start+f.count);for(let p=g,m=x;p<m;p+=3){let S=p,T=p+1,y=p+2;i=Qo(this,o,e,n,c,h,d,S,T,y),i&&(i.faceIndex=Math.floor(p/3),t.push(i))}}}};function Tp(s,e,t,n,i,r,o,a){let l;if(e.side===Wt?l=n.intersectTriangle(o,r,i,!0,a):l=n.intersectTriangle(i,r,o,e.side===ii,a),l===null)return null;jo.copy(a),jo.applyMatrix4(s.matrixWorld);let c=t.ray.origin.distanceTo(jo);return c<t.near||c>t.far?null:{distance:c,point:jo.clone(),object:s}}function Qo(s,e,t,n,i,r,o,a,l,c){s.getVertexPosition(a,Ko),s.getVertexPosition(l,Zo),s.getVertexPosition(c,Jo);let h=Tp(s,e,t,n,Ko,Zo,Jo,wu);if(h){let d=new C;Bi.getBarycoord(wu,Ko,Zo,Jo,d),i&&(h.uv=Bi.getInterpolatedAttribute(i,a,l,c,d,new ae)),r&&(h.uv1=Bi.getInterpolatedAttribute(r,a,l,c,d,new ae)),o&&(h.normal=Bi.getInterpolatedAttribute(o,a,l,c,d,new C),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a,b:l,c,normal:new C,materialIndex:0};Bi.getNormal(Ko,Zo,Jo,u.normal),h.face=u,h.barycoord=d}return h}var Rr=new pt,Au=new pt,Ru=new pt,Ep=new pt,Cu=new Oe,ea=new C,yc=new pn,Iu=new Oe,Mc=new ls,Gr=class extends nt{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Rc,this.bindMatrix=new Oe,this.bindMatrixInverse=new Oe,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new hn),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ea),this.boundingBox.expandByPoint(ea)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new pn),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ea),this.boundingSphere.expandByPoint(ea)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),yc.copy(this.boundingSphere),yc.applyMatrix4(i),e.ray.intersectsSphere(yc)!==!1&&(Iu.copy(i).invert(),Mc.copy(e.ray).applyMatrix4(Iu),!(this.boundingBox!==null&&Mc.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,Mc)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new pt,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);let r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Rc?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===vd?this.bindMatrixInverse.copy(this.bindMatrix).invert():De("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,i=this.geometry;Au.fromBufferAttribute(i.attributes.skinIndex,e),Ru.fromBufferAttribute(i.attributes.skinWeight,e),t.isVector4?(Rr.copy(t),t.set(0,0,0,0)):(Rr.set(...t,1),t.set(0,0,0)),Rr.applyMatrix4(this.bindMatrix);for(let r=0;r<4;r++){let o=Ru.getComponent(r);if(o!==0){let a=Au.getComponent(r);Cu.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),t.addScaledVector(Ep.copy(Rr).applyMatrix4(Cu),o)}}return t.isVector4&&(t.w=Rr.w),t.applyMatrix4(this.bindMatrixInverse)}},Zs=class extends bt{constructor(){super(),this.isBone=!0,this.type="Bone"}},Js=class extends Zt{constructor(e=null,t=1,n=1,i,r,o,a,l,c=Pt,h=Pt,d,u){super(null,o,a,l,c,h,i,r,d,u),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Pu=new Oe,wp=new Oe,Wr=class s{constructor(e=[],t=[]){this.uuid=qn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){De("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new Oe)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let n=new Oe;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let r=0,o=e.length;r<o;r++){let a=e[r]?e[r].matrixWorld:wp;Pu.multiplyMatrices(a,t[r]),Pu.toArray(n,r*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new s(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new Js(t,e,e,Tn,bn);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){let r=e.bones[n],o=t[r];o===void 0&&(De("Skeleton: No bone found with UUID:",r),o=new Zs),this.bones.push(o),this.boneInverses.push(new Oe().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let i=0,r=t.length;i<r;i++){let o=t[i];e.bones.push(o.uuid);let a=n[i];e.boneInverses.push(a.toArray())}return e}},xi=class extends Vt{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Us=new Oe,Lu=new Oe,ta=[],Nu=new hn,Ap=new Oe,Cr=new nt,Ir=new pn,dn=class extends nt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new xi(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,Ap)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new hn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Us),Nu.copy(e.boundingBox).applyMatrix4(Us),this.boundingBox.union(Nu)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new pn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Us),Ir.copy(e.boundingSphere).applyMatrix4(Us),this.boundingSphere.union(Ir)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,r=n.length+1,o=e*r+1;for(let a=0;a<n.length;a++)n[a]=i[o+a]}raycast(e,t){let n=this.matrixWorld,i=this.count;if(Cr.geometry=this.geometry,Cr.material=this.material,Cr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Ir.copy(this.boundingSphere),Ir.applyMatrix4(n),e.ray.intersectsSphere(Ir)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,Us),Lu.multiplyMatrices(n,Us),Cr.matrixWorld=Lu,Cr.raycast(e,ta);for(let o=0,a=ta.length;o<a;o++){let l=ta[o];l.instanceId=r,l.object=this,t.push(l)}ta.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new xi(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new Js(new Float32Array(i*this.count),i,this.count,Ja,bn));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<n.length;c++)o+=n[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=i*e;return r[l]=a,r.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},ns=new pn,Rp=new ae(.5,.5),na=new C,$s=class{constructor(e=new Gn,t=new Gn,n=new Gn,i=new Gn,r=new Gn,o=new Gn){this.planes=[e,t,n,i,r,o]}set(e,t,n,i,r,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(i),a[4].copy(r),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Xn,n=!1){let i=this.planes,r=e.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],d=r[5],u=r[6],f=r[7],g=r[8],x=r[9],p=r[10],m=r[11],S=r[12],T=r[13],y=r[14],E=r[15];if(i[0].setComponents(c-o,f-h,m-g,E-S).normalize(),i[1].setComponents(c+o,f+h,m+g,E+S).normalize(),i[2].setComponents(c+a,f+d,m+x,E+T).normalize(),i[3].setComponents(c-a,f-d,m-x,E-T).normalize(),n)i[4].setComponents(l,u,p,y).normalize(),i[5].setComponents(c-l,f-u,m-p,E-y).normalize();else if(i[4].setComponents(c-l,f-u,m-p,E-y).normalize(),t===Xn)i[5].setComponents(c+l,f+u,m+p,E+y).normalize();else if(t===Vs)i[5].setComponents(l,u,p,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ns.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ns.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ns)}intersectsSprite(e){ns.center.set(0,0,0);let t=Rp.distanceTo(e.center);return ns.radius=.7071067811865476+t,ns.applyMatrix4(e.matrixWorld),this.intersectsSphere(ns)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(na.x=i.normal.x>0?e.max.x:e.min.x,na.y=i.normal.y>0?e.max.y:e.min.y,na.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(na)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var js=class extends un{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ce(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Sa=new C,ba=new C,Du=new Oe,Pr=new ls,ia=new pn,Sc=new C,Uu=new C,cs=class extends bt{constructor(e=new gt,t=new js){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)Sa.fromBufferAttribute(t,i-1),ba.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Sa.distanceTo(ba);e.setAttribute("lineDistance",new $e(n,1))}else De("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ia.copy(n.boundingSphere),ia.applyMatrix4(i),ia.radius+=r,e.ray.intersectsSphere(ia)===!1)return;Du.copy(i).invert(),Pr.copy(e.ray).applyMatrix4(Du);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=n.index,u=n.attributes.position;if(h!==null){let f=Math.max(0,o.start),g=Math.min(h.count,o.start+o.count);for(let x=f,p=g-1;x<p;x+=c){let m=h.getX(x),S=h.getX(x+1),T=sa(this,e,Pr,l,m,S,x);T&&t.push(T)}if(this.isLineLoop){let x=h.getX(g-1),p=h.getX(f),m=sa(this,e,Pr,l,x,p,g-1);m&&t.push(m)}}else{let f=Math.max(0,o.start),g=Math.min(u.count,o.start+o.count);for(let x=f,p=g-1;x<p;x+=c){let m=sa(this,e,Pr,l,x,x+1,x);m&&t.push(m)}if(this.isLineLoop){let x=sa(this,e,Pr,l,g-1,f,g-1);x&&t.push(x)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function sa(s,e,t,n,i,r,o){let a=s.geometry.attributes.position;if(Sa.fromBufferAttribute(a,i),ba.fromBufferAttribute(a,r),t.distanceSqToSegment(Sa,ba,Sc,Uu)>n)return;Sc.applyMatrix4(s.matrixWorld);let c=e.ray.origin.distanceTo(Sc);if(!(c<e.near||c>e.far))return{distance:c,point:Uu.clone().applyMatrix4(s.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:s}}var Fu=new C,Ou=new C,Xr=class extends cs{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,r=t.count;i<r;i+=2)Fu.fromBufferAttribute(t,i),Ou.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+Fu.distanceTo(Ou);e.setAttribute("lineDistance",new $e(n,1))}else De("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},qr=class extends cs{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},Qs=class extends un{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ce(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Bu=new Oe,Nc=new ls,ra=new pn,oa=new C,hs=class extends bt{constructor(e=new gt,t=new Qs){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ra.copy(n.boundingSphere),ra.applyMatrix4(i),ra.radius+=r,e.ray.intersectsSphere(ra)===!1)return;Bu.copy(i).invert(),Nc.copy(e.ray).applyMatrix4(Bu);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,d=n.attributes.position;if(c!==null){let u=Math.max(0,o.start),f=Math.min(c.count,o.start+o.count);for(let g=u,x=f;g<x;g++){let p=c.getX(g);oa.fromBufferAttribute(d,p),zu(oa,p,l,i,e,t,this)}}else{let u=Math.max(0,o.start),f=Math.min(d.count,o.start+o.count);for(let g=u,x=f;g<x;g++)oa.fromBufferAttribute(d,g),zu(oa,g,l,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function zu(s,e,t,n,i,r,o){let a=Nc.distanceSqToPoint(s);if(a<t){let l=new C;Nc.closestPointToPoint(s,l),l.applyMatrix4(n);let c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}var Yr=class extends Zt{constructor(e=[],t=Wi,n,i,r,o,a,l,c,h){super(e,t,n,i,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};var ki=class extends Zt{constructor(e,t,n=Zn,i,r,o,a=Pt,l=Pt,c,h=Qn,d=1){if(h!==Qn&&h!==Xi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:e,height:t,depth:d};super(u,i,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Xs(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},Ta=class extends ki{constructor(e,t=Zn,n=Wi,i,r,o=Pt,a=Pt,l,c=Qn){let h={width:e,height:e,depth:1},d=[h,h,h,h,h,h];super(e,e,t,n,i,r,o,a,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Kr=class extends Zt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Jt=class s extends gt{constructor(e=1,t=1,n=1,i=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:o};let a=this;i=Math.floor(i),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],d=[],u=0,f=0;g("z","y","x",-1,-1,n,t,e,o,r,0),g("z","y","x",1,-1,n,t,-e,o,r,1),g("x","z","y",1,1,e,n,t,i,o,2),g("x","z","y",1,-1,e,n,-t,i,o,3),g("x","y","z",1,-1,e,t,n,i,r,4),g("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new $e(c,3)),this.setAttribute("normal",new $e(h,3)),this.setAttribute("uv",new $e(d,2));function g(x,p,m,S,T,y,E,M,A,_,w){let I=y/A,L=E/_,U=y/2,O=E/2,N=M/2,B=A+1,q=_+1,G=0,j=0,X=new C;for(let $=0;$<q;$++){let ne=$*L-O;for(let Te=0;Te<B;Te++){let le=Te*I-U;X[x]=le*S,X[p]=ne*T,X[m]=N,c.push(X.x,X.y,X.z),X[x]=0,X[p]=0,X[m]=M>0?1:-1,h.push(X.x,X.y,X.z),d.push(Te/A),d.push(1-$/_),G+=1}}for(let $=0;$<_;$++)for(let ne=0;ne<A;ne++){let Te=u+ne+B*$,le=u+ne+B*($+1),Fe=u+(ne+1)+B*($+1),Be=u+(ne+1)+B*$;l.push(Te,le,Be),l.push(le,Fe,Be),j+=6}a.addGroup(f,j,w),f+=j,u+=G}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var mn=class s extends gt{constructor(e=1,t=1,n=1,i=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;i=Math.floor(i),r=Math.floor(r);let h=[],d=[],u=[],f=[],g=0,x=[],p=n/2,m=0;S(),o===!1&&(e>0&&T(!0),t>0&&T(!1)),this.setIndex(h),this.setAttribute("position",new $e(d,3)),this.setAttribute("normal",new $e(u,3)),this.setAttribute("uv",new $e(f,2));function S(){let y=new C,E=new C,M=0,A=(t-e)/n;for(let _=0;_<=r;_++){let w=[],I=_/r,L=I*(t-e)+e;for(let U=0;U<=i;U++){let O=U/i,N=O*l+a,B=Math.sin(N),q=Math.cos(N);E.x=L*B,E.y=-I*n+p,E.z=L*q,d.push(E.x,E.y,E.z),y.set(B,A,q).normalize(),u.push(y.x,y.y,y.z),f.push(O,1-I),w.push(g++)}x.push(w)}for(let _=0;_<i;_++)for(let w=0;w<r;w++){let I=x[w][_],L=x[w+1][_],U=x[w+1][_+1],O=x[w][_+1];(e>0||w!==0)&&(h.push(I,L,O),M+=3),(t>0||w!==r-1)&&(h.push(L,U,O),M+=3)}c.addGroup(m,M,0),m+=M}function T(y){let E=g,M=new ae,A=new C,_=0,w=y===!0?e:t,I=y===!0?1:-1;for(let U=1;U<=i;U++)d.push(0,p*I,0),u.push(0,I,0),f.push(.5,.5),g++;let L=g;for(let U=0;U<=i;U++){let N=U/i*l+a,B=Math.cos(N),q=Math.sin(N);A.x=w*q,A.y=p*I,A.z=w*B,d.push(A.x,A.y,A.z),u.push(0,I,0),M.x=B*.5+.5,M.y=q*.5*I+.5,f.push(M.x,M.y),g++}for(let U=0;U<i;U++){let O=E+U,N=L+U;y===!0?h.push(N,N+1,O):h.push(N+1,N,O),_+=3}c.addGroup(m,_,y===!0?1:2),m+=_}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Zr=class s extends mn{constructor(e=1,t=1,n=32,i=1,r=!1,o=0,a=Math.PI*2){super(0,e,t,n,i,r,o,a),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(e){return new s(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Jr=class s extends gt{constructor(e=[],t=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:i};let r=[],o=[];a(i),c(n),h(),this.setAttribute("position",new $e(r,3)),this.setAttribute("normal",new $e(r.slice(),3)),this.setAttribute("uv",new $e(o,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function a(S){let T=new C,y=new C,E=new C;for(let M=0;M<t.length;M+=3)f(t[M+0],T),f(t[M+1],y),f(t[M+2],E),l(T,y,E,S)}function l(S,T,y,E){let M=E+1,A=[];for(let _=0;_<=M;_++){A[_]=[];let w=S.clone().lerp(y,_/M),I=T.clone().lerp(y,_/M),L=M-_;for(let U=0;U<=L;U++)U===0&&_===M?A[_][U]=w:A[_][U]=w.clone().lerp(I,U/L)}for(let _=0;_<M;_++)for(let w=0;w<2*(M-_)-1;w++){let I=Math.floor(w/2);w%2===0?(u(A[_][I+1]),u(A[_+1][I]),u(A[_][I])):(u(A[_][I+1]),u(A[_+1][I+1]),u(A[_+1][I]))}}function c(S){let T=new C;for(let y=0;y<r.length;y+=3)T.x=r[y+0],T.y=r[y+1],T.z=r[y+2],T.normalize().multiplyScalar(S),r[y+0]=T.x,r[y+1]=T.y,r[y+2]=T.z}function h(){let S=new C;for(let T=0;T<r.length;T+=3){S.x=r[T+0],S.y=r[T+1],S.z=r[T+2];let y=p(S)/2/Math.PI+.5,E=m(S)/Math.PI+.5;o.push(y,1-E)}g(),d()}function d(){for(let S=0;S<o.length;S+=6){let T=o[S+0],y=o[S+2],E=o[S+4],M=Math.max(T,y,E),A=Math.min(T,y,E);M>.9&&A<.1&&(T<.2&&(o[S+0]+=1),y<.2&&(o[S+2]+=1),E<.2&&(o[S+4]+=1))}}function u(S){r.push(S.x,S.y,S.z)}function f(S,T){let y=S*3;T.x=e[y+0],T.y=e[y+1],T.z=e[y+2]}function g(){let S=new C,T=new C,y=new C,E=new C,M=new ae,A=new ae,_=new ae;for(let w=0,I=0;w<r.length;w+=9,I+=6){S.set(r[w+0],r[w+1],r[w+2]),T.set(r[w+3],r[w+4],r[w+5]),y.set(r[w+6],r[w+7],r[w+8]),M.set(o[I+0],o[I+1]),A.set(o[I+2],o[I+3]),_.set(o[I+4],o[I+5]),E.copy(S).add(T).add(y).divideScalar(3);let L=p(E);x(M,I+0,S,L),x(A,I+2,T,L),x(_,I+4,y,L)}}function x(S,T,y,E){E<0&&S.x===1&&(o[T]=S.x-1),y.x===0&&y.z===0&&(o[T]=E/2/Math.PI+.5)}function p(S){return Math.atan2(S.z,-S.x)}function m(S){return Math.atan2(-S.y,Math.sqrt(S.x*S.x+S.z*S.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.vertices,e.indices,e.radius,e.detail)}},$r=class s extends Jr{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,i=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-i,-n,0,-i,n,0,i,-n,0,i,n,-i,-n,0,-i,n,0,i,-n,0,i,n,0,-n,0,-i,n,0,-i,-n,0,i,n,0,i],o=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,o,e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new s(e.radius,e.detail)}};var Pn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){De("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),r=0;t.push(0);for(let o=1;o<=e;o++)n=this.getPoint(o/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),i=0,r=n.length,o;t?o=t:o=e*n[r-1];let a=0,l=r-1,c;for(;a<=l;)if(i=Math.floor(a+(l-a)/2),c=n[i]-o,c<0)a=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===o)return i/(r-1);let h=n[i],u=n[i+1]-h,f=(o-h)/u;return(i+f)/(r-1)}getTangent(e,t){let i=e-1e-4,r=e+1e-4;i<0&&(i=0),r>1&&(r=1);let o=this.getPoint(i),a=this.getPoint(r),l=t||(o.isVector2?new ae:new C);return l.copy(a).sub(o).normalize(),l}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new C,i=[],r=[],o=[],a=new C,l=new Oe;for(let f=0;f<=e;f++){let g=f/e;i[f]=this.getTangentAt(g,new C)}r[0]=new C,o[0]=new C;let c=Number.MAX_VALUE,h=Math.abs(i[0].x),d=Math.abs(i[0].y),u=Math.abs(i[0].z);h<=c&&(c=h,n.set(1,0,0)),d<=c&&(c=d,n.set(0,1,0)),u<=c&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],a),o[0].crossVectors(i[0],r[0]);for(let f=1;f<=e;f++){if(r[f]=r[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(i[f-1],i[f]),a.length()>Number.EPSILON){a.normalize();let g=Math.acos(qe(i[f-1].dot(i[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(a,g))}o[f].crossVectors(i[f],r[f])}if(t===!0){let f=Math.acos(qe(r[0].dot(r[e]),-1,1));f/=e,i[0].dot(a.crossVectors(r[0],r[e]))>0&&(f=-f);for(let g=1;g<=e;g++)r[g].applyMatrix4(l.makeRotationAxis(i[g],f*g)),o[g].crossVectors(i[g],r[g])}return{tangents:i,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},jr=class extends Pn{constructor(e=0,t=0,n=1,i=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(e,t=new ae){let n=t,i=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(o?r=0:r=i),this.aClockwise===!0&&!o&&(r===i?r=-i:r=r-i);let a=this.aStartAngle+e*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=l-this.aX,f=c-this.aY;l=u*h-f*d+this.aX,c=u*d+f*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},Ea=class extends jr{constructor(e,t,n,i,r,o){super(e,t,n,n,i,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function nh(){let s=0,e=0,t=0,n=0;function i(r,o,a,l){s=r,e=a,t=-3*r+3*o-2*a-l,n=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){i(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,d){let u=(o-r)/c-(a-r)/(c+h)+(a-o)/h,f=(a-o)/h-(l-o)/(h+d)+(l-a)/d;u*=h,f*=h,i(o,a,u,f)},calc:function(r){let o=r*r,a=o*r;return s+e*r+t*o+n*a}}}var ku=new C,Hu=new C,bc=new nh,Tc=new nh,Ec=new nh,Hi=class extends Pn{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new C){let n=t,i=this.points,r=i.length,o=(r-(this.closed?0:1))*e,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=i[(a-1)%r]:(Hu.subVectors(i[0],i[1]).add(i[0]),c=Hu);let d=i[a%r],u=i[(a+1)%r];if(this.closed||a+2<r?h=i[(a+2)%r]:(ku.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=ku),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(d),f),x=Math.pow(d.distanceToSquared(u),f),p=Math.pow(u.distanceToSquared(h),f);x<1e-4&&(x=1),g<1e-4&&(g=x),p<1e-4&&(p=x),bc.initNonuniformCatmullRom(c.x,d.x,u.x,h.x,g,x,p),Tc.initNonuniformCatmullRom(c.y,d.y,u.y,h.y,g,x,p),Ec.initNonuniformCatmullRom(c.z,d.z,u.z,h.z,g,x,p)}else this.curveType==="catmullrom"&&(bc.initCatmullRom(c.x,d.x,u.x,h.x,this.tension),Tc.initCatmullRom(c.y,d.y,u.y,h.y,this.tension),Ec.initCatmullRom(c.z,d.z,u.z,h.z,this.tension));return n.set(bc.calc(l),Tc.calc(l),Ec.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new C().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Vu(s,e,t,n,i){let r=(n-e)*.5,o=(i-t)*.5,a=s*s,l=s*a;return(2*t-2*n+r+o)*l+(-3*t+3*n-2*r-o)*a+r*s+t}function Cp(s,e){let t=1-s;return t*t*e}function Ip(s,e){return 2*(1-s)*s*e}function Pp(s,e){return s*s*e}function Dr(s,e,t,n){return Cp(s,e)+Ip(s,t)+Pp(s,n)}function Lp(s,e){let t=1-s;return t*t*t*e}function Np(s,e){let t=1-s;return 3*t*t*s*e}function Dp(s,e){return 3*(1-s)*s*s*e}function Up(s,e){return s*s*s*e}function Ur(s,e,t,n,i){return Lp(s,e)+Np(s,t)+Dp(s,n)+Up(s,i)}var wa=class extends Pn{constructor(e=new ae,t=new ae,n=new ae,i=new ae){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new ae){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Ur(e,i.x,r.x,o.x,a.x),Ur(e,i.y,r.y,o.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Aa=class extends Pn{constructor(e=new C,t=new C,n=new C,i=new C){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new C){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Ur(e,i.x,r.x,o.x,a.x),Ur(e,i.y,r.y,o.y,a.y),Ur(e,i.z,r.z,o.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Ra=class extends Pn{constructor(e=new ae,t=new ae){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ae){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ae){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Ca=class extends Pn{constructor(e=new C,t=new C){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new C){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new C){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Ia=class extends Pn{constructor(e=new ae,t=new ae,n=new ae){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new ae){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(Dr(e,i.x,r.x,o.x),Dr(e,i.y,r.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Qr=class extends Pn{constructor(e=new C,t=new C,n=new C){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new C){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(Dr(e,i.x,r.x,o.x),Dr(e,i.y,r.y,o.y),Dr(e,i.z,r.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Pa=class extends Pn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ae){let n=t,i=this.points,r=(i.length-1)*e,o=Math.floor(r),a=r-o,l=i[o===0?o:o-1],c=i[o],h=i[o>i.length-2?i.length-1:o+1],d=i[o>i.length-3?i.length-1:o+2];return n.set(Vu(a,l.x,c.x,h.x,d.x),Vu(a,l.y,c.y,h.y,d.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new ae().fromArray(i))}return this}},Fp=Object.freeze({__proto__:null,ArcCurve:Ea,CatmullRomCurve3:Hi,CubicBezierCurve:wa,CubicBezierCurve3:Aa,EllipseCurve:jr,LineCurve:Ra,LineCurve3:Ca,QuadraticBezierCurve:Ia,QuadraticBezierCurve3:Qr,SplineCurve:Pa});var eo=class s extends Jr{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,i=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(i,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new s(e.radius,e.detail)}},us=class s extends gt{constructor(e=[new ae(0,-.5),new ae(.5,0),new ae(0,.5)],t=12,n=0,i=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:i},t=Math.floor(t),i=qe(i,0,Math.PI*2);let r=[],o=[],a=[],l=[],c=[],h=1/t,d=new C,u=new ae,f=new C,g=new C,x=new C,p=0,m=0;for(let S=0;S<=e.length-1;S++)switch(S){case 0:p=e[S+1].x-e[S].x,m=e[S+1].y-e[S].y,f.x=m*1,f.y=-p,f.z=m*0,x.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case e.length-1:l.push(x.x,x.y,x.z);break;default:p=e[S+1].x-e[S].x,m=e[S+1].y-e[S].y,f.x=m*1,f.y=-p,f.z=m*0,g.copy(f),f.x+=x.x,f.y+=x.y,f.z+=x.z,f.normalize(),l.push(f.x,f.y,f.z),x.copy(g)}for(let S=0;S<=t;S++){let T=n+S*h*i,y=Math.sin(T),E=Math.cos(T);for(let M=0;M<=e.length-1;M++){d.x=e[M].x*y,d.y=e[M].y,d.z=e[M].x*E,o.push(d.x,d.y,d.z),u.x=S/t,u.y=M/(e.length-1),a.push(u.x,u.y);let A=l[3*M+0]*y,_=l[3*M+1],w=l[3*M+0]*E;c.push(A,_,w)}}for(let S=0;S<t;S++)for(let T=0;T<e.length-1;T++){let y=T+S*e.length,E=y,M=y+e.length,A=y+e.length+1,_=y+1;r.push(E,M,_),r.push(A,_,M)}this.setIndex(r),this.setAttribute("position",new $e(o,3)),this.setAttribute("uv",new $e(a,2)),this.setAttribute("normal",new $e(c,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.points,e.segments,e.phiStart,e.phiLength)}};var to=class s extends gt{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,o=t/2,a=Math.floor(n),l=Math.floor(i),c=a+1,h=l+1,d=e/a,u=t/l,f=[],g=[],x=[],p=[];for(let m=0;m<h;m++){let S=m*u-o;for(let T=0;T<c;T++){let y=T*d-r;g.push(y,-S,0),x.push(0,0,1),p.push(T/a),p.push(1-m/l)}}for(let m=0;m<l;m++)for(let S=0;S<a;S++){let T=S+c*m,y=S+c*(m+1),E=S+1+c*(m+1),M=S+1+c*m;f.push(T,y,M),f.push(y,E,M)}this.setIndex(f),this.setAttribute("position",new $e(g,3)),this.setAttribute("normal",new $e(x,3)),this.setAttribute("uv",new $e(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.widthSegments,e.heightSegments)}};var $t=class s extends gt{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let l=Math.min(o+a,Math.PI),c=0,h=[],d=new C,u=new C,f=[],g=[],x=[],p=[];for(let m=0;m<=n;m++){let S=[],T=m/n,y=o+T*a,E=e*Math.cos(y),M=Math.sqrt(e*e-E*E),A=0;m===0&&o===0?A=.5/t:m===n&&l===Math.PI&&(A=-.5/t);for(let _=0;_<=t;_++){let w=_/t,I=i+w*r;d.x=-M*Math.cos(I),d.y=E,d.z=M*Math.sin(I),g.push(d.x,d.y,d.z),u.copy(d).normalize(),x.push(u.x,u.y,u.z),p.push(w+A,1-T),S.push(c++)}h.push(S)}for(let m=0;m<n;m++)for(let S=0;S<t;S++){let T=h[m][S+1],y=h[m][S],E=h[m+1][S],M=h[m+1][S+1];(m!==0||o>0)&&f.push(T,y,M),(m!==n-1||l<Math.PI)&&f.push(y,E,M)}this.setIndex(f),this.setAttribute("position",new $e(g,3)),this.setAttribute("normal",new $e(x,3)),this.setAttribute("uv",new $e(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}};var vi=class s extends gt{constructor(e=1,t=.4,n=12,i=48,r=Math.PI*2,o=0,a=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:r,thetaStart:o,thetaLength:a},n=Math.floor(n),i=Math.floor(i);let l=[],c=[],h=[],d=[],u=new C,f=new C,g=new C;for(let x=0;x<=n;x++){let p=o+x/n*a;for(let m=0;m<=i;m++){let S=m/i*r;f.x=(e+t*Math.cos(p))*Math.cos(S),f.y=(e+t*Math.cos(p))*Math.sin(S),f.z=t*Math.sin(p),c.push(f.x,f.y,f.z),u.x=e*Math.cos(S),u.y=e*Math.sin(S),g.subVectors(f,u).normalize(),h.push(g.x,g.y,g.z),d.push(m/i),d.push(x/n)}}for(let x=1;x<=n;x++)for(let p=1;p<=i;p++){let m=(i+1)*x+p-1,S=(i+1)*(x-1)+p-1,T=(i+1)*(x-1)+p,y=(i+1)*x+p;l.push(m,S,y),l.push(S,T,y)}this.setIndex(l),this.setAttribute("position",new $e(c,3)),this.setAttribute("normal",new $e(h,3)),this.setAttribute("uv",new $e(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc,e.thetaStart,e.thetaLength)}};var ds=class s extends gt{constructor(e=new Qr(new C(-1,-1,0),new C(-1,1,0),new C(1,1,0)),t=64,n=1,i=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:i,closed:r};let o=e.computeFrenetFrames(t,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;let a=new C,l=new C,c=new ae,h=new C,d=[],u=[],f=[],g=[];x(),this.setIndex(g),this.setAttribute("position",new $e(d,3)),this.setAttribute("normal",new $e(u,3)),this.setAttribute("uv",new $e(f,2));function x(){for(let T=0;T<t;T++)p(T);p(r===!1?t:0),S(),m()}function p(T){h=e.getPointAt(T/t,h);let y=o.normals[T],E=o.binormals[T];for(let M=0;M<=i;M++){let A=M/i*Math.PI*2,_=Math.sin(A),w=-Math.cos(A);l.x=w*y.x+_*E.x,l.y=w*y.y+_*E.y,l.z=w*y.z+_*E.z,l.normalize(),u.push(l.x,l.y,l.z),a.x=h.x+n*l.x,a.y=h.y+n*l.y,a.z=h.z+n*l.z,d.push(a.x,a.y,a.z)}}function m(){for(let T=1;T<=t;T++)for(let y=1;y<=i;y++){let E=(i+1)*(T-1)+(y-1),M=(i+1)*T+(y-1),A=(i+1)*T+y,_=(i+1)*(T-1)+y;g.push(E,M,_),g.push(M,A,_)}}function S(){for(let T=0;T<=t;T++)for(let y=0;y<=i;y++)c.x=T/t,c.y=y/i,f.push(c.x,c.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new s(new Fp[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}};function xs(s){let e={};for(let t in s){e[t]={};for(let n in s[t]){let i=s[t][n];if(Gu(i))i.isRenderTargetTexture?(De("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone();else if(Array.isArray(i))if(Gu(i[0])){let r=[];for(let o=0,a=i.length;o<a;o++)r[o]=i[o].clone();e[t][n]=r}else e[t][n]=i.slice();else e[t][n]=i}}return e}function rn(s){let e={};for(let t=0;t<s.length;t++){let n=xs(s[t]);for(let i in n)e[i]=n[i]}return e}function Gu(s){return s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)}function Op(s){let e=[];for(let t=0;t<s.length;t++)e.push(s[t].clone());return e}function ih(s){let e=s.getRenderTarget();return e===null?s.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ge.workingColorSpace}var wi={clone:xs,merge:rn},Bp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,zp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,yt=class extends un{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Bp,this.fragmentShader=zp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=xs(e.uniforms),this.uniformsGroups=Op(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let o=this.uniforms[i].value;o&&o.isTexture?t.uniforms[i]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[i]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[i]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[i]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[i]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[i]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[i]={type:"m4",value:o.toArray()}:t.uniforms[i]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let i=e.uniforms[n];switch(this.uniforms[n]={},i.type){case"t":this.uniforms[n].value=t[i.value]||null;break;case"c":this.uniforms[n].value=new Ce().setHex(i.value);break;case"v2":this.uniforms[n].value=new ae().fromArray(i.value);break;case"v3":this.uniforms[n].value=new C().fromArray(i.value);break;case"v4":this.uniforms[n].value=new pt().fromArray(i.value);break;case"m3":this.uniforms[n].value=new He().fromArray(i.value);break;case"m4":this.uniforms[n].value=new Oe().fromArray(i.value);break;default:this.uniforms[n].value=i.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},er=class extends yt{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},At=class extends un{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ce(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ce(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ao,this.normalScale=new ae(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new In,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},gn=class extends At{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new ae(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return qe(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ce(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ce(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ce(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(e){this._retroreflectivity>0!=e>0&&this.version++,this._retroreflectivity=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.retroreflectivity=e.retroreflectivity,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var no=class extends un{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Ce(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ce(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ao,this.normalScale=new ae(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new In,this.combine=Ga,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},La=class extends un{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Md,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Na=class extends un{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function Oi(s,e){return!s||s.constructor===e?s:typeof e.BYTES_PER_ELEMENT=="number"?new e(s):Array.prototype.slice.call(s)}function ua(s){return s!==void 0&&s.inTangents!==void 0&&s.outTangents!==void 0}function kp(s){function e(i,r){return s[i]-s[r]}let t=s.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n}function Wu(s,e,t){let n=s.length,i=new s.constructor(n);for(let r=0,o=0;o!==n;++r){let a=t[r]*e;for(let l=0;l!==e;++l)i[o++]=s[a+l]}return i}function Hp(s,e,t,n){let i=1,r=s[0];for(;r!==void 0&&r[n]===void 0;)r=s[i++];if(r===void 0)return;let o=r[n];if(o!==void 0)if(Array.isArray(o))do o=r[n],o!==void 0&&(e.push(r.time),t.push(...o)),r=s[i++];while(r!==void 0);else if(o.toArray!==void 0)do o=r[n],o!==void 0&&(e.push(r.time),o.toArray(t,t.length)),r=s[i++];while(r!==void 0);else do o=r[n],o!==void 0&&(e.push(r.time),t.push(o)),r=s[i++];while(r!==void 0)}var ti=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];n:{e:{let o;t:{i:if(!(e<i)){for(let a=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=i,i=t[++n],e<i)break e}o=t.length;break t}if(!(e>=r)){let a=t[1];e<a&&(n=2,r=a);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=r,r=t[--n-1],e>=r)break e}o=n,n=0;break t}break n}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let o=0;o!==i;++o)t[o]=n[r+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Da=class extends ti{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ic,endingEnd:Ic}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,o=e+1,a=i[r],l=i[o];if(a===void 0)switch(this.getSettings_().endingStart){case Pc:r=e,a=2*t-n;break;case Lc:r=i.length-2,a=t+i[r]-i[r+1];break;default:r=e,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Pc:o=e,l=2*n-t;break;case Lc:o=1,l=n+i[1]-i[0];break;default:o=e-1,l=t}let c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,g=(n-t)/(i-t),x=g*g,p=x*g,m=-u*p+2*u*x-u*g,S=(1+u)*p+(-1.5-2*u)*x+(-.5+u)*g+1,T=(-1-f)*p+(1.5+f)*x+.5*g,y=f*p-f*x;for(let E=0;E!==a;++E)r[E]=m*o[h+E]+S*o[c+E]+T*o[l+E]+y*o[d+E];return r}},Ua=class extends ti{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=(n-t)/(i-t),d=1-h;for(let u=0;u!==a;++u)r[u]=o[c+u]*d+o[l+u]*h;return r}},Fa=class extends ti{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},Oa=class extends ti{interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this.inTangents,d=this.outTangents;if(!h||!d){let g=(n-t)/(i-t),x=1-g;for(let p=0;p!==a;++p)r[p]=o[c+p]*x+o[l+p]*g;return r}let u=a*2,f=e-1;for(let g=0;g!==a;++g){let x=o[c+g],p=o[l+g],m=f*u+g*2,S=d[m],T=d[m+1],y=e*u+g*2,E=h[y],M=h[y+1],A=Gp(n,t,S,E,i);r[g]=Ud(A,x,T,M,p)}return r}};function Ud(s,e,t,n,i){let r=1-s;return r*r*r*e+3*r*r*s*t+3*r*s*s*n+s*s*s*i}function Vp(s,e,t,n,i){let r=1-s;return 3*r*r*(t-e)+6*r*s*(n-t)+3*s*s*(i-n)}function Gp(s,e,t,n,i){let r=(s-e)/(i-e);for(let o=0;o<8;o++){let a=Ud(r,e,t,n,i)-s;if(Math.abs(a)<1e-10)break;let l=Vp(r,e,t,n,i);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var _n=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Oi(t,this.TimeBufferType),this.values=Oi(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Oi(e.times,Array),values:Oi(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i),ua(e.settings)&&(n.settings={inTangents:Oi(e.settings.inTangents,Array),outTangents:Oi(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Fa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Ua(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Da(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Oa(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case ss:t=this.InterpolantFactoryMethodDiscrete;break;case rs:t=this.InterpolantFactoryMethodLinear;break;case ca:t=this.InterpolantFactoryMethodSmooth;break;case Cc:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return De("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ss;case this.InterpolantFactoryMethodLinear:return rs;case this.InterpolantFactoryMethodSmooth:return ca;case this.InterpolantFactoryMethodBezier:return Cc}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e;ua(this.settings)&&(Xu(this.settings.inTangents,e),Xu(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,i=n.length,r=0,o=i-1;for(;r!==i&&n[r]<e;)++r;for(;o!==-1&&n[o]>t;)--o;if(++o,r!==0||o!==i){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(ke("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,r=n.length;r===0&&(ke("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==r;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){ke("KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){ke("KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(i!==void 0&&Xf(i))for(let a=0,l=i.length;a!==l;++a){let c=i[a];if(isNaN(c)){ke("KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===ca,r=e.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=e[a],h=e[a+1];if(c!==h&&(a!==1||c!==e[0]))if(i)l=!0;else{let d=a*n,u=d-n,f=d+n;for(let g=0;g!==n;++g){let x=t[d+g];if(x!==t[u+g]||x!==t[f+g]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let d=a*n,u=o*n;for(let f=0;f!==n;++f)t[u+f]=t[d+f]}++o}}if(r>0){e[o]=e[r];for(let a=r*n,l=o*n,c=0;c!==n;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,ua(this.settings)&&(i.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),i}};function Xu(s,e){for(let t=0,n=s.length;t!==n;t+=2)s[t]*=e}_n.prototype.ValueTypeName="";_n.prototype.TimeBufferType=Float32Array;_n.prototype.ValueBufferType=Float32Array;_n.prototype.DefaultInterpolation=rs;var yi=class extends _n{constructor(e,t,n){super(e,t,n)}};yi.prototype.ValueTypeName="bool";yi.prototype.ValueBufferType=Array;yi.prototype.DefaultInterpolation=ss;yi.prototype.InterpolantFactoryMethodLinear=void 0;yi.prototype.InterpolantFactoryMethodSmooth=void 0;var io=class extends _n{constructor(e,t,n,i){super(e,t,n,i)}};io.prototype.ValueTypeName="color";var Mi=class extends _n{constructor(e,t,n,i){super(e,t,n,i)}};Mi.prototype.ValueTypeName="number";var Ba=class extends ti{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-t)/(i-t),c=e*a;for(let h=c+a;c!==h;c+=4)zt.slerpFlat(r,0,o,c-a,o,c,l);return r}},Si=class extends _n{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new Ba(this.times,this.values,this.getValueSize(),e)}};Si.prototype.ValueTypeName="quaternion";Si.prototype.InterpolantFactoryMethodSmooth=void 0;var bi=class extends _n{constructor(e,t,n){super(e,t,n)}};bi.prototype.ValueTypeName="string";bi.prototype.ValueBufferType=Array;bi.prototype.DefaultInterpolation=ss;bi.prototype.InterpolantFactoryMethodLinear=void 0;bi.prototype.InterpolantFactoryMethodSmooth=void 0;var Vi=class extends _n{constructor(e,t,n,i){super(e,t,n,i)}};Vi.prototype.ValueTypeName="vector";var so=class{constructor(e="",t=-1,n=[],i=yd){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=qn(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,i=1/(e.fps||1);for(let o=0,a=n.length;o!==a;++o)t.push(Xp(n[o]).scale(i));let r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r.userData=JSON.parse(e.userData||"{}"),r}static toJSON(e){let t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let r=0,o=n.length;r!==o;++r)t.push(_n.toJSON(n[r]));return i}static CreateFromMorphTargetSequence(e,t,n,i){let r=t.length,o=[];for(let a=0;a<r;a++){let l=[],c=[];l.push((a+r-1)%r,a,(a+1)%r),c.push(0,1,0);let h=kp(l);l=Wu(l,1,h),c=Wu(c,1,h),!i&&l[0]===0&&(l.push(r),c.push(c[0])),o.push(new Mi(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/n))}return new this(e,-1,o)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let i={},r=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){let c=e[a],h=c.name.match(r);if(h&&h.length>1){let d=h[1],u=i[d];u||(i[d]=u=[]),u.push(c)}}let o=[];for(let a in i)o.push(this.CreateFromMorphTargetSequence(a,i[a],t,n));return o}resetDuration(){let e=this.tracks,t=0;for(let n=0,i=e.length;n!==i;++n){let r=this.tracks[n];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let n=0;n<this.tracks.length;n++)e.push(this.tracks[n].clone());let t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}};function Wp(s){switch(s.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Mi;case"vector":case"vector2":case"vector3":case"vector4":return Vi;case"color":return io;case"quaternion":return Si;case"bool":case"boolean":return yi;case"string":return bi}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+s)}function Xp(s){if(s.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=Wp(s.type);if(s.times===void 0){let n=[],i=[];Hp(s.keys,n,i,"value"),s.times=n,s.values=i}let t;return e.parse!==void 0?t=e.parse(s):t=new e(s.name,s.times,s.values,s.interpolation),ua(s.settings)&&(t.settings={inTangents:Oi(s.settings.inTangents,Float32Array),outTangents:Oi(s.settings.outTangents,Float32Array)}),t}var jn={enabled:!1,files:{},add:function(s,e){this.enabled!==!1&&(qu(s)||(this.files[s]=e))},get:function(s){if(this.enabled!==!1&&!qu(s))return this.files[s]},remove:function(s){delete this.files[s]},clear:function(){this.files={}}};function qu(s){try{let e=s.slice(s.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var tr=class{constructor(e,t,n){let i=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){a++,r===!1&&i.onStart!==void 0&&i.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,i.onProgress!==void 0&&i.onProgress(h,o,a),o===a&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){let d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=c.length;d<u;d+=2){let f=c[d],g=c[d+1];if(f.global&&(f.lastIndex=0),f.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Fd=new tr,ni=class{constructor(e){this.manager=e!==void 0?e:Fd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};ni.DEFAULT_MATERIAL_NAME="__DEFAULT";var gi={},Dc=class extends Error{constructor(e,t){super(e),this.response=t}},nr=class extends ni{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=jn.get(`file:${e}`);if(r!==void 0){this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0);return}if(gi[e]!==void 0){gi[e].push({onLoad:t,onProgress:n,onError:i});return}gi[e]=[],gi[e].push({onLoad:t,onProgress:n,onError:i});let o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),a=this.mimeType,l=this.responseType;fetch(o).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&De("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let h=gi[e],d=c.body.getReader(),u=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),f=u?parseInt(u):0,g=f!==0,x=0,p=new ReadableStream({start(m){S();function S(){d.read().then(({done:T,value:y})=>{if(T)m.close();else{x+=y.byteLength;let E=new ProgressEvent("progress",{lengthComputable:g,loaded:x,total:f});for(let M=0,A=h.length;M<A;M++){let _=h[M];_.onProgress&&_.onProgress(E)}m.enqueue(y),S()}},T=>{m.error(T)})}}});return new Response(p)}else throw new Dc(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,a));case"json":return c.json();default:if(a==="")return c.text();{let d=/charset="?([^;"\s]*)"?/i.exec(a),u=d&&d[1]?d[1].toLowerCase():void 0,f=new TextDecoder(u);return c.arrayBuffer().then(g=>f.decode(g))}}}).then(c=>{jn.add(`file:${e}`,c);let h=gi[e];delete gi[e];for(let d=0,u=h.length;d<u;d++){let f=h[d];f.onLoad&&f.onLoad(c)}}).catch(c=>{let h=gi[e];if(h===void 0)throw this.manager.itemError(e),c;delete gi[e];for(let d=0,u=h.length;d<u;d++){let f=h[d];f.onError&&f.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Fs=new WeakMap,za=class extends ni{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=jn.get(`image:${e}`);if(o!==void 0){if(o.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);else{let d=Fs.get(o);d===void 0&&(d=[],Fs.set(o,d)),d.push({onLoad:t,onError:i})}return o}let a=Gs("img");function l(){h(),t&&t(this);let d=Fs.get(this)||[];for(let u=0;u<d.length;u++){let f=d[u];f.onLoad&&f.onLoad(this)}Fs.delete(this),r.manager.itemEnd(e)}function c(d){h(),i&&i(d),jn.remove(`image:${e}`);let u=Fs.get(this)||[];for(let f=0;f<u.length;f++){let g=u[f];g.onError&&g.onError(d)}Fs.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),jn.add(`image:${e}`,a),r.manager.itemStart(e),a.src=e,a}};var ro=class extends ni{constructor(e){super(e)}load(e,t,n,i){let r=new Zt,o=new za(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},n,i),r}},fs=class extends bt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ce(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},oo=class extends fs{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(bt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ce(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},wc=new Oe,Yu=new C,Ku=new C,ir=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ae(512,512),this.mapType=vn,this.map=null,this.mapPass=null,this.matrix=new Oe,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new $s,this._frameExtents=new ae(1,1),this._viewportCount=1,this._viewports=[new pt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;Yu.setFromMatrixPosition(e.matrixWorld),t.position.copy(Yu),Ku.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Ku),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,i){wc.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(wc,e.coordinateSystem,e.reversedDepth);let r=this._frameExtents,o=i?i.z/r.x:1,a=i?i.w/r.y:1,l=i?i.x/r.x:0,c=i?i.y/r.y:0;e.coordinateSystem===Vs||e.reversedDepth?t.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):t.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),t.multiply(wc)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},aa=new C,la=new zt,$n=new C,ao=class extends bt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Oe,this.projectionMatrix=new Oe,this.projectionMatrixInverse=new Oe,this.coordinateSystem=Xn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(aa,la,$n),$n.x===1&&$n.y===1&&$n.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(aa,la,$n.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(aa,la,$n),$n.x===1&&$n.y===1&&$n.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(aa,la,$n.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Fi=new C,Zu=new ae,Ju=new ae,Bt=class extends ao{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=os*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Lr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return os*2*Math.atan(Math.tan(Lr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Fi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Fi.x,Fi.y).multiplyScalar(-e/Fi.z),Fi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Fi.x,Fi.y).multiplyScalar(-e/Fi.z)}getViewSize(e,t){return this.getViewBounds(e,Zu,Ju),t.subVectors(Ju,Zu)}setViewOffset(e,t,n,i,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Lr*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-.5*i,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*i/l,t-=o.offsetY*n/c,i*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},Uc=class extends ir{constructor(){super(new Bt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){let t=this.camera,n=os*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(n!==t.fov||i!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=i,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this.aspect=e.aspect,this}toJSON(){let e=super.toJSON();return e.focus=this.focus,e.aspect=this.aspect,e}},lo=class extends fs{constructor(e,t,n=0,i=Math.PI/3,r=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(bt.DEFAULT_UP),this.updateMatrix(),this.target=new bt,this.distance=n,this.angle=i,this.penumbra=r,this.decay=o,this.map=null,this.shadow=new Uc}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},Fc=class extends ir{constructor(){super(new Bt(90,1,.5,500)),this.isPointLightShadow=!0}},xn=class extends fs{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Fc}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},Ln=class extends ao{constructor(e=-1,t=1,n=1,i=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,o=n+e,a=i+t,l=i-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Oc=class extends ir{constructor(){super(new Ln(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Gi=class extends fs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(bt.DEFAULT_UP),this.updateMatrix(),this.target=new bt,this.shadow=new Oc}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var Ti=class{static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}};var Ac=new WeakMap,co=class extends ni{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&De("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&De("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=jn.get(`image-bitmap:${e}`);if(o!==void 0){if(r.manager.itemStart(e),o.then){o.then(c=>{Ac.has(o)===!0?(i&&i(Ac.get(o)),r.manager.itemError(e),r.manager.itemEnd(e)):(t&&t(c),r.manager.itemEnd(e))});return}setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);return}let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader,a.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;let l=fetch(e,a).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign({},r.options,{colorSpaceConversion:"none"}))}).then(function(c){return jn.add(`image-bitmap:${e}`,c),t&&t(c),r.manager.itemEnd(e),c}).catch(function(c){i&&i(c),Ac.set(l,c),jn.remove(`image-bitmap:${e}`),r.manager.itemError(e),r.manager.itemEnd(e)});jn.add(`image-bitmap:${e}`,l),r.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Os=-90,Bs=1,ka=class extends bt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new Bt(Os,Bs,e,t);i.layers=this.layers,this.add(i);let r=new Bt(Os,Bs,e,t);r.layers=this.layers,this.add(r);let o=new Bt(Os,Bs,e,t);o.layers=this.layers,this.add(o);let a=new Bt(Os,Bs,e,t);a.layers=this.layers,this.add(a);let l=new Bt(Os,Bs,e,t);l.layers=this.layers,this.add(l);let c=new Bt(Os,Bs,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,o,a,l]=t;for(let c of t)this.remove(c);if(e===Xn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Vs)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,d=e.getRenderTarget(),u=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let p=!1;e.isWebGLRenderer===!0?p=e.state.buffers.depth.getReversed():p=e.reversedDepthBuffer,e.setRenderTarget(n,0,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,2,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,3,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(d,u,f),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},Ha=class extends Bt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},ho=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=qp.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function qp(){this._document.hidden===!1&&this.reset()}var sh="\\[\\]\\.:\\/",Yp=new RegExp("["+sh+"]","g"),rh="[^"+sh+"]",Kp="[^"+sh.replace("\\.","")+"]",Zp=/((?:WC+[\/:])*)/.source.replace("WC",rh),Jp=/(WCOD+)?/.source.replace("WCOD",Kp),$p=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",rh),jp=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",rh),Qp=new RegExp("^"+Zp+Jp+$p+jp+"$"),em=["material","materials","bones","map"],Bc=class{constructor(e,t,n){let i=n||vt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},vt=class s{constructor(e,t,n){this.path=t,this.parsedPath=n||s.parseTrackName(t),this.node=s.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new s.Composite(e,t,n):new s(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Yp,"")}static parseTrackName(e){let t=Qp.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);em.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===t||a.uuid===t)return a;let l=n(a.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,r=t.propertyIndex;if(e||(e=s.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){De("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){ke("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){ke("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){ke("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){ke("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){ke("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[i];if(o===void 0){let c=t.nodeName;ke("PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};vt.Composite=Bc;vt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};vt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};vt.prototype.GetterByBindingType=[vt.prototype._getValue_direct,vt.prototype._getValue_array,vt.prototype._getValue_arrayElement,vt.prototype._getValue_toArray];vt.prototype.SetterByBindingTypeAndVersioning=[[vt.prototype._setValue_direct,vt.prototype._setValue_direct_setNeedsUpdate,vt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[vt.prototype._setValue_array,vt.prototype._setValue_array_setNeedsUpdate,vt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[vt.prototype._setValue_arrayElement,vt.prototype._setValue_arrayElement_setNeedsUpdate,vt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[vt.prototype._setValue_fromArray,vt.prototype._setValue_fromArray_setNeedsUpdate,vt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Tv=new Float32Array(1);var zc=class s{static{s.prototype.isMatrix2=!0}constructor(e,t,n,i){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=i,this}};function oh(s,e,t,n){let i=tm(n);switch(t){case Jc:return s*e;case Ja:return s*e/i.components*i.byteLength;case $a:return s*e/i.components*i.byteLength;case qi:return s*e*2/i.components*i.byteLength;case ja:return s*e*2/i.components*i.byteLength;case $c:return s*e*3/i.components*i.byteLength;case Tn:return s*e*4/i.components*i.byteLength;case Qa:return s*e*4/i.components*i.byteLength;case yo:case Mo:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case So:case bo:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case tl:case il:return Math.max(s,16)*Math.max(e,8)/4;case el:case nl:return Math.max(s,8)*Math.max(e,8)/2;case sl:case rl:case al:case ll:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case ol:case To:case cl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case hl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case ul:return Math.floor((s+4)/5)*Math.floor((e+3)/4)*16;case dl:return Math.floor((s+4)/5)*Math.floor((e+4)/5)*16;case fl:return Math.floor((s+5)/6)*Math.floor((e+4)/5)*16;case pl:return Math.floor((s+5)/6)*Math.floor((e+5)/6)*16;case ml:return Math.floor((s+7)/8)*Math.floor((e+4)/5)*16;case gl:return Math.floor((s+7)/8)*Math.floor((e+5)/6)*16;case _l:return Math.floor((s+7)/8)*Math.floor((e+7)/8)*16;case xl:return Math.floor((s+9)/10)*Math.floor((e+4)/5)*16;case vl:return Math.floor((s+9)/10)*Math.floor((e+5)/6)*16;case yl:return Math.floor((s+9)/10)*Math.floor((e+7)/8)*16;case Ml:return Math.floor((s+9)/10)*Math.floor((e+9)/10)*16;case Sl:return Math.floor((s+11)/12)*Math.floor((e+9)/10)*16;case bl:return Math.floor((s+11)/12)*Math.floor((e+11)/12)*16;case Tl:case El:case wl:return Math.ceil(s/4)*Math.ceil(e/4)*16;case Al:case Rl:return Math.ceil(s/4)*Math.ceil(e/4)*8;case Eo:case Cl:return Math.ceil(s/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function tm(s){switch(s){case vn:case qc:return{byteLength:1,components:1};case ar:case Yc:case en:return{byteLength:2,components:1};case Ka:case Za:return{byteLength:2,components:4};case Zn:case Ya:case bn:return{byteLength:4,components:1};case Kc:case Zc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${s}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?De("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function rf(){let s=null,e=!1,t=null,n=null;function i(r,o){n=s.requestAnimationFrame(i),t(r,o)}return{start:function(){e!==!0&&t!==null&&s!==null&&(n=s.requestAnimationFrame(i),e=!0)},stop:function(){s!==null&&s.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){s=r}}}function im(s){let e=new WeakMap;function t(a,l){let c=a.array,h=a.usage,d=c.byteLength,u=s.createBuffer();s.bindBuffer(l,u),s.bufferData(l,c,h),a.onUploadCallback();let f;if(c instanceof Float32Array)f=s.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=s.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?f=s.HALF_FLOAT:f=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=s.SHORT;else if(c instanceof Uint32Array)f=s.UNSIGNED_INT;else if(c instanceof Int32Array)f=s.INT;else if(c instanceof Int8Array)f=s.BYTE;else if(c instanceof Uint8Array)f=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:d}}function n(a,l,c){let h=l.array,d=l.updateRanges;if(s.bindBuffer(c,a),d.length===0)s.bufferSubData(c,0,h);else{d.sort((f,g)=>f.start-g.start);let u=0;for(let f=1;f<d.length;f++){let g=d[u],x=d[f];x.start<=g.start+g.count+1?g.count=Math.max(g.count,x.start+x.count-g.start):(++u,d[u]=x)}d.length=u+1;for(let f=0,g=d.length;f<g;f++){let x=d[f];s.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(s.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:i,remove:r,update:o}}var sm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,rm=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,om=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,am=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,lm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,cm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,hm=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,um=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,dm=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,fm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,pm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,mm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,gm=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,_m=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,xm=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,vm=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,ym=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Mm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Sm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,bm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Tm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Em=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,wm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Am=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Rm=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Cm=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Im=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Pm=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Lm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Nm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Dm="gl_FragColor = linearToOutputTexel( gl_FragColor );",Um=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Fm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Om=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Bm=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,zm=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,km=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Hm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Vm=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Gm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Wm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Xm=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,qm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Ym=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Km=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Zm=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Jm=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,$m=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,jm=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Qm=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,eg=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,tg=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,ng=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,ig=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,sg=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,rg=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,og=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,ag=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,lg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,cg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,hg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,ug=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,dg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,fg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,pg=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,mg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,gg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,_g=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,xg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,vg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,yg=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Mg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Sg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,bg=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Tg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Eg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,wg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Ag=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Rg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Cg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ig=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Pg=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Lg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Ng=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Dg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Ug=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Fg=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Og=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Bg=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,zg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,kg=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Hg=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Vg=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Gg=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Wg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Xg=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,qg=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Yg=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Kg=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Zg=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Jg=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,$g=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,jg=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Qg=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,e0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,t0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,n0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,i0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,s0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,r0=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,o0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,a0=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,l0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,c0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,h0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,u0=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,d0=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,f0=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,p0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,m0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,g0=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,_0=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,x0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,v0=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,y0=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,M0=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,S0=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,b0=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,T0=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,E0=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,w0=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,A0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,R0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,C0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,I0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,P0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,L0=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,N0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,D0=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,U0=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,F0=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,O0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ye={alphahash_fragment:sm,alphahash_pars_fragment:rm,alphamap_fragment:om,alphamap_pars_fragment:am,alphatest_fragment:lm,alphatest_pars_fragment:cm,aomap_fragment:hm,aomap_pars_fragment:um,batching_pars_vertex:dm,batching_vertex:fm,begin_vertex:pm,beginnormal_vertex:mm,bsdfs:gm,iridescence_fragment:_m,bumpmap_pars_fragment:xm,clipping_planes_fragment:vm,clipping_planes_pars_fragment:ym,clipping_planes_pars_vertex:Mm,clipping_planes_vertex:Sm,color_fragment:bm,color_pars_fragment:Tm,color_pars_vertex:Em,color_vertex:wm,common:Am,cube_uv_reflection_fragment:Rm,defaultnormal_vertex:Cm,displacementmap_pars_vertex:Im,displacementmap_vertex:Pm,emissivemap_fragment:Lm,emissivemap_pars_fragment:Nm,colorspace_fragment:Dm,colorspace_pars_fragment:Um,envmap_fragment:Fm,envmap_common_pars_fragment:Om,envmap_pars_fragment:Bm,envmap_pars_vertex:zm,envmap_physical_pars_fragment:Jm,envmap_vertex:km,fog_vertex:Hm,fog_pars_vertex:Vm,fog_fragment:Gm,fog_pars_fragment:Wm,gradientmap_pars_fragment:Xm,lightmap_pars_fragment:qm,lights_lambert_fragment:Ym,lights_lambert_pars_fragment:Km,lights_pars_begin:Zm,lights_toon_fragment:$m,lights_toon_pars_fragment:jm,lights_phong_fragment:Qm,lights_phong_pars_fragment:eg,lights_physical_fragment:tg,lights_physical_pars_fragment:ng,lights_fragment_begin:ig,lights_fragment_maps:sg,lights_fragment_end:rg,lightprobes_pars_fragment:og,logdepthbuf_fragment:ag,logdepthbuf_pars_fragment:lg,logdepthbuf_pars_vertex:cg,logdepthbuf_vertex:hg,map_fragment:ug,map_pars_fragment:dg,map_particle_fragment:fg,map_particle_pars_fragment:pg,metalnessmap_fragment:mg,metalnessmap_pars_fragment:gg,morphinstance_vertex:_g,morphcolor_vertex:xg,morphnormal_vertex:vg,morphtarget_pars_vertex:yg,morphtarget_vertex:Mg,normal_fragment_begin:Sg,normal_fragment_maps:bg,normal_pars_fragment:Tg,normal_pars_vertex:Eg,normal_vertex:wg,normalmap_pars_fragment:Ag,clearcoat_normal_fragment_begin:Rg,clearcoat_normal_fragment_maps:Cg,clearcoat_pars_fragment:Ig,iridescence_pars_fragment:Pg,opaque_fragment:Lg,packing:Ng,premultiplied_alpha_fragment:Dg,project_vertex:Ug,dithering_fragment:Fg,dithering_pars_fragment:Og,roughnessmap_fragment:Bg,roughnessmap_pars_fragment:zg,shadowmap_pars_fragment:kg,shadowmap_pars_vertex:Hg,shadowmap_vertex:Vg,shadowmask_pars_fragment:Gg,skinbase_vertex:Wg,skinning_pars_vertex:Xg,skinning_vertex:qg,skinnormal_vertex:Yg,specularmap_fragment:Kg,specularmap_pars_fragment:Zg,tonemapping_fragment:Jg,tonemapping_pars_fragment:$g,transmission_fragment:jg,transmission_pars_fragment:Qg,uv_pars_fragment:e0,uv_pars_vertex:t0,uv_vertex:n0,worldpos_vertex:i0,background_vert:s0,background_frag:r0,backgroundCube_vert:o0,backgroundCube_frag:a0,cube_vert:l0,cube_frag:c0,depth_vert:h0,depth_frag:u0,distance_vert:d0,distance_frag:f0,equirect_vert:p0,equirect_frag:m0,linedashed_vert:g0,linedashed_frag:_0,meshbasic_vert:x0,meshbasic_frag:v0,meshlambert_vert:y0,meshlambert_frag:M0,meshmatcap_vert:S0,meshmatcap_frag:b0,meshnormal_vert:T0,meshnormal_frag:E0,meshphong_vert:w0,meshphong_frag:A0,meshphysical_vert:R0,meshphysical_frag:C0,meshtoon_vert:I0,meshtoon_frag:P0,points_vert:L0,points_frag:N0,shadow_vert:D0,shadow_frag:U0,sprite_vert:F0,sprite_frag:O0},ve={common:{diffuse:{value:new Ce(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new He},alphaMap:{value:null},alphaMapTransform:{value:new He},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new He}},envmap:{envMap:{value:null},envMapRotation:{value:new He},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new He}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new He}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new He},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new He},normalScale:{value:new ae(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new He},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new He}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new He}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new He}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ce(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new C},probesMax:{value:new C},probesResolution:{value:new C}},points:{diffuse:{value:new Ce(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new He},alphaTest:{value:0},uvTransform:{value:new He}},sprite:{diffuse:{value:new Ce(16777215)},opacity:{value:1},center:{value:new ae(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new He},alphaMap:{value:null},alphaMapTransform:{value:new He},alphaTest:{value:0}}},oi={basic:{uniforms:rn([ve.common,ve.specularmap,ve.envmap,ve.aomap,ve.lightmap,ve.fog]),vertexShader:Ye.meshbasic_vert,fragmentShader:Ye.meshbasic_frag},lambert:{uniforms:rn([ve.common,ve.specularmap,ve.envmap,ve.aomap,ve.lightmap,ve.emissivemap,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.fog,ve.lights,{emissive:{value:new Ce(0)},envMapIntensity:{value:1}}]),vertexShader:Ye.meshlambert_vert,fragmentShader:Ye.meshlambert_frag},phong:{uniforms:rn([ve.common,ve.specularmap,ve.envmap,ve.aomap,ve.lightmap,ve.emissivemap,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.fog,ve.lights,{emissive:{value:new Ce(0)},specular:{value:new Ce(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ye.meshphong_vert,fragmentShader:Ye.meshphong_frag},standard:{uniforms:rn([ve.common,ve.envmap,ve.aomap,ve.lightmap,ve.emissivemap,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.roughnessmap,ve.metalnessmap,ve.fog,ve.lights,{emissive:{value:new Ce(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ye.meshphysical_vert,fragmentShader:Ye.meshphysical_frag},toon:{uniforms:rn([ve.common,ve.aomap,ve.lightmap,ve.emissivemap,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.gradientmap,ve.fog,ve.lights,{emissive:{value:new Ce(0)}}]),vertexShader:Ye.meshtoon_vert,fragmentShader:Ye.meshtoon_frag},matcap:{uniforms:rn([ve.common,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.fog,{matcap:{value:null}}]),vertexShader:Ye.meshmatcap_vert,fragmentShader:Ye.meshmatcap_frag},points:{uniforms:rn([ve.points,ve.fog]),vertexShader:Ye.points_vert,fragmentShader:Ye.points_frag},dashed:{uniforms:rn([ve.common,ve.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ye.linedashed_vert,fragmentShader:Ye.linedashed_frag},depth:{uniforms:rn([ve.common,ve.displacementmap]),vertexShader:Ye.depth_vert,fragmentShader:Ye.depth_frag},normal:{uniforms:rn([ve.common,ve.bumpmap,ve.normalmap,ve.displacementmap,{opacity:{value:1}}]),vertexShader:Ye.meshnormal_vert,fragmentShader:Ye.meshnormal_frag},sprite:{uniforms:rn([ve.sprite,ve.fog]),vertexShader:Ye.sprite_vert,fragmentShader:Ye.sprite_frag},background:{uniforms:{uvTransform:{value:new He},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ye.background_vert,fragmentShader:Ye.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new He}},vertexShader:Ye.backgroundCube_vert,fragmentShader:Ye.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ye.cube_vert,fragmentShader:Ye.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ye.equirect_vert,fragmentShader:Ye.equirect_frag},distance:{uniforms:rn([ve.common,ve.displacementmap,{referencePosition:{value:new C},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ye.distance_vert,fragmentShader:Ye.distance_frag},shadow:{uniforms:rn([ve.lights,ve.fog,{color:{value:new Ce(0)},opacity:{value:1}}]),vertexShader:Ye.shadow_vert,fragmentShader:Ye.shadow_frag}};oi.physical={uniforms:rn([oi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new He},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new He},clearcoatNormalScale:{value:new ae(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new He},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new He},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new He},sheen:{value:0},sheenColor:{value:new Ce(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new He},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new He},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new He},transmissionSamplerSize:{value:new ae},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new He},attenuationDistance:{value:0},attenuationColor:{value:new Ce(0)},specularColor:{value:new Ce(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new He},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new He},anisotropyVector:{value:new ae},anisotropyMap:{value:null},anisotropyMapTransform:{value:new He}}]),vertexShader:Ye.meshphysical_vert,fragmentShader:Ye.meshphysical_frag};var Ll={r:0,b:0,g:0},B0=new Oe,of=new He;of.set(-1,0,0,0,1,0,0,0,1);function z0(s,e,t,n,i,r){let o=new Ce(0),a=i===!0?0:1,l,c,h=null,d=0,u=null;function f(S){let T=S.isScene===!0?S.background:null;if(T&&T.isTexture){let y=S.backgroundBlurriness>0;T=e.get(T,y)}return T}function g(S){let T=!1,y=f(S);y===null?p(o,a):y&&y.isColor&&(p(y,1),T=!0);let E=s.xr.getEnvironmentBlendMode();E==="additive"?t.buffers.color.setClear(0,0,0,1,r):E==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(s.autoClear||T)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function x(S,T){let y=f(T);y&&(y.isCubeTexture||y.mapping===vo)?(c===void 0&&(c=new nt(new Jt(1,1,1),new yt({name:"BackgroundCubeMaterial",uniforms:xs(oi.backgroundCube.uniforms),vertexShader:oi.backgroundCube.vertexShader,fragmentShader:oi.backgroundCube.fragmentShader,side:Wt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(E,M,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(B0.makeRotationFromEuler(T.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(of),c.material.toneMapped=Ge.getTransfer(y.colorSpace)!==ot,(h!==y||d!==y.version||u!==s.toneMapping)&&(c.material.needsUpdate=!0,h=y,d=y.version,u=s.toneMapping),c.layers.enableAll(),S.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new nt(new to(2,2),new yt({name:"BackgroundMaterial",uniforms:xs(oi.background.uniforms),vertexShader:oi.background.vertexShader,fragmentShader:oi.background.fragmentShader,side:ii,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=Ge.getTransfer(y.colorSpace)!==ot,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(h!==y||d!==y.version||u!==s.toneMapping)&&(l.material.needsUpdate=!0,h=y,d=y.version,u=s.toneMapping),l.layers.enableAll(),S.unshift(l,l.geometry,l.material,0,0,null))}function p(S,T){S.getRGB(Ll,ih(s)),t.buffers.color.setClear(Ll.r,Ll.g,Ll.b,T,r)}function m(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(S,T=1){o.set(S),a=T,p(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(S){a=S,p(o,a)},render:g,addToRenderList:x,dispose:m}}function k0(s,e){let t=s.getParameter(s.MAX_VERTEX_ATTRIBS),n={},i=u(null),r=i,o=!1;function a(L,U,O,N,B){let q=!1,G=d(L,N,O,U);r!==G&&(r=G,c(r.object)),q=f(L,N,O,B),q&&g(L,N,O,B),B!==null&&e.update(B,s.ELEMENT_ARRAY_BUFFER),(q||o)&&(o=!1,y(L,U,O,N),B!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(B).buffer))}function l(){return s.createVertexArray()}function c(L){return s.bindVertexArray(L)}function h(L){return s.deleteVertexArray(L)}function d(L,U,O,N){let B=N.wireframe===!0,q=n[U.id];q===void 0&&(q={},n[U.id]=q);let G=L.isInstancedMesh===!0?L.id:0,j=q[G];j===void 0&&(j={},q[G]=j);let X=j[O.id];X===void 0&&(X={},j[O.id]=X);let $=X[B];return $===void 0&&($=u(l()),X[B]=$),$}function u(L){let U=[],O=[],N=[];for(let B=0;B<t;B++)U[B]=0,O[B]=0,N[B]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:O,attributeDivisors:N,object:L,attributes:{},index:null}}function f(L,U,O,N){let B=r.attributes,q=U.attributes,G=0,j=O.getAttributes();for(let X in j)if(j[X].location>=0){let ne=B[X],Te=q[X];if(Te===void 0&&(X==="instanceMatrix"&&L.instanceMatrix&&(Te=L.instanceMatrix),X==="instanceColor"&&L.instanceColor&&(Te=L.instanceColor)),ne===void 0||ne.attribute!==Te||Te&&ne.data!==Te.data)return!0;G++}return r.attributesNum!==G||r.index!==N}function g(L,U,O,N){let B={},q=U.attributes,G=0,j=O.getAttributes();for(let X in j)if(j[X].location>=0){let ne=q[X];ne===void 0&&(X==="instanceMatrix"&&L.instanceMatrix&&(ne=L.instanceMatrix),X==="instanceColor"&&L.instanceColor&&(ne=L.instanceColor));let Te={};Te.attribute=ne,ne&&ne.data&&(Te.data=ne.data),B[X]=Te,G++}r.attributes=B,r.attributesNum=G,r.index=N}function x(){let L=r.newAttributes;for(let U=0,O=L.length;U<O;U++)L[U]=0}function p(L){m(L,0)}function m(L,U){let O=r.newAttributes,N=r.enabledAttributes,B=r.attributeDivisors;O[L]=1,N[L]===0&&(s.enableVertexAttribArray(L),N[L]=1),B[L]!==U&&(s.vertexAttribDivisor(L,U),B[L]=U)}function S(){let L=r.newAttributes,U=r.enabledAttributes;for(let O=0,N=U.length;O<N;O++)U[O]!==L[O]&&(s.disableVertexAttribArray(O),U[O]=0)}function T(L,U,O,N,B,q,G){G===!0?s.vertexAttribIPointer(L,U,O,B,q):s.vertexAttribPointer(L,U,O,N,B,q)}function y(L,U,O,N){x();let B=N.attributes,q=O.getAttributes(),G=U.defaultAttributeValues;for(let j in q){let X=q[j];if(X.location>=0){let $=B[j];if($===void 0&&(j==="instanceMatrix"&&L.instanceMatrix&&($=L.instanceMatrix),j==="instanceColor"&&L.instanceColor&&($=L.instanceColor)),$!==void 0){let ne=$.normalized,Te=$.itemSize,le=e.get($);if(le===void 0)continue;let Fe=le.buffer,Be=le.type,Qe=le.bytesPerElement,K=Be===s.INT||Be===s.UNSIGNED_INT||$.gpuType===Ya;if($.isInterleavedBufferAttribute){let ee=$.data,ye=ee.stride,Ue=$.offset;if(ee.isInstancedInterleavedBuffer){for(let ie=0;ie<X.locationSize;ie++)m(X.location+ie,ee.meshPerAttribute);L.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let ie=0;ie<X.locationSize;ie++)p(X.location+ie);s.bindBuffer(s.ARRAY_BUFFER,Fe);for(let ie=0;ie<X.locationSize;ie++)T(X.location+ie,Te/X.locationSize,Be,ne,ye*Qe,(Ue+Te/X.locationSize*ie)*Qe,K)}else{if($.isInstancedBufferAttribute){for(let ee=0;ee<X.locationSize;ee++)m(X.location+ee,$.meshPerAttribute);L.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=$.meshPerAttribute*$.count)}else for(let ee=0;ee<X.locationSize;ee++)p(X.location+ee);s.bindBuffer(s.ARRAY_BUFFER,Fe);for(let ee=0;ee<X.locationSize;ee++)T(X.location+ee,Te/X.locationSize,Be,ne,Te*Qe,Te/X.locationSize*ee*Qe,K)}}else if(G!==void 0){let ne=G[j];if(ne!==void 0)switch(ne.length){case 2:s.vertexAttrib2fv(X.location,ne);break;case 3:s.vertexAttrib3fv(X.location,ne);break;case 4:s.vertexAttrib4fv(X.location,ne);break;default:s.vertexAttrib1fv(X.location,ne)}}}}S()}function E(){w();for(let L in n){let U=n[L];for(let O in U){let N=U[O];for(let B in N){let q=N[B];for(let G in q)h(q[G].object),delete q[G];delete N[B]}}delete n[L]}}function M(L){if(n[L.id]===void 0)return;let U=n[L.id];for(let O in U){let N=U[O];for(let B in N){let q=N[B];for(let G in q)h(q[G].object),delete q[G];delete N[B]}}delete n[L.id]}function A(L){for(let U in n){let O=n[U];for(let N in O){let B=O[N];if(B[L.id]===void 0)continue;let q=B[L.id];for(let G in q)h(q[G].object),delete q[G];delete B[L.id]}}}function _(L){for(let U in n){let O=n[U],N=L.isInstancedMesh===!0?L.id:0,B=O[N];if(B!==void 0){for(let q in B){let G=B[q];for(let j in G)h(G[j].object),delete G[j];delete B[q]}delete O[N],Object.keys(O).length===0&&delete n[U]}}}function w(){I(),o=!0,r!==i&&(r=i,c(r.object))}function I(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:a,reset:w,resetDefaultState:I,dispose:E,releaseStatesOfGeometry:M,releaseStatesOfObject:_,releaseStatesOfProgram:A,initAttributes:x,enableAttribute:p,disableUnusedAttributes:S}}function H0(s,e,t){let n;function i(l){n=l}function r(l,c){s.drawArrays(n,l,c),t.update(c,n,1)}function o(l,c,h){h!==0&&(s.drawArraysInstanced(n,l,c,h),t.update(c,n,h))}function a(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let f=0;f<h;f++)u+=c[f];t.update(u,n,1)}this.setMode=i,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function V0(s,e,t,n){let i;function r(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){let A=e.get("EXT_texture_filter_anisotropic");i=s.getParameter(A.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(A){return!(A!==Tn&&n.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(A){let _=A===en&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(A!==vn&&A!==bn&&!_&&n.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE))}function l(A){if(A==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";A="mediump"}return A==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(De("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let d=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&De("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),g=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=s.getParameter(s.MAX_TEXTURE_SIZE),p=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),m=s.getParameter(s.MAX_VERTEX_ATTRIBS),S=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),T=s.getParameter(s.MAX_VARYING_VECTORS),y=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),E=s.getParameter(s.MAX_SAMPLES),M=s.getParameter(s.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:S,maxVaryings:T,maxFragmentUniforms:y,maxSamples:E,samples:M}}function G0(s){let e=this,t=null,n=0,i=!1,r=!1,o=new Gn,a=new He,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){let f=d.length!==0||u||n!==0||i;return i=u,n=d.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,u){t=h(d,u,0)},this.setState=function(d,u,f){let g=d.clippingPlanes,x=d.clipIntersection,p=d.clipShadows,m=s.get(d);if(!i||g===null||g.length===0||r&&!p)r?h(null):c();else{let S=r?0:n,T=S*4,y=m.clippingState||null;l.value=y,y=h(g,u,T,f);for(let E=0;E!==T;++E)y[E]=t[E];m.clippingState=y,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=S}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(d,u,f,g){let x=d!==null?d.length:0,p=null;if(x!==0){if(p=l.value,g!==!0||p===null){let m=f+x*4,S=u.matrixWorldInverse;a.getNormalMatrix(S),(p===null||p.length<m)&&(p=new Float32Array(m));for(let T=0,y=f;T!==x;++T,y+=4)o.copy(d[T]).applyMatrix4(S,a),o.normal.toArray(p,y),p[y+3]=o.constant}l.value=p,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,p}}var ur=4,W0=6,X0=20,q0=256,Co=new Ln,Od=new Ce,ah=null,lh=0,ch=0,hh=!1,Y0=new C,vs=new C,fr=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,i=100,r={}){let{size:o=256,position:a=Y0}=r;ah=this._renderer.getRenderTarget(),lh=this._renderer.getActiveCubeFace(),ch=this._renderer.getActiveMipmapLevel(),hh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,i,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=kd(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=zd(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(ah,lh,ch),this._renderer.xr.enabled=hh,e.scissorTest=!1,hr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Wi||e.mapping===gs?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ah=this._renderer.getRenderTarget(),lh=this._renderer.getActiveCubeFace(),ch=this._renderer.getActiveMipmapLevel(),hh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Lt,minFilter:Lt,generateMipmaps:!1,type:en,format:Tn,colorSpace:cn,depthBuffer:!1},i=Bd(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Bd(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=K0(r)),this._blurMaterial=J0(r,e,t),this._ggxMaterial=Z0(r,e,t)}return i}_compileMaterial(e){let t=new nt(new gt,e);this._renderer.compile(t,Co)}_sceneToCubeUV(e,t,n,i,r){let l=new Bt(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,f=d.toneMapping;d.getClearColor(Od),d.toneMapping=Yn,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(i),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new nt(new Jt,new Gt({name:"PMREM.Background",side:Wt,depthWrite:!1,depthTest:!1})));let x=this._backgroundBox,p=x.material,m=!1,S=e.background;S?S.isColor&&(p.color.copy(S),e.background=null,m=!0):(p.color.copy(Od),m=!0);for(let T=0;T<6;T++){let y=T%3;y===0?(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[T],r.y,r.z)):y===1?(l.up.set(0,0,c[T]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[T],r.z)):(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[T]));let E=this._cubeSize;hr(i,y*E,T>2?E:0,E,E),d.setRenderTarget(i),m&&d.render(x,l),d.render(e,l)}d.toneMapping=f,d.autoClear=u,e.background=S}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===Wi||e.mapping===gs;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=kd()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=zd());let r=i?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=e;let l=this._cubeSize;hr(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(o,Co)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodMeshes.length;for(let r=1;r<i;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){let i=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[n];a.material=o;let l=o.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),d=Math.sqrt(c*c-h*h),u=c*1.25,f=d*u,{_lodMax:g}=this,x=this._sizeLods[n],p=3*x*(n>g-ur?n-g+ur:0),m=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=f,l.mipInt.value=g-t,hr(r,p,m,3*x,2*x),i.setRenderTarget(r),i.render(a,Co),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-n,hr(e,p,m,3*x,2*x),i.setRenderTarget(e),i.render(a,Co)}_blur(e,t,n,i){let r=this._pingPongRenderTarget,o=Math.min(i,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,o),this._blurPass(r,e,n,n,o)}_blurPass(e,t,n,i,r){let o=this._renderer,a=this._blurMaterial,l=this._lodMeshes[i];l.material=a;let c=a.uniforms;c.envMap.value=e.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-n;let h=this._sizeLods[i],d=3*h*(i>this._lodMax-ur?i-this._lodMax+ur:0),u=4*(this._cubeSize-h);hr(t,d,u,3*h,2*h),o.setRenderTarget(t),o.render(l,Co)}};function K0(s){let e=[],t=[],n=s,i=s-ur+1+W0;for(let r=0;r<i;r++){let o=Math.pow(2,n);e.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],d=6,u=6,f=3,g=new Float32Array(f*u*d),x=new Float32Array(f*u*d);for(let m=0;m<d;m++){let S=m%3*2/3-1,T=m>2?0:-1,y=[S,T,0,S+2/3,T,0,S+2/3,T+1,0,S,T,0,S+2/3,T+1,0,S,T+1,0];g.set(y,f*u*m);for(let E=0;E<u;E++){let M=h[E*2]*2-1,A=h[E*2+1]*2-1;m===0?vs.set(1,A,M):m===1?vs.set(-M,1,-A):m===2?vs.set(-M,A,1):m===3?vs.set(-1,A,-M):m===4?vs.set(-M,-1,A):vs.set(M,A,-1),vs.toArray(x,(m*u+E)*f)}}let p=new gt;p.setAttribute("position",new Vt(g,f)),p.setAttribute("outputDirection",new Vt(x,f)),t.push(new nt(p,null)),n>ur&&n--}return{lodMeshes:t,sizeLods:e}}function Bd(s,e,t){let n=new kt(s,e,t);return n.texture.mapping=vo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function hr(s,e,t,n,i){s.viewport.set(e,t,n,i),s.scissor.set(e,t,n,i)}function Z0(s,e,t){return new yt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:q0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Fl(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Nn,depthTest:!1,depthWrite:!1})}function J0(s,e,t){return new yt({name:"SphericalGaussianBlur",defines:{SAMPLES:X0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Fl(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:Nn,depthTest:!1,depthWrite:!1})}function zd(){return new yt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Fl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Nn,depthTest:!1,depthWrite:!1})}function kd(){return new yt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Fl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Nn,depthTest:!1,depthWrite:!1})}function Fl(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Dl=class extends kt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new Yr(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Jt(5,5,5),r=new yt({name:"CubemapFromEquirect",uniforms:xs(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Wt,blending:Nn});r.uniforms.tEquirect.value=t;let o=new nt(i,r),a=t.minFilter;return t.minFilter===Kn&&(t.minFilter=Lt),new ka(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){let r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,i);e.setRenderTarget(r)}};function $0(s){let e=new WeakMap,t=new WeakMap,n=null;function i(u,f=!1){return u==null?null:f?o(u):r(u)}function r(u){if(u&&u.isTexture){let f=u.mapping;if(f===Wa||f===Xa)if(e.has(u)){let g=e.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let x=new Dl(g.height);return x.fromEquirectangularTexture(s,u),e.set(u,x),u.addEventListener("dispose",c),a(x.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let f=u.mapping,g=f===Wa||f===Xa,x=f===Wi||f===gs;if(g||x){let p=t.get(u),m=p!==void 0?p.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==m)return n===null&&(n=new fr(s)),p=g?n.fromEquirectangular(u,p):n.fromCubemap(u,p),p.texture.pmremVersion=u.pmremVersion,t.set(u,p),p.texture;if(p!==void 0)return p.texture;{let S=u.image;return g&&S&&S.height>0||x&&S&&l(S)?(n===null&&(n=new fr(s)),p=g?n.fromEquirectangular(u):n.fromCubemap(u),p.texture.pmremVersion=u.pmremVersion,t.set(u,p),u.addEventListener("dispose",h),p.texture):null}}}return u}function a(u,f){return f===Wa?u.mapping=Wi:f===Xa&&(u.mapping=gs),u}function l(u){let f=0,g=6;for(let x=0;x<g;x++)u[x]!==void 0&&f++;return f===g}function c(u){let f=u.target;f.removeEventListener("dispose",c);let g=e.get(f);g!==void 0&&(e.delete(f),g.dispose())}function h(u){let f=u.target;f.removeEventListener("dispose",h);let g=t.get(f);g!==void 0&&(t.delete(f),g.dispose())}function d(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:i,dispose:d}}function j0(s){let e={};function t(n){if(e[n]!==void 0)return e[n];let i=s.getExtension(n);return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let i=t(n);return i===null&&is("WebGLRenderer: "+n+" extension not supported."),i}}}function Q0(s,e,t,n){let i={},r=new WeakMap;function o(d){let u=d.target;u.index!==null&&e.remove(u.index);for(let g in u.attributes)e.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete i[u.id];let f=r.get(u);f&&(e.remove(f),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function a(d,u){return i[u.id]===!0||(u.addEventListener("dispose",o),i[u.id]=!0,t.memory.geometries++),u}function l(d){let u=d.attributes;for(let f in u)e.update(u[f],s.ARRAY_BUFFER)}function c(d){let u=[],f=d.index,g=d.attributes.position,x=0;if(g===void 0)return;if(f!==null){let S=f.array;x=f.version;for(let T=0,y=S.length;T<y;T+=3){let E=S[T+0],M=S[T+1],A=S[T+2];u.push(E,M,M,A,A,E)}}else{let S=g.array;x=g.version;for(let T=0,y=S.length/3-1;T<y;T+=3){let E=T+0,M=T+1,A=T+2;u.push(E,M,M,A,A,E)}}let p=new(g.count>=65535?Vr:Hr)(u,1);p.version=x;let m=r.get(d);m&&e.remove(m),r.set(d,p)}function h(d){let u=r.get(d);if(u){let f=d.index;f!==null&&u.version<f.version&&c(d)}else c(d);return r.get(d)}return{get:a,update:l,getWireframeAttribute:h}}function e_(s,e,t){let n;function i(d){n=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function l(d,u){s.drawElements(n,u,r,d*o),t.update(u,n,1)}function c(d,u,f){f!==0&&(s.drawElementsInstanced(n,u,r,d*o,f),t.update(u,n,f))}function h(d,u,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,d,0,f);let x=0;for(let p=0;p<f;p++)x+=u[p];t.update(x,n,1)}this.setMode=i,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function t_(s){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(t.calls++,o){case s.TRIANGLES:t.triangles+=a*(r/3);break;case s.LINES:t.lines+=a*(r/2);break;case s.LINE_STRIP:t.lines+=a*(r-1);break;case s.LINE_LOOP:t.lines+=a*r;break;case s.POINTS:t.points+=a*r;break;default:ke("WebGLInfo: Unknown draw mode:",o);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function n_(s,e,t){let n=new WeakMap,i=new pt;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,d=h!==void 0?h.length:0,u=n.get(a);if(u===void 0||u.count!==d){let w=function(){A.dispose(),n.delete(a),a.removeEventListener("dispose",w)};u!==void 0&&u.texture.dispose();let f=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],m=a.morphAttributes.normal||[],S=a.morphAttributes.color||[],T=0;f===!0&&(T=1),g===!0&&(T=2),x===!0&&(T=3);let y=a.attributes.position.count*T,E=1;y>e.maxTextureSize&&(E=Math.ceil(y/e.maxTextureSize),y=e.maxTextureSize);let M=new Float32Array(y*E*4*d),A=new Br(M,y,E,d);A.type=bn,A.needsUpdate=!0;let _=T*4;for(let I=0;I<d;I++){let L=p[I],U=m[I],O=S[I],N=y*E*4*I;for(let B=0;B<L.count;B++){let q=B*_;f===!0&&(i.fromBufferAttribute(L,B),M[N+q+0]=i.x,M[N+q+1]=i.y,M[N+q+2]=i.z,M[N+q+3]=0),g===!0&&(i.fromBufferAttribute(U,B),M[N+q+4]=i.x,M[N+q+5]=i.y,M[N+q+6]=i.z,M[N+q+7]=0),x===!0&&(i.fromBufferAttribute(O,B),M[N+q+8]=i.x,M[N+q+9]=i.y,M[N+q+10]=i.z,M[N+q+11]=O.itemSize===4?i.w:1)}}u={count:d,texture:A,size:new ae(y,E)},n.set(a,u),a.addEventListener("dispose",w)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",o.morphTexture,t);else{let f=0;for(let x=0;x<c.length;x++)f+=c[x];let g=a.morphTargetsRelative?1:1-f;l.getUniforms().setValue(s,"morphTargetBaseInfluence",g),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",u.texture,t),l.getUniforms().setValue(s,"morphTargetsTextureSize",u.size)}return{update:r}}function i_(s,e,t,n,i){let r=new WeakMap;function o(c){let h=i.render.frame,d=c.geometry,u=e.get(c,d);if(r.get(u)!==h&&(e.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(t.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,s.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return u}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:o,dispose:a}}var s_={[fo]:"LINEAR_TONE_MAPPING",[po]:"REINHARD_TONE_MAPPING",[mo]:"CINEON_TONE_MAPPING",[ms]:"ACES_FILMIC_TONE_MAPPING",[_o]:"AGX_TONE_MAPPING",[xo]:"NEUTRAL_TONE_MAPPING",[go]:"CUSTOM_TONE_MAPPING"};function r_(s,e,t,n,i,r){let o=new kt(e,t,{type:s,depthBuffer:i,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new gt;c.setAttribute("position",new $e([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new $e([0,2,0,0,2,0],2));let h=new er({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new nt(c,h),u=new Ln(-1,1,1,-1,0,1),f=null,g=null,x=!1,p,m=null,S=[],T=!1;this.setSize=function(y,E){o.setSize(y,E),a!==null&&a.setSize(y,E),l!==null&&l.setSize(y,E);for(let M=0;M<S.length;M++){let A=S[M];A.setSize&&A.setSize(y,E)}},this.setEffects=function(y){S=y,T=S.length>0&&S[0].isRenderPass===!0;let E=o.width,M=o.height;S.length>0&&a===null&&(a=new kt(E,M,{type:en,depthBuffer:!1,stencilBuffer:!1}),l=new kt(E,M,{type:en,depthBuffer:!1,stencilBuffer:!1}));for(let A=0;A<S.length;A++){let _=S[A];_.setSize&&_.setSize(E,M)}},this.begin=function(y,E){if(x||y.toneMapping===Yn&&S.length===0)return!1;if(m=E,E!==null){let M=E.width,A=E.height;(o.width!==M||o.height!==A)&&this.setSize(M,A)}return T===!1&&y.setRenderTarget(o),p=y.toneMapping,y.toneMapping=Yn,!0},this.hasRenderPass=function(){return T},this.end=function(y,E){y.toneMapping=p,x=!0;let M=o,A=a;for(let _=0;_<S.length;_++){let w=S[_];w.enabled!==!1&&(w.render(y,A,M,E),w.needsSwap!==!1&&(M=A,A=A===a?l:a))}if(f!==y.outputColorSpace||g!==y.toneMapping){f=y.outputColorSpace,g=y.toneMapping,h.defines={},Ge.getTransfer(f)===ot&&(h.defines.SRGB_TRANSFER="");let _=s_[g];_&&(h.defines[_]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=M.texture,y.setRenderTarget(m),y.render(d,u),m=null,x=!1},this.isCompositing=function(){return x},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),c.dispose(),h.dispose()}}var af=new Zt,fh=new ki(1,1),lf=new Br,cf=new Ma,hf=new Yr,Hd=[],Vd=[],Gd=new Float32Array(16),Wd=new Float32Array(9),Xd=new Float32Array(4);function pr(s,e,t){let n=s[0];if(n<=0||n>0)return s;let i=e*t,r=Hd[i];if(r===void 0&&(r=new Float32Array(i),Hd[i]=r),e!==0){n.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,s[o].toArray(r,a)}return r}function Xt(s,e){if(s.length!==e.length)return!1;for(let t=0,n=s.length;t<n;t++)if(s[t]!==e[t])return!1;return!0}function qt(s,e){for(let t=0,n=e.length;t<n;t++)s[t]=e[t]}function Ol(s,e){let t=Vd[e];t===void 0&&(t=new Int32Array(e),Vd[e]=t);for(let n=0;n!==e;++n)t[n]=s.allocateTextureUnit();return t}function o_(s,e){let t=this.cache;t[0]!==e&&(s.uniform1f(this.addr,e),t[0]=e)}function a_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Xt(t,e))return;s.uniform2fv(this.addr,e),qt(t,e)}}function l_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(s.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Xt(t,e))return;s.uniform3fv(this.addr,e),qt(t,e)}}function c_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Xt(t,e))return;s.uniform4fv(this.addr,e),qt(t,e)}}function h_(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(Xt(t,e))return;s.uniformMatrix2fv(this.addr,!1,e),qt(t,e)}else{if(Xt(t,n))return;Xd.set(n),s.uniformMatrix2fv(this.addr,!1,Xd),qt(t,n)}}function u_(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(Xt(t,e))return;s.uniformMatrix3fv(this.addr,!1,e),qt(t,e)}else{if(Xt(t,n))return;Wd.set(n),s.uniformMatrix3fv(this.addr,!1,Wd),qt(t,n)}}function d_(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(Xt(t,e))return;s.uniformMatrix4fv(this.addr,!1,e),qt(t,e)}else{if(Xt(t,n))return;Gd.set(n),s.uniformMatrix4fv(this.addr,!1,Gd),qt(t,n)}}function f_(s,e){let t=this.cache;t[0]!==e&&(s.uniform1i(this.addr,e),t[0]=e)}function p_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Xt(t,e))return;s.uniform2iv(this.addr,e),qt(t,e)}}function m_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Xt(t,e))return;s.uniform3iv(this.addr,e),qt(t,e)}}function g_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Xt(t,e))return;s.uniform4iv(this.addr,e),qt(t,e)}}function __(s,e){let t=this.cache;t[0]!==e&&(s.uniform1ui(this.addr,e),t[0]=e)}function x_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Xt(t,e))return;s.uniform2uiv(this.addr,e),qt(t,e)}}function v_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Xt(t,e))return;s.uniform3uiv(this.addr,e),qt(t,e)}}function y_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Xt(t,e))return;s.uniform4uiv(this.addr,e),qt(t,e)}}function M_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);let r;this.type===s.SAMPLER_2D_SHADOW?(fh.compareFunction=t.isReversedDepthBuffer()?Pl:Il,r=fh):r=af,t.setTexture2D(e||r,i)}function S_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||cf,i)}function b_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||hf,i)}function T_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||lf,i)}function E_(s){switch(s){case 5126:return o_;case 35664:return a_;case 35665:return l_;case 35666:return c_;case 35674:return h_;case 35675:return u_;case 35676:return d_;case 5124:case 35670:return f_;case 35667:case 35671:return p_;case 35668:case 35672:return m_;case 35669:case 35673:return g_;case 5125:return __;case 36294:return x_;case 36295:return v_;case 36296:return y_;case 35678:case 36198:case 36298:case 36306:case 35682:return M_;case 35679:case 36299:case 36307:return S_;case 35680:case 36300:case 36308:case 36293:return b_;case 36289:case 36303:case 36311:case 36292:return T_}}function w_(s,e){s.uniform1fv(this.addr,e)}function A_(s,e){let t=pr(e,this.size,2);s.uniform2fv(this.addr,t)}function R_(s,e){let t=pr(e,this.size,3);s.uniform3fv(this.addr,t)}function C_(s,e){let t=pr(e,this.size,4);s.uniform4fv(this.addr,t)}function I_(s,e){let t=pr(e,this.size,4);s.uniformMatrix2fv(this.addr,!1,t)}function P_(s,e){let t=pr(e,this.size,9);s.uniformMatrix3fv(this.addr,!1,t)}function L_(s,e){let t=pr(e,this.size,16);s.uniformMatrix4fv(this.addr,!1,t)}function N_(s,e){s.uniform1iv(this.addr,e)}function D_(s,e){s.uniform2iv(this.addr,e)}function U_(s,e){s.uniform3iv(this.addr,e)}function F_(s,e){s.uniform4iv(this.addr,e)}function O_(s,e){s.uniform1uiv(this.addr,e)}function B_(s,e){s.uniform2uiv(this.addr,e)}function z_(s,e){s.uniform3uiv(this.addr,e)}function k_(s,e){s.uniform4uiv(this.addr,e)}function H_(s,e,t){let n=this.cache,i=e.length,r=Ol(t,i);Xt(n,r)||(s.uniform1iv(this.addr,r),qt(n,r));let o;this.type===s.SAMPLER_2D_SHADOW?o=fh:o=af;for(let a=0;a!==i;++a)t.setTexture2D(e[a]||o,r[a])}function V_(s,e,t){let n=this.cache,i=e.length,r=Ol(t,i);Xt(n,r)||(s.uniform1iv(this.addr,r),qt(n,r));for(let o=0;o!==i;++o)t.setTexture3D(e[o]||cf,r[o])}function G_(s,e,t){let n=this.cache,i=e.length,r=Ol(t,i);Xt(n,r)||(s.uniform1iv(this.addr,r),qt(n,r));for(let o=0;o!==i;++o)t.setTextureCube(e[o]||hf,r[o])}function W_(s,e,t){let n=this.cache,i=e.length,r=Ol(t,i);Xt(n,r)||(s.uniform1iv(this.addr,r),qt(n,r));for(let o=0;o!==i;++o)t.setTexture2DArray(e[o]||lf,r[o])}function X_(s){switch(s){case 5126:return w_;case 35664:return A_;case 35665:return R_;case 35666:return C_;case 35674:return I_;case 35675:return P_;case 35676:return L_;case 5124:case 35670:return N_;case 35667:case 35671:return D_;case 35668:case 35672:return U_;case 35669:case 35673:return F_;case 5125:return O_;case 36294:return B_;case 36295:return z_;case 36296:return k_;case 35678:case 36198:case 36298:case 36306:case 35682:return H_;case 35679:case 36299:case 36307:return V_;case 35680:case 36300:case 36308:case 36293:return G_;case 36289:case 36303:case 36311:case 36292:return W_}}var ph=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=E_(t.type)}},mh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=X_(t.type)}},gh=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,o=i.length;r!==o;++r){let a=i[r];a.setValue(e,t[a.id],n)}}},uh=/(\w+)(\])?(\[|\.)?/g;function qd(s,e){s.seq.push(e),s.map[e.id]=e}function q_(s,e,t){let n=s.name,i=n.length;for(uh.lastIndex=0;;){let r=uh.exec(n),o=uh.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===i){qd(t,c===void 0?new ph(a,s,e):new mh(a,s,e));break}else{let d=t.map[a];d===void 0&&(d=new gh(a),qd(t,d)),t=d}}}var dr=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=e.getActiveUniform(t,o),l=e.getUniformLocation(t,a.name);q_(a,l,this)}let i=[],r=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?i.push(o):r.push(o);i.length>0&&(this.seq=i.concat(r))}setValue(e,t,n,i){let r=this.map[t];r!==void 0&&r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,o=t.length;r!==o;++r){let a=t[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let o=e[i];o.id in t&&n.push(o)}return n}};function Yd(s,e,t){let n=s.createShader(e);return s.shaderSource(n,t),s.compileShader(n),n}var Y_=37297,K_=0;function Z_(s,e){let t=s.split(`
`),n=[],i=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=i;o<r;o++){let a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}var Kd=new He;function J_(s){Ge._getMatrix(Kd,Ge.workingColorSpace,s);let e=`mat3( ${Kd.elements.map(t=>t.toFixed(4))} )`;switch(Ge.getTransfer(s)){case Fr:return[e,"LinearTransferOETF"];case ot:return[e,"sRGBTransferOETF"];default:return De("WebGLProgram: Unsupported color space: ",s),[e,"LinearTransferOETF"]}}function Zd(s,e,t){let n=s.getShaderParameter(e,s.COMPILE_STATUS),r=(s.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+Z_(s.getShaderSource(e),a)}else return r}function $_(s,e){let t=J_(e);return[`vec4 ${s}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var j_={[fo]:"Linear",[po]:"Reinhard",[mo]:"Cineon",[ms]:"ACESFilmic",[_o]:"AgX",[xo]:"Neutral",[go]:"Custom"};function Q_(s,e){let t=j_[e];return t===void 0?(De("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+s+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+s+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Nl=new C;function ex(){Ge.getLuminanceCoefficients(Nl);let s=Nl.x.toFixed(4),e=Nl.y.toFixed(4),t=Nl.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function tx(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Po).join(`
`)}function nx(s){let e=[];for(let t in s){let n=s[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function ix(s,e){let t={},n=s.getProgramParameter(e,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){let r=s.getActiveAttrib(e,i),o=r.name,a=1;r.type===s.FLOAT_MAT2&&(a=2),r.type===s.FLOAT_MAT3&&(a=3),r.type===s.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:s.getAttribLocation(e,o),locationSize:a}}return t}function Po(s){return s!==""}function Jd(s,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return s.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function $d(s,e){return s.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var sx=/^[ \t]*#include +<([\w\d./]+)>/gm;function _h(s){return s.replace(sx,ox)}var rx=new Map;function ox(s,e){let t=Ye[e];if(t===void 0){let n=rx.get(e);if(n!==void 0)t=Ye[n],De('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return _h(t)}var ax=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function jd(s){return s.replace(ax,lx)}function lx(s,e,t,n){let i="";for(let r=parseInt(e);r<parseInt(t);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function Qd(s){let e=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?e+=`
#define HIGH_PRECISION`:s.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var cx={[uo]:"SHADOWMAP_TYPE_PCF",[sr]:"SHADOWMAP_TYPE_VSM"};function hx(s){return cx[s.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var ux={[Wi]:"ENVMAP_TYPE_CUBE",[gs]:"ENVMAP_TYPE_CUBE",[vo]:"ENVMAP_TYPE_CUBE_UV"};function dx(s){return s.envMap===!1?"ENVMAP_TYPE_CUBE":ux[s.envMapMode]||"ENVMAP_TYPE_CUBE"}var fx={[gs]:"ENVMAP_MODE_REFRACTION"};function px(s){return s.envMap===!1?"ENVMAP_MODE_REFLECTION":fx[s.envMapMode]||"ENVMAP_MODE_REFLECTION"}var mx={[Ga]:"ENVMAP_BLENDING_MULTIPLY",[_d]:"ENVMAP_BLENDING_MIX",[xd]:"ENVMAP_BLENDING_ADD"};function gx(s){return s.envMap===!1?"ENVMAP_BLENDING_NONE":mx[s.combine]||"ENVMAP_BLENDING_NONE"}function _x(s){let e=s.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function xx(s,e,t,n){let i=s.getContext(),r=t.defines,o=t.vertexShader,a=t.fragmentShader,l=hx(t),c=dx(t),h=px(t),d=gx(t),u=_x(t),f=tx(t),g=nx(r),x=i.createProgram(),p,m,S=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Po).join(`
`),p.length>0&&(p+=`
`),m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Po).join(`
`),m.length>0&&(m+=`
`)):(p=[Qd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Po).join(`
`),m=[Qd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Yn?"#define TONE_MAPPING":"",t.toneMapping!==Yn?Ye.tonemapping_pars_fragment:"",t.toneMapping!==Yn?Q_("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ye.colorspace_pars_fragment,$_("linearToOutputTexel",t.outputColorSpace),ex(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Po).join(`
`)),o=_h(o),o=Jd(o,t),o=$d(o,t),a=_h(a),a=Jd(a,t),a=$d(a,t),o=jd(o),a=jd(a),t.isRawShaderMaterial!==!0&&(S=`#version 300 es
`,p=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,m=["#define varying in",t.glslVersion===eh?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===eh?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let T=S+p+o,y=S+m+a,E=Yd(i,i.VERTEX_SHADER,T),M=Yd(i,i.FRAGMENT_SHADER,y);i.attachShader(x,E),i.attachShader(x,M),t.index0AttributeName!==void 0?i.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&i.bindAttribLocation(x,0,"position"),i.linkProgram(x);function A(L){if(s.debug.checkShaderErrors){let U=i.getProgramInfoLog(x)||"",O=i.getShaderInfoLog(E)||"",N=i.getShaderInfoLog(M)||"",B=U.trim(),q=O.trim(),G=N.trim(),j=!0,X=!0;if(i.getProgramParameter(x,i.LINK_STATUS)===!1)if(j=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,x,E,M);else{let $=Zd(i,E,"vertex"),ne=Zd(i,M,"fragment");ke("WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(x,i.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+B+`
`+$+`
`+ne)}else B!==""?De("WebGLProgram: Program Info Log:",B):(q===""||G==="")&&(X=!1);X&&(L.diagnostics={runnable:j,programLog:B,vertexShader:{log:q,prefix:p},fragmentShader:{log:G,prefix:m}})}i.deleteShader(E),i.deleteShader(M),_=new dr(i,x),w=ix(i,x)}let _;this.getUniforms=function(){return _===void 0&&A(this),_};let w;this.getAttributes=function(){return w===void 0&&A(this),w};let I=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return I===!1&&(I=i.getProgramParameter(x,Y_)),I},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=K_++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=E,this.fragmentShader=M,this}var vx=0,xh=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let i=this._getShaderCacheForMaterial(e);return i.has(t)===!1&&(i.add(t),t.usedTimes++),i.has(n)===!1&&(i.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new vh(e),t.set(e,n)),n}},vh=class{constructor(e){this.id=vx++,this.code=e,this.usedTimes=0}};function yx(s){return s===qi||s===To||s===Eo}function Mx(s,e,t,n,i,r){let o=new zr,a=new xh,l=new Set,c=[],h=new Map,d=n.logarithmicDepthBuffer,u=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(_){return l.add(_),_===0?"uv":`uv${_}`}function x(_,w,I,L,U,O){let N=L.fog,B=U.geometry,q=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?L.environment:null,G=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,j=e.get(_.envMap||q,G),X=j&&j.mapping===vo?j.image.height:null,$=f[_.type];_.precision!==null&&(u=n.getMaxPrecision(_.precision),u!==_.precision&&De("WebGLProgram.getParameters:",_.precision,"not supported, using",u,"instead."));let ne=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,Te=ne!==void 0?ne.length:0,le=0;B.morphAttributes.position!==void 0&&(le=1),B.morphAttributes.normal!==void 0&&(le=2),B.morphAttributes.color!==void 0&&(le=3);let Fe,Be,Qe,K;if($){let ct=oi[$];Fe=ct.vertexShader,Be=ct.fragmentShader}else{Fe=_.vertexShader,Be=_.fragmentShader;let ct=a.getVertexShaderStage(_),st=a.getFragmentShaderStage(_);a.update(_,ct,st),Qe=ct.id,K=st.id}let ee=s.getRenderTarget(),ye=s.state.buffers.depth.getReversed(),Ue=U.isInstancedMesh===!0,ie=U.isBatchedMesh===!0,ce=!!_.map,Mt=!!_.matcap,Ve=!!j,Je=!!_.aoMap,ut=!!_.lightMap,Ke=!!_.bumpMap&&_.wireframe===!1,tt=!!_.normalMap,wt=!!_.displacementMap,Qt=!!_.emissiveMap,lt=!!_.metalnessMap,Tt=!!_.roughnessMap,D=_.anisotropy>0,dt=_.clearcoat>0,We=_.dispersion>0,R=_.retroreflectivity>0,v=_.iridescence>0,z=_.sheen>0,W=_.transmission>0,Y=D&&!!_.anisotropyMap,oe=dt&&!!_.clearcoatMap,ue=dt&&!!_.clearcoatNormalMap,Z=dt&&!!_.clearcoatRoughnessMap,Q=v&&!!_.iridescenceMap,de=v&&!!_.iridescenceThicknessMap,Ae=z&&!!_.sheenColorMap,me=z&&!!_.sheenRoughnessMap,re=!!_.specularMap,Re=!!_.specularColorMap,Ne=!!_.specularIntensityMap,ze=W&&!!_.transmissionMap,F=W&&!!_.thicknessMap,fe=!!_.gradientMap,J=!!_.alphaMap,pe=_.alphaTest>0,_e=!!_.alphaHash,se=!!_.extensions,Le=Yn;_.toneMapped&&(ee===null||ee.isXRRenderTarget===!0)&&(Le=s.toneMapping);let Me={shaderID:$,shaderType:_.type,shaderName:_.name,vertexShader:Fe,fragmentShader:Be,defines:_.defines,customVertexShaderID:Qe,customFragmentShaderID:K,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:u,batching:ie,batchingColor:ie&&U._colorsTexture!==null,instancing:Ue,instancingColor:Ue&&U.instanceColor!==null,instancingMorph:Ue&&U.morphTexture!==null,outputColorSpace:ee===null?s.outputColorSpace:ee.isXRRenderTarget===!0?ee.texture.colorSpace:Ge.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:ce,matcap:Mt,envMap:Ve,envMapMode:Ve&&j.mapping,envMapCubeUVHeight:X,aoMap:Je,lightMap:ut,bumpMap:Ke,normalMap:tt,displacementMap:wt,emissiveMap:Qt,normalMapObjectSpace:tt&&_.normalMapType===Sd,normalMapTangentSpace:tt&&_.normalMapType===Ao,packedNormalMap:tt&&_.normalMapType===Ao&&yx(_.normalMap.format),metalnessMap:lt,roughnessMap:Tt,anisotropy:D,anisotropyMap:Y,clearcoat:dt,clearcoatMap:oe,clearcoatNormalMap:ue,clearcoatRoughnessMap:Z,dispersion:We,retroreflection:R,iridescence:v,iridescenceMap:Q,iridescenceThicknessMap:de,sheen:z,sheenColorMap:Ae,sheenRoughnessMap:me,specularMap:re,specularColorMap:Re,specularIntensityMap:Ne,transmission:W,transmissionMap:ze,thicknessMap:F,gradientMap:fe,opaque:_.transparent===!1&&_.blending===rr&&_.alphaToCoverage===!1,alphaMap:J,alphaTest:pe,alphaHash:_e,combine:_.combine,mapUv:ce&&g(_.map.channel),aoMapUv:Je&&g(_.aoMap.channel),lightMapUv:ut&&g(_.lightMap.channel),bumpMapUv:Ke&&g(_.bumpMap.channel),normalMapUv:tt&&g(_.normalMap.channel),displacementMapUv:wt&&g(_.displacementMap.channel),emissiveMapUv:Qt&&g(_.emissiveMap.channel),metalnessMapUv:lt&&g(_.metalnessMap.channel),roughnessMapUv:Tt&&g(_.roughnessMap.channel),anisotropyMapUv:Y&&g(_.anisotropyMap.channel),clearcoatMapUv:oe&&g(_.clearcoatMap.channel),clearcoatNormalMapUv:ue&&g(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Z&&g(_.clearcoatRoughnessMap.channel),iridescenceMapUv:Q&&g(_.iridescenceMap.channel),iridescenceThicknessMapUv:de&&g(_.iridescenceThicknessMap.channel),sheenColorMapUv:Ae&&g(_.sheenColorMap.channel),sheenRoughnessMapUv:me&&g(_.sheenRoughnessMap.channel),specularMapUv:re&&g(_.specularMap.channel),specularColorMapUv:Re&&g(_.specularColorMap.channel),specularIntensityMapUv:Ne&&g(_.specularIntensityMap.channel),transmissionMapUv:ze&&g(_.transmissionMap.channel),thicknessMapUv:F&&g(_.thicknessMap.channel),alphaMapUv:J&&g(_.alphaMap.channel),vertexTangents:!!B.attributes.tangent&&(tt||D),vertexNormals:!!B.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!B.attributes.uv&&(ce||J),fog:!!N,useFog:_.fog===!0,fogExp2:!!N&&N.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||B.attributes.normal===void 0&&tt===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:ye,skinning:U.isSkinnedMesh===!0,hasPositionAttribute:B.attributes.position!==void 0,morphTargets:B.morphAttributes.position!==void 0,morphNormals:B.morphAttributes.normal!==void 0,morphColors:B.morphAttributes.color!==void 0,morphTargetsCount:Te,morphTextureStride:le,numSunLights:w.sun.length,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numSunLightShadows:w.sunShadowMap.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:O.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:_.dithering,shadowMapEnabled:s.shadowMap.enabled&&I.length>0,shadowMapType:s.shadowMap.type,toneMapping:Le,decodeVideoTexture:ce&&_.map.isVideoTexture===!0&&Ge.getTransfer(_.map.colorSpace)===ot,decodeVideoTextureEmissive:Qt&&_.emissiveMap.isVideoTexture===!0&&Ge.getTransfer(_.emissiveMap.colorSpace)===ot,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Ht,flipSided:_.side===Wt,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:se&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(se&&_.extensions.multiDraw===!0||ie)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return Me.vertexUv1s=l.has(1),Me.vertexUv2s=l.has(2),Me.vertexUv3s=l.has(3),l.clear(),Me}function p(_){let w=[];if(_.shaderID?w.push(_.shaderID):(w.push(_.customVertexShaderID),w.push(_.customFragmentShaderID)),_.defines!==void 0)for(let I in _.defines)w.push(I),w.push(_.defines[I]);return _.isRawShaderMaterial===!1&&(m(w,_),S(w,_),w.push(s.outputColorSpace)),w.push(_.customProgramCacheKey),w.join()}function m(_,w){_.push(w.precision),_.push(w.outputColorSpace),_.push(w.envMapMode),_.push(w.envMapCubeUVHeight),_.push(w.mapUv),_.push(w.alphaMapUv),_.push(w.lightMapUv),_.push(w.aoMapUv),_.push(w.bumpMapUv),_.push(w.normalMapUv),_.push(w.displacementMapUv),_.push(w.emissiveMapUv),_.push(w.metalnessMapUv),_.push(w.roughnessMapUv),_.push(w.anisotropyMapUv),_.push(w.clearcoatMapUv),_.push(w.clearcoatNormalMapUv),_.push(w.clearcoatRoughnessMapUv),_.push(w.iridescenceMapUv),_.push(w.iridescenceThicknessMapUv),_.push(w.sheenColorMapUv),_.push(w.sheenRoughnessMapUv),_.push(w.specularMapUv),_.push(w.specularColorMapUv),_.push(w.specularIntensityMapUv),_.push(w.transmissionMapUv),_.push(w.thicknessMapUv),_.push(w.combine),_.push(w.fogExp2),_.push(w.sizeAttenuation),_.push(w.morphTargetsCount),_.push(w.morphAttributeCount),_.push(w.numSunLights),_.push(w.numDirLights),_.push(w.numPointLights),_.push(w.numSpotLights),_.push(w.numSpotLightMaps),_.push(w.numHemiLights),_.push(w.numRectAreaLights),_.push(w.numSunLightShadows),_.push(w.numDirLightShadows),_.push(w.numPointLightShadows),_.push(w.numSpotLightShadows),_.push(w.numSpotLightShadowsWithMaps),_.push(w.numLightProbes),_.push(w.shadowMapType),_.push(w.toneMapping),_.push(w.numClippingPlanes),_.push(w.numClipIntersection),_.push(w.depthPacking)}function S(_,w){o.disableAll(),w.instancing&&o.enable(0),w.instancingColor&&o.enable(1),w.instancingMorph&&o.enable(2),w.matcap&&o.enable(3),w.envMap&&o.enable(4),w.normalMapObjectSpace&&o.enable(5),w.normalMapTangentSpace&&o.enable(6),w.clearcoat&&o.enable(7),w.iridescence&&o.enable(8),w.alphaTest&&o.enable(9),w.vertexColors&&o.enable(10),w.vertexAlphas&&o.enable(11),w.vertexUv1s&&o.enable(12),w.vertexUv2s&&o.enable(13),w.vertexUv3s&&o.enable(14),w.vertexTangents&&o.enable(15),w.anisotropy&&o.enable(16),w.alphaHash&&o.enable(17),w.batching&&o.enable(18),w.dispersion&&o.enable(19),w.retroreflection&&o.enable(24),w.batchingColor&&o.enable(20),w.gradientMap&&o.enable(21),w.packedNormalMap&&o.enable(22),w.vertexNormals&&o.enable(23),_.push(o.mask),o.disableAll(),w.fog&&o.enable(0),w.useFog&&o.enable(1),w.flatShading&&o.enable(2),w.logarithmicDepthBuffer&&o.enable(3),w.reversedDepthBuffer&&o.enable(4),w.skinning&&o.enable(5),w.morphTargets&&o.enable(6),w.morphNormals&&o.enable(7),w.morphColors&&o.enable(8),w.premultipliedAlpha&&o.enable(9),w.shadowMapEnabled&&o.enable(10),w.doubleSided&&o.enable(11),w.flipSided&&o.enable(12),w.useDepthPacking&&o.enable(13),w.dithering&&o.enable(14),w.transmission&&o.enable(15),w.sheen&&o.enable(16),w.opaque&&o.enable(17),w.pointsUvs&&o.enable(18),w.decodeVideoTexture&&o.enable(19),w.decodeVideoTextureEmissive&&o.enable(20),w.alphaToCoverage&&o.enable(21),w.numLightProbeGrids>0&&o.enable(22),w.hasPositionAttribute&&o.enable(23),_.push(o.mask)}function T(_){let w=f[_.type],I;if(w){let L=oi[w];I=wi.clone(L.uniforms)}else I=_.uniforms;return I}function y(_,w){let I=h.get(w);return I!==void 0?++I.usedTimes:(I=new xx(s,w,_,i),c.push(I),h.set(w,I)),I}function E(_){if(--_.usedTimes===0){let w=c.indexOf(_);c[w]=c[c.length-1],c.pop(),h.delete(_.cacheKey),_.destroy()}}function M(_){a.remove(_)}function A(){a.dispose()}return{getParameters:x,getProgramCacheKey:p,getUniforms:T,acquireProgram:y,releaseProgram:E,releaseShaderCache:M,programs:c,dispose:A}}function Sx(){let s=new WeakMap;function e(o){return s.has(o)}function t(o){let a=s.get(o);return a===void 0&&(a={},s.set(o,a)),a}function n(o){s.delete(o)}function i(o,a,l){s.get(o)[a]=l}function r(){s=new WeakMap}return{has:e,get:t,remove:n,update:i,dispose:r}}function bx(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.material.id!==e.material.id?s.material.id-e.material.id:s.materialVariant!==e.materialVariant?s.materialVariant-e.materialVariant:s.z!==e.z?s.z-e.z:s.id-e.id}function ef(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.z!==e.z?e.z-s.z:s.id-e.id}function tf(){let s=[],e=0,t=[],n=[],i=[];function r(){e=0,t.length=0,n.length=0,i.length=0}function o(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function a(u,f,g,x,p,m){let S=s[e];return S===void 0?(S={id:u.id,object:u,geometry:f,material:g,materialVariant:o(u),groupOrder:x,renderOrder:u.renderOrder,z:p,group:m},s[e]=S):(S.id=u.id,S.object=u,S.geometry=f,S.material=g,S.materialVariant=o(u),S.groupOrder=x,S.renderOrder=u.renderOrder,S.z=p,S.group=m),e++,S}function l(u,f,g,x,p,m,S){S.reversedDepth===!0&&(p=-p);let T=a(u,f,g,x,p,m);g.transmission>0?n.push(T):g.transparent===!0?i.push(T):t.push(T)}function c(u,f,g,x,p,m){let S=a(u,f,g,x,p,m);g.transmission>0?n.unshift(S):g.transparent===!0?i.unshift(S):t.unshift(S)}function h(u,f){t.length>1&&t.sort(u||bx),n.length>1&&n.sort(f||ef),i.length>1&&i.sort(f||ef)}function d(){for(let u=e,f=s.length;u<f;u++){let g=s[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:i,init:r,push:l,unshift:c,finish:d,sort:h}}function Tx(){let s=new WeakMap;function e(n,i){let r=s.get(n),o;return r===void 0?(o=new tf,s.set(n,[o])):i>=r.length?(o=new tf,r.push(o)):o=r[i],o}function t(){s=new WeakMap}return{get:e,dispose:t}}function Ex(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new C,color:new Ce};break;case"SpotLight":t={position:new C,direction:new C,color:new Ce,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new C,color:new Ce,distance:0,decay:0};break;case"HemisphereLight":t={direction:new C,skyColor:new Ce,groundColor:new Ce};break;case"RectAreaLight":t={color:new Ce,position:new C,halfWidth:new C,halfHeight:new C};break}return s[e.id]=t,t}}}function wx(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ae};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ae};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ae,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[e.id]=t,t}}}var Ax=0;function Rx(s,e){return(e.castShadow?2:0)-(s.castShadow?2:0)+(e.map?1:0)-(s.map?1:0)}function Cx(s){let e=new Ex,t=wx(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new C);let i=new C,r=new Oe,o=new Oe;function a(c){let h=0,d=0,u=0;for(let U=0;U<9;U++)n.probe[U].set(0,0,0);let f=0,g=0,x=0,p=0,m=0,S=0,T=0,y=0,E=0,M=0,A=0,_=0,w=0,I=0;c.sort(Rx);for(let U=0,O=c.length;U<O;U++){let N=c[U],B=N.color,q=N.intensity,G=N.distance,j=null;if(N.shadow&&N.shadow.map&&(N.shadow.map.texture.format===qi?j=N.shadow.map.texture:j=N.shadow.map.depthTexture||N.shadow.map.texture),N.isAmbientLight)h+=B.r*q,d+=B.g*q,u+=B.b*q;else if(N.isLightProbe){for(let X=0;X<9;X++)n.probe[X].addScaledVector(N.sh.coefficients[X],q);I++}else if(N.isSunLight){let X=e.get(N);if(X.color.copy(N.color).multiplyScalar(N.intensity),N.castShadow){let $=N.shadow,ne=t.get(N);ne.shadowIntensity=$.intensity,ne.shadowBias=$.bias,ne.shadowNormalBias=$.normalBias,ne.shadowRadius=$.radius,ne.shadowMapSize.copy($.mapSize).multiply($.getFrameExtents()),n.sunShadow[g]=ne,n.sunShadowMap[g]=j;let Te=$.getViewportCount();for(let le=0;le<Te;le++)n.sunShadowMatrix[x+le]=$.getMatrix(le),n.sunShadowCascade[x+le]=$._cascadeData[le];x+=Te,g++}n.sun[f]=X,f++}else if(N.isDirectionalLight){let X=e.get(N);if(X.color.copy(N.color).multiplyScalar(N.intensity),N.castShadow){let $=N.shadow,ne=t.get(N);ne.shadowIntensity=$.intensity,ne.shadowBias=$.bias,ne.shadowNormalBias=$.normalBias,ne.shadowRadius=$.radius,ne.shadowMapSize=$.mapSize,n.directionalShadow[p]=ne,n.directionalShadowMap[p]=j,n.directionalShadowMatrix[p]=N.shadow.matrix,E++}n.directional[p]=X,p++}else if(N.isSpotLight){let X=e.get(N);X.position.setFromMatrixPosition(N.matrixWorld),X.color.copy(B).multiplyScalar(q),X.distance=G,X.coneCos=Math.cos(N.angle),X.penumbraCos=Math.cos(N.angle*(1-N.penumbra)),X.decay=N.decay,n.spot[S]=X;let $=N.shadow;if(N.map&&(n.spotLightMap[_]=N.map,_++,$.updateMatrices(N),N.castShadow&&w++),n.spotLightMatrix[S]=$.matrix,N.castShadow){let ne=t.get(N);ne.shadowIntensity=$.intensity,ne.shadowBias=$.bias,ne.shadowNormalBias=$.normalBias,ne.shadowRadius=$.radius,ne.shadowMapSize=$.mapSize,n.spotShadow[S]=ne,n.spotShadowMap[S]=j,A++}S++}else if(N.isRectAreaLight){let X=e.get(N);X.color.copy(B).multiplyScalar(q),X.halfWidth.set(N.width*.5,0,0),X.halfHeight.set(0,N.height*.5,0),n.rectArea[T]=X,T++}else if(N.isPointLight){let X=e.get(N);if(X.color.copy(N.color).multiplyScalar(N.intensity),X.distance=N.distance,X.decay=N.decay,N.castShadow){let $=N.shadow,ne=t.get(N);ne.shadowIntensity=$.intensity,ne.shadowBias=$.bias,ne.shadowNormalBias=$.normalBias,ne.shadowRadius=$.radius,ne.shadowMapSize=$.mapSize,ne.shadowCameraNear=$.camera.near,ne.shadowCameraFar=$.camera.far,n.pointShadow[m]=ne,n.pointShadowMap[m]=j,n.pointShadowMatrix[m]=N.shadow.matrix,M++}n.point[m]=X,m++}else if(N.isHemisphereLight){let X=e.get(N);X.skyColor.copy(N.color).multiplyScalar(q),X.groundColor.copy(N.groundColor).multiplyScalar(q),n.hemi[y]=X,y++}}T>0&&(s.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ve.LTC_FLOAT_1,n.rectAreaLTC2=ve.LTC_FLOAT_2):(n.rectAreaLTC1=ve.LTC_HALF_1,n.rectAreaLTC2=ve.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=u;let L=n.hash;(L.sunLength!==f||L.directionalLength!==p||L.pointLength!==m||L.spotLength!==S||L.rectAreaLength!==T||L.hemiLength!==y||L.numSunShadows!==g||L.numDirectionalShadows!==E||L.numPointShadows!==M||L.numSpotShadows!==A||L.numSpotMaps!==_||L.numLightProbes!==I)&&(n.sun.length=f,n.directional.length=p,n.spot.length=S,n.rectArea.length=T,n.point.length=m,n.hemi.length=y,n.sunShadow.length=g,n.sunShadowMap.length=g,n.sunShadowMatrix.length=x,n.sunShadowCascade.length=x,n.directionalShadow.length=E,n.directionalShadowMap.length=E,n.directionalShadowMatrix.length=E,n.pointShadow.length=M,n.pointShadowMap.length=M,n.pointShadowMatrix.length=M,n.spotShadow.length=A,n.spotShadowMap.length=A,n.spotLightMatrix.length=A+_-w,n.spotLightMap.length=_,n.numSpotLightShadowsWithMaps=w,n.numLightProbes=I,L.sunLength=f,L.directionalLength=p,L.pointLength=m,L.spotLength=S,L.rectAreaLength=T,L.hemiLength=y,L.numSunShadows=g,L.numDirectionalShadows=E,L.numPointShadows=M,L.numSpotShadows=A,L.numSpotMaps=_,L.numLightProbes=I,n.version=Ax++)}function l(c,h){let d=0,u=0,f=0,g=0,x=0,p=0,m=h.matrixWorldInverse;for(let S=0,T=c.length;S<T;S++){let y=c[S];if(y.isSunLight){let E=n.sun[d];E.direction.setFromMatrixPosition(y.matrixWorld),E.direction.transformDirection(m),d++}else if(y.isDirectionalLight){let E=n.directional[u];E.direction.setFromMatrixPosition(y.matrixWorld),i.setFromMatrixPosition(y.target.matrixWorld),E.direction.sub(i),E.direction.transformDirection(m),u++}else if(y.isSpotLight){let E=n.spot[g];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(m),E.direction.setFromMatrixPosition(y.matrixWorld),i.setFromMatrixPosition(y.target.matrixWorld),E.direction.sub(i),E.direction.transformDirection(m),g++}else if(y.isRectAreaLight){let E=n.rectArea[x];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(m),o.identity(),r.copy(y.matrixWorld),r.premultiply(m),o.extractRotation(r),E.halfWidth.set(y.width*.5,0,0),E.halfHeight.set(0,y.height*.5,0),E.halfWidth.applyMatrix4(o),E.halfHeight.applyMatrix4(o),x++}else if(y.isPointLight){let E=n.point[f];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(m),f++}else if(y.isHemisphereLight){let E=n.hemi[p];E.direction.setFromMatrixPosition(y.matrixWorld),E.direction.transformDirection(m),p++}}}return{setup:a,setupView:l,state:n}}function nf(s){let e=new Cx(s),t=[],n=[],i=[];function r(u){d.camera=u,t.length=0,n.length=0,i.length=0}function o(u){t.push(u)}function a(u){n.push(u)}function l(u){i.push(u)}function c(){e.setup(t)}function h(u){e.setupView(t,u)}let d={lightsArray:t,shadowsArray:n,lightProbeGridArray:i,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function Ix(s){let e=new WeakMap;function t(i,r=0){let o=e.get(i),a;return o===void 0?(a=new nf(s),e.set(i,[a])):r>=o.length?(a=new nf(s),o.push(a)):a=o[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}var Px=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Lx=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Nx=[new C(1,0,0),new C(-1,0,0),new C(0,1,0),new C(0,-1,0),new C(0,0,1),new C(0,0,-1)],Dx=[new C(0,-1,0),new C(0,-1,0),new C(0,0,1),new C(0,0,-1),new C(0,-1,0),new C(0,-1,0)],sf=new Oe,Io=new C,dh=new C;function Ux(s,e,t){let n=new $s,i=new ae,r=new ae,o=new pt,a=new La,l=new Na,c={},h=t.maxTextureSize,d={[ii]:Wt,[Wt]:ii,[Ht]:Ht},u=new yt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ae},radius:{value:4}},vertexShader:Px,fragmentShader:Lx}),f=u.clone();f.defines.HORIZONTAL_PASS=1;let g=new gt;g.setAttribute("position",new Vt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new nt(g,u),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=uo;let m=this.type;this.render=function(M,A,_){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||M.length===0)return;this.type===Va&&(De("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=uo);let w=s.getRenderTarget(),I=s.getActiveCubeFace(),L=s.getActiveMipmapLevel(),U=s.state;U.setBlending(Nn),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let O=m!==this.type;O&&A.traverse(function(N){N.material&&(Array.isArray(N.material)?N.material.forEach(B=>B.needsUpdate=!0):N.material.needsUpdate=!0)});for(let N=0,B=M.length;N<B;N++){let q=M[N],G=q.shadow;if(G===void 0){De("WebGLShadowMap:",q,"has no shadow.");continue}if(G.autoUpdate===!1&&G.needsUpdate===!1)continue;i.copy(G.mapSize);let j=G.getFrameExtents();i.multiply(j),r.copy(G.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/j.x),i.x=r.x*j.x,G.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/j.y),i.y=r.y*j.y,G.mapSize.y=r.y));let X=s.state.buffers.depth.getReversed();if(G.camera._reversedDepth=X,G.map===null||O===!0){if(G.map!==null&&(G.map.depthTexture!==null&&(G.map.depthTexture.dispose(),G.map.depthTexture=null),G.map.dispose()),this.type===sr){if(q.isPointLight){De("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}G.map=new kt(i.x,i.y,{format:qi,type:en,minFilter:Lt,magFilter:Lt,generateMipmaps:!1}),G.map.texture.name=q.name+".shadowMap",G.map.depthTexture=new ki(i.x,i.y,bn),G.map.depthTexture.name=q.name+".shadowMapDepth",G.map.depthTexture.format=Qn,G.map.depthTexture.compareFunction=null,G.map.depthTexture.minFilter=Pt,G.map.depthTexture.magFilter=Pt}else q.isPointLight?(G.map=new Dl(i.x),G.map.depthTexture=new Ta(i.x,Zn)):(G.map=new kt(i.x,i.y),G.map.depthTexture=new ki(i.x,i.y,Zn)),G.map.depthTexture.name=q.name+".shadowMap",G.map.depthTexture.format=Qn,this.type===uo?(G.map.depthTexture.compareFunction=X?Pl:Il,G.map.depthTexture.minFilter=Lt,G.map.depthTexture.magFilter=Lt):(G.map.depthTexture.compareFunction=null,G.map.depthTexture.minFilter=Pt,G.map.depthTexture.magFilter=Pt);G.camera.updateProjectionMatrix()}G.map.isWebGLCubeRenderTarget!==!0&&(G.map.width!==i.x||G.map.height!==i.y)&&G.map.setSize(i.x,i.y);let $=G.map.isWebGLCubeRenderTarget?6:G.getViewportCount();q.isPointLight!==!0&&G.updateMatrices(q,_);for(let ne=0;ne<$;ne++){let Te=G.getCamera(ne);if(q.isPointLight){let le=G.camera,Fe=G.matrix,Be=q.distance||le.far;Be!==le.far&&(le.far=Be,le.updateProjectionMatrix()),Io.setFromMatrixPosition(q.matrixWorld),le.position.copy(Io),dh.copy(le.position),dh.add(Nx[ne]),le.up.copy(Dx[ne]),le.lookAt(dh),le.updateMatrixWorld(),Fe.makeTranslation(-Io.x,-Io.y,-Io.z),sf.multiplyMatrices(le.projectionMatrix,le.matrixWorldInverse),G._frustum.setFromProjectionMatrix(sf,le.coordinateSystem,le.reversedDepth)}if(G.map.isWebGLCubeRenderTarget)s.setRenderTarget(G.map,ne),s.clear();else{ne===0&&(s.setRenderTarget(G.map),s.clear());let le=G.getViewport(ne);o.set(r.x*le.x,r.y*le.y,r.x*le.z,r.y*le.w),U.viewport(o)}n=G.getFrustum(ne),y(A,_,Te,q,this.type)}G.isPointLightShadow!==!0&&this.type===sr&&S(G,_),G.needsUpdate=!1}m=this.type,p.needsUpdate=!1,s.setRenderTarget(w,I,L)};function S(M,A){let _=e.update(x);u.defines.VSM_SAMPLES!==M.blurSamples&&(u.defines.VSM_SAMPLES=M.blurSamples,f.defines.VSM_SAMPLES=M.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),M.mapPass===null?M.mapPass=new kt(i.x,i.y,{format:qi,type:en}):(M.mapPass.width!==M.map.width||M.mapPass.height!==M.map.height)&&M.mapPass.setSize(M.map.width,M.map.height),u.uniforms.shadow_pass.value=M.map.depthTexture,u.uniforms.resolution.value.set(M.map.width,M.map.height),u.uniforms.radius.value=M.radius,s.setRenderTarget(M.mapPass),s.clear(),s.renderBufferDirect(A,null,_,u,x,null),f.uniforms.shadow_pass.value=M.mapPass.texture,f.uniforms.resolution.value.set(M.map.width,M.map.height),f.uniforms.radius.value=M.radius,s.setRenderTarget(M.map),s.clear(),s.renderBufferDirect(A,null,_,f,x,null)}function T(M,A,_,w){let I=null,L=_.isPointLight===!0?M.customDistanceMaterial:M.customDepthMaterial;if(L!==void 0)I=L;else if(I=_.isPointLight===!0?l:a,s.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0||A.alphaToCoverage===!0){let U=I.uuid,O=A.uuid,N=c[U];N===void 0&&(N={},c[U]=N);let B=N[O];B===void 0&&(B=I.clone(),N[O]=B,A.addEventListener("dispose",E)),I=B}if(I.visible=A.visible,I.wireframe=A.wireframe,w===sr?I.side=A.shadowSide!==null?A.shadowSide:A.side:I.side=A.shadowSide!==null?A.shadowSide:d[A.side],I.alphaMap=A.alphaMap,I.alphaTest=A.alphaToCoverage===!0?.5:A.alphaTest,I.map=A.map,I.clipShadows=A.clipShadows,I.clippingPlanes=A.clippingPlanes,I.clipIntersection=A.clipIntersection,I.displacementMap=A.displacementMap,I.displacementScale=A.displacementScale,I.displacementBias=A.displacementBias,I.wireframeLinewidth=A.wireframeLinewidth,I.linewidth=A.linewidth,_.isPointLight===!0&&I.isMeshDistanceMaterial===!0){let U=s.properties.get(I);U.light=_}return I}function y(M,A,_,w,I){if(M.visible===!1)return;if(M.layers.test(A.layers)&&(M.isMesh||M.isLine||M.isPoints)&&(M.castShadow||M.receiveShadow&&I===sr)&&(!M.frustumCulled||M.intersectsFrustum(n))){M.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,M.matrixWorld);let O=e.update(M),N=M.material;if(Array.isArray(N)){let B=O.groups;for(let q=0,G=B.length;q<G;q++){let j=B[q],X=N[j.materialIndex];if(X&&X.visible){let $=T(M,X,w,I);M.onBeforeShadow(s,M,A,_,O,$,j),s.renderBufferDirect(_,null,O,$,M,j),M.onAfterShadow(s,M,A,_,O,$,j)}}}else if(N.visible){let B=T(M,N,w,I);M.onBeforeShadow(s,M,A,_,O,B,null),s.renderBufferDirect(_,null,O,B,M,null),M.onAfterShadow(s,M,A,_,O,B,null)}}let U=M.children;for(let O=0,N=U.length;O<N;O++)y(U[O],A,_,w,I)}function E(M){M.target.removeEventListener("dispose",E);for(let _ in c){let w=c[_],I=M.target.uuid;I in w&&(w[I].dispose(),delete w[I])}}}function Fx(s,e){function t(){let F=!1,fe=new pt,J=null,pe=new pt(0,0,0,0);return{setMask:function(_e){J!==_e&&!F&&(s.colorMask(_e,_e,_e,_e),J=_e)},setLocked:function(_e){F=_e},setClear:function(_e,se,Le,Me,ct){ct===!0&&(_e*=Me,se*=Me,Le*=Me),fe.set(_e,se,Le,Me),pe.equals(fe)===!1&&(s.clearColor(_e,se,Le,Me),pe.copy(fe))},reset:function(){F=!1,J=null,pe.set(-1,0,0,0)}}}function n(){let F=!1,fe=!1,J=null,pe=null,_e=null;return{setReversed:function(se){if(fe!==se){let Le=e.get("EXT_clip_control");se?Le.clipControlEXT(Le.LOWER_LEFT_EXT,Le.ZERO_TO_ONE_EXT):Le.clipControlEXT(Le.LOWER_LEFT_EXT,Le.NEGATIVE_ONE_TO_ONE_EXT),fe=se;let Me=_e;_e=null,this.setClear(Me)}},getReversed:function(){return fe},setTest:function(se){se?ee(s.DEPTH_TEST):ye(s.DEPTH_TEST)},setMask:function(se){J!==se&&!F&&(s.depthMask(se),J=se)},setFunc:function(se){if(fe&&(se=Nd[se]),pe!==se){switch(se){case da:s.depthFunc(s.NEVER);break;case fa:s.depthFunc(s.ALWAYS);break;case pa:s.depthFunc(s.LESS);break;case ks:s.depthFunc(s.LEQUAL);break;case ma:s.depthFunc(s.EQUAL);break;case ga:s.depthFunc(s.GEQUAL);break;case _a:s.depthFunc(s.GREATER);break;case xa:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}pe=se}},setLocked:function(se){F=se},setClear:function(se){_e!==se&&(_e=se,fe&&(se=1-se),s.clearDepth(se))},reset:function(){F=!1,J=null,pe=null,_e=null,fe=!1}}}function i(){let F=!1,fe=null,J=null,pe=null,_e=null,se=null,Le=null,Me=null,ct=null;return{setTest:function(st){F||(st?ee(s.STENCIL_TEST):ye(s.STENCIL_TEST))},setMask:function(st){fe!==st&&!F&&(s.stencilMask(st),fe=st)},setFunc:function(st,Ut,yn){(J!==st||pe!==Ut||_e!==yn)&&(s.stencilFunc(st,Ut,yn),J=st,pe=Ut,_e=yn)},setOp:function(st,Ut,yn){(se!==st||Le!==Ut||Me!==yn)&&(s.stencilOp(st,Ut,yn),se=st,Le=Ut,Me=yn)},setLocked:function(st){F=st},setClear:function(st){ct!==st&&(s.clearStencil(st),ct=st)},reset:function(){F=!1,fe=null,J=null,pe=null,_e=null,se=null,Le=null,Me=null,ct=null}}}let r=new t,o=new n,a=new i,l=new WeakMap,c=new WeakMap,h={},d={},u={},f=new WeakMap,g=[],x=null,p=!1,m=null,S=null,T=null,y=null,E=null,M=null,A=null,_=new Ce(0,0,0),w=0,I=!1,L=null,U=null,O=null,N=null,B=null,q=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS),G=!1,j=0,X=s.getParameter(s.VERSION);X.indexOf("WebGL")!==-1?(j=parseFloat(/^WebGL (\d)/.exec(X)[1]),G=j>=1):X.indexOf("OpenGL ES")!==-1&&(j=parseFloat(/^OpenGL ES (\d)/.exec(X)[1]),G=j>=2);let $=null,ne={},Te=s.getParameter(s.SCISSOR_BOX),le=s.getParameter(s.VIEWPORT),Fe=new pt().fromArray(Te),Be=new pt().fromArray(le);function Qe(F,fe,J,pe){let _e=new Uint8Array(4),se=s.createTexture();s.bindTexture(F,se),s.texParameteri(F,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(F,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Le=0;Le<J;Le++)F===s.TEXTURE_3D||F===s.TEXTURE_2D_ARRAY?s.texImage3D(fe,0,s.RGBA,1,1,pe,0,s.RGBA,s.UNSIGNED_BYTE,_e):s.texImage2D(fe+Le,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,_e);return se}let K={};K[s.TEXTURE_2D]=Qe(s.TEXTURE_2D,s.TEXTURE_2D,1),K[s.TEXTURE_CUBE_MAP]=Qe(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),K[s.TEXTURE_2D_ARRAY]=Qe(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),K[s.TEXTURE_3D]=Qe(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),ee(s.DEPTH_TEST),o.setFunc(ks),Ke(!1),tt(kc),ee(s.CULL_FACE),Je(Nn);function ee(F){h[F]!==!0&&(s.enable(F),h[F]=!0)}function ye(F){h[F]!==!1&&(s.disable(F),h[F]=!1)}function Ue(F,fe){return u[F]!==fe?(s.bindFramebuffer(F,fe),u[F]=fe,F===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=fe),F===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=fe),!0):!1}function ie(F,fe){let J=g,pe=!1;if(F){J=f.get(fe),J===void 0&&(J=[],f.set(fe,J));let _e=F.textures;if(J.length!==_e.length||J[0]!==s.COLOR_ATTACHMENT0){for(let se=0,Le=_e.length;se<Le;se++)J[se]=s.COLOR_ATTACHMENT0+se;J.length=_e.length,pe=!0}}else J[0]!==s.BACK&&(J[0]=s.BACK,pe=!0);pe&&s.drawBuffers(J)}function ce(F){return x!==F?(s.useProgram(F),x=F,!0):!1}let Mt={[ps]:s.FUNC_ADD,[ed]:s.FUNC_SUBTRACT,[td]:s.FUNC_REVERSE_SUBTRACT};Mt[nd]=s.MIN,Mt[id]=s.MAX;let Ve={[sd]:s.ZERO,[rd]:s.ONE,[od]:s.SRC_COLOR,[Gc]:s.SRC_ALPHA,[dd]:s.SRC_ALPHA_SATURATE,[hd]:s.DST_COLOR,[ld]:s.DST_ALPHA,[ad]:s.ONE_MINUS_SRC_COLOR,[Wc]:s.ONE_MINUS_SRC_ALPHA,[ud]:s.ONE_MINUS_DST_COLOR,[cd]:s.ONE_MINUS_DST_ALPHA,[fd]:s.CONSTANT_COLOR,[pd]:s.ONE_MINUS_CONSTANT_COLOR,[md]:s.CONSTANT_ALPHA,[gd]:s.ONE_MINUS_CONSTANT_ALPHA};function Je(F,fe,J,pe,_e,se,Le,Me,ct,st){if(F===Nn){p===!0&&(ye(s.BLEND),p=!1);return}if(p===!1&&(ee(s.BLEND),p=!0),F!==Qu){if(F!==m||st!==I){if((S!==ps||E!==ps)&&(s.blendEquation(s.FUNC_ADD),S=ps,E=ps),st)switch(F){case rr:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case si:s.blendFunc(s.ONE,s.ONE);break;case Hc:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Vc:s.blendFuncSeparate(s.DST_COLOR,s.ONE_MINUS_SRC_ALPHA,s.ZERO,s.ONE);break;default:ke("WebGLState: Invalid blending: ",F);break}else switch(F){case rr:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case si:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE,s.ONE,s.ONE);break;case Hc:ke("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Vc:ke("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:ke("WebGLState: Invalid blending: ",F);break}T=null,y=null,M=null,A=null,_.set(0,0,0),w=0,m=F,I=st}return}_e=_e||fe,se=se||J,Le=Le||pe,(fe!==S||_e!==E)&&(s.blendEquationSeparate(Mt[fe],Mt[_e]),S=fe,E=_e),(J!==T||pe!==y||se!==M||Le!==A)&&(s.blendFuncSeparate(Ve[J],Ve[pe],Ve[se],Ve[Le]),T=J,y=pe,M=se,A=Le),(Me.equals(_)===!1||ct!==w)&&(s.blendColor(Me.r,Me.g,Me.b,ct),_.copy(Me),w=ct),m=F,I=!1}function ut(F,fe){F.side===Ht?ye(s.CULL_FACE):ee(s.CULL_FACE);let J=F.side===Wt;fe&&(J=!J),Ke(J),F.blending===rr&&F.transparent===!1?Je(Nn):Je(F.blending,F.blendEquation,F.blendSrc,F.blendDst,F.blendEquationAlpha,F.blendSrcAlpha,F.blendDstAlpha,F.blendColor,F.blendAlpha,F.premultipliedAlpha),o.setFunc(F.depthFunc),o.setTest(F.depthTest),o.setMask(F.depthWrite),r.setMask(F.colorWrite);let pe=F.stencilWrite;a.setTest(pe),pe&&(a.setMask(F.stencilWriteMask),a.setFunc(F.stencilFunc,F.stencilRef,F.stencilFuncMask),a.setOp(F.stencilFail,F.stencilZFail,F.stencilZPass)),Qt(F.polygonOffset,F.polygonOffsetFactor,F.polygonOffsetUnits),F.alphaToCoverage===!0?ee(s.SAMPLE_ALPHA_TO_COVERAGE):ye(s.SAMPLE_ALPHA_TO_COVERAGE)}function Ke(F){L!==F&&(F?s.frontFace(s.CW):s.frontFace(s.CCW),L=F)}function tt(F){F!==$u?(ee(s.CULL_FACE),F!==U&&(F===kc?s.cullFace(s.BACK):F===ju?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):ye(s.CULL_FACE),U=F}function wt(F){F!==O&&(G&&s.lineWidth(F),O=F)}function Qt(F,fe,J){F?(ee(s.POLYGON_OFFSET_FILL),(N!==fe||B!==J)&&(N=fe,B=J,o.getReversed()&&(fe=-fe),s.polygonOffset(fe,J))):ye(s.POLYGON_OFFSET_FILL)}function lt(F){F?ee(s.SCISSOR_TEST):ye(s.SCISSOR_TEST)}function Tt(F){F===void 0&&(F=s.TEXTURE0+q-1),$!==F&&(s.activeTexture(F),$=F)}function D(F,fe,J){J===void 0&&($===null?J=s.TEXTURE0+q-1:J=$);let pe=ne[J];pe===void 0&&(pe={type:void 0,texture:void 0},ne[J]=pe),(pe.type!==F||pe.texture!==fe)&&($!==J&&(s.activeTexture(J),$=J),s.bindTexture(F,fe||K[F]),pe.type=F,pe.texture=fe)}function dt(){let F=ne[$];F!==void 0&&F.type!==void 0&&(s.bindTexture(F.type,null),F.type=void 0,F.texture=void 0)}function We(){try{s.compressedTexImage2D(...arguments)}catch(F){ke("WebGLState:",F)}}function R(){try{s.compressedTexImage3D(...arguments)}catch(F){ke("WebGLState:",F)}}function v(){try{s.texSubImage2D(...arguments)}catch(F){ke("WebGLState:",F)}}function z(){try{s.texSubImage3D(...arguments)}catch(F){ke("WebGLState:",F)}}function W(){try{s.compressedTexSubImage2D(...arguments)}catch(F){ke("WebGLState:",F)}}function Y(){try{s.compressedTexSubImage3D(...arguments)}catch(F){ke("WebGLState:",F)}}function oe(){try{s.texStorage2D(...arguments)}catch(F){ke("WebGLState:",F)}}function ue(){try{s.texStorage3D(...arguments)}catch(F){ke("WebGLState:",F)}}function Z(){try{s.texImage2D(...arguments)}catch(F){ke("WebGLState:",F)}}function Q(){try{s.texImage3D(...arguments)}catch(F){ke("WebGLState:",F)}}function de(F){return d[F]!==void 0?d[F]:s.getParameter(F)}function Ae(F,fe){d[F]!==fe&&(s.pixelStorei(F,fe),d[F]=fe)}function me(F){Fe.equals(F)===!1&&(s.scissor(F.x,F.y,F.z,F.w),Fe.copy(F))}function re(F){Be.equals(F)===!1&&(s.viewport(F.x,F.y,F.z,F.w),Be.copy(F))}function Re(F,fe){let J=c.get(fe);J===void 0&&(J=new WeakMap,c.set(fe,J));let pe=J.get(F);pe===void 0&&(pe=s.getUniformBlockIndex(fe,F.name),J.set(F,pe))}function Ne(F,fe){let pe=c.get(fe).get(F);l.get(fe)!==pe&&(s.uniformBlockBinding(fe,pe,F.__bindingPointIndex),l.set(fe,pe))}function ze(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),o.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),s.pixelStorei(s.PACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!1),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,s.BROWSER_DEFAULT_WEBGL),s.pixelStorei(s.PACK_ROW_LENGTH,0),s.pixelStorei(s.PACK_SKIP_PIXELS,0),s.pixelStorei(s.PACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_ROW_LENGTH,0),s.pixelStorei(s.UNPACK_IMAGE_HEIGHT,0),s.pixelStorei(s.UNPACK_SKIP_PIXELS,0),s.pixelStorei(s.UNPACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_SKIP_IMAGES,0),h={},d={},$=null,ne={},u={},f=new WeakMap,g=[],x=null,p=!1,m=null,S=null,T=null,y=null,E=null,M=null,A=null,_=new Ce(0,0,0),w=0,I=!1,L=null,U=null,O=null,N=null,B=null,Fe.set(0,0,s.canvas.width,s.canvas.height),Be.set(0,0,s.canvas.width,s.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:ee,disable:ye,bindFramebuffer:Ue,drawBuffers:ie,useProgram:ce,setBlending:Je,setMaterial:ut,setFlipSided:Ke,setCullFace:tt,setLineWidth:wt,setPolygonOffset:Qt,setScissorTest:lt,activeTexture:Tt,bindTexture:D,unbindTexture:dt,compressedTexImage2D:We,compressedTexImage3D:R,texImage2D:Z,texImage3D:Q,pixelStorei:Ae,getParameter:de,updateUBOMapping:Re,uniformBlockBinding:Ne,texStorage2D:oe,texStorage3D:ue,texSubImage2D:v,texSubImage3D:z,compressedTexSubImage2D:W,compressedTexSubImage3D:Y,scissor:me,viewport:re,reset:ze}}function Ox(s,e,t,n,i,r,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ae,h=new WeakMap,d=new Set,u,f=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(R,v){return g?new OffscreenCanvas(R,v):Gs("canvas")}function p(R,v,z){let W=1,Y=We(R);if((Y.width>z||Y.height>z)&&(W=z/Math.max(Y.width,Y.height)),W<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let oe=Math.floor(W*Y.width),ue=Math.floor(W*Y.height);u===void 0&&(u=x(oe,ue));let Z=v?x(oe,ue):u;return Z.width=oe,Z.height=ue,Z.getContext("2d").drawImage(R,0,0,oe,ue),De("WebGLRenderer: Texture has been resized from ("+Y.width+"x"+Y.height+") to ("+oe+"x"+ue+")."),Z}else return"data"in R&&De("WebGLRenderer: Image in DataTexture is too big ("+Y.width+"x"+Y.height+")."),R;return R}function m(R){return R.generateMipmaps}function S(R){s.generateMipmap(R)}function T(R){return R.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?s.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function y(R,v,z,W,Y,oe=!1){if(R!==null){if(s[R]!==void 0)return s[R];De("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let ue;W&&(ue=e.get("EXT_texture_norm16"),ue||De("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Z=v;if(v===s.RED&&(z===s.FLOAT&&(Z=s.R32F),z===s.HALF_FLOAT&&(Z=s.R16F),z===s.UNSIGNED_BYTE&&(Z=s.R8),z===s.UNSIGNED_SHORT&&ue&&(Z=ue.R16_EXT),z===s.SHORT&&ue&&(Z=ue.R16_SNORM_EXT)),v===s.RED_INTEGER&&(z===s.UNSIGNED_BYTE&&(Z=s.R8UI),z===s.UNSIGNED_SHORT&&(Z=s.R16UI),z===s.UNSIGNED_INT&&(Z=s.R32UI),z===s.BYTE&&(Z=s.R8I),z===s.SHORT&&(Z=s.R16I),z===s.INT&&(Z=s.R32I)),v===s.RG&&(z===s.FLOAT&&(Z=s.RG32F),z===s.HALF_FLOAT&&(Z=s.RG16F),z===s.UNSIGNED_BYTE&&(Z=s.RG8),z===s.UNSIGNED_SHORT&&ue&&(Z=ue.RG16_EXT),z===s.SHORT&&ue&&(Z=ue.RG16_SNORM_EXT)),v===s.RG_INTEGER&&(z===s.UNSIGNED_BYTE&&(Z=s.RG8UI),z===s.UNSIGNED_SHORT&&(Z=s.RG16UI),z===s.UNSIGNED_INT&&(Z=s.RG32UI),z===s.BYTE&&(Z=s.RG8I),z===s.SHORT&&(Z=s.RG16I),z===s.INT&&(Z=s.RG32I)),v===s.RGB_INTEGER&&(z===s.UNSIGNED_BYTE&&(Z=s.RGB8UI),z===s.UNSIGNED_SHORT&&(Z=s.RGB16UI),z===s.UNSIGNED_INT&&(Z=s.RGB32UI),z===s.BYTE&&(Z=s.RGB8I),z===s.SHORT&&(Z=s.RGB16I),z===s.INT&&(Z=s.RGB32I)),v===s.RGBA_INTEGER&&(z===s.UNSIGNED_BYTE&&(Z=s.RGBA8UI),z===s.UNSIGNED_SHORT&&(Z=s.RGBA16UI),z===s.UNSIGNED_INT&&(Z=s.RGBA32UI),z===s.BYTE&&(Z=s.RGBA8I),z===s.SHORT&&(Z=s.RGBA16I),z===s.INT&&(Z=s.RGBA32I)),v===s.RGB&&(z===s.UNSIGNED_SHORT&&ue&&(Z=ue.RGB16_EXT),z===s.SHORT&&ue&&(Z=ue.RGB16_SNORM_EXT),z===s.UNSIGNED_INT_5_9_9_9_REV&&(Z=s.RGB9_E5),z===s.UNSIGNED_INT_10F_11F_11F_REV&&(Z=s.R11F_G11F_B10F)),v===s.RGBA){let Q=oe?Fr:Ge.getTransfer(Y);z===s.FLOAT&&(Z=s.RGBA32F),z===s.HALF_FLOAT&&(Z=s.RGBA16F),z===s.UNSIGNED_BYTE&&(Z=Q===ot?s.SRGB8_ALPHA8:s.RGBA8),z===s.UNSIGNED_SHORT&&ue&&(Z=ue.RGBA16_EXT),z===s.SHORT&&ue&&(Z=ue.RGBA16_SNORM_EXT),z===s.UNSIGNED_SHORT_4_4_4_4&&(Z=s.RGBA4),z===s.UNSIGNED_SHORT_5_5_5_1&&(Z=s.RGB5_A1)}return(Z===s.R16F||Z===s.R32F||Z===s.RG16F||Z===s.RG32F||Z===s.RGBA16F||Z===s.RGBA32F)&&e.get("EXT_color_buffer_float"),Z}function E(R,v){let z;return R?v===null||v===Zn||v===lr?z=s.DEPTH24_STENCIL8:v===bn?z=s.DEPTH32F_STENCIL8:v===ar&&(z=s.DEPTH24_STENCIL8,De("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===Zn||v===lr?z=s.DEPTH_COMPONENT24:v===bn?z=s.DEPTH_COMPONENT32F:v===ar&&(z=s.DEPTH_COMPONENT16),z}function M(R,v){return m(R)===!0||R.isFramebufferTexture&&R.minFilter!==Pt&&R.minFilter!==Lt?Math.log2(Math.max(v.width,v.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?v.mipmaps.length:1}function A(R){let v=R.target;v.removeEventListener("dispose",A),w(v),v.isVideoTexture&&h.delete(v),v.isHTMLTexture&&d.delete(v)}function _(R){let v=R.target;v.removeEventListener("dispose",_),L(v)}function w(R){let v=n.get(R);if(v.__webglInit===void 0)return;let z=R.source,W=f.get(z);if(W){let Y=W[v.__cacheKey];Y.usedTimes--,Y.usedTimes===0&&I(R),Object.keys(W).length===0&&f.delete(z)}n.remove(R)}function I(R){let v=n.get(R);s.deleteTexture(v.__webglTexture);let z=R.source,W=f.get(z);delete W[v.__cacheKey],o.memory.textures--}function L(R){let v=n.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),n.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let W=0;W<6;W++){if(Array.isArray(v.__webglFramebuffer[W]))for(let Y=0;Y<v.__webglFramebuffer[W].length;Y++)s.deleteFramebuffer(v.__webglFramebuffer[W][Y]);else s.deleteFramebuffer(v.__webglFramebuffer[W]);v.__webglDepthbuffer&&s.deleteRenderbuffer(v.__webglDepthbuffer[W])}else{if(Array.isArray(v.__webglFramebuffer))for(let W=0;W<v.__webglFramebuffer.length;W++)s.deleteFramebuffer(v.__webglFramebuffer[W]);else s.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&s.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&s.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let W=0;W<v.__webglColorRenderbuffer.length;W++)v.__webglColorRenderbuffer[W]&&s.deleteRenderbuffer(v.__webglColorRenderbuffer[W]);v.__webglDepthRenderbuffer&&s.deleteRenderbuffer(v.__webglDepthRenderbuffer)}let z=R.textures;for(let W=0,Y=z.length;W<Y;W++){let oe=n.get(z[W]);oe.__webglTexture&&(s.deleteTexture(oe.__webglTexture),o.memory.textures--),n.remove(z[W])}n.remove(R)}let U=0;function O(){U=0}function N(){return U}function B(R){U=R}function q(){let R=U;return R>=i.maxTextures&&De("WebGLTextures: Trying to use "+(R+1)+" texture units while this GPU supports only "+i.maxTextures),U+=1,R}function G(R){let v=[];return v.push(R.wrapS),v.push(R.wrapT),v.push(R.wrapR||0),v.push(R.magFilter),v.push(R.minFilter),v.push(R.anisotropy),v.push(R.internalFormat),v.push(R.format),v.push(R.type),v.push(R.generateMipmaps),v.push(R.premultiplyAlpha),v.push(R.flipY),v.push(R.unpackAlignment),v.push(R.colorSpace),v.join()}function j(R,v){let z=n.get(R);if(R.isVideoTexture&&D(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&z.__version!==R.version){let W=R.image;if(W===null)De("WebGLRenderer: Texture marked for update but no image data found.");else if(W.complete===!1)De("WebGLRenderer: Texture marked for update but image is incomplete");else{ye(z,R,v);return}}else R.isExternalTexture&&(z.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(s.TEXTURE_2D,z.__webglTexture,s.TEXTURE0+v)}function X(R,v){let z=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&z.__version!==R.version){ye(z,R,v);return}else R.isExternalTexture&&(z.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(s.TEXTURE_2D_ARRAY,z.__webglTexture,s.TEXTURE0+v)}function $(R,v){let z=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&z.__version!==R.version){ye(z,R,v);return}t.bindTexture(s.TEXTURE_3D,z.__webglTexture,s.TEXTURE0+v)}function ne(R,v){let z=n.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&z.__version!==R.version){Ue(z,R,v);return}t.bindTexture(s.TEXTURE_CUBE_MAP,z.__webglTexture,s.TEXTURE0+v)}let Te={[zi]:s.REPEAT,[Cn]:s.CLAMP_TO_EDGE,[Hs]:s.MIRRORED_REPEAT},le={[Pt]:s.NEAREST,[qa]:s.NEAREST_MIPMAP_NEAREST,[_s]:s.NEAREST_MIPMAP_LINEAR,[Lt]:s.LINEAR,[or]:s.LINEAR_MIPMAP_NEAREST,[Kn]:s.LINEAR_MIPMAP_LINEAR},Fe={[Td]:s.NEVER,[Cd]:s.ALWAYS,[Ed]:s.LESS,[Il]:s.LEQUAL,[wd]:s.EQUAL,[Pl]:s.GEQUAL,[Ad]:s.GREATER,[Rd]:s.NOTEQUAL};function Be(R,v){if(v.type===bn&&e.has("OES_texture_float_linear")===!1&&(v.magFilter===Lt||v.magFilter===or||v.magFilter===_s||v.magFilter===Kn||v.minFilter===Lt||v.minFilter===or||v.minFilter===_s||v.minFilter===Kn)&&De("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(R,s.TEXTURE_WRAP_S,Te[v.wrapS]),s.texParameteri(R,s.TEXTURE_WRAP_T,Te[v.wrapT]),(R===s.TEXTURE_3D||R===s.TEXTURE_2D_ARRAY)&&s.texParameteri(R,s.TEXTURE_WRAP_R,Te[v.wrapR]),s.texParameteri(R,s.TEXTURE_MAG_FILTER,le[v.magFilter]),s.texParameteri(R,s.TEXTURE_MIN_FILTER,le[v.minFilter]),v.compareFunction&&(s.texParameteri(R,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(R,s.TEXTURE_COMPARE_FUNC,Fe[v.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===Pt||v.minFilter!==_s&&v.minFilter!==Kn||v.type===bn&&e.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||n.get(v).__currentAnisotropy){let z=e.get("EXT_texture_filter_anisotropic");s.texParameterf(R,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,i.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy}}}function Qe(R,v){let z=!1;R.__webglInit===void 0&&(R.__webglInit=!0,v.addEventListener("dispose",A));let W=v.source,Y=f.get(W);Y===void 0&&(Y={},f.set(W,Y));let oe=G(v);if(oe!==R.__cacheKey){Y[oe]===void 0&&(Y[oe]={texture:s.createTexture(),usedTimes:0},o.memory.textures++,z=!0),Y[oe].usedTimes++;let ue=Y[R.__cacheKey];ue!==void 0&&(Y[R.__cacheKey].usedTimes--,ue.usedTimes===0&&I(v)),R.__cacheKey=oe,R.__webglTexture=Y[oe].texture}return z}function K(R,v,z){return Math.floor(Math.floor(R/z)/v)}function ee(R,v,z,W){let oe=R.updateRanges;if(oe.length===0)t.texSubImage2D(s.TEXTURE_2D,0,0,0,v.width,v.height,z,W,v.data);else{oe.sort((Ae,me)=>Ae.start-me.start);let ue=0;for(let Ae=1;Ae<oe.length;Ae++){let me=oe[ue],re=oe[Ae],Re=me.start+me.count,Ne=K(re.start,v.width,4),ze=K(me.start,v.width,4);re.start<=Re+1&&Ne===ze&&K(re.start+re.count-1,v.width,4)===Ne?me.count=Math.max(me.count,re.start+re.count-me.start):(++ue,oe[ue]=re)}oe.length=ue+1;let Z=t.getParameter(s.UNPACK_ROW_LENGTH),Q=t.getParameter(s.UNPACK_SKIP_PIXELS),de=t.getParameter(s.UNPACK_SKIP_ROWS);t.pixelStorei(s.UNPACK_ROW_LENGTH,v.width);for(let Ae=0,me=oe.length;Ae<me;Ae++){let re=oe[Ae],Re=Math.floor(re.start/4),Ne=Math.ceil(re.count/4),ze=Re%v.width,F=Math.floor(Re/v.width),fe=Ne,J=1;t.pixelStorei(s.UNPACK_SKIP_PIXELS,ze),t.pixelStorei(s.UNPACK_SKIP_ROWS,F),t.texSubImage2D(s.TEXTURE_2D,0,ze,F,fe,J,z,W,v.data)}R.clearUpdateRanges(),t.pixelStorei(s.UNPACK_ROW_LENGTH,Z),t.pixelStorei(s.UNPACK_SKIP_PIXELS,Q),t.pixelStorei(s.UNPACK_SKIP_ROWS,de)}}function ye(R,v,z){let W=s.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(W=s.TEXTURE_2D_ARRAY),v.isData3DTexture&&(W=s.TEXTURE_3D);let Y=Qe(R,v),oe=v.source;t.bindTexture(W,R.__webglTexture,s.TEXTURE0+z);let ue=n.get(oe);if(oe.version!==ue.__version||Y===!0){if(t.activeTexture(s.TEXTURE0+z),(typeof ImageBitmap<"u"&&v.image instanceof ImageBitmap)===!1){let J=Ge.getPrimaries(Ge.workingColorSpace),pe=v.colorSpace===Ei?null:Ge.getPrimaries(v.colorSpace),_e=v.colorSpace===Ei||J===pe?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,_e)}t.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment);let Q=p(v.image,!1,i.maxTextureSize);Q=dt(v,Q);let de=r.convert(v.format,v.colorSpace),Ae=r.convert(v.type),me=y(v.internalFormat,de,Ae,v.normalized,v.colorSpace,v.isVideoTexture);Be(W,v);let re,Re=v.mipmaps,Ne=v.isVideoTexture!==!0,ze=ue.__version===void 0||Y===!0,F=oe.dataReady,fe=M(v,Q);if(v.isDepthTexture)me=E(v.format===Xi,v.type),ze&&(Ne?t.texStorage2D(s.TEXTURE_2D,1,me,Q.width,Q.height):t.texImage2D(s.TEXTURE_2D,0,me,Q.width,Q.height,0,de,Ae,null));else if(v.isDataTexture)if(Re.length>0){Ne&&ze&&t.texStorage2D(s.TEXTURE_2D,fe,me,Re[0].width,Re[0].height);for(let J=0,pe=Re.length;J<pe;J++)re=Re[J],Ne?F&&t.texSubImage2D(s.TEXTURE_2D,J,0,0,re.width,re.height,de,Ae,re.data):t.texImage2D(s.TEXTURE_2D,J,me,re.width,re.height,0,de,Ae,re.data);v.generateMipmaps=!1}else Ne?(ze&&t.texStorage2D(s.TEXTURE_2D,fe,me,Q.width,Q.height),F&&ee(v,Q,de,Ae)):t.texImage2D(s.TEXTURE_2D,0,me,Q.width,Q.height,0,de,Ae,Q.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Ne&&ze&&t.texStorage3D(s.TEXTURE_2D_ARRAY,fe,me,Re[0].width,Re[0].height,Q.depth);for(let J=0,pe=Re.length;J<pe;J++)if(re=Re[J],v.format!==Tn)if(de!==null)if(Ne){if(F)if(v.layerUpdates.size>0){let _e=oh(re.width,re.height,v.format,v.type);for(let se of v.layerUpdates){let Le=re.data.subarray(se*_e/re.data.BYTES_PER_ELEMENT,(se+1)*_e/re.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,J,0,0,se,re.width,re.height,1,de,Le)}}else t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,J,0,0,0,re.width,re.height,Q.depth,de,re.data)}else t.compressedTexImage3D(s.TEXTURE_2D_ARRAY,J,me,re.width,re.height,Q.depth,0,re.data,0,0);else De("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ne?F&&t.texSubImage3D(s.TEXTURE_2D_ARRAY,J,0,0,0,re.width,re.height,Q.depth,de,Ae,re.data):t.texImage3D(s.TEXTURE_2D_ARRAY,J,me,re.width,re.height,Q.depth,0,de,Ae,re.data);v.layerUpdates.size>0&&v.clearLayerUpdates()}else{Ne&&ze&&t.texStorage2D(s.TEXTURE_2D,fe,me,Re[0].width,Re[0].height);for(let J=0,pe=Re.length;J<pe;J++)re=Re[J],v.format!==Tn?de!==null?Ne?F&&t.compressedTexSubImage2D(s.TEXTURE_2D,J,0,0,re.width,re.height,de,re.data):t.compressedTexImage2D(s.TEXTURE_2D,J,me,re.width,re.height,0,re.data):De("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ne?F&&t.texSubImage2D(s.TEXTURE_2D,J,0,0,re.width,re.height,de,Ae,re.data):t.texImage2D(s.TEXTURE_2D,J,me,re.width,re.height,0,de,Ae,re.data)}else if(v.isDataArrayTexture)if(Ne){if(ze&&t.texStorage3D(s.TEXTURE_2D_ARRAY,fe,me,Q.width,Q.height,Q.depth),F)if(v.layerUpdates.size>0){let J=oh(Q.width,Q.height,v.format,v.type);for(let pe of v.layerUpdates){let _e=Q.data.subarray(pe*J/Q.data.BYTES_PER_ELEMENT,(pe+1)*J/Q.data.BYTES_PER_ELEMENT);t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,pe,Q.width,Q.height,1,de,Ae,_e)}v.clearLayerUpdates()}else t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,Q.width,Q.height,Q.depth,de,Ae,Q.data)}else t.texImage3D(s.TEXTURE_2D_ARRAY,0,me,Q.width,Q.height,Q.depth,0,de,Ae,Q.data);else if(v.isData3DTexture)Ne?(ze&&t.texStorage3D(s.TEXTURE_3D,fe,me,Q.width,Q.height,Q.depth),F&&t.texSubImage3D(s.TEXTURE_3D,0,0,0,0,Q.width,Q.height,Q.depth,de,Ae,Q.data)):t.texImage3D(s.TEXTURE_3D,0,me,Q.width,Q.height,Q.depth,0,de,Ae,Q.data);else if(v.isFramebufferTexture){if(ze)if(Ne)t.texStorage2D(s.TEXTURE_2D,fe,me,Q.width,Q.height);else{let J=Q.width,pe=Q.height;for(let _e=0;_e<fe;_e++)t.texImage2D(s.TEXTURE_2D,_e,me,J,pe,0,de,Ae,null),J>>=1,pe>>=1}}else if(v.isHTMLTexture){if("texElementImage2D"in s){let J=s.canvas;if(J.hasAttribute("layoutsubtree")||J.setAttribute("layoutsubtree","true"),Q.parentNode!==J){J.appendChild(Q),d.add(v),J.onpaint=pe=>{let _e=pe.changedElements;for(let se of d)_e.includes(se.image)&&(se.needsUpdate=!0)},J.requestPaint();return}if(s.texElementImage2D.length===3)s.texElementImage2D(s.TEXTURE_2D,s.RGBA8,Q);else{let _e=s.RGBA,se=s.RGBA,Le=s.UNSIGNED_BYTE;s.texElementImage2D(s.TEXTURE_2D,0,_e,se,Le,Q)}s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE)}}else if(Re.length>0){if(Ne&&ze){let J=We(Re[0]);t.texStorage2D(s.TEXTURE_2D,fe,me,J.width,J.height)}for(let J=0,pe=Re.length;J<pe;J++)re=Re[J],Ne?F&&t.texSubImage2D(s.TEXTURE_2D,J,0,0,de,Ae,re):t.texImage2D(s.TEXTURE_2D,J,me,de,Ae,re);v.generateMipmaps=!1}else if(Ne){if(ze){let J=We(Q);t.texStorage2D(s.TEXTURE_2D,fe,me,J.width,J.height)}F&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,de,Ae,Q)}else t.texImage2D(s.TEXTURE_2D,0,me,de,Ae,Q);m(v)&&S(W),ue.__version=oe.version,v.onUpdate&&v.onUpdate(v)}R.__version=v.version}function Ue(R,v,z){if(v.image.length!==6)return;let W=Qe(R,v),Y=v.source;t.bindTexture(s.TEXTURE_CUBE_MAP,R.__webglTexture,s.TEXTURE0+z);let oe=n.get(Y);if(Y.version!==oe.__version||W===!0){t.activeTexture(s.TEXTURE0+z);let ue=Ge.getPrimaries(Ge.workingColorSpace),Z=v.colorSpace===Ei?null:Ge.getPrimaries(v.colorSpace),Q=v.colorSpace===Ei||ue===Z?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),t.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,Q);let de=v.isCompressedTexture||v.image[0].isCompressedTexture,Ae=v.image[0]&&v.image[0].isDataTexture,me=[];for(let se=0;se<6;se++)!de&&!Ae?me[se]=p(v.image[se],!0,i.maxCubemapSize):me[se]=Ae?v.image[se].image:v.image[se],me[se]=dt(v,me[se]);let re=me[0],Re=r.convert(v.format,v.colorSpace),Ne=r.convert(v.type),ze=y(v.internalFormat,Re,Ne,v.normalized,v.colorSpace),F=v.isVideoTexture!==!0,fe=oe.__version===void 0||W===!0,J=Y.dataReady,pe=M(v,re);Be(s.TEXTURE_CUBE_MAP,v);let _e;if(de){F&&fe&&t.texStorage2D(s.TEXTURE_CUBE_MAP,pe,ze,re.width,re.height);for(let se=0;se<6;se++){_e=me[se].mipmaps;for(let Le=0;Le<_e.length;Le++){let Me=_e[Le];v.format!==Tn?Re!==null?F?J&&t.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le,0,0,Me.width,Me.height,Re,Me.data):t.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le,ze,Me.width,Me.height,0,Me.data):De("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):F?J&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le,0,0,Me.width,Me.height,Re,Ne,Me.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le,ze,Me.width,Me.height,0,Re,Ne,Me.data)}}}else{if(_e=v.mipmaps,F&&fe){_e.length>0&&pe++;let se=We(me[0]);t.texStorage2D(s.TEXTURE_CUBE_MAP,pe,ze,se.width,se.height)}for(let se=0;se<6;se++)if(Ae){F?J&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,me[se].width,me[se].height,Re,Ne,me[se].data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,ze,me[se].width,me[se].height,0,Re,Ne,me[se].data);for(let Le=0;Le<_e.length;Le++){let ct=_e[Le].image[se].image;F?J&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le+1,0,0,ct.width,ct.height,Re,Ne,ct.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le+1,ze,ct.width,ct.height,0,Re,Ne,ct.data)}}else{F?J&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,Re,Ne,me[se]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,ze,Re,Ne,me[se]);for(let Le=0;Le<_e.length;Le++){let Me=_e[Le];F?J&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le+1,0,0,Re,Ne,Me.image[se]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+se,Le+1,ze,Re,Ne,Me.image[se])}}}m(v)&&S(s.TEXTURE_CUBE_MAP),oe.__version=Y.version,v.onUpdate&&v.onUpdate(v)}R.__version=v.version}function ie(R,v,z,W,Y,oe){let ue=r.convert(z.format,z.colorSpace),Z=r.convert(z.type),Q=y(z.internalFormat,ue,Z,z.normalized,z.colorSpace),de=n.get(v),Ae=n.get(z);if(Ae.__renderTarget=v,!de.__hasExternalTextures){let me=Math.max(1,v.width>>oe),re=Math.max(1,v.height>>oe);Y===s.TEXTURE_3D||Y===s.TEXTURE_2D_ARRAY?t.texImage3D(Y,oe,Q,me,re,v.depth,0,ue,Z,null):t.texImage2D(Y,oe,Q,me,re,0,ue,Z,null)}t.bindFramebuffer(s.FRAMEBUFFER,R),Tt(v)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,W,Y,Ae.__webglTexture,0,lt(v)):(Y===s.TEXTURE_2D||Y>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&Y<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,W,Y,Ae.__webglTexture,oe),t.bindFramebuffer(s.FRAMEBUFFER,null)}function ce(R,v,z){if(s.bindRenderbuffer(s.RENDERBUFFER,R),v.depthBuffer){let W=v.depthTexture,Y=W&&W.isDepthTexture?W.type:null,oe=E(v.stencilBuffer,Y),ue=v.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;Tt(v)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,lt(v),oe,v.width,v.height):z?s.renderbufferStorageMultisample(s.RENDERBUFFER,lt(v),oe,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,oe,v.width,v.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,ue,s.RENDERBUFFER,R)}else{let W=v.textures;for(let Y=0;Y<W.length;Y++){let oe=W[Y],ue=r.convert(oe.format,oe.colorSpace),Z=r.convert(oe.type),Q=y(oe.internalFormat,ue,Z,oe.normalized,oe.colorSpace);Tt(v)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,lt(v),Q,v.width,v.height):z?s.renderbufferStorageMultisample(s.RENDERBUFFER,lt(v),Q,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,Q,v.width,v.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Mt(R,v,z){let W=v.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(s.FRAMEBUFFER,R),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Y=n.get(v.depthTexture);if(Y.__renderTarget=v,(!Y.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),W){if(Y.__webglInit===void 0&&(Y.__webglInit=!0,v.depthTexture.addEventListener("dispose",A)),Y.__webglTexture===void 0){Y.__webglTexture=s.createTexture(),t.bindTexture(s.TEXTURE_CUBE_MAP,Y.__webglTexture),Be(s.TEXTURE_CUBE_MAP,v.depthTexture);let de=r.convert(v.depthTexture.format),Ae=r.convert(v.depthTexture.type),me;v.depthTexture.format===Qn?me=s.DEPTH_COMPONENT24:v.depthTexture.format===Xi&&(me=s.DEPTH24_STENCIL8);for(let re=0;re<6;re++)s.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,me,v.width,v.height,0,de,Ae,null)}}else j(v.depthTexture,0);let oe=Y.__webglTexture,ue=lt(v),Z=W?s.TEXTURE_CUBE_MAP_POSITIVE_X+z:s.TEXTURE_2D,Q=v.depthTexture.format===Xi?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;if(v.depthTexture.format===Qn)Tt(v)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,Q,Z,oe,0,ue):s.framebufferTexture2D(s.FRAMEBUFFER,Q,Z,oe,0);else if(v.depthTexture.format===Xi)Tt(v)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,Q,Z,oe,0,ue):s.framebufferTexture2D(s.FRAMEBUFFER,Q,Z,oe,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Ve(R){let v=n.get(R),z=R.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==R.depthTexture){let W=R.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),W){let Y=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,W.removeEventListener("dispose",Y)};W.addEventListener("dispose",Y),v.__depthDisposeCallback=Y}v.__boundDepthTexture=W}if(R.depthTexture&&!v.__autoAllocateDepthBuffer)if(z)for(let W=0;W<6;W++)Mt(v.__webglFramebuffer[W],R,W);else{let W=R.texture.mipmaps;W&&W.length>0?Mt(v.__webglFramebuffer[0],R,0):Mt(v.__webglFramebuffer,R,0)}else if(z){v.__webglDepthbuffer=[];for(let W=0;W<6;W++)if(t.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer[W]),v.__webglDepthbuffer[W]===void 0)v.__webglDepthbuffer[W]=s.createRenderbuffer(),ce(v.__webglDepthbuffer[W],R,!1);else{let Y=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,oe=v.__webglDepthbuffer[W];s.bindRenderbuffer(s.RENDERBUFFER,oe),s.framebufferRenderbuffer(s.FRAMEBUFFER,Y,s.RENDERBUFFER,oe)}}else{let W=R.texture.mipmaps;if(W&&W.length>0?t.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer[0]):t.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=s.createRenderbuffer(),ce(v.__webglDepthbuffer,R,!1);else{let Y=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,oe=v.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,oe),s.framebufferRenderbuffer(s.FRAMEBUFFER,Y,s.RENDERBUFFER,oe)}}t.bindFramebuffer(s.FRAMEBUFFER,null)}function Je(R,v,z){let W=n.get(R);v!==void 0&&ie(W.__webglFramebuffer,R,R.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),z!==void 0&&Ve(R)}function ut(R){let v=R.texture,z=n.get(R),W=n.get(v);R.addEventListener("dispose",_);let Y=R.textures,oe=R.isWebGLCubeRenderTarget===!0,ue=Y.length>1;if(ue||(W.__webglTexture===void 0&&(W.__webglTexture=s.createTexture()),W.__version=v.version,o.memory.textures++),oe){z.__webglFramebuffer=[];for(let Z=0;Z<6;Z++)if(v.mipmaps&&v.mipmaps.length>0){z.__webglFramebuffer[Z]=[];for(let Q=0;Q<v.mipmaps.length;Q++)z.__webglFramebuffer[Z][Q]=s.createFramebuffer()}else z.__webglFramebuffer[Z]=s.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){z.__webglFramebuffer=[];for(let Z=0;Z<v.mipmaps.length;Z++)z.__webglFramebuffer[Z]=s.createFramebuffer()}else z.__webglFramebuffer=s.createFramebuffer();if(ue)for(let Z=0,Q=Y.length;Z<Q;Z++){let de=n.get(Y[Z]);de.__webglTexture===void 0&&(de.__webglTexture=s.createTexture(),o.memory.textures++)}if(R.samples>0&&Tt(R)===!1){z.__webglMultisampledFramebuffer=s.createFramebuffer(),z.__webglColorRenderbuffer=[],t.bindFramebuffer(s.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let Z=0;Z<Y.length;Z++){let Q=Y[Z];z.__webglColorRenderbuffer[Z]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,z.__webglColorRenderbuffer[Z]);let de=r.convert(Q.format,Q.colorSpace),Ae=r.convert(Q.type),me=y(Q.internalFormat,de,Ae,Q.normalized,Q.colorSpace,R.isXRRenderTarget===!0),re=lt(R);s.renderbufferStorageMultisample(s.RENDERBUFFER,re,me,R.width,R.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+Z,s.RENDERBUFFER,z.__webglColorRenderbuffer[Z])}s.bindRenderbuffer(s.RENDERBUFFER,null),R.depthBuffer&&(z.__webglDepthRenderbuffer=s.createRenderbuffer(),ce(z.__webglDepthRenderbuffer,R,!0)),t.bindFramebuffer(s.FRAMEBUFFER,null)}}if(oe){t.bindTexture(s.TEXTURE_CUBE_MAP,W.__webglTexture),Be(s.TEXTURE_CUBE_MAP,v);for(let Z=0;Z<6;Z++)if(v.mipmaps&&v.mipmaps.length>0)for(let Q=0;Q<v.mipmaps.length;Q++)ie(z.__webglFramebuffer[Z][Q],R,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+Z,Q);else ie(z.__webglFramebuffer[Z],R,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0);m(v)&&S(s.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ue){for(let Z=0,Q=Y.length;Z<Q;Z++){let de=Y[Z],Ae=n.get(de),me=s.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(me=R.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(me,Ae.__webglTexture),Be(me,de),ie(z.__webglFramebuffer,R,de,s.COLOR_ATTACHMENT0+Z,me,0),m(de)&&S(me)}t.unbindTexture()}else{let Z=s.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(Z=R.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(Z,W.__webglTexture),Be(Z,v),v.mipmaps&&v.mipmaps.length>0)for(let Q=0;Q<v.mipmaps.length;Q++)ie(z.__webglFramebuffer[Q],R,v,s.COLOR_ATTACHMENT0,Z,Q);else ie(z.__webglFramebuffer,R,v,s.COLOR_ATTACHMENT0,Z,0);m(v)&&S(Z),t.unbindTexture()}R.depthBuffer&&Ve(R)}function Ke(R){let v=R.textures;for(let z=0,W=v.length;z<W;z++){let Y=v[z];if(m(Y)){let oe=T(R),ue=n.get(Y).__webglTexture;t.bindTexture(oe,ue),S(oe),t.unbindTexture()}}}let tt=[],wt=[];function Qt(R){if(R.samples>0){if(Tt(R)===!1){let v=R.textures,z=R.width,W=R.height,Y=s.COLOR_BUFFER_BIT,oe=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ue=n.get(R),Z=v.length>1;if(Z)for(let de=0;de<v.length;de++)t.bindFramebuffer(s.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.RENDERBUFFER,null),t.bindFramebuffer(s.FRAMEBUFFER,ue.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.TEXTURE_2D,null,0);t.bindFramebuffer(s.READ_FRAMEBUFFER,ue.__webglMultisampledFramebuffer);let Q=R.texture.mipmaps;Q&&Q.length>0?t.bindFramebuffer(s.DRAW_FRAMEBUFFER,ue.__webglFramebuffer[0]):t.bindFramebuffer(s.DRAW_FRAMEBUFFER,ue.__webglFramebuffer);for(let de=0;de<v.length;de++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(Y|=s.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(Y|=s.STENCIL_BUFFER_BIT)),Z){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,ue.__webglColorRenderbuffer[de]);let Ae=n.get(v[de]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,Ae,0)}s.blitFramebuffer(0,0,z,W,0,0,z,W,Y,s.NEAREST),l===!0&&(tt.length=0,wt.length=0,tt.push(s.COLOR_ATTACHMENT0+de),R.depthBuffer&&R.storeMultisampledDepthBuffer===!1&&(tt.push(oe),wt.push(oe),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,wt)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,tt))}if(t.bindFramebuffer(s.READ_FRAMEBUFFER,null),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),Z)for(let de=0;de<v.length;de++){t.bindFramebuffer(s.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.RENDERBUFFER,ue.__webglColorRenderbuffer[de]);let Ae=n.get(v[de]).__webglTexture;t.bindFramebuffer(s.FRAMEBUFFER,ue.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.TEXTURE_2D,Ae,0)}t.bindFramebuffer(s.DRAW_FRAMEBUFFER,ue.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.storeMultisampledDepthBuffer===!1&&l){let v=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[v])}}}function lt(R){return Math.min(i.maxSamples,R.samples)}function Tt(R){let v=n.get(R);return R.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function D(R){let v=o.render.frame;h.get(R)!==v&&(h.set(R,v),R.update())}function dt(R,v){let z=R.colorSpace,W=R.format,Y=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||z!==cn&&z!==Ei&&(Ge.getTransfer(z)===ot?(W!==Tn||Y!==vn)&&De("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):ke("WebGLTextures: Unsupported texture color space:",z)),v}function We(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=q,this.resetTextureUnits=O,this.getTextureUnits=N,this.setTextureUnits=B,this.setTexture2D=j,this.setTexture2DArray=X,this.setTexture3D=$,this.setTextureCube=ne,this.rebindTextures=Je,this.setupRenderTarget=ut,this.updateRenderTargetMipmap=Ke,this.updateMultisampleRenderTarget=Qt,this.setupDepthRenderbuffer=Ve,this.setupFrameBufferTexture=ie,this.useMultisampledRTT=Tt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Bx(s,e){function t(n,i=Ei){let r,o=Ge.getTransfer(i);if(n===vn)return s.UNSIGNED_BYTE;if(n===Ka)return s.UNSIGNED_SHORT_4_4_4_4;if(n===Za)return s.UNSIGNED_SHORT_5_5_5_1;if(n===Kc)return s.UNSIGNED_INT_5_9_9_9_REV;if(n===Zc)return s.UNSIGNED_INT_10F_11F_11F_REV;if(n===qc)return s.BYTE;if(n===Yc)return s.SHORT;if(n===ar)return s.UNSIGNED_SHORT;if(n===Ya)return s.INT;if(n===Zn)return s.UNSIGNED_INT;if(n===bn)return s.FLOAT;if(n===en)return s.HALF_FLOAT;if(n===Jc)return s.ALPHA;if(n===$c)return s.RGB;if(n===Tn)return s.RGBA;if(n===Qn)return s.DEPTH_COMPONENT;if(n===Xi)return s.DEPTH_STENCIL;if(n===Ja)return s.RED;if(n===$a)return s.RED_INTEGER;if(n===qi)return s.RG;if(n===ja)return s.RG_INTEGER;if(n===Qa)return s.RGBA_INTEGER;if(n===yo||n===Mo||n===So||n===bo)if(o===ot)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===yo)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Mo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===So)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===bo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===yo)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Mo)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===So)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===bo)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===el||n===tl||n===nl||n===il)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===el)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===tl)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===nl)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===il)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===sl||n===rl||n===ol||n===al||n===ll||n===To||n===cl)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===sl||n===rl)return o===ot?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===ol)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===al)return r.COMPRESSED_R11_EAC;if(n===ll)return r.COMPRESSED_SIGNED_R11_EAC;if(n===To)return r.COMPRESSED_RG11_EAC;if(n===cl)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===hl||n===ul||n===dl||n===fl||n===pl||n===ml||n===gl||n===_l||n===xl||n===vl||n===yl||n===Ml||n===Sl||n===bl)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===hl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===ul)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===dl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===fl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===pl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ml)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===gl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===_l)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===xl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===vl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===yl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Ml)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Sl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===bl)return o===ot?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Tl||n===El||n===wl)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===Tl)return o===ot?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===El)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===wl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Al||n===Rl||n===Eo||n===Cl)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===Al)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Rl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Eo)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Cl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===lr?s.UNSIGNED_INT_24_8:s[n]!==void 0?s[n]:null}return{convert:t}}var zx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,kx=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,yh=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Kr(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new yt({vertexShader:zx,fragmentShader:kx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new nt(new to(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Mh=class extends ei{constructor(e,t){super();let n=this,i=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,d=null,u=null,f=null,g=null,x=typeof XRWebGLBinding<"u",p=new yh,m={},S=t.getContextAttributes(),T=null,y=null,E=[],M=[],A=new ae,_=null,w=null,I=new Bt;I.viewport=new pt;let L=new Bt;L.viewport=new pt;let U=[I,L],O=new Ha,N=null,B=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(K){let ee=E[K];return ee===void 0&&(ee=new qs,E[K]=ee),ee.getTargetRaySpace()},this.getControllerGrip=function(K){let ee=E[K];return ee===void 0&&(ee=new qs,E[K]=ee),ee.getGripSpace()},this.getHand=function(K){let ee=E[K];return ee===void 0&&(ee=new qs,E[K]=ee),ee.getHandSpace()};function q(K){let ee=M.indexOf(K.inputSource);if(ee===-1)return;let ye=E[ee];ye!==void 0&&(ye.update(K.inputSource,K.frame,c||o),ye.dispatchEvent({type:K.type,data:K.inputSource}))}function G(){i.removeEventListener("select",q),i.removeEventListener("selectstart",q),i.removeEventListener("selectend",q),i.removeEventListener("squeeze",q),i.removeEventListener("squeezestart",q),i.removeEventListener("squeezeend",q),i.removeEventListener("end",G),i.removeEventListener("inputsourceschange",j);for(let K=0;K<E.length;K++){let ee=M[K];ee!==null&&(M[K]=null,E[K].disconnect(ee))}N=null,B=null,p.reset();for(let K in m)delete m[K];if(e.setRenderTarget(T),f=null,u=null,d=null,i=null,y=null,Qe.stop(),n.isPresenting=!1,e.setPixelRatio(_),e.setSize(A.width,A.height,!1),w!==null){let K=w.camera;K.fov=w.fov,K.zoom=w.zoom,K.updateProjectionMatrix(),w=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(K){r=K,n.isPresenting===!0&&De("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(K){a=K,n.isPresenting===!0&&De("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(K){c=K},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return d===null&&x&&(d=new XRWebGLBinding(i,t)),d},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(K){if(i=K,i!==null){if(T=e.getRenderTarget(),i.addEventListener("select",q),i.addEventListener("selectstart",q),i.addEventListener("selectend",q),i.addEventListener("squeeze",q),i.addEventListener("squeezestart",q),i.addEventListener("squeezeend",q),i.addEventListener("end",G),i.addEventListener("inputsourceschange",j),S.xrCompatible!==!0&&await t.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(A),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let ye=null,Ue=null,ie=null;S.depth&&(ie=S.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ye=S.stencil?Xi:Qn,Ue=S.stencil?lr:Zn);let ce={colorFormat:t.RGBA8,depthFormat:ie,scaleFactor:r};d=this.getBinding(),u=d.createProjectionLayer(ce),i.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),y=new kt(u.textureWidth,u.textureHeight,{format:Tn,type:vn,depthTexture:new ki(u.textureWidth,u.textureHeight,Ue,void 0,void 0,void 0,void 0,void 0,void 0,ye),stencilBuffer:S.stencil,colorSpace:e.outputColorSpace,samples:S.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let ye={antialias:S.antialias,alpha:!0,depth:S.depth,stencil:S.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(i,t,ye),i.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new kt(f.framebufferWidth,f.framebufferHeight,{format:Tn,type:vn,colorSpace:e.outputColorSpace,stencilBuffer:S.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await i.requestReferenceSpace(a),Qe.setContext(i),Qe.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function j(K){for(let ee=0;ee<K.removed.length;ee++){let ye=K.removed[ee],Ue=M.indexOf(ye);Ue>=0&&(M[Ue]=null,E[Ue].disconnect(ye))}for(let ee=0;ee<K.added.length;ee++){let ye=K.added[ee],Ue=M.indexOf(ye);if(Ue===-1){for(let ce=0;ce<E.length;ce++)if(ce>=M.length){M.push(ye),Ue=ce;break}else if(M[ce]===null){M[ce]=ye,Ue=ce;break}if(Ue===-1)break}let ie=E[Ue];ie&&ie.connect(ye)}}let X=new C,$=new C;function ne(K,ee,ye){X.setFromMatrixPosition(ee.matrixWorld),$.setFromMatrixPosition(ye.matrixWorld);let Ue=X.distanceTo($),ie=ee.projectionMatrix.elements,ce=ye.projectionMatrix.elements,Mt=ie[14]/(ie[10]-1),Ve=ie[14]/(ie[10]+1),Je=(ie[9]+1)/ie[5],ut=(ie[9]-1)/ie[5],Ke=(ie[8]-1)/ie[0],tt=(ce[8]+1)/ce[0],wt=Mt*Ke,Qt=Mt*tt,lt=Ue/(-Ke+tt),Tt=lt*-Ke;if(ee.matrixWorld.decompose(K.position,K.quaternion,K.scale),K.translateX(Tt),K.translateZ(lt),K.matrixWorld.compose(K.position,K.quaternion,K.scale),K.matrixWorldInverse.copy(K.matrixWorld).invert(),ie[10]===-1)K.projectionMatrix.copy(ee.projectionMatrix),K.projectionMatrixInverse.copy(ee.projectionMatrixInverse);else{let D=Mt+lt,dt=Ve+lt,We=wt-Tt,R=Qt+(Ue-Tt),v=Je*Ve/dt*D,z=ut*Ve/dt*D;K.projectionMatrix.makePerspective(We,R,v,z,D,dt),K.projectionMatrixInverse.copy(K.projectionMatrix).invert()}}function Te(K,ee){ee===null?K.matrixWorld.copy(K.matrix):K.matrixWorld.multiplyMatrices(ee.matrixWorld,K.matrix),K.matrixWorldInverse.copy(K.matrixWorld).invert()}this.updateCamera=function(K){if(i===null)return;let ee=K.near,ye=K.far;p.texture!==null&&(p.depthNear>0&&(ee=p.depthNear),p.depthFar>0&&(ye=p.depthFar)),O.near=L.near=I.near=ee,O.far=L.far=I.far=ye,(N!==O.near||B!==O.far)&&(i.updateRenderState({depthNear:O.near,depthFar:O.far}),N=O.near,B=O.far),O.layers.mask=K.layers.mask|6,I.layers.mask=O.layers.mask&-5,L.layers.mask=O.layers.mask&-3;let Ue=K.parent,ie=O.cameras;Te(O,Ue);for(let ce=0;ce<ie.length;ce++)Te(ie[ce],Ue);ie.length===2?ne(O,I,L):O.projectionMatrix.copy(I.projectionMatrix),w===null&&K.isPerspectiveCamera&&(w={camera:K,fov:K.fov,zoom:K.zoom}),le(K,O,Ue)};function le(K,ee,ye){ye===null?K.matrix.copy(ee.matrixWorld):(K.matrix.copy(ye.matrixWorld),K.matrix.invert(),K.matrix.multiply(ee.matrixWorld)),K.matrix.decompose(K.position,K.quaternion,K.scale),K.updateMatrixWorld(!0),K.projectionMatrix.copy(ee.projectionMatrix),K.projectionMatrixInverse.copy(ee.projectionMatrixInverse),K.isPerspectiveCamera&&(K.fov=os*2*Math.atan(1/K.projectionMatrix.elements[5]),K.zoom=1)}this.getCamera=function(){return O},this.getFoveation=function(){if(!(u===null&&f===null))return l},this.setFoveation=function(K){l=K,u!==null&&(u.fixedFoveation=K),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=K)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(O)},this.getCameraTexture=function(K){return m[K]};let Fe=null;function Be(K,ee){if(h=ee.getViewerPose(c||o),g=ee,h!==null){let ye=h.views;f!==null&&(e.setRenderTargetFramebuffer(y,f.framebuffer),e.setRenderTarget(y));let Ue=!1;ye.length!==O.cameras.length&&(O.cameras.length=0,Ue=!0);for(let Ve=0;Ve<ye.length;Ve++){let Je=ye[Ve],ut=null;if(f!==null)ut=f.getViewport(Je);else{let tt=d.getViewSubImage(u,Je);ut=tt.viewport,Ve===0&&(e.setRenderTargetTextures(y,tt.colorTexture,tt.depthStencilTexture),e.setRenderTarget(y))}let Ke=U[Ve];Ke===void 0&&(Ke=new Bt,Ke.layers.enable(Ve),Ke.viewport=new pt,U[Ve]=Ke),Ke.matrix.fromArray(Je.transform.matrix),Ke.matrix.decompose(Ke.position,Ke.quaternion,Ke.scale),Ke.projectionMatrix.fromArray(Je.projectionMatrix),Ke.projectionMatrixInverse.copy(Ke.projectionMatrix).invert(),Ke.viewport.set(ut.x,ut.y,ut.width,ut.height),Ve===0&&(O.matrix.copy(Ke.matrix),O.matrix.decompose(O.position,O.quaternion,O.scale)),Ue===!0&&O.cameras.push(Ke)}let ie=i.enabledFeatures;if(ie&&ie.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&x){d=n.getBinding();let Ve=d.getDepthInformation(ye[0]);Ve&&Ve.isValid&&Ve.texture&&p.init(Ve,i.renderState)}if(ie&&ie.includes("camera-access")&&x){e.state.unbindTexture(),d=n.getBinding();for(let Ve=0;Ve<ye.length;Ve++){let Je=ye[Ve].camera;if(Je){let ut=m[Je];ut||(ut=new Kr,m[Je]=ut);let Ke=d.getCameraImage(Je);ut.sourceTexture=Ke}}}}for(let ye=0;ye<E.length;ye++){let Ue=M[ye],ie=E[ye];Ue!==null&&ie!==void 0&&ie.update(Ue,ee,c||o)}Fe&&Fe(K,ee),ee.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ee}),g=null}let Qe=new rf;Qe.setAnimationLoop(Be),this.setAnimationLoop=function(K){Fe=K},this.dispose=function(){}}},Hx=new Oe,uf=new He;uf.set(-1,0,0,0,1,0,0,0,1);function Vx(s,e){function t(p,m){p.matrixAutoUpdate===!0&&p.updateMatrix(),m.value.copy(p.matrix)}function n(p,m){m.color.getRGB(p.fogColor.value,ih(s)),m.isFog?(p.fogNear.value=m.near,p.fogFar.value=m.far):m.isFogExp2&&(p.fogDensity.value=m.density)}function i(p,m,S,T,y){m.isNodeMaterial?m.uniformsNeedUpdate=!1:m.isMeshBasicMaterial?r(p,m):m.isMeshLambertMaterial?(r(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshToonMaterial?(r(p,m),d(p,m)):m.isMeshPhongMaterial?(r(p,m),h(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshStandardMaterial?(r(p,m),u(p,m),m.isMeshPhysicalMaterial&&f(p,m,y)):m.isMeshMatcapMaterial?(r(p,m),g(p,m)):m.isMeshDepthMaterial?r(p,m):m.isMeshDistanceMaterial?(r(p,m),x(p,m)):m.isMeshNormalMaterial?r(p,m):m.isLineBasicMaterial?(o(p,m),m.isLineDashedMaterial&&a(p,m)):m.isPointsMaterial?l(p,m,S,T):m.isSpriteMaterial?c(p,m):m.isShadowMaterial?(p.color.value.copy(m.color),p.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function r(p,m){p.opacity.value=m.opacity,m.color&&p.diffuse.value.copy(m.color),m.emissive&&p.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(p.map.value=m.map,t(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,t(m.alphaMap,p.alphaMapTransform)),m.bumpMap&&(p.bumpMap.value=m.bumpMap,t(m.bumpMap,p.bumpMapTransform),p.bumpScale.value=m.bumpScale,m.side===Wt&&(p.bumpScale.value*=-1)),m.normalMap&&(p.normalMap.value=m.normalMap,t(m.normalMap,p.normalMapTransform),p.normalScale.value.copy(m.normalScale),m.side===Wt&&p.normalScale.value.negate()),m.displacementMap&&(p.displacementMap.value=m.displacementMap,t(m.displacementMap,p.displacementMapTransform),p.displacementScale.value=m.displacementScale,p.displacementBias.value=m.displacementBias),m.emissiveMap&&(p.emissiveMap.value=m.emissiveMap,t(m.emissiveMap,p.emissiveMapTransform)),m.specularMap&&(p.specularMap.value=m.specularMap,t(m.specularMap,p.specularMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest);let S=e.get(m),T=S.envMap,y=S.envMapRotation;T&&(p.envMap.value=T,p.envMapRotation.value.setFromMatrix4(Hx.makeRotationFromEuler(y)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(uf),p.reflectivity.value=m.reflectivity,p.ior.value=m.ior,p.refractionRatio.value=m.refractionRatio),m.lightMap&&(p.lightMap.value=m.lightMap,p.lightMapIntensity.value=m.lightMapIntensity,t(m.lightMap,p.lightMapTransform)),m.aoMap&&(p.aoMap.value=m.aoMap,p.aoMapIntensity.value=m.aoMapIntensity,t(m.aoMap,p.aoMapTransform))}function o(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,m.map&&(p.map.value=m.map,t(m.map,p.mapTransform))}function a(p,m){p.dashSize.value=m.dashSize,p.totalSize.value=m.dashSize+m.gapSize,p.scale.value=m.scale}function l(p,m,S,T){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.size.value=m.size*S,p.scale.value=T*.5,m.map&&(p.map.value=m.map,t(m.map,p.uvTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,t(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function c(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.rotation.value=m.rotation,m.map&&(p.map.value=m.map,t(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,t(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function h(p,m){p.specular.value.copy(m.specular),p.shininess.value=Math.max(m.shininess,1e-4)}function d(p,m){m.gradientMap&&(p.gradientMap.value=m.gradientMap)}function u(p,m){p.metalness.value=m.metalness,m.metalnessMap&&(p.metalnessMap.value=m.metalnessMap,t(m.metalnessMap,p.metalnessMapTransform)),p.roughness.value=m.roughness,m.roughnessMap&&(p.roughnessMap.value=m.roughnessMap,t(m.roughnessMap,p.roughnessMapTransform)),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)}function f(p,m,S){p.ior.value=m.ior,m.sheen>0&&(p.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),p.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(p.sheenColorMap.value=m.sheenColorMap,t(m.sheenColorMap,p.sheenColorMapTransform)),m.sheenRoughnessMap&&(p.sheenRoughnessMap.value=m.sheenRoughnessMap,t(m.sheenRoughnessMap,p.sheenRoughnessMapTransform))),m.clearcoat>0&&(p.clearcoat.value=m.clearcoat,p.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(p.clearcoatMap.value=m.clearcoatMap,t(m.clearcoatMap,p.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,t(m.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(p.clearcoatNormalMap.value=m.clearcoatNormalMap,t(m.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===Wt&&p.clearcoatNormalScale.value.negate())),m.dispersion>0&&(p.dispersion.value=m.dispersion),m.retroreflectivity>0&&(p.retroreflectivity.value=m.retroreflectivity),m.iridescence>0&&(p.iridescence.value=m.iridescence,p.iridescenceIOR.value=m.iridescenceIOR,p.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(p.iridescenceMap.value=m.iridescenceMap,t(m.iridescenceMap,p.iridescenceMapTransform)),m.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=m.iridescenceThicknessMap,t(m.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),m.transmission>0&&(p.transmission.value=m.transmission,p.transmissionSamplerMap.value=S.texture,p.transmissionSamplerSize.value.set(S.width,S.height),m.transmissionMap&&(p.transmissionMap.value=m.transmissionMap,t(m.transmissionMap,p.transmissionMapTransform)),p.thickness.value=m.thickness,m.thicknessMap&&(p.thicknessMap.value=m.thicknessMap,t(m.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=m.attenuationDistance,p.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(p.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(p.anisotropyMap.value=m.anisotropyMap,t(m.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=m.specularIntensity,p.specularColor.value.copy(m.specularColor),m.specularColorMap&&(p.specularColorMap.value=m.specularColorMap,t(m.specularColorMap,p.specularColorMapTransform)),m.specularIntensityMap&&(p.specularIntensityMap.value=m.specularIntensityMap,t(m.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,m){m.matcap&&(p.matcap.value=m.matcap)}function x(p,m){let S=e.get(m).light;p.referencePosition.value.setFromMatrixPosition(S.matrixWorld),p.nearDistance.value=S.shadow.camera.near,p.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function Gx(s,e,t,n){let i={},r={},o=[],a=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,E){let M=E.program;n.uniformBlockBinding(y,M)}function c(y,E){let M=i[y.id];M===void 0&&(p(y),M=h(y),i[y.id]=M,y.addEventListener("dispose",S));let A=E.program;n.updateUBOMapping(y,A);let _=e.render.frame;r[y.id]!==_&&(u(y),r[y.id]=_)}function h(y){let E=d();y.__bindingPointIndex=E;let M=s.createBuffer(),A=y.__size,_=y.usage;return s.bindBuffer(s.UNIFORM_BUFFER,M),s.bufferData(s.UNIFORM_BUFFER,A,_),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,E,M),M}function d(){for(let y=0;y<a;y++)if(o.indexOf(y)===-1)return o.push(y),y;return ke("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(y){let E=i[y.id],M=y.uniforms,A=y.__cache;s.bindBuffer(s.UNIFORM_BUFFER,E);for(let _=0,w=M.length;_<w;_++){let I=M[_];if(Array.isArray(I))for(let L=0,U=I.length;L<U;L++)f(I[L],_,L,A);else f(I,_,0,A)}s.bindBuffer(s.UNIFORM_BUFFER,null)}function f(y,E,M,A){if(x(y,E,M,A)===!0){let _=y.__offset,w=y.value;if(Array.isArray(w)){let I=0;for(let L=0;L<w.length;L++){let U=w[L],O=m(U);g(U,y.__data,I),typeof U!="number"&&typeof U!="boolean"&&!U.isMatrix3&&!ArrayBuffer.isView(U)&&(I+=O.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(w,y.__data,0);s.bufferSubData(s.UNIFORM_BUFFER,_,y.__data)}}function g(y,E,M){typeof y=="number"||typeof y=="boolean"?E[0]=y:y.isMatrix3?(E[0]=y.elements[0],E[1]=y.elements[1],E[2]=y.elements[2],E[3]=0,E[4]=y.elements[3],E[5]=y.elements[4],E[6]=y.elements[5],E[7]=0,E[8]=y.elements[6],E[9]=y.elements[7],E[10]=y.elements[8],E[11]=0):ArrayBuffer.isView(y)?E.set(new y.constructor(y.buffer,y.byteOffset,E.length)):y.toArray(E,M)}function x(y,E,M,A){let _=y.value,w=E+"_"+M;if(A[w]===void 0)return typeof _=="number"||typeof _=="boolean"?A[w]=_:ArrayBuffer.isView(_)?A[w]=_.slice():A[w]=_.clone(),!0;{let I=A[w];if(typeof _=="number"||typeof _=="boolean"){if(I!==_)return A[w]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(I.equals(_)===!1)return I.copy(_),!0}}return!1}function p(y){let E=y.uniforms,M=0,A=16;for(let w=0,I=E.length;w<I;w++){let L=Array.isArray(E[w])?E[w]:[E[w]];for(let U=0,O=L.length;U<O;U++){let N=L[U],B=Array.isArray(N.value)?N.value:[N.value];for(let q=0,G=B.length;q<G;q++){let j=B[q],X=m(j),$=M%A,ne=$%X.boundary,Te=$+ne;M+=ne,Te!==0&&A-Te<X.storage&&(M+=A-Te),N.__data=new Float32Array(X.storage/Float32Array.BYTES_PER_ELEMENT),N.__offset=M,M+=X.storage}}}let _=M%A;return _>0&&(M+=A-_),y.__size=M,y.__cache={},this}function m(y){let E={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(E.boundary=4,E.storage=4):y.isVector2?(E.boundary=8,E.storage=8):y.isVector3||y.isColor?(E.boundary=16,E.storage=12):y.isVector4?(E.boundary=16,E.storage=16):y.isMatrix3?(E.boundary=48,E.storage=48):y.isMatrix4?(E.boundary=64,E.storage=64):y.isTexture?De("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(E.boundary=16,E.storage=y.byteLength):De("WebGLRenderer: Unsupported uniform value type.",y),E}function S(y){let E=y.target;E.removeEventListener("dispose",S);let M=o.indexOf(E.__bindingPointIndex);o.splice(M,1),s.deleteBuffer(i[E.id]),delete i[E.id],delete r[E.id]}function T(){for(let y in i)s.deleteBuffer(i[y]);o=[],i={},r={}}return{bind:l,update:c,dispose:T}}var Wx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),ri=null;function Xx(){return ri===null&&(ri=new Js(Wx,16,16,qi,en),ri.name="DFG_LUT",ri.minFilter=Lt,ri.magFilter=Lt,ri.wrapS=Cn,ri.wrapT=Cn,ri.generateMipmaps=!1,ri.needsUpdate=!0),ri}var Ul=class{constructor(e={}){let{canvas:t=Id(),context:n=null,depth:i=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:f=vn}=e;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=o;let x=f,p=new Set([Qa,ja,$a]),m=new Set([vn,Zn,ar,lr,Ka,Za]),S=new Uint32Array(4),T=new Int32Array(4),y=new C,E=null,M=null,A=[],_=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Yn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let I=this,L=!1,U=null,O=null,N=null,B=null;this._outputColorSpace=It;let q=0,G=0,j=null,X=-1,$=null,ne=new pt,Te=new pt,le=null,Fe=new Ce(0),Be=0,Qe=t.width,K=t.height,ee=1,ye=null,Ue=null,ie=new pt(0,0,Qe,K),ce=new pt(0,0,Qe,K),Mt=!1,Ve=new $s,Je=!1,ut=!1,Ke=new Oe,tt=new C,wt=new pt,Qt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},lt=!1;function Tt(){return j===null?ee:1}let D=n;function dt(b,P){return t.getContext(b,P)}let We,R,v,z,W,Y,oe,ue,Z,Q,de,Ae,me,re,Re,Ne,ze,F,fe,J,pe,_e,se;try{let b={alpha:!0,depth:i,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"186"}`),t.addEventListener("webglcontextlost",ct,!1),t.addEventListener("webglcontextrestored",st,!1),t.addEventListener("webglcontextcreationerror",Ut,!1),D===null){let P="webgl2";if(D=dt(P,b),D===null)throw dt(P)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Le()}catch(b){throw t.removeEventListener("webglcontextlost",ct,!1),t.removeEventListener("webglcontextrestored",st,!1),t.removeEventListener("webglcontextcreationerror",Ut,!1),ke("WebGLRenderer: "+b.message),b}function Le(){We=new j0(D),We.init(),pe=new Bx(D,We),R=new V0(D,We,e,pe),v=new Fx(D,We),R.reversedDepthBuffer&&u&&v.buffers.depth.setReversed(!0),O=D.createFramebuffer(),N=D.createFramebuffer(),B=D.createFramebuffer(),z=new t_(D),W=new Sx,Y=new Ox(D,We,v,W,R,pe,z),oe=new $0(I),ue=new im(D),_e=new k0(D,ue),Z=new Q0(D,ue,z,_e),Q=new i_(D,Z,ue,_e,z),F=new n_(D,R,Y),Re=new G0(W),de=new Mx(I,oe,We,R,_e,Re),Ae=new Vx(I,W),me=new Tx,re=new Ix(We),ze=new z0(I,oe,v,Q,g,l),Ne=new Ux(I,Q,R),se=new Gx(D,z,R,v),fe=new H0(D,We,z),J=new e_(D,We,z),z.programs=de.programs,I.capabilities=R,I.extensions=We,I.properties=W,I.renderLists=me,I.shadowMap=Ne,I.state=v,I.info=z}x!==vn&&(w=new r_(x,t.width,t.height,a,i,r));let Me=new Mh(I,D);this.xr=Me,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){let b=We.get("WEBGL_lose_context");b&&b.loseContext()},this.forceContextRestore=function(){let b=We.get("WEBGL_lose_context");b&&b.restoreContext()},this.getPixelRatio=function(){return ee},this.setPixelRatio=function(b){b!==void 0&&(ee=b,this.setSize(Qe,K,!1))},this.getSize=function(b){return b.set(Qe,K)},this.setSize=function(b,P,V=!0){if(Me.isPresenting){De("WebGLRenderer: Can't change size while VR device is presenting.");return}Qe=b,K=P,t.width=Math.floor(b*ee),t.height=Math.floor(P*ee),V===!0&&(t.style.width=b+"px",t.style.height=P+"px"),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,b,P)},this.getDrawingBufferSize=function(b){return b.set(Qe*ee,K*ee).floor()},this.setDrawingBufferSize=function(b,P,V){Qe=b,K=P,ee=V,t.width=Math.floor(b*V),t.height=Math.floor(P*V),this.setViewport(0,0,b,P)},this.setEffects=function(b){if(x===vn){ke("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(b){for(let P=0;P<b.length;P++)if(b[P].isOutputPass===!0){De("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}w.setEffects(b||[])},this.getCurrentViewport=function(b){return b.copy(ne)},this.getViewport=function(b){return b.copy(ie)},this.setViewport=function(b,P,V,k){b.isVector4?ie.set(b.x,b.y,b.z,b.w):ie.set(b,P,V,k),v.viewport(ne.copy(ie).multiplyScalar(ee).round())},this.getScissor=function(b){return b.copy(ce)},this.setScissor=function(b,P,V,k){b.isVector4?ce.set(b.x,b.y,b.z,b.w):ce.set(b,P,V,k),v.scissor(Te.copy(ce).multiplyScalar(ee).round())},this.getScissorTest=function(){return Mt},this.setScissorTest=function(b){v.setScissorTest(Mt=b)},this.setOpaqueSort=function(b){ye=b},this.setTransparentSort=function(b){Ue=b},this.getClearColor=function(b){return b.copy(ze.getClearColor())},this.setClearColor=function(){ze.setClearColor(...arguments)},this.getClearAlpha=function(){return ze.getClearAlpha()},this.setClearAlpha=function(){ze.setClearAlpha(...arguments)},this.clear=function(b=!0,P=!0,V=!0){let k=0;if(b){let H=!1;if(j!==null){let he=j.texture.format;H=p.has(he)}if(H){let he=j.texture.type,be=m.has(he),xe=ze.getClearColor(),we=ze.getClearAlpha(),Ie=xe.r,Xe=xe.g,et=xe.b;be?(S[0]=Ie,S[1]=Xe,S[2]=et,S[3]=we,D.clearBufferuiv(D.COLOR,0,S)):(T[0]=Ie,T[1]=Xe,T[2]=et,T[3]=we,D.clearBufferiv(D.COLOR,0,T))}else k|=D.COLOR_BUFFER_BIT}P&&(k|=D.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),V&&(k|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),k!==0&&D.clear(k)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(b){b.setRenderer(this),U=b},this.dispose=function(){t.removeEventListener("webglcontextlost",ct,!1),t.removeEventListener("webglcontextrestored",st,!1),t.removeEventListener("webglcontextcreationerror",Ut,!1),ze.dispose(),me.dispose(),re.dispose(),W.dispose(),oe.dispose(),Q.dispose(),_e.dispose(),se.dispose(),de.dispose(),Me.dispose(),Me.removeEventListener("sessionstart",Mr),Me.removeEventListener("sessionend",$i),Bn.stop()};function ct(b){b.preventDefault(),Or("WebGLRenderer: Context Lost."),L=!0}function st(){Or("WebGLRenderer: Context Restored."),L=!1;let b=z.autoReset,P=Ne.enabled,V=Ne.autoUpdate,k=Ne.needsUpdate,H=Ne.type;Le(),z.autoReset=b,Ne.enabled=P,Ne.autoUpdate=V,Ne.needsUpdate=k,Ne.type=H}function Ut(b){ke("WebGLRenderer: A WebGL context could not be created. Reason: ",b.statusMessage)}function yn(b){let P=b.target;P.removeEventListener("dispose",yn),ec(P)}function ec(b){Uo(b),W.remove(b)}function Uo(b){let P=W.get(b).programs;P!==void 0&&(P.forEach(function(V){de.releaseProgram(V)}),b.isShaderMaterial&&de.releaseShaderCache(b))}this.renderBufferDirect=function(b,P,V,k,H,he){P===null&&(P=Qt);let be=H.isMesh&&H.matrixWorld.determinantAffine()<0,xe=on(b,P,V,k,H);v.setMaterial(k,be);let we=V.index,Ie=1;if(k.wireframe===!0){if(we=Z.getWireframeAttribute(V),we===void 0)return;Ie=2}let Xe=V.drawRange,et=V.attributes.position,Pe=Xe.start*Ie,ht=(Xe.start+Xe.count)*Ie;he!==null&&(Pe=Math.max(Pe,he.start*Ie),ht=Math.min(ht,(he.start+he.count)*Ie)),we!==null?(Pe=Math.max(Pe,0),ht=Math.min(ht,we.count)):et!=null&&(Pe=Math.max(Pe,0),ht=Math.min(ht,et.count));let Ft=ht-Pe;if(Ft<0||Ft===1/0)return;_e.setup(H,k,xe,V,we);let Et,xt=fe;if(we!==null&&(Et=ue.get(we),xt=J,xt.setIndex(Et)),H.isMesh)k.wireframe===!0?(v.setLineWidth(k.wireframeLinewidth*Tt()),xt.setMode(D.LINES)):xt.setMode(D.TRIANGLES);else if(H.isLine){let tn=k.linewidth;tn===void 0&&(tn=1),v.setLineWidth(tn*Tt()),H.isLineSegments?xt.setMode(D.LINES):H.isLineLoop?xt.setMode(D.LINE_LOOP):xt.setMode(D.LINE_STRIP)}else H.isPoints?xt.setMode(D.POINTS):H.isSprite&&xt.setMode(D.TRIANGLES);if(H.isBatchedMesh)if(We.get("WEBGL_multi_draw"))xt.renderMultiDraw(H._multiDrawStarts,H._multiDrawCounts,H._multiDrawCount);else{let tn=H._multiDrawStarts,Ee=H._multiDrawCounts,an=H._multiDrawCount,it=we?ue.get(we).bytesPerElement:1,An=W.get(k).currentProgram.getUniforms();for(let Jn=0;Jn<an;Jn++)An.setValue(D,"_gl_DrawID",Jn),xt.render(tn[Jn]/it,Ee[Jn])}else if(H.isInstancedMesh)xt.renderInstances(Pe,Ft,H.count);else if(V.isInstancedBufferGeometry){let tn=V._maxInstanceCount!==void 0?V._maxInstanceCount:1/0,Ee=Math.min(V.instanceCount,tn);xt.renderInstances(Pe,Ft,Ee)}else xt.render(Pe,Ft)};function Fo(b,P,V,k){U!==null&&b.isNodeMaterial&&U.setObject(k,b),Je===!0&&Re.setState(b,V,!1),b.transparent===!0&&b.side===Ht&&b.forceSinglePass===!1?(b.side=Wt,b.needsUpdate=!0,te(b,P,k),b.side=ii,b.needsUpdate=!0,te(b,P,k),b.side=Ht):te(b,P,k)}this.compile=function(b,P,V=null){V===null&&(V=b),U!==null&&U.renderStart(b,P,V),M=re.get(V),M.init(P),_.push(M),V.traverseVisible(function(H){H.isLight&&H.layers.test(P.layers)&&(M.pushLight(H),H.castShadow&&M.pushShadow(H))}),b!==V&&b.traverseVisible(function(H){H.isLight&&H.layers.test(P.layers)&&(M.pushLight(H),H.castShadow&&M.pushShadow(H))}),M.setupLights(),U!==null&&U.updateLights(M.state.lightsArray),ut=this.localClippingEnabled,Je=Re.init(this.clippingPlanes,ut),Je===!0&&Re.setGlobalState(this.clippingPlanes,P),U!==null&&Ne.render(M.state.shadowsArray,V,P);let k=new Set;return b.traverse(function(H){if(!(H.isMesh||H.isPoints||H.isLine||H.isSprite))return;let he=H.material;if(he)if(Array.isArray(he))for(let be=0;be<he.length;be++){let xe=he[be];Fo(xe,V,P,H),k.add(xe)}else Fo(he,V,P,H),k.add(he)}),M=_.pop(),U!==null&&U.renderEnd(),k},this.compileAsync=function(b,P,V=null){let k=this.compile(b,P,V);return new Promise(H=>{function he(){if(k.forEach(function(be){let we=W.get(be).currentProgram;(we===void 0||we.isReady())&&k.delete(be)}),k.size===0){H(b);return}setTimeout(he,10)}We.get("KHR_parallel_shader_compile")!==null?he():setTimeout(he,10)})};let Ms=null;function Oo(b){Ms&&Ms(b)}function Mr(){Bn.stop()}function $i(){Bn.start()}let Bn=new rf;Bn.setAnimationLoop(Oo),typeof self<"u"&&Bn.setContext(self),this.setAnimationLoop=function(b){Ms=b,Me.setAnimationLoop(b),b===null?Bn.stop():Bn.start()},Me.addEventListener("sessionstart",Mr),Me.addEventListener("sessionend",$i),this.render=function(b,P){if(P!==void 0&&P.isCamera!==!0){ke("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(L===!0)return;U!==null&&U.renderStart(b,P);let V=Me.enabled===!0&&Me.isPresenting===!0,k=w!==null&&(j===null||V)&&w.begin(I,j);if(b.matrixWorldAutoUpdate===!0&&b.updateMatrixWorld(),P.parent===null&&P.matrixWorldAutoUpdate===!0&&P.updateMatrixWorld(),Me.enabled===!0&&Me.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(Me.cameraAutoUpdate===!0&&Me.updateCamera(P),P=Me.getCamera()),b.isScene===!0&&b.onBeforeRender(I,b,P,j),M=re.get(b,_.length),M.init(P),M.state.textureUnits=Y.getTextureUnits(),_.push(M),Ke.multiplyMatrices(P.projectionMatrix,P.matrixWorldInverse),Ve.setFromProjectionMatrix(Ke,Xn,P.reversedDepth),ut=this.localClippingEnabled,Je=Re.init(this.clippingPlanes,ut),E=me.get(b,A.length),E.init(),A.push(E),Me.enabled===!0&&Me.isPresenting===!0){let be=I.xr.getDepthSensingMesh();be!==null&&Ss(be,P,-1/0,I.sortObjects)}Ss(b,P,0,I.sortObjects),E.finish(),U!==null&&U.updateLights(M.state.lightsArray),I.sortObjects===!0&&E.sort(ye,Ue),lt=Me.enabled===!1||Me.isPresenting===!1||Me.hasDepthSensing()===!1,lt&&ze.addToRenderList(E,b),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Je===!0&&Re.beginShadows();let H=M.state.shadowsArray;if(Ne.render(H,b,P),Je===!0&&Re.endShadows(),(k&&w.hasRenderPass())===!1){let be=E.opaque,xe=E.transmissive;if(M.setupLights(),P.isArrayCamera){let we=P.cameras;if(xe.length>0)for(let Ie=0,Xe=we.length;Ie<Xe;Ie++){let et=we[Ie];br(be,xe,b,et)}lt&&ze.render(b);for(let Ie=0,Xe=we.length;Ie<Xe;Ie++){let et=we[Ie];Sr(E,b,et,et.viewport)}}else xe.length>0&&br(be,xe,b,P),lt&&ze.render(b),Sr(E,b,P)}j!==null&&G===0&&(Y.updateMultisampleRenderTarget(j),Y.updateRenderTargetMipmap(j)),k&&w.end(I),b.isScene===!0&&b.onAfterRender(I,b,P),_e.resetDefaultState(),X=-1,$=null,_.pop(),_.length>0?(M=_[_.length-1],Y.setTextureUnits(M.state.textureUnits),Je===!0&&Re.setGlobalState(I.clippingPlanes,M.state.camera)):M=null,A.pop(),A.length>0?E=A[A.length-1]:E=null,U!==null&&U.renderEnd()};function Ss(b,P,V,k){if(b.visible===!1)return;if(b.layers.test(P.layers)){if(b.isGroup)V=b.renderOrder;else if(b.isLOD)b.autoUpdate===!0&&b.update(P);else if(b.isLightProbeGrid)M.pushLightProbeGrid(b);else if(b.isLight)M.pushLight(b),b.castShadow&&M.pushShadow(b);else if(b.isSprite){if(!b.frustumCulled||b.intersectsFrustum(Ve)){k&&wt.setFromMatrixPosition(b.matrixWorld).applyMatrix4(Ke);let be=Q.update(b),xe=b.material;xe.visible&&E.push(b,be,xe,V,wt.z,null,P)}}else if((b.isMesh||b.isLine||b.isPoints)&&(!b.frustumCulled||b.intersectsFrustum(Ve))){let be=Q.update(b),xe=b.material;if(k&&(b.boundingSphere!==void 0?(b.boundingSphere===null&&b.computeBoundingSphere(),wt.copy(b.boundingSphere.center)):(be.boundingSphere===null&&be.computeBoundingSphere(),wt.copy(be.boundingSphere.center)),wt.applyMatrix4(b.matrixWorld).applyMatrix4(Ke)),Array.isArray(xe)){let we=be.groups;for(let Ie=0,Xe=we.length;Ie<Xe;Ie++){let et=we[Ie],Pe=xe[et.materialIndex];Pe&&Pe.visible&&E.push(b,be,Pe,V,wt.z,et,P)}}else xe.visible&&E.push(b,be,xe,V,wt.z,null,P)}}let he=b.children;for(let be=0,xe=he.length;be<xe;be++)Ss(he[be],P,V,k)}function Sr(b,P,V,k){let{opaque:H,transmissive:he,transparent:be}=b;M.setupLightsView(V),Je===!0&&Re.setGlobalState(I.clippingPlanes,V),k&&v.viewport(ne.copy(k)),H.length>0&&ji(H,P,V),he.length>0&&ji(he,P,V),be.length>0&&ji(be,P,V),v.buffers.depth.setTest(!0),v.buffers.depth.setMask(!0),v.buffers.color.setMask(!0),v.setPolygonOffset(!1)}function br(b,P,V,k){if((V.isScene===!0?V.overrideMaterial:null)!==null)return;if(M.state.transmissionRenderTarget[k.id]===void 0){let Pe=We.has("EXT_color_buffer_half_float")||We.has("EXT_color_buffer_float");M.state.transmissionRenderTarget[k.id]=new kt(1,1,{generateMipmaps:!0,type:Pe?en:vn,minFilter:Kn,samples:Math.max(4,R.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Ge.workingColorSpace})}let he=M.state.transmissionRenderTarget[k.id],be=k.viewport||ne;he.setSize(be.z*I.transmissionResolutionScale,be.w*I.transmissionResolutionScale);let xe=I.getRenderTarget(),we=I.getActiveCubeFace(),Ie=I.getActiveMipmapLevel();I.setRenderTarget(he),I.getClearColor(Fe),Be=I.getClearAlpha(),Be<1&&I.setClearColor(16777215,.5),I.clear(),lt&&ze.render(V);let Xe=I.toneMapping;I.toneMapping=Yn;let et=k.viewport;if(k.viewport!==void 0&&(k.viewport=void 0),M.setupLightsView(k),Je===!0&&Re.setGlobalState(I.clippingPlanes,k),ji(b,V,k),Y.updateMultisampleRenderTarget(he),Y.updateRenderTargetMipmap(he),We.has("WEBGL_multisampled_render_to_texture")===!1){let Pe=!1;for(let ht=0,Ft=P.length;ht<Ft;ht++){let Et=P[ht],{object:xt,geometry:tn,material:Ee,group:an}=Et;if(Ee.side===Ht&&xt.layers.test(k.layers)){let it=Ee.side;Ee.side=Wt,Ee.needsUpdate=!0,Ri(xt,V,k,tn,Ee,an),Ee.side=it,Ee.needsUpdate=!0,Pe=!0}}Pe===!0&&(Y.updateMultisampleRenderTarget(he),Y.updateRenderTargetMipmap(he))}I.setRenderTarget(xe,we,Ie),I.setClearColor(Fe,Be),et!==void 0&&(k.viewport=et),I.toneMapping=Xe}function ji(b,P,V){let k=P.isScene===!0?P.overrideMaterial:null;for(let H=0,he=b.length;H<he;H++){let be=b[H],{object:xe,geometry:we,group:Ie}=be,Xe=be.material;Xe.allowOverride===!0&&k!==null&&(Xe=k),xe.layers.test(V.layers)&&Ri(xe,P,V,we,Xe,Ie)}}function Ri(b,P,V,k,H,he){U!==null&&H.isNodeMaterial&&U.setObject(b,H),b.onBeforeRender(I,P,V,k,H,he),b.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,b.matrixWorld),b.normalMatrix.getNormalMatrix(b.modelViewMatrix),H.onBeforeRender(I,P,V,k,b,he),H.transparent===!0&&H.side===Ht&&H.forceSinglePass===!1?(H.side=Wt,H.needsUpdate=!0,I.renderBufferDirect(V,P,k,H,b,he),H.side=ii,H.needsUpdate=!0,I.renderBufferDirect(V,P,k,H,b,he),H.side=Ht):I.renderBufferDirect(V,P,k,H,b,he),b.onAfterRender(I,P,V,k,H,he)}function te(b,P,V){P.isScene!==!0&&(P=Qt);let k=W.get(b),H=M.state.lights,he=M.state.shadowsArray,be=H.state.version,xe=de.getParameters(b,H.state,he,P,V,M.state.lightProbeGridArray),we=de.getProgramCacheKey(xe),Ie=k.programs;k.environment=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?P.environment:null,k.fog=P.fog;let Xe=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap;k.envMap=oe.get(b.envMap||k.environment,Xe),k.envMapRotation=k.environment!==null&&b.envMap===null?P.environmentRotation:b.envMapRotation,Ie===void 0&&(b.addEventListener("dispose",yn),Ie=new Map,k.programs=Ie);let et=Ie.get(we);if(et!==void 0){if(k.currentProgram===et&&k.lightsStateVersion===be)return Se(b,xe),et}else xe.uniforms=de.getUniforms(b),U!==null&&b.isNodeMaterial&&U.build(b,V,xe),b.onBeforeCompile(xe,I),et=de.acquireProgram(xe,we),Ie.set(we,et),k.uniforms=xe.uniforms;let Pe=k.uniforms;return(!b.isShaderMaterial&&!b.isRawShaderMaterial||b.clipping===!0)&&(Pe.clippingPlanes=Re.uniform),Se(b,xe),k.needsLights=fn(b),k.lightsStateVersion=be,k.needsLights&&(Pe.ambientLightColor.value=H.state.ambient,Pe.lightProbe.value=H.state.probe,Pe.sunLights.value=H.state.sun,Pe.sunLightShadows.value=H.state.sunShadow,Pe.directionalLights.value=H.state.directional,Pe.directionalLightShadows.value=H.state.directionalShadow,Pe.spotLights.value=H.state.spot,Pe.spotLightShadows.value=H.state.spotShadow,Pe.rectAreaLights.value=H.state.rectArea,Pe.ltc_1.value=H.state.rectAreaLTC1,Pe.ltc_2.value=H.state.rectAreaLTC2,Pe.pointLights.value=H.state.point,Pe.pointLightShadows.value=H.state.pointShadow,Pe.hemisphereLights.value=H.state.hemi,Pe.sunShadowMatrix.value=H.state.sunShadowMatrix,Pe.sunShadowCascade.value=H.state.sunShadowCascade,Pe.directionalShadowMatrix.value=H.state.directionalShadowMatrix,Pe.spotLightMatrix.value=H.state.spotLightMatrix,Pe.spotLightMap.value=H.state.spotLightMap,Pe.pointShadowMatrix.value=H.state.pointShadowMatrix),k.lightProbeGrid=M.state.lightProbeGridArray.length>0,k.currentProgram=et,k.uniformsList=null,et}function ge(b){if(b.uniformsList===null){let P=b.currentProgram.getUniforms();b.uniformsList=dr.seqWithValue(P.seq,b.uniforms)}return b.uniformsList}function Se(b,P){let V=W.get(b);V.outputColorSpace=P.outputColorSpace,V.batching=P.batching,V.batchingColor=P.batchingColor,V.instancing=P.instancing,V.instancingColor=P.instancingColor,V.instancingMorph=P.instancingMorph,V.skinning=P.skinning,V.morphTargets=P.morphTargets,V.morphNormals=P.morphNormals,V.morphColors=P.morphColors,V.morphTargetsCount=P.morphTargetsCount,V.numClippingPlanes=P.numClippingPlanes,V.numIntersection=P.numClipIntersection,V.vertexAlphas=P.vertexAlphas,V.vertexTangents=P.vertexTangents,V.toneMapping=P.toneMapping}function rt(b,P){if(b.length===0)return null;if(b.length===1)return b[0].texture!==null?b[0]:null;y.setFromMatrixPosition(P.matrixWorld);for(let V=0,k=b.length;V<k;V++){let H=b[V];if(H.texture!==null&&H.boundingBox.containsPoint(y))return H}return null}function on(b,P,V,k,H){P.isScene!==!0&&(P=Qt),Y.resetTextureUnits();let he=P.fog,be=k.isMeshStandardMaterial||k.isMeshLambertMaterial||k.isMeshPhongMaterial?P.environment:null,xe=j===null?I.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Ge.workingColorSpace,we=k.isMeshStandardMaterial||k.isMeshLambertMaterial&&!k.envMap||k.isMeshPhongMaterial&&!k.envMap,Ie=oe.get(k.envMap||be,we),Xe=k.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,et=!!V.attributes.tangent&&(!!k.normalMap||k.anisotropy>0),Pe=!!V.morphAttributes.position,ht=!!V.morphAttributes.normal,Ft=!!V.morphAttributes.color,Et=Yn;k.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Et=I.toneMapping);let xt=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,tn=xt!==void 0?xt.length:0,Ee=W.get(k),an=M.state.lights;if(Je===!0&&(ut===!0||b!==$)){let St=b===$&&k.id===X;Re.setState(k,b,St)}let it=!1;k.version===Ee.__version?(Ee.needsLights&&Ee.lightsStateVersion!==an.state.version||Ee.outputColorSpace!==xe||H.isBatchedMesh&&Ee.batching===!1||!H.isBatchedMesh&&Ee.batching===!0||H.isBatchedMesh&&Ee.batchingColor===!0&&H._colorsTexture===null||H.isBatchedMesh&&Ee.batchingColor===!1&&H._colorsTexture!==null||H.isInstancedMesh&&Ee.instancing===!1||!H.isInstancedMesh&&Ee.instancing===!0||H.isSkinnedMesh&&Ee.skinning===!1||!H.isSkinnedMesh&&Ee.skinning===!0||H.isInstancedMesh&&Ee.instancingColor===!0&&H.instanceColor===null||H.isInstancedMesh&&Ee.instancingColor===!1&&H.instanceColor!==null||H.isInstancedMesh&&Ee.instancingMorph===!0&&H.morphTexture===null||H.isInstancedMesh&&Ee.instancingMorph===!1&&H.morphTexture!==null||Ee.envMap!==Ie||k.fog===!0&&Ee.fog!==he||Ee.numClippingPlanes!==void 0&&(Ee.numClippingPlanes!==Re.numPlanes||Ee.numIntersection!==Re.numIntersection)||Ee.vertexAlphas!==Xe||Ee.vertexTangents!==et||Ee.morphTargets!==Pe||Ee.morphNormals!==ht||Ee.morphColors!==Ft||Ee.toneMapping!==Et||Ee.morphTargetsCount!==tn||!!Ee.lightProbeGrid!=M.state.lightProbeGridArray.length>0)&&(it=!0):(it=!0,Ee.__version=k.version);let An=Ee.currentProgram;it===!0&&(An=te(k,P,H),U&&k.isNodeMaterial&&U.onUpdateProgram(k,An,Ee));let Jn=!1,Ci=!1,bs=!1,mt=An.getUniforms(),Ct=Ee.uniforms;if(v.useProgram(An.program)&&(Jn=!0,Ci=!0,bs=!0),k.id!==X&&(X=k.id,Ci=!0),Ee.needsLights){let St=rt(M.state.lightProbeGridArray,H);Ee.lightProbeGrid!==St&&(Ee.lightProbeGrid=St,Ci=!0)}if(Jn||$!==b){v.buffers.depth.getReversed()&&b.reversedDepth!==!0&&(b._reversedDepth=!0,b.updateProjectionMatrix()),mt.setValue(D,"projectionMatrix",b.projectionMatrix),mt.setValue(D,"viewMatrix",b.matrixWorldInverse);let Pi=mt.map.cameraPosition;Pi!==void 0&&Pi.setValue(D,tt.setFromMatrixPosition(b.matrixWorld)),R.logarithmicDepthBuffer&&mt.setValue(D,"logDepthBufFC",2/(Math.log(b.far+1)/Math.LN2)),(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial)&&mt.setValue(D,"isOrthographic",b.isOrthographicCamera===!0),$!==b&&($=b,Ci=!0,bs=!0)}if(Ee.needsLights&&(an.state.sunShadowMap.length>0&&mt.setValue(D,"sunShadowMap",an.state.sunShadowMap,Y),an.state.directionalShadowMap.length>0&&mt.setValue(D,"directionalShadowMap",an.state.directionalShadowMap,Y),an.state.spotShadowMap.length>0&&mt.setValue(D,"spotShadowMap",an.state.spotShadowMap,Y),an.state.pointShadowMap.length>0&&mt.setValue(D,"pointShadowMap",an.state.pointShadowMap,Y)),H.isSkinnedMesh){mt.setOptional(D,H,"bindMatrix"),mt.setOptional(D,H,"bindMatrixInverse");let St=H.skeleton;St&&(St.boneTexture===null&&St.computeBoneTexture(),mt.setValue(D,"boneTexture",St.boneTexture,Y))}H.isBatchedMesh&&(mt.setOptional(D,H,"batchingTexture"),mt.setValue(D,"batchingTexture",H._matricesTexture,Y),mt.setOptional(D,H,"batchingIdTexture"),mt.setValue(D,"batchingIdTexture",H._indirectTexture,Y),mt.setOptional(D,H,"batchingColorTexture"),H._colorsTexture!==null&&mt.setValue(D,"batchingColorTexture",H._colorsTexture,Y));let Ii=V.morphAttributes;if((Ii.position!==void 0||Ii.normal!==void 0||Ii.color!==void 0)&&F.update(H,V,An),(Ci||Ee.receiveShadow!==H.receiveShadow)&&(Ee.receiveShadow=H.receiveShadow,mt.setValue(D,"receiveShadow",H.receiveShadow)),(k.isMeshStandardMaterial||k.isMeshLambertMaterial||k.isMeshPhongMaterial)&&k.envMap===null&&P.environment!==null&&(Ct.envMapIntensity.value=P.environmentIntensity),Ct.dfgLUT!==void 0&&(Ct.dfgLUT.value=Xx()),Ci){if(mt.setValue(D,"toneMappingExposure",I.toneMappingExposure),Ee.needsLights&&zn(Ct,bs),he&&k.fog===!0&&Ae.refreshFogUniforms(Ct,he),Ae.refreshMaterialUniforms(Ct,k,ee,K,M.state.transmissionRenderTarget[b.id]),Ee.needsLights&&Ee.lightProbeGrid){let St=Ee.lightProbeGrid;Ct.probesSH.value=St.texture,Ct.probesMin.value.copy(St.boundingBox.min),Ct.probesMax.value.copy(St.boundingBox.max),Ct.probesResolution.value.copy(St.resolution)}dr.upload(D,ge(Ee),Ct,Y)}if(k.isShaderMaterial&&k.uniformsNeedUpdate===!0&&(dr.upload(D,ge(Ee),Ct,Y),k.uniformsNeedUpdate=!1),k.isSpriteMaterial&&mt.setValue(D,"center",H.center),mt.setValue(D,"modelViewMatrix",H.modelViewMatrix),mt.setValue(D,"normalMatrix",H.normalMatrix),mt.setValue(D,"modelMatrix",H.matrixWorld),k.uniformsGroups!==void 0){let St=k.uniformsGroups;for(let Pi=0,Ts=St.length;Pi<Ts;Pi++){let au=St[Pi];se.update(au,An),se.bind(au,An)}}return An}function zn(b,P){b.ambientLightColor.needsUpdate=P,b.lightProbe.needsUpdate=P,b.sunLights.needsUpdate=P,b.sunLightShadows.needsUpdate=P,b.directionalLights.needsUpdate=P,b.directionalLightShadows.needsUpdate=P,b.pointLights.needsUpdate=P,b.pointLightShadows.needsUpdate=P,b.spotLights.needsUpdate=P,b.spotLightShadows.needsUpdate=P,b.rectAreaLights.needsUpdate=P,b.hemisphereLights.needsUpdate=P}function fn(b){return b.isMeshLambertMaterial||b.isMeshToonMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isShadowMaterial||b.isShaderMaterial&&b.lights===!0}this.getActiveCubeFace=function(){return q},this.getActiveMipmapLevel=function(){return G},this.getRenderTarget=function(){return j},this.setRenderTargetTextures=function(b,P,V){let k=W.get(b);k.__autoAllocateDepthBuffer=b.resolveDepthBuffer===!1,k.__autoAllocateDepthBuffer===!1&&(k.__useRenderToTexture=!1),W.get(b.texture).__webglTexture=P,W.get(b.depthTexture).__webglTexture=k.__autoAllocateDepthBuffer?void 0:V,k.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(b,P){let V=W.get(b);V.__webglFramebuffer=P,V.__useDefaultFramebuffer=P===void 0},this.setRenderTarget=function(b,P=0,V=0){j=b,q=P,G=V;let k=null,H=!1,he=!1;if(b){let xe=W.get(b);if(xe.__useDefaultFramebuffer!==void 0){v.bindFramebuffer(D.FRAMEBUFFER,xe.__webglFramebuffer),ne.copy(b.viewport),Te.copy(b.scissor),le=b.scissorTest,v.viewport(ne),v.scissor(Te),v.setScissorTest(le),X=-1;return}else if(xe.__webglFramebuffer===void 0)Y.setupRenderTarget(b);else if(xe.__hasExternalTextures)Y.rebindTextures(b,W.get(b.texture).__webglTexture,W.get(b.depthTexture).__webglTexture);else if(b.depthBuffer){let Xe=b.depthTexture;if(xe.__boundDepthTexture!==Xe){if(Xe!==null&&W.has(Xe)&&(b.width!==Xe.image.width||b.height!==Xe.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Y.setupDepthRenderbuffer(b)}}let we=b.texture;(we.isData3DTexture||we.isDataArrayTexture||we.isCompressedArrayTexture)&&(he=!0);let Ie=W.get(b).__webglFramebuffer;b.isWebGLCubeRenderTarget?(Array.isArray(Ie[P])?k=Ie[P][V]:k=Ie[P],H=!0):b.samples>0&&Y.useMultisampledRTT(b)===!1?k=W.get(b).__webglMultisampledFramebuffer:Array.isArray(Ie)?k=Ie[V]:k=Ie,ne.copy(b.viewport),Te.copy(b.scissor),le=b.scissorTest}else ne.copy(ie).multiplyScalar(ee).floor(),Te.copy(ce).multiplyScalar(ee).floor(),le=Mt;if(V!==0&&(k=O),v.bindFramebuffer(D.FRAMEBUFFER,k)&&v.drawBuffers(b,k),v.viewport(ne),v.scissor(Te),v.setScissorTest(le),H){let xe=W.get(b.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+P,xe.__webglTexture,V)}else if(he){let xe=P;for(let we=0;we<b.textures.length;we++){let Ie=W.get(b.textures[we]);D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0+we,Ie.__webglTexture,V,xe)}}else if(b!==null&&V!==0){let xe=W.get(b.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,xe.__webglTexture,V)}X=-1};function hi(b){let P=W.get(b);return(P.__readFormat!==b.format||P.__readType!==b.type)&&(P.__readFormat=b.format,P.__readType=b.type,P.__formatReadable=R.textureFormatReadable(b.format),P.__typeReadable=R.textureTypeReadable(b.type)),P}this.readRenderTargetPixels=function(b,P,V,k,H,he,be,xe=0){if(!(b&&b.isWebGLRenderTarget)){ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let we=W.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&be!==void 0&&(we=we[be]),we){v.bindFramebuffer(D.FRAMEBUFFER,we);try{let Ie=b.textures[xe],Xe=Ie.format,et=Ie.type;b.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+xe);let Pe=hi(Ie);if(Pe.__formatReadable===!1){ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Pe.__typeReadable===!1){ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}P>=0&&P<=b.width-k&&V>=0&&V<=b.height-H&&D.readPixels(P,V,k,H,pe.convert(Xe),pe.convert(et),he)}finally{let Ie=j!==null?W.get(j).__webglFramebuffer:null;v.bindFramebuffer(D.FRAMEBUFFER,Ie)}}},this.readRenderTargetPixelsAsync=async function(b,P,V,k,H,he,be,xe=0){if(!(b&&b.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let we=W.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&be!==void 0&&(we=we[be]),we)if(P>=0&&P<=b.width-k&&V>=0&&V<=b.height-H){v.bindFramebuffer(D.FRAMEBUFFER,we);let Ie=b.textures[xe],Xe=Ie.format,et=Ie.type;b.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+xe);let Pe=hi(Ie);if(Pe.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Pe.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let ht=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,ht),D.bufferData(D.PIXEL_PACK_BUFFER,he.byteLength,D.STREAM_READ),D.readPixels(P,V,k,H,pe.convert(Xe),pe.convert(et),0),D.bindBuffer(D.PIXEL_PACK_BUFFER,null);let Ft=j!==null?W.get(j).__webglFramebuffer:null;v.bindFramebuffer(D.FRAMEBUFFER,Ft);let Et=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await Ld(D,Et,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,ht),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,he),D.bindBuffer(D.PIXEL_PACK_BUFFER,null),D.deleteBuffer(ht),D.deleteSync(Et),he}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(b,P=null,V=0){let k=Math.pow(2,-V),H=Math.floor(b.image.width*k),he=Math.floor(b.image.height*k),be=P!==null?P.x:0,xe=P!==null?P.y:0;Y.setTexture2D(b,0),D.copyTexSubImage2D(D.TEXTURE_2D,V,0,0,be,xe,H,he),v.unbindTexture()},this.copyTextureToTexture=function(b,P,V=null,k=null,H=0,he=0){let be,xe,we,Ie,Xe,et,Pe,ht,Ft,Et=b.isCompressedTexture?b.mipmaps[he]:b.image;if(V!==null)be=V.max.x-V.min.x,xe=V.max.y-V.min.y,we=V.isBox3?V.max.z-V.min.z:1,Ie=V.min.x,Xe=V.min.y,et=V.isBox3?V.min.z:0;else{let Ct=Math.pow(2,-H);be=Math.floor(Et.width*Ct),xe=Math.floor(Et.height*Ct),b.isDataArrayTexture?we=Et.depth:b.isData3DTexture?we=Math.floor(Et.depth*Ct):we=1,Ie=0,Xe=0,et=0}k!==null?(Pe=k.x,ht=k.y,Ft=k.z):(Pe=0,ht=0,Ft=0);let xt=pe.convert(P.format),tn=pe.convert(P.type),Ee;P.isData3DTexture?(Y.setTexture3D(P,0),Ee=D.TEXTURE_3D):P.isDataArrayTexture||P.isCompressedArrayTexture?(Y.setTexture2DArray(P,0),Ee=D.TEXTURE_2D_ARRAY):(Y.setTexture2D(P,0),Ee=D.TEXTURE_2D),v.activeTexture(D.TEXTURE0),v.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,P.flipY),v.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,P.premultiplyAlpha),v.pixelStorei(D.UNPACK_ALIGNMENT,P.unpackAlignment);let an=v.getParameter(D.UNPACK_ROW_LENGTH),it=v.getParameter(D.UNPACK_IMAGE_HEIGHT),An=v.getParameter(D.UNPACK_SKIP_PIXELS),Jn=v.getParameter(D.UNPACK_SKIP_ROWS),Ci=v.getParameter(D.UNPACK_SKIP_IMAGES);v.pixelStorei(D.UNPACK_ROW_LENGTH,Et.width),v.pixelStorei(D.UNPACK_IMAGE_HEIGHT,Et.height),v.pixelStorei(D.UNPACK_SKIP_PIXELS,Ie),v.pixelStorei(D.UNPACK_SKIP_ROWS,Xe),v.pixelStorei(D.UNPACK_SKIP_IMAGES,et);let bs=b.isDataArrayTexture||b.isData3DTexture,mt=P.isDataArrayTexture||P.isData3DTexture;if(b.isDepthTexture){let Ct=W.get(b),Ii=W.get(P),St=W.get(Ct.__renderTarget),Pi=W.get(Ii.__renderTarget);v.bindFramebuffer(D.READ_FRAMEBUFFER,St.__webglFramebuffer),v.bindFramebuffer(D.DRAW_FRAMEBUFFER,Pi.__webglFramebuffer);for(let Ts=0;Ts<we;Ts++)bs&&(D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,W.get(b).__webglTexture,H,et+Ts),D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,W.get(P).__webglTexture,he,Ft+Ts)),D.blitFramebuffer(Ie,Xe,be,xe,Pe,ht,be,xe,D.DEPTH_BUFFER_BIT,D.NEAREST);v.bindFramebuffer(D.READ_FRAMEBUFFER,null),v.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else if(H!==0||b.isRenderTargetTexture||W.has(b)){let Ct=W.get(b),Ii=W.get(P);v.bindFramebuffer(D.READ_FRAMEBUFFER,N),v.bindFramebuffer(D.DRAW_FRAMEBUFFER,B);for(let St=0;St<we;St++)bs?D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Ct.__webglTexture,H,et+St):D.framebufferTexture2D(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,Ct.__webglTexture,H),mt?D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Ii.__webglTexture,he,Ft+St):D.framebufferTexture2D(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,Ii.__webglTexture,he),H!==0?D.blitFramebuffer(Ie,Xe,be,xe,Pe,ht,be,xe,D.COLOR_BUFFER_BIT,D.NEAREST):mt?D.copyTexSubImage3D(Ee,he,Pe,ht,Ft+St,Ie,Xe,be,xe):D.copyTexSubImage2D(Ee,he,Pe,ht,Ie,Xe,be,xe);v.bindFramebuffer(D.READ_FRAMEBUFFER,null),v.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else mt?b.isDataTexture||b.isData3DTexture?D.texSubImage3D(Ee,he,Pe,ht,Ft,be,xe,we,xt,tn,Et.data):P.isCompressedArrayTexture?D.compressedTexSubImage3D(Ee,he,Pe,ht,Ft,be,xe,we,xt,Et.data):D.texSubImage3D(Ee,he,Pe,ht,Ft,be,xe,we,xt,tn,Et):b.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,he,Pe,ht,be,xe,xt,tn,Et.data):b.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,he,Pe,ht,Et.width,Et.height,xt,Et.data):D.texSubImage2D(D.TEXTURE_2D,he,Pe,ht,be,xe,xt,tn,Et);v.pixelStorei(D.UNPACK_ROW_LENGTH,an),v.pixelStorei(D.UNPACK_IMAGE_HEIGHT,it),v.pixelStorei(D.UNPACK_SKIP_PIXELS,An),v.pixelStorei(D.UNPACK_SKIP_ROWS,Jn),v.pixelStorei(D.UNPACK_SKIP_IMAGES,Ci),he===0&&P.generateMipmaps&&D.generateMipmap(Ee),v.unbindTexture()},this.initRenderTarget=function(b){W.get(b).__webglFramebuffer===void 0&&Y.setupRenderTarget(b)},this.initTexture=function(b){b.isCubeTexture?Y.setTextureCube(b,0):b.isData3DTexture?Y.setTexture3D(b,0):b.isDataArrayTexture||b.isCompressedArrayTexture?Y.setTexture2DArray(b,0):Y.setTexture2D(b,0),v.unbindTexture()},this.resetState=function(){q=0,G=0,j=null,v.reset(),_e.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Xn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ge._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ge._getUnpackColorSpace()}};function Sh(s,e){if(e===jc)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),s;if(e===cr||e===wo){let t=s.getIndex();if(t===null){let r=[],o=s.getAttribute("position");if(o!==void 0){for(let a=0;a<o.count;a++)r.push(a);s.setIndex(r),t=s.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),s}let n=t.count-2,i=[];if(e===cr)for(let r=1;r<=n;r++)i.push(t.getX(0)),i.push(t.getX(r)),i.push(t.getX(r+1));else for(let r=0;r<n;r++)r%2===0?(i.push(t.getX(r)),i.push(t.getX(r+1)),i.push(t.getX(r+2))):(i.push(t.getX(r+2)),i.push(t.getX(r+1)),i.push(t.getX(r)));return i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles."),s.setIndex(i),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),s}function df(s){let e=new Map,t=new Map,n=s.clone();return ff(s,n,function(i,r){e.set(r,i),t.set(i,r)}),n.traverse(function(i){if(!i.isSkinnedMesh)return;let r=i,o=e.get(i),a=o.skeleton.bones;r.skeleton=o.skeleton.clone(),r.bindMatrix.copy(o.bindMatrix),r.skeleton.bones=a.map(function(l){return t.get(l)}),r.bind(r.skeleton,r.bindMatrix)}),n}function ff(s,e,t){t(s,e);for(let n=0;n<s.children.length;n++)ff(s.children[n],e.children[n],t)}var Bl=class extends ni{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new Ch(t)}),this.register(function(t){return new Ih(t)}),this.register(function(t){return new zh(t)}),this.register(function(t){return new kh(t)}),this.register(function(t){return new Hh(t)}),this.register(function(t){return new Lh(t)}),this.register(function(t){return new Nh(t)}),this.register(function(t){return new Dh(t)}),this.register(function(t){return new Uh(t)}),this.register(function(t){return new Rh(t)}),this.register(function(t){return new Fh(t)}),this.register(function(t){return new Ph(t)}),this.register(function(t){return new Bh(t)}),this.register(function(t){return new Oh(t)}),this.register(function(t){return new wh(t)}),this.register(function(t){return new zl(t,je.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new zl(t,je.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new Vh(t)})}load(e,t,n,i){let r=this,o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){let c=Ti.extractUrlBase(e);o=Ti.resolveURL(c,this.path)}else o=Ti.extractUrlBase(e);this.manager.itemStart(e);let a=function(c){i?i(c):console.error(c),r.manager.itemError(e),r.manager.itemEnd(e)},l=new nr(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{r.parse(c,o,function(h){t(h),r.manager.itemEnd(e)},a)}catch(h){a(h)}},n,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let r,o={},a={},l=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===xf){try{o[je.KHR_BINARY_GLTF]=new Gh(e)}catch(d){i&&i(d);return}r=JSON.parse(o[je.KHR_BINARY_GLTF].content)}else r=JSON.parse(l.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let c=new Jh(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){let d=this.pluginCallbacks[h](c);d.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[d.name]=d,o[d.name]=!0}if(r.extensionsUsed)for(let h=0;h<r.extensionsUsed.length;++h){let d=r.extensionsUsed[h],u=r.extensionsRequired||[];switch(d){case je.KHR_MATERIALS_UNLIT:o[d]=new Ah;break;case je.KHR_DRACO_MESH_COMPRESSION:o[d]=new Wh(r,this.dracoLoader);break;case je.KHR_TEXTURE_TRANSFORM:o[d]=new Xh;break;case je.KHR_MESH_QUANTIZATION:o[d]=new qh;break;default:u.indexOf(d)>=0&&a[d]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+d+'".')}}c.setExtensions(o),c.setPlugins(a),c.parse(n,i)}parseAsync(e,t){let n=this;return new Promise(function(i,r){n.parse(e,t,i,r)})}};function qx(){let s={};return{get:function(e){return s[e]},add:function(e,t){s[e]=t},remove:function(e){delete s[e]},removeAll:function(){s={}}}}function Nt(s,e,t){let n=s.json.materials[e];return n.extensions&&n.extensions[t]?n.extensions[t]:null}var je={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},wh=class{constructor(e){this.parser=e,this.name=je.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){let r=t[n];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){let t=this.parser,n="light:"+e,i=t.cache.get(n);if(i)return i;let r=t.json,l=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e],c,h=new Ce(16777215);l.color!==void 0&&h.setRGB(l.color[0],l.color[1],l.color[2],cn);let d=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new Gi(h),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new xn(h),c.distance=d;break;case"spot":c=new lo(h),c.distance=d,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),ai(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),i=Promise.resolve(c),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,n=this.parser,r=n.json.nodes[e],a=(r.extensions&&r.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(l){return n._getNodeRef(t.cache,a,l)})}},Ah=class{constructor(){this.name=je.KHR_MATERIALS_UNLIT}getMaterialType(){return Gt}extendParams(e,t,n){let i=[];e.color=new Ce(1,1,1),e.opacity=1;let r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){let o=r.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],cn),e.opacity=o[3]}r.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",r.baseColorTexture,It))}return Promise.all(i)}},Rh=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}},Ch=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatMap",n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(i.push(this.parser.assignTexture(t,"clearcoatNormalMap",n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){let r=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new ae(r,r)}return Promise.all(i)}},Ih=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_DISPERSION}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion!==void 0?n.dispersion:0),Promise.resolve()}},Ph=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceMap",n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceThicknessMap",n.iridescenceThicknessTexture)),Promise.all(i)}},Lh=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_SHEEN}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];if(t.sheenColor=new Ce(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){let r=n.sheenColorFactor;t.sheenColor.setRGB(r[0],r[1],r[2],cn)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenColorMap",n.sheenColorTexture,It)),n.sheenRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenRoughnessMap",n.sheenRoughnessTexture)),Promise.all(i)}},Nh=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&i.push(this.parser.assignTexture(t,"transmissionMap",n.transmissionTexture)),Promise.all(i)}},Dh=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_VOLUME}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];t.thickness=n.thicknessFactor!==void 0?n.thicknessFactor:0,n.thicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"thicknessMap",n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;let r=n.attenuationColor||[1,1,1];return t.attenuationColor=new Ce().setRGB(r[0],r[1],r[2],cn),Promise.all(i)}},Uh=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_IOR}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);return n===null||(t.ior=n.ior!==void 0?n.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}},Fh=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_SPECULAR}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];t.specularIntensity=n.specularFactor!==void 0?n.specularFactor:1,n.specularTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularIntensityMap",n.specularTexture));let r=n.specularColorFactor||[1,1,1];return t.specularColor=new Ce().setRGB(r[0],r[1],r[2],cn),n.specularColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularColorMap",n.specularColorTexture,It)),Promise.all(i)}},Oh=class{constructor(e){this.parser=e,this.name=je.EXT_MATERIALS_BUMP}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return t.bumpScale=n.bumpFactor!==void 0?n.bumpFactor:1,n.bumpTexture!==void 0&&i.push(this.parser.assignTexture(t,"bumpMap",n.bumpTexture)),Promise.all(i)}},Bh=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return Nt(this.parser,e,this.name)!==null?gn:null}extendMaterialParams(e,t){let n=Nt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&i.push(this.parser.assignTexture(t,"anisotropyMap",n.anisotropyTexture)),Promise.all(i)}},zh=class{constructor(e){this.parser=e,this.name=je.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;let r=i.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,o)}},kh=class{constructor(e){this.parser=e,this.name=je.EXT_TEXTURE_WEBP}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],l=n.textureLoader;if(a.uri){let c=n.options.manager.getHandler(a.uri);c!==null&&(l=c)}return n.loadTextureImage(e,o.source,l)}},Hh=class{constructor(e){this.parser=e,this.name=je.EXT_TEXTURE_AVIF}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],l=n.textureLoader;if(a.uri){let c=n.options.manager.getHandler(a.uri);c!==null&&(l=c)}return n.loadTextureImage(e,o.source,l)}},zl=class{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){let t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){let i=n.extensions[this.name],r=this.parser.getDependency("buffer",i.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(a){let l=i.byteOffset||0,c=i.byteLength||0,h=i.count,d=i.byteStride,u=new Uint8Array(a,l,c);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(h,d,u,i.mode,i.filter).then(function(f){return f.buffer}):o.ready.then(function(){let f=new ArrayBuffer(h*d);return o.decodeGltfBuffer(new Uint8Array(f),h,d,u,i.mode,i.filter),f})})}else return null}},Vh=class{constructor(e){this.name=je.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;let i=t.meshes[n.mesh];for(let c of i.primitives)if(c.mode!==Dn.TRIANGLES&&c.mode!==Dn.TRIANGLE_STRIP&&c.mode!==Dn.TRIANGLE_FAN&&c.mode!==void 0)return null;let o=n.extensions[this.name].attributes,a=[],l={};for(let c in o)a.push(this.parser.getDependency("accessor",o[c]).then(h=>(l[c]=h,l[c])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(c=>{let h=c.pop(),d=h.isGroup?h.children:[h],u=c[0].count,f=[];for(let g of d){let x=new Oe,p=new C,m=new zt,S=new C(1,1,1),T=new dn(g.geometry,g.material,u);for(let E=0;E<u;E++)l.TRANSLATION&&p.fromBufferAttribute(l.TRANSLATION,E),l.ROTATION&&m.fromBufferAttribute(l.ROTATION,E),l.SCALE&&S.fromBufferAttribute(l.SCALE,E),T.setMatrixAt(E,x.compose(p,m,S));let y=null;for(let E in l)if(E==="_COLOR_0"){let M=l[E];T.instanceColor=new xi(M.array,M.itemSize,M.normalized)}else if(E!=="TRANSLATION"&&E!=="ROTATION"&&E!=="SCALE"){if(y===null){let A=T.geometry;y=new gt,y.name=A.name;for(let _ in A.attributes)y.setAttribute(_,A.attributes[_]);for(let _ in A.morphAttributes)y.morphAttributes[_]=A.morphAttributes[_];A.index!==null&&y.setIndex(A.index),y.morphTargetsRelative=A.morphTargetsRelative;for(let _ of A.groups)y.addGroup(_.start,_.count,_.materialIndex);A.boundingBox!==null&&(y.boundingBox=A.boundingBox.clone()),A.boundingSphere!==null&&(y.boundingSphere=A.boundingSphere.clone()),y.drawRange.start=A.drawRange.start,y.drawRange.count=A.drawRange.count,y.userData=Object.assign({},A.userData),T.geometry=y}let M=l[E];y.setAttribute(E,new xi(M.array,M.itemSize,M.normalized))}bt.prototype.copy.call(T,g),this.parser.assignFinalMaterial(T),f.push(T)}return h.isGroup?(h.clear(),h.add(...f),h):f[0]}))}},xf="glTF",Lo=12,pf={JSON:1313821514,BIN:5130562},Gh=class{constructor(e){this.name=je.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,Lo),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==xf)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let i=this.header.length-Lo,r=new DataView(e,Lo),o=0;for(;o<i;){let a=r.getUint32(o,!0);o+=4;let l=r.getUint32(o,!0);if(o+=4,l===pf.JSON){let c=new Uint8Array(e,Lo+o,a);this.content=n.decode(c)}else if(l===pf.BIN){let c=Lo+o;this.body=e.slice(c,c+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},Wh=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=je.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let n=this.json,i=this.dracoLoader,r=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},l={},c={};for(let h in o){let d=Kh[h]||h.toLowerCase();a[d]=o[h]}for(let h in e.attributes){let d=Kh[h]||h.toLowerCase();if(o[h]!==void 0){let u=n.accessors[e.attributes[h]],f=gr[u.componentType];c[d]=f.name,l[d]=u.normalized===!0}}return t.getDependency("bufferView",r).then(function(h){return new Promise(function(d,u){i.decodeDracoFile(h,function(f){for(let g in f.attributes){let x=f.attributes[g],p=l[g];p!==void 0&&(x.normalized=p)}d(f)},a,c,cn,u)})})}},Xh=class{constructor(){this.name=je.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){if((t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0)return e;if(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),t.rotation!==void 0){let n=Math.cos(e.rotation),i=Math.sin(e.rotation);e.matrix.set(e.repeat.x*n,e.repeat.y*i,e.offset.x,-e.repeat.x*i,e.repeat.y*n,e.offset.y,0,0,1),e.matrixAutoUpdate=!1}return e.needsUpdate=!0,e}},qh=class{constructor(){this.name=je.KHR_MESH_QUANTIZATION}},kl=class extends ti{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i*3+i;for(let o=0;o!==i;o++)t[o]=n[r+o];return t}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=a*2,c=a*3,h=i-t,d=(n-t)/h,u=d*d,f=u*d,g=e*c,x=g-c,p=-2*f+3*u,m=f-u,S=1-p,T=m-u+d;for(let y=0;y!==a;y++){let E=o[x+y+a],M=o[x+y+l]*h,A=o[g+y+a],_=o[g+y]*h;r[y]=S*E+T*M+p*A+m*_}return r}},Yx=new zt,Yh=class extends kl{interpolate_(e,t,n,i){let r=super.interpolate_(e,t,n,i);return Yx.fromArray(r).normalize().toArray(r),r}},Dn={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},gr={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},mf={9728:Pt,9729:Lt,9984:qa,9985:or,9986:_s,9987:Kn},gf={33071:Cn,33648:Hs,10497:zi},bh={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Kh={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Yi={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},Kx={CUBICSPLINE:void 0,LINEAR:rs,STEP:ss},Th={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function Zx(s){return s.DefaultMaterial===void 0&&(s.DefaultMaterial=new At({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:ii})),s.DefaultMaterial}function ys(s,e,t){for(let n in t.extensions)s[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function ai(s,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(s.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function Jx(s,e,t){let n=!1,i=!1,r=!1;for(let c=0,h=e.length;c<h;c++){let d=e[c];if(d.POSITION!==void 0&&(n=!0),d.NORMAL!==void 0&&(i=!0),d.COLOR_0!==void 0&&(r=!0),n&&i&&r)break}if(!n&&!i&&!r)return Promise.resolve(s);let o=[],a=[],l=[];for(let c=0,h=e.length;c<h;c++){let d=e[c];if(n){let u=d.POSITION!==void 0?t.getDependency("accessor",d.POSITION):s.attributes.position;o.push(u)}if(i){let u=d.NORMAL!==void 0?t.getDependency("accessor",d.NORMAL):s.attributes.normal;a.push(u)}if(r){let u=d.COLOR_0!==void 0?t.getDependency("accessor",d.COLOR_0):s.attributes.color;l.push(u)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l)]).then(function(c){let h=c[0],d=c[1],u=c[2];return n&&(s.morphAttributes.position=h),i&&(s.morphAttributes.normal=d),r&&(s.morphAttributes.color=u),s.morphTargetsRelative=!0,s})}function $x(s,e){if(s.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)s.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(s.morphTargetInfluences.length===t.length){s.morphTargetDictionary={};for(let n=0,i=t.length;n<i;n++)s.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function jx(s){let e,t=s.extensions&&s.extensions[je.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+Eh(t.attributes):e=s.indices+":"+Eh(s.attributes)+":"+s.mode,s.targets!==void 0)for(let n=0,i=s.targets.length;n<i;n++)e+=":"+Eh(s.targets[n]);return e}function Eh(s){let e="",t=Object.keys(s).sort();for(let n=0,i=t.length;n<i;n++)e+=t[n]+":"+s[t[n]]+";";return e}function Zh(s){switch(s){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function Qx(s){return s.search(/\.jpe?g($|\?)/i)>0||s.search(/^data\:image\/jpeg/)===0?"image/jpeg":s.search(/\.webp($|\?)/i)>0||s.search(/^data\:image\/webp/)===0?"image/webp":s.search(/\.ktx2($|\?)/i)>0||s.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var ev=new Oe,Jh=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new qx,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,r=!1,o=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){let a=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(a)===!0;let l=a.match(/Version\/(\d+)/);i=n&&l?parseInt(l[1],10):-1,r=a.indexOf("Firefox")>-1,o=r?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||r&&o<98?this.textureLoader=new ro(this.options.manager):this.textureLoader=new co(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new nr(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let n=this,i=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(o){let a={scene:o[0][i.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:i.asset,parser:n,userData:{}};return ys(r,a,i),ai(a,i),Promise.all(n._invokeAll(function(l){return l.afterRoot&&l.afterRoot(a)})).then(function(){for(let l of a.scenes)l.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,r=t.length;i<r;i++){let o=t[i].joints;for(let a=0,l=o.length;a<l;a++)e[o[a]].isBone=!0}for(let i=0,r=e.length;i<r;i++){let o=e[i];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(n[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;let i=n.clone(),r=(o,a)=>{let l=this.associations.get(o);l!=null&&this.associations.set(a,l);for(let[c,h]of o.children.entries())r(h,a.children[c])};return r(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){let i=e(t[n]);if(i)return i}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let n=[];for(let i=0;i<t.length;i++){let r=e(t[i]);r&&n.push(r)}return n}getDependency(e,t){let n=e+":"+t,i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":i=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){let n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(r,o){return n.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[je.KHR_BINARY_GLTF].body);let i=this.options;return new Promise(function(r,o){n.load(Ti.resolveURL(t.uri,i.path),r,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){let i=t.byteLength||0,r=t.byteOffset||0;return n.slice(r,r+i)})}loadAccessor(e){let t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){let o=bh[i.type],a=gr[i.componentType],l=i.normalized===!0,c=new a(i.count*o);return Promise.resolve(new Vt(c,o,l))}let r=[];return i.bufferView!==void 0?r.push(this.getDependency("bufferView",i.bufferView)):r.push(null),i.sparse!==void 0&&(r.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(r).then(function(o){let a=o[0],l=bh[i.type],c=gr[i.componentType],h=c.BYTES_PER_ELEMENT,d=h*l,u=i.byteOffset||0,f=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,g=i.normalized===!0,x,p;if(f&&f!==d){let m=Math.floor(u/f),S="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+m+":"+i.count,T=t.cache.get(S);T||(x=new c(a,m*f,i.count*f/h),T=new Ys(x,f/h),t.cache.add(S,T)),p=new Ks(T,l,u%f/h,g)}else a===null?x=new c(i.count*l):x=new c(a,u,i.count*l),p=new Vt(x,l,g);if(i.sparse!==void 0){let m=bh.SCALAR,S=gr[i.sparse.indices.componentType],T=i.sparse.indices.byteOffset||0,y=i.sparse.values.byteOffset||0,E=new S(o[1],T,i.sparse.count*m),M=new c(o[2],y,i.sparse.count*l);a!==null&&(p=new Vt(p.array.slice(),p.itemSize,p.normalized)),p.normalized=!1;for(let A=0,_=E.length;A<_;A++){let w=E[A];if(p.setX(w,M[A*l]),l>=2&&p.setY(w,M[A*l+1]),l>=3&&p.setZ(w,M[A*l+2]),l>=4&&p.setW(w,M[A*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}p.normalized=g}return p})}loadTexture(e){let t=this.json,n=this.options,r=t.textures[e].source,o=t.images[r],a=this.textureLoader;if(o.uri){let l=n.manager.getHandler(o.uri);l!==null&&(a=l)}return this.loadTextureImage(e,r,a)}loadTextureImage(e,t,n){let i=this,r=this.json,o=r.textures[e],a=r.images[t],l=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,n).then(function(h){h.flipY=!1,h.name=o.name||a.name||"",h.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(h.name=a.uri);let u=(r.samplers||{})[o.sampler]||{};return h.magFilter=mf[u.magFilter]||Lt,h.minFilter=mf[u.minFilter]||Kn,h.wrapS=gf[u.wrapS]||zi,h.wrapT=gf[u.wrapT]||zi,h.generateMipmaps=!h.isCompressedTexture&&h.minFilter!==Pt&&h.minFilter!==Lt,i.associations.set(h,{textures:e}),h}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let n=this,i=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(d=>d.clone());let o=i.images[e],a=self.URL||self.webkitURL,l=o.uri||"",c=!1;if(o.bufferView!==void 0)l=n.getDependency("bufferView",o.bufferView).then(function(d){c=!0;let u=new Blob([d],{type:o.mimeType});return l=a.createObjectURL(u),l});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let h=Promise.resolve(l).then(function(d){return new Promise(function(u,f){let g=u;t.isImageBitmapLoader===!0&&(g=function(x){let p=new Zt(x);p.needsUpdate=!0,u(p)}),t.load(Ti.resolveURL(d,r.path),g,void 0,f)})}).then(function(d){return c===!0&&a.revokeObjectURL(l),ai(d,o),d.userData.mimeType=o.mimeType||Qx(o.uri),d}).catch(function(d){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),d});return this.sourceCache[e]=h,h}assignTexture(e,t,n,i){let r=this;return this.getDependency("texture",n.index).then(function(o){if(!o)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(o=o.clone(),o.channel=n.texCoord),r.extensions[je.KHR_TEXTURE_TRANSFORM]){let a=n.extensions!==void 0?n.extensions[je.KHR_TEXTURE_TRANSFORM]:void 0;if(a){let l=r.associations.get(o);o=r.extensions[je.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),r.associations.set(o,l)}}return i!==void 0&&(o.colorSpace=i),e[t]=o,o})}assignFinalMaterial(e){let t=e.geometry,n=e.material,i=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){let a="PointsMaterial:"+n.uuid,l=this.cache.get(a);l||(l=new Qs,un.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,l.sizeAttenuation=!1,this.cache.add(a,l)),n=l}else if(e.isLine){let a="LineBasicMaterial:"+n.uuid,l=this.cache.get(a);l||(l=new js,un.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,this.cache.add(a,l)),n=l}if(i||r||o){let a="ClonedMaterial:"+n.uuid+":";i&&(a+="derivative-tangents:"),r&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let l=this.cache.get(a);l||(l=n.clone(),r&&(l.vertexColors=!0),o&&(l.flatShading=!0),i&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(a,l),this.associations.set(l,this.associations.get(n))),n=l}e.material=n}getMaterialType(){return At}loadMaterial(e){let t=this,n=this.json,i=this.extensions,r=n.materials[e],o,a={},l=r.extensions||{},c=[];if(l[je.KHR_MATERIALS_UNLIT]){let d=i[je.KHR_MATERIALS_UNLIT];o=d.getMaterialType(),c.push(d.extendParams(a,r,t))}else{let d=r.pbrMetallicRoughness||{};if(a.color=new Ce(1,1,1),a.opacity=1,Array.isArray(d.baseColorFactor)){let u=d.baseColorFactor;a.color.setRGB(u[0],u[1],u[2],cn),a.opacity=u[3]}d.baseColorTexture!==void 0&&c.push(t.assignTexture(a,"map",d.baseColorTexture,It)),a.metalness=d.metallicFactor!==void 0?d.metallicFactor:1,a.roughness=d.roughnessFactor!==void 0?d.roughnessFactor:1,d.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(a,"metalnessMap",d.metallicRoughnessTexture)),c.push(t.assignTexture(a,"roughnessMap",d.metallicRoughnessTexture))),o=this._invokeOne(function(u){return u.getMaterialType&&u.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(u){return u.extendMaterialParams&&u.extendMaterialParams(e,a)})))}r.doubleSided===!0&&(a.side=Ht);let h=r.alphaMode||Th.OPAQUE;if(h===Th.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,h===Th.MASK&&(a.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&o!==Gt&&(c.push(t.assignTexture(a,"normalMap",r.normalTexture)),a.normalScale=new ae(1,1),r.normalTexture.scale!==void 0)){let d=r.normalTexture.scale;a.normalScale.set(d,d)}if(r.occlusionTexture!==void 0&&o!==Gt&&(c.push(t.assignTexture(a,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&o!==Gt){let d=r.emissiveFactor;a.emissive=new Ce().setRGB(d[0],d[1],d[2],cn)}return r.emissiveTexture!==void 0&&o!==Gt&&c.push(t.assignTexture(a,"emissiveMap",r.emissiveTexture,It)),Promise.all(c).then(function(){let d=new o(a);return r.name&&(d.name=r.name),ai(d,r),t.associations.set(d,{materials:e}),r.extensions&&ys(i,d,r),d})}createUniqueName(e){let t=vt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,n=this.extensions,i=this.primitiveCache;function r(a){return n[je.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(l){return _f(l,a,t)})}let o=[];for(let a=0,l=e.length;a<l;a++){let c=e[a],h=jx(c),d=i[h];if(d)o.push(d.promise);else{let u;c.extensions&&c.extensions[je.KHR_DRACO_MESH_COMPRESSION]?u=r(c):u=_f(new gt,c,t),c.mode===Dn.TRIANGLE_STRIP?u=u.then(f=>Sh(f,wo)):c.mode===Dn.TRIANGLE_FAN&&(u=u.then(f=>Sh(f,cr))),i[h]={primitive:c,promise:u},o.push(u)}}return Promise.all(o)}loadMesh(e){let t=this,n=this.json,i=this.extensions,r=n.meshes[e],o=r.primitives,a=[];for(let l=0,c=o.length;l<c;l++){let h=o[l].material===void 0?Zx(this.cache):this.getDependency("material",o[l].material);a.push(h)}return a.push(t.loadGeometries(o)),Promise.all(a).then(async function(l){let c=l.slice(0,l.length-1),h=l[l.length-1],d=[];for(let f=0,g=h.length;f<g;f++){let x=h[f],p=o[f],m,S=c[f];if(p.mode===Dn.TRIANGLES||p.mode===Dn.TRIANGLE_STRIP||p.mode===Dn.TRIANGLE_FAN||p.mode===void 0){let T=r.isSkinnedMesh===!0,y=x.hasAttribute("skinIndex")&&x.hasAttribute("skinWeight");T&&y===!1&&console.warn("THREE.GLTFLoader: Missing skinIndex or skinWeight attributes. Skinning disabled."),m=T&&y?new Gr(x,S):new nt(x,S),m.isSkinnedMesh===!0&&m.normalizeSkinWeights()}else if(p.mode===Dn.LINES)m=new Xr(x,S);else if(p.mode===Dn.LINE_STRIP)m=new cs(x,S);else if(p.mode===Dn.LINE_LOOP)m=new qr(x,S);else if(p.mode===Dn.POINTS)m=new hs(x,S);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+p.mode);Object.keys(m.geometry.morphAttributes).length>0&&$x(m,r),m.name=t.createUniqueName(r.name||"mesh_"+e),ai(m,r),p.extensions&&ys(i,m,p),t.assignFinalMaterial(m),d.push(m)}for(let f=0,g=d.length;f<g;f++)t.associations.set(d[f],{meshes:e,primitives:f});if(d.length===1)return r.extensions&&ys(i,d[0],r),d[0];let u=new Ze;r.extensions&&ys(i,u,r),t.associations.set(u,{meshes:e});for(let f=0,g=d.length;f<g;f++)u.add(d[f]);return u})}loadCamera(e){let t,n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new Bt(at.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new Ln(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),ai(t,n),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],n=[];for(let i=0,r=t.joints.length;i<r;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){let r=i.pop(),o=i,a=[],l=[];for(let c=0,h=o.length;c<h;c++){let d=o[c];if(d){a.push(d);let u=new Oe;r!==null&&u.fromArray(r.array,c*16),l.push(u)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Wr(a,l)})}loadAnimation(e){let t=this.json,n=this,i=t.animations[e],r=i.name?i.name:"animation_"+e,o=[],a=[],l=[],c=[],h=[];for(let d=0,u=i.channels.length;d<u;d++){let f=i.channels[d],g=i.samplers[f.sampler],x=f.target,p=x.node,m=i.parameters!==void 0?i.parameters[g.input]:g.input,S=i.parameters!==void 0?i.parameters[g.output]:g.output;x.node!==void 0&&(o.push(this.getDependency("node",p)),a.push(this.getDependency("accessor",m)),l.push(this.getDependency("accessor",S)),c.push(g),h.push(x))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l),Promise.all(c),Promise.all(h)]).then(function(d){let u=d[0],f=d[1],g=d[2],x=d[3],p=d[4],m=[];for(let T=0,y=u.length;T<y;T++){let E=u[T],M=f[T],A=g[T],_=x[T],w=p[T];if(E===void 0)continue;E.updateMatrix&&E.updateMatrix();let I=n._createAnimationTracks(E,M,A,_,w);if(I)for(let L=0;L<I.length;L++)m.push(I[L])}let S=new so(r,void 0,m);return ai(S,i),S})}createNodeMesh(e){let t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(r){let o=n._getNodeRef(n.meshCache,i.mesh,r);return i.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let l=0,c=i.weights.length;l<c;l++)a.morphTargetInfluences[l]=i.weights[l]}),o})}loadNode(e){let t=this.json,n=this,i=t.nodes[e],r=n._loadNodeShallow(e),o=[],a=i.children||[];for(let c=0,h=a.length;c<h;c++)o.push(n.getDependency("node",a[c]));let l=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([r,Promise.all(o),l]).then(function(c){let h=c[0],d=c[1],u=c[2];u!==null&&h.traverse(function(f){f.isSkinnedMesh&&f.bind(u,ev)});for(let f=0,g=d.length;f<g;f++)h.add(d[f]);if(h.userData.pivot!==void 0&&d.length>0){let f=h.userData.pivot,g=d[0];h.pivot=new C().fromArray(f),h.position.x-=f[0],h.position.y-=f[1],h.position.z-=f[2],g.position.set(0,0,0),delete h.userData.pivot}return h})}_loadNodeShallow(e){let t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let r=t.nodes[e],o=r.name?i.createUniqueName(r.name):"",a=[],l=i._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&a.push(l),r.camera!==void 0&&a.push(i.getDependency("camera",r.camera).then(function(c){return i._getNodeRef(i.cameraCache,r.camera,c)})),i._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){a.push(c)}),this.nodeCache[e]=Promise.all(a).then(function(c){let h;if(r.isBone===!0?h=new Zs:c.length>1?h=new Ze:c.length===1?h=c[0]:h=new bt,h!==c[0])for(let d=0,u=c.length;d<u;d++)h.add(c[d]);if(r.name&&(h.userData.name=r.name,h.name=o),ai(h,r),r.extensions&&ys(n,h,r),r.matrix!==void 0){let d=new Oe;d.fromArray(r.matrix),h.applyMatrix4(d)}else r.translation!==void 0&&h.position.fromArray(r.translation),r.rotation!==void 0&&h.quaternion.fromArray(r.rotation),r.scale!==void 0&&h.scale.fromArray(r.scale);if(!i.associations.has(h))i.associations.set(h,{});else if(r.mesh!==void 0&&i.meshCache.refs[r.mesh]>1){let d=i.associations.get(h);i.associations.set(h,{...d})}return i.associations.get(h).nodes=e,h}),this.nodeCache[e]}loadScene(e){let t=this.extensions,n=this.json.scenes[e],i=this,r=new Ze;n.name&&(r.name=i.createUniqueName(n.name)),ai(r,n),n.extensions&&ys(t,r,n);let o=n.nodes||[],a=[];for(let l=0,c=o.length;l<c;l++)a.push(i.getDependency("node",o[l]));return Promise.all(a).then(function(l){for(let h=0,d=l.length;h<d;h++){let u=l[h];u.parent!==null?r.add(df(u)):r.add(u)}let c=h=>{let d=new Map;for(let[u,f]of i.associations)(u instanceof un||u instanceof Zt)&&d.set(u,f);return h.traverse(u=>{let f=i.associations.get(u);f!=null&&d.set(u,f)}),d};return i.associations=c(r),r})}_createAnimationTracks(e,t,n,i,r){let o=[],a=e.name?e.name:e.uuid,l=[];function c(f){f.morphTargetInfluences&&l.push(f.name?f.name:f.uuid)}Yi[r.path]===Yi.weights?(c(e),e.isGroup&&e.children.forEach(c)):l.push(a);let h;switch(Yi[r.path]){case Yi.weights:h=Mi;break;case Yi.rotation:h=Si;break;case Yi.translation:case Yi.scale:h=Vi;break;default:switch(n.itemSize){case 1:h=Mi;break;case 2:case 3:default:h=Vi;break}break}let d=i.interpolation!==void 0?Kx[i.interpolation]:rs,u=this._getArrayFromAccessor(n);for(let f=0,g=l.length;f<g;f++){let x=new h(l[f]+"."+Yi[r.path],t.array,u,d);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(x),o.push(x)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let n=Zh(t.constructor),i=new Float32Array(t.length);for(let r=0,o=t.length;r<o;r++)i[r]=t[r]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){let i=this instanceof Si?Yh:kl;return new i(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function tv(s,e,t){let n=e.attributes,i=new hn;if(n.POSITION!==void 0){let a=t.json.accessors[n.POSITION],l=a.min,c=a.max;if(l!==void 0&&c!==void 0){if(i.set(new C(l[0],l[1],l[2]),new C(c[0],c[1],c[2])),a.normalized){let h=Zh(gr[a.componentType]);i.min.multiplyScalar(h),i.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let r=e.targets;if(r!==void 0){let a=new C,l=new C;for(let c=0,h=r.length;c<h;c++){let d=r[c];if(d.POSITION!==void 0){let u=t.json.accessors[d.POSITION],f=u.min,g=u.max;if(f!==void 0&&g!==void 0){if(l.setX(Math.max(Math.abs(f[0]),Math.abs(g[0]))),l.setY(Math.max(Math.abs(f[1]),Math.abs(g[1]))),l.setZ(Math.max(Math.abs(f[2]),Math.abs(g[2]))),u.normalized){let x=Zh(gr[u.componentType]);l.multiplyScalar(x)}a.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(a)}s.boundingBox=i;let o=new pn;i.getCenter(o.center),o.radius=i.min.distanceTo(i.max)/2,s.boundingSphere=o}function _f(s,e,t){let n=e.attributes,i=[];function r(o,a){return t.getDependency("accessor",o).then(function(l){s.setAttribute(a,l)})}for(let o in n){let a=Kh[o]||o.toLowerCase();a in s.attributes||i.push(r(n[o],a))}if(e.indices!==void 0&&!s.index){let o=t.getDependency("accessor",e.indices).then(function(a){s.setIndex(a)});i.push(o)}return Ge.workingColorSpace!==cn&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Ge.workingColorSpace}" not supported.`),ai(s,e),tv(s,e,t),Promise.all(i).then(function(){return e.targets!==void 0?Jx(s,e.targets,t):s})}var _r={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var En=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},nv=new Ln(-1,1,1,-1,0,1),$h=class extends gt{constructor(){super(),this.setAttribute("position",new $e([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new $e([0,2,0,0,2,0],2))}},iv=new $h,Ki=class{constructor(e){this._mesh=new nt(iv,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,nv)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}};var Hl=class extends En{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof yt?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=wi.clone(e.uniforms),this.material=new yt({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new Ki(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var No=class extends En{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let i=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let o,a;this.inverse?(o=0,a=1):(o=1,a=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),r.buffers.stencil.setFunc(i.ALWAYS,o,4294967295),r.buffers.stencil.setClear(a),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(i.EQUAL,1,4294967295),r.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),r.buffers.stencil.setLocked(!0)}},Vl=class extends En{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}};var Gl=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new ae);this._width=n.width,this._height=n.height,t=new kt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:en}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Hl(_r),this.copyPass.material.blending=Nn,this.timer=new ho}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let i=0,r=this.passes.length;i<r;i++){let o=this.passes[i];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),o.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),o.needsSwap){if(n){let a=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(a.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(a.EQUAL,1,4294967295)}this.swapBuffers()}No!==void 0&&(o instanceof No?n=!0:o instanceof Vl&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new ae);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var Wl=class extends En{constructor(e,t,n=null,i=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Ce}render(e,t,n){let i=e.autoClear;e.autoClear=!1;let r,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),e.autoClear=i}};var vf={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Ce(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};var xr=class s extends En{constructor(e,t=1,n,i){super(),this.strength=t,this.radius=n,this.threshold=i,this.resolution=e!==void 0?new ae(e.x,e.y):new ae(256,256),this.clearColor=new Ce(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new kt(r,o,{type:en,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){let d=new kt(r,o,{type:en,depthBuffer:!1});d.texture.name="UnrealBloomPass.h"+h,d.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(d);let u=new kt(r,o,{type:en,depthBuffer:!1});u.texture.name="UnrealBloomPass.v"+h,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),r=Math.round(r/2),o=Math.round(o/2)}let a=vf;this.highPassUniforms=wi.clone(a.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new yt({uniforms:this.highPassUniforms,vertexShader:a.vertexShader,fragmentShader:a.fragmentShader}),this.separableBlurMaterials=[];let l=[6,10,14,18,22];r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new ae(1/r,1/o),r=Math.round(r/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=wi.clone(_r.uniforms),this.blendMaterial=new yt({uniforms:this.copyUniforms,vertexShader:_r.vertexShader,fragmentShader:_r.fragmentShader,premultipliedAlpha:!0,blending:si,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Ce,this._oldClearAlpha=1,this._basic=new Gt,this._fsQuad=new Ki(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(n,i);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,i),this.renderTargetsVertical[r].setSize(n,i),this.separableBlurMaterials[r].uniforms.invSize.value=new ae(1/n,1/i),n=Math.round(n/2),i=Math.round(i/2)}render(e,t,n,i,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=n.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let a=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=a.texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this._fsQuad.render(e),a=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(n),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let o=0;o<e;o++)t.push(.39894*Math.exp(-.5*o*o/(n*n))/n);let i=[],r=[];for(let o=1;o<e;o+=2){let a=t[o],l=o+1<e?t[o+1]:0,c=a+l;i.push((o*a+(o+1)*l)/c),r.push(c)}return new yt({defines:{KERNEL_PAIRS:i.length},uniforms:{colorTexture:{value:null},invSize:{value:new ae(.5,.5)},direction:{value:new ae(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:i},gaussianWeights:{value:r}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new yt({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};xr.BlurDirectionX=new ae(1,0);xr.BlurDirectionY=new ae(0,1);var Do={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var Xl=class extends En{constructor(){super(),this.isOutputPass=!0,this.uniforms=wi.clone(Do.uniforms),this.material=new er({name:Do.name,uniforms:this.uniforms,vertexShader:Do.vertexShader,fragmentShader:Do.fragmentShader}),this._fsQuad=new Ki(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Ge.getTransfer(this._outputColorSpace)===ot&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===fo?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===po?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===mo?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===ms?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===_o?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===xo?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===go&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var ql=class extends as{constructor(){super(),this.name="RoomEnvironment",this.position.y=-3.5;let e=new Jt;e.deleteAttribute("uv");let t=new At({side:Wt}),n=new At,i=new xn(16777215,900,28,2);i.position.set(.418,16.199,.3),this.add(i);let r=new nt(e,t);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);let o=new dn(e,n,6),a=new bt;a.position.set(-10.906,2.009,1.846),a.rotation.set(0,-.195,0),a.scale.set(2.328,7.905,4.651),a.updateMatrix(),o.setMatrixAt(0,a.matrix),a.position.set(-5.607,-.754,-.758),a.rotation.set(0,.994,0),a.scale.set(1.97,1.534,3.955),a.updateMatrix(),o.setMatrixAt(1,a.matrix),a.position.set(6.167,.857,7.803),a.rotation.set(0,.561,0),a.scale.set(3.927,6.285,3.687),a.updateMatrix(),o.setMatrixAt(2,a.matrix),a.position.set(-2.017,.018,6.124),a.rotation.set(0,.333,0),a.scale.set(2.002,4.566,2.064),a.updateMatrix(),o.setMatrixAt(3,a.matrix),a.position.set(2.291,-.756,-2.621),a.rotation.set(0,-.286,0),a.scale.set(1.546,1.552,1.496),a.updateMatrix(),o.setMatrixAt(4,a.matrix),a.position.set(-2.193,-.369,-5.547),a.rotation.set(0,.516,0),a.scale.set(3.875,3.487,2.986),a.updateMatrix(),o.setMatrixAt(5,a.matrix),this.add(o);let l=new nt(e,vr(50));l.position.set(-16.116,14.37,8.208),l.scale.set(.1,2.428,2.739),this.add(l);let c=new nt(e,vr(50));c.position.set(-16.109,18.021,-8.207),c.scale.set(.1,2.425,2.751),this.add(c);let h=new nt(e,vr(17));h.position.set(14.904,12.198,-1.832),h.scale.set(.15,4.265,6.331),this.add(h);let d=new nt(e,vr(43));d.position.set(-.462,8.89,14.52),d.scale.set(4.38,5.441,.088),this.add(d);let u=new nt(e,vr(20));u.position.set(3.235,11.486,-12.541),u.scale.set(2.5,2,.1),this.add(u);let f=new nt(e,vr(100));f.position.set(0,20,0),f.scale.set(1,.1,1),this.add(f)}dispose(){let e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(let t of e)t.dispose()}};function vr(s){return new no({color:0,emissive:16777215,emissiveIntensity:s})}var Uf=hu(Ef()),Ff=hu(jh());function wf(s){let e=[],t=[],n=0,i=0;s.traverse(h=>{h.isMesh&&t.push(h)});for(let h of t){let d=h.material?.name||"";if(!/midnight structural|pearl edge|cyan optical|lens catchlight/.test(d))continue;let u=h.geometry.clone(),f=u.attributes.position,g=u.index;if(!g)throw Error("Indexed facial surfaces required");let x=Array.from({length:f.count},(M,A)=>A),p=new Map,m=[],S=M=>{for(;x[M]!==M;)x[M]=x[x[M]],M=x[M];return M},T=(M,A)=>{x[S(M)]=S(A)};for(let M=0;M<f.count;M++){let A=[f.getX(M),f.getY(M),f.getZ(M)].map(_=>Math.round(_*1e5)).join(",");p.has(A)||p.set(A,M),m[M]=p.get(A)}for(let M=0;M<g.count;M+=3)T(m[g.getX(M)],m[g.getX(M+1)]),T(m[g.getX(M)],m[g.getX(M+2)]);let y=new Map;for(let M=0;M<g.count;M+=3){let A=S(m[g.getX(M)]);y.has(A)||y.set(A,[]),y.get(A).push(g.getX(M),g.getX(M+1),g.getX(M+2))}let E=[];n+=g.count/3;for(let M of y.values()){let A=new hn;for(let B of M)A.expandByPoint(new C(f.getX(B),f.getY(B),f.getZ(B)));let _=A.getCenter(new C),w=A.getSize(new C),I=null;if(/pearl edge/.test(d)&&_.y>2.73&&_.y<2.85&&w.x<.35&&w.y<.12&&w.z<.09&&(I="brow"),/midnight structural/.test(d)&&A.min.z>.515&&w.x<.18&&w.y<.18&&(I="pupil"),/cyan optical/.test(d)&&_.y>2.4&&A.min.z>.49&&(I="iris"),/lens catchlight/.test(d)&&(I="catchlight"),!I){E.push(...M);continue}let L=new gt;for(let[B,q]of Object.entries(u.attributes))L.setAttribute(B,q);L.setIndex(M);let U=new Ze;U.name="Study_"+I+"_"+(_.x<0?"L":"R"),U.position.copy(_);let O=new nt(L,h.material);O.position.copy(_).negate(),O.castShadow=h.castShadow,O.receiveShadow=h.receiveShadow,U.add(O);let N=new Ze;N.position.copy(h.position),N.quaternion.copy(h.quaternion),N.scale.copy(h.scale),N.add(U),h.parent.add(N),e.push({role:I,side:_.x<0?-1:1,pivot:U,center:_.clone(),surface:O,triangles:M.length/3}),i+=M.length/3}u.setIndex(E),h.geometry=u,i+=E.length/3}let r=Object.fromEntries(["brow","pupil","iris","catchlight"].map(h=>[h,e.filter(d=>d.role===h).length]));if(Object.values(r).some(h=>h!==2)||n!==i)throw Error("Facial rig must find two of each existing component and conserve triangles: "+JSON.stringify(r));let o={counts:r,trianglesBefore:n,trianglesAfter:i,verticesEdited:0,method:"Connected-component index partition, original position/normal attributes retained; neutral pivot/mesh translations cancel."},a=new Gt({color:1192770}),l=new Gt({color:5683397}),c=new At({color:15264999});return{audit:o,pose({aimX:h=0,aimY:d=0,browL:u=0,browR:f=0,rollL:g=0,rollR:x=0}={}){for(let p of e)p.pivot.position.copy(p.center),p.pivot.rotation.set(0,0,0),p.role==="brow"?(p.pivot.position.y+=p.side<0?u:f,p.pivot.rotation.z=p.side<0?g:x):(p.pivot.position.x+=at.clamp(h,-.032,.032),p.pivot.position.y+=at.clamp(d,-.022,.022))},colorize(){for(let h of e)h.surface.material=h.role==="pupil"?a:h.role==="iris"?l:c},dispose(){a.dispose(),l.dispose(),c.dispose()}}}function Af(s){let e=new Ze;e.name="OriginalStudyMiniDish",e.position.set(-.32,.55,-.04),s.add(e),e.visible=!1;let t=new At({color:14147548,roughness:.38,metalness:.2}),n=new At({color:10910297,roughness:.32,metalness:.78}),i=new At({color:2705236,roughness:.44,metalness:.5}),r=new Gt({color:6674143});t.side=Ht;let o=(x,p,m,S)=>{let T=new nt(p,m);return T.position.set(...S),x.add(T),T};o(e,new mn(.105,.13,.1,16),n,[0,0,0]);let a=o(e,new mn(.018,.023,.34,12),t,[0,.1,0]),l=new Ze;e.add(l);let c=new Ze;l.add(c);let h=new Ze;h.scale.setScalar(.75),c.add(h),o(h,new $t(.08,12,8),n,[0,0,0]);let d=[];for(let x=0;x<6;x++){let p=new Ze;p.rotation.z=x*Math.PI/3,h.add(p);let m=new Ze;p.add(m);let S=new us([new ae(.035,0),new ae(.13,.018),new ae(.23,.075),new ae(.29,.14)],8,0,Math.PI/3*(.94*1.1));S.rotateX(Math.PI/2),o(m,S,t,[0,0,0]),d.push(m)}let u=o(h,new mn(.018,.018,.26,8),i,[0,0,.13]);u.rotation.x=Math.PI/2;let f=o(h,new $t(.035,12,8),r,[0,0,.27]),g=0;return e.traverse(x=>{x.isMesh&&(g+=(x.geometry.index?.count||x.geometry.attributes.position.count)/3,x.castShadow=!0,x.receiveShadow=!0)}),{root:e,audit:{originalAttachment:!0,petals:6,triangles:g,dishScale:.75,petalCoverageMultiplier:1.1,petalSectorRadians:Math.PI/3*(.94*1.1)},pose({extension:x=0,open:p=0,scanYaw:m=0,scanPitch:S=0,locked:T=!1}){e.visible=!0,a.scale.y=.18+.82*x,a.position.y=.05+.17*a.scale.y,l.position.y=.1+.34*x,c.rotation.y=m,h.rotation.x=S;for(let y of d)y.rotation.x=1.15*(1-p);f.material=r,f.scale.setScalar(T?1.15:1)},setVisible(x){e.visible=x}}}var Un=(s,e,t)=>at.smoothstep(t,s,e),wn=at.lerp,Rf=s=>new C(...s);function Cf(s){let e=s.getObjectByName("Head"),t=wf(e),n=Af(e);return t.colorize(),{face:t,sensor:n,dispose:()=>t.dispose()}}function tu({sample:s,time:e,hostGroup:t,joints:n,actor:i,camera:r,reduced:o}){for(let w of n.values())w.node.rotation.copy(w.rotation);let a=s.age,l=s.position,c=s.phase==="travel",h=Number.isFinite(s.heading)?s.heading:s.travel<.25?Math.atan2(-4,-5):-Math.PI/2,d=wn(wn(.45,h,Un(6.4,7.5,a)),-Math.PI,Un(11.3,12,a));s.arrived&&s.available&&!s.active&&s.state!=="idle"&&(d=wn(-Math.PI,-.8,Un(0,1.1,s.reactionAge))),t.position.set(l[0],l[1]+(o?0:Math.sin(e*1.7)*.035),l[2]),t.rotation.y=d;let u=n.get("Head"),f=n.get("ArmL"),g=n.get("ArmR"),x=Un(.75,1.35,a)*(1-Un(5.8,6.4,a));u&&(u.node.rotation.z-=x*.1,u.node.rotation.y+=wn(0,h-.45,Un(6.4,7,a))*(1-Un(7,7.5,a)));let p=s.reaction==="relief"?Math.sin(Math.PI*s.reactionAge/1.8):0,m=s.reaction==="concern"?Math.sin(Math.PI*s.reactionAge/1.8):0;u&&(u.node.rotation.x+=p*.09,u.node.rotation.z-=m*.1),f&&(f.node.rotation.z+=.05+p*.13,f.node.rotation.x-=c?.12:.04),g&&(g.node.rotation.z-=.05+p*.1,g.node.rotation.x-=c?.1:.04);let S=n.get("Core");S&&(S.node.rotation.y+=e*.14),i?.face.pose({aimX:.025*Un(.75,1,a)*(1-Un(6,6.4,a)),aimY:m*-.01,browL:x*.036+m*.02,browR:x*.006+p*.008,rollL:x*.13,rollR:x*-.03});let T=s.scanning?Math.sin((a-3.4)*Math.PI*1.2)*.5:0,y=s.target||[-18,.95,7],E=[y[0],4,y[2]-4];i?.sensor.pose({extension:s.extension,open:s.open,scanYaw:s.locked?Math.atan2(E[0]-l[0],E[2]-l[2])-d:T,scanPitch:-.12,locked:s.locked});let M,A,_;if(a<7.5&&!s.arrived){let w=Un(2.05,3.4,a);M=[l[0]+wn(1.1,3,w),wn(5.1,6.5,w),l[2]+wn(2.7,7,w)],A=[l[0],wn(4.85,5.3,w),l[2]],_=wn(36,42,w)}else if(!s.arrived)M=[l[0]+7,5.5,l[2]+8],A=[l[0],3.8,l[2]],_=46;else{let w=Un(12,14,a);M=[l[0]-6,wn(5.5,7.5,w),l[2]+9],A=[y[0],4,wn(y[2],y[2]-3.7,w)],_=46;let I=Un(14,17,a);M=M.map((L,U)=>wn(L,[l[0]-7,6,l[2]+11][U],I)),A=A.map((L,U)=>wn(L,[l[0]-2,3.6,l[2]-1][U],I))}return r.position.copy(Rf(M)),r.fov=_,r.updateProjectionMatrix(),r.lookAt(Rf(A)),{...s,camera:{position:M,target:A,fov:_},faceRig:i?.face.audit,sensor:i?.sensor.audit}}var nu=(s,e,t,n)=>Number.isFinite(s)?at.clamp(s,t,n):e;function If({hostGroup:s,scene:e}){if(!s?.add||!e?.add)throw new TypeError("Thrusters require a host group and scene");let t=new Ze;t.name="OriginalIndustrialThrusterPack",s.add(t);let n=new At({color:2502972,metalness:.88,roughness:.34}),i=new At({color:6446177,metalness:.83,roughness:.44}),r=new At({color:9986109,metalness:.8,roughness:.33}),o=new At({color:1055270,metalness:.68,roughness:.48}),a=new At({color:7350805,emissive:16739105,emissiveIntensity:.1,metalness:.5,roughness:.35,side:Ht}),l=new yt({transparent:!0,depthWrite:!1,side:Ht,blending:si,uniforms:{uTime:{value:0},uPower:{value:0}},vertexShader:"varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;void main(){vUv=uv;vN=mat3(modelMatrix)*normal;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}",fragmentShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;uniform float uTime;uniform float uPower;
      void main(){float y=vUv.y;float bands=.62+.38*sin(y*48.-uTime*38.);float taper=smoothstep(0.,.25,y);
      float flicker=.86+.14*sin(uTime*91.+vUv.x*19.);float softEdge=pow(abs(dot(normalize(vN),normalize(cameraPosition-vWorld))),1.5);
      vec3 col=mix(vec3(1.,.19,.015),vec3(.10,.40,1.),smoothstep(.10,.8,y));col=mix(col,vec3(.75,.92,1.),pow(y,4.)*.7);
      gl_FragColor=vec4(col*1.2,taper*bands*flicker*softEdge*uPower*.24);}`}),c=new Gt({color:9101311,transparent:!0,opacity:0,depthWrite:!1,blending:si,side:Ht}),h=new Set,d=new Set([n,i,r,o,a,l,c]),u=[],f=[],g=(O,N,B,q)=>{h.add(N);let G=new nt(N,B);return G.position.set(...q),G.castShadow=!0,G.receiveShadow=!0,O.add(G),G};for(let O=0;O<3;O++){let N=O*Math.PI*2/3+.2,B=Math.cos(N)*.4,q=Math.sin(N)*.4,G=new Ze;G.name=`IndustrialExhaustBell${O+1}`,G.position.set(B,0,q),t.add(G);let j=[[.12,.55],[.13,.4],[.14,.25],[.23,.1],[.235,.06],[.205,.055],[.13,.24],[.105,.4],[.1,.55]].map(Fe=>new ae(...Fe));g(G,new us(j,32),n,[0,0,0]);for(let Fe of[.35,.42,.49])g(G,new vi(.146,.023,8,32),r,[0,Fe,0]).rotation.x=Math.PI/2;g(G,new vi(.22,.021,8,32),i,[0,.075,0]).rotation.x=Math.PI/2,g(G,new mn(.108,.17,.1,24,1,!0),a,[0,.18,0]);for(let Fe=0;Fe<3;Fe++){let Be=Fe*Math.PI*2/3;g(G,new Jt(.055,.31,.13),o,[Math.cos(Be)*.18,.29,Math.sin(Be)*.18]).rotation.y=-Be}let X=new Hi([new C(B*.8,.79,q*.8),new C(B*1.25,.63,q*1.25),new C(B,.48,q)]);g(t,new ds(X,12,.022,6,!1),r,[0,0,0]);let $=new mn(.105,.17,1,24,6,!0);$.translate(0,-.5,0);let ne=g(G,$,l,[0,.06,0]);ne.castShadow=ne.receiveShadow=!1,u.push(ne);let Te=new mn(.035,.055,1,16,4,!0);Te.translate(0,-.5,0);let le=g(G,Te,c,[0,.06,0]);le.castShadow=le.receiveShadow=!1,f.push(le)}let x=new xn(16739109,0,6,2);x.name="ThrusterAmberWash",e.add(x);let p=new gt,m=[];for(let O=0;O<40;O++)m.push(O/40*Math.PI*2,O*17%41/41,O*13%37/37);p.setAttribute("position",new $e(m,3)),h.add(p);let S=new yt({transparent:!0,depthWrite:!1,uniforms:{uTime:{value:0},uPower:{value:0},uOrigin:{value:new C},uRight:{value:new C(1,0,0)},uForward:{value:new C(0,0,1)},uUp:{value:new C(0,1,0)}},vertexShader:`uniform float uTime;uniform float uPower;uniform vec3 uOrigin;uniform vec3 uRight;uniform vec3 uForward;uniform vec3 uUp;varying float vFade;
      void main(){float life=fract(uTime*.8+position.y);float r=.2+life*2.8;vec3 p=uOrigin+uRight*cos(position.x)*r+uForward*sin(position.x)*r+uUp*(sin(life*3.14159)*.14);
      vFade=(1.-life)*uPower*.35;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);gl_PointSize=7.+position.z*10.;}`,fragmentShader:"varying float vFade;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.66,.57,.43,smoothstep(.5,.1,d)*vFade);}"});d.add(S);let T=new hs(p,S);T.name="ThrusterGroundDust",T.frustumCulled=!1,e.add(T);let y=0;t.traverse(O=>{O.isMesh&&(y+=(O.geometry.index?.count||O.geometry.attributes.position.count)/3)});let E=Object.freeze({originalAttachment:!0,nozzles:3,triangles:y,dustPoints:40,sourceHostModified:!1,timers:0,ownsRenderer:!1}),M=new C,A=new C,_=new C,w=!1,I=null;function L(O=0,N=.1,{reducedMotion:B=!1,groundY:q=.1}={}){if(w)return{disposed:!0,audit:E};let G=B?0:nu(O,0,0,86400),j=nu(N,.1,0,1);return l.uniforms.uTime.value=G,l.uniforms.uPower.value=j,a.emissiveIntensity=.15+j*2.3,c.opacity=j*.6,u.forEach((X,$)=>{X.scale.y=.08+j*.5*(1+(B?0:.04*Math.sin(G*61+$))),X.scale.x=X.scale.z=.7+j*.3,f[$].scale.y=X.scale.y*.85}),s.updateWorldMatrix(!0,!1),e.updateWorldMatrix(!0,!1),s.getWorldPosition(M),A.copy(M),e.worldToLocal(A),x.position.copy(A),x.position.y-=.1,x.intensity=j*9,x.visible=j>0,_.copy(A),_.y=nu(q,.1,-1e4,1e4),e.localToWorld(_),S.uniforms.uTime.value=G,S.uniforms.uPower.value=B?0:Math.max(0,j-.12),S.uniforms.uOrigin.value.copy(_),S.uniforms.uRight.value.setFromMatrixColumn(e.matrixWorld,0),S.uniforms.uUp.value.setFromMatrixColumn(e.matrixWorld,1),S.uniforms.uForward.value.setFromMatrixColumn(e.matrixWorld,2),T.visible=!B&&j>.12,I={seconds:G,power:j,reducedMotion:!!B,idle:j<=.12,worldOrigin:M.toArray(),washScenePosition:x.position.toArray(),dustWorldOrigin:_.toArray(),flameLengths:u.map(X=>X.scale.y),dustVisible:T.visible,audit:E},I}function U(){w||(w=!0,t.removeFromParent(),x.removeFromParent(),T.removeFromParent(),h.forEach(O=>O.dispose()),d.forEach(O=>O.dispose()))}return L(0,.1),{root:t,wash:x,dust:T,audit:E,pose:L,diagnostics:()=>I,destroy:U}}var Yt=(s,e,t)=>at.smoothstep(t,s,e),jt=at.lerp,Zi=12,iu=Object.freeze([Object.freeze({id:"M01",start:0,end:2.5,title:"Ignition"}),Object.freeze({id:"M02",start:2.5,end:4.2,title:"Precise machinery"}),Object.freeze({id:"M03",start:4.2,end:6.2,title:"Controlled stop"}),Object.freeze({id:"M04",start:6.2,end:12,title:"Someone helpful"})]);function Pf({scene:s,hostGroup:e,joints:t,actor:n,camera:i,lights:r={}}){if(!s?.add||!e?.position||!i?.position)throw new TypeError("Opening requires the existing scene, host and camera");let o=t instanceof Map?t:new Map,a=r||{},l=new xn(16767142,0,14,2);l.name="OpeningWarmFaceKey",l.position.set(7.5,6.5,15),s.add(l);let c=If({hostGroup:e,scene:s}),h=new C,d=new C,u=new C,f=new C,g=new zt,x=!1,p=null,m=(E,M)=>{a[E]&&typeof a[E].intensity=="number"&&(a[E].intensity=M)};function S(E=1){if(x)return{disposed:!0,exposure:p?.lighting.exposure??.8};let M=Number.isFinite(E)?at.clamp(E,0,1):1,A={welcome:M,ambient:jt(.55,1.5,M),key:jt(1.15,2.1,M),rim:jt(.7,1.7,M),practical:jt(3,6,M),warmKeyIntensity:M*14,environmentIntensity:jt(.16,.3,M),exposure:jt(.62,.8,M),missing:["ambient","key","rim","practical"].filter(_=>!a[_]||typeof a[_].intensity!="number")};for(let _ of["ambient","key","rim","practical"])m(_,A[_]);return l.intensity=A.warmKeyIntensity,s.environmentIntensity=A.environmentIntensity,A}function T(E=0,{reducedMotion:M=!1}={}){if(x)return{disposed:!0,duration:Zi};let A=Number(E),_=M?Zi:Number.isFinite(A)?at.clamp(A,0,Zi):A===1/0?Zi:0,w=iu.find(ie=>_>=ie.start&&_<ie.end)||iu[iu.length-1];for(let ie of o.values())ie.rotation&&ie.node.rotation.copy(ie.rotation),ie.scale&&ie.node.scale.copy(ie.scale);let I=Yt(.25,1.1,_),L=_<4.2&&!M?Math.sin(_*4)*.025*Math.exp(-_*.9):0,U=M?0:Yt(.2,.45,_)*(1-Yt(1.1,2.15,_)),O=.1+.9*U,N=Yt(6.2,7.5,_),B=S(N);e.position.set(5,.95+L+.24*U,10.8+1.2*I),e.rotation.set(0,.45,0);let q=o.get("Core"),G=o.get("ArmR"),j=o.get("ArmL"),X=o.get("Head");q&&(q.node.rotation.y+=.9*(1-Math.exp(-_*1.4))+.05*_),G&&(G.node.rotation.x-=.12*(1-Yt(2.5,3.5,_)),G.node.rotation.z-=.035*Yt(2.5,3.3,_)),j&&(j.node.rotation.z+=.035);let $=Yt(6.65,7.25,_)*(1-Yt(9.1,10,_));X&&(X.node.rotation.y+=.22*Yt(6.95,8.2,_),X.node.rotation.z-=.075*$,X.node.rotation.x+=.035*Math.sin(Yt(10.8,12,_)*Math.PI));let ne={aimX:.025*Yt(6.65,6.8,_),aimY:.008*$,browL:.032*$,browR:.005*$,rollL:.1*$,rollR:-.025*$},Te={extension:Yt(9,9.8,_),open:Yt(9.5,10.4,_),scanYaw:_<10.4?0:jt(Math.sin((_-10.4)*8)*.2,-.3,Yt(11.2,11.65,_)),scanPitch:-.12,locked:_>=11.65};n?.face?.pose?.(ne),n?.sensor?.pose?.(Te);let le,Fe,Be;if(w.id==="M01"){let ie=Yt(0,2.5,_);le=[jt(6.5,6.15,ie),jt(1.25,1.4,ie),jt(13.65,13.45,ie)],Fe=[5,1.62,e.position.z],Be=38}else if(w.id==="M02"){let ie=Yt(2.5,4.2,_);le=[jt(7.8,7.55,ie),3.8,12.4],Fe=[6.32,4,11.36],Be=32}else if(w.id==="M03"){let ie=Yt(4.2,6.2,_);le=[3.2,jt(1.8,3.25,ie),9.3],Fe=[5,jt(2.1,3.4,ie),12],Be=42}else{let ie=Yt(6.2,12,_);le=[jt(8.9,8.5,ie),jt(5.15,5.5,ie),jt(12.4,14.3,ie)],Fe=[5,jt(5.05,5.25,ie),12],Be=jt(38,46,Yt(8.7,10.4,_))}let Qe=e.scale.x/1.65,K=[5,.95,12];le=le.map((ie,ce)=>K[ce]+(ie-K[ce])*Qe),Fe=Fe.map((ie,ce)=>K[ce]+(ie-K[ce])*Qe),i.position.set(...le),i.fov=Be,i.lookAt(h.set(...Fe)),i.updateProjectionMatrix(),i.updateWorldMatrix(!0,!1),e.updateWorldMatrix(!0,!0);let ee=c.pose(_,O,{reducedMotion:M});i.getWorldPosition(u),(X?.node||e).getWorldQuaternion(g),f.set(0,0,1).applyQuaternion(g);let ye=!1,Ue=!1;for(let ie of[-.26,.26]){d.set(ie,2.56,.53).applyMatrix4(e.matrixWorld),Ue||=f.dot(h.copy(u).sub(d))>.02;let ce=d.clone().project(i);ye||=ce.x>-1&&ce.x<1&&ce.y>-1&&ce.y<1&&ce.z>-1&&ce.z<1}return p={duration:Zi,requestedSeconds:Number.isFinite(A)?A:null,seconds:_,shotId:w.id,complete:_>=Zi,reducedMotion:!!M,camera:{position:le,target:Fe,fov:Be},hostPosition:e.position.toArray(),hostRotation:e.rotation.toArray().slice(0,3),faceVisible:ye&&Ue,faceVisibility:{inFrame:ye,frontFacing:Ue,method:"Optics frustum and front-facing probes; native occlusion/artistic qualification remains required"},facePose:ne,sensorPose:Te,face:n?.face?.audit||null,sensor:n?.sensor?.audit||null,lighting:B,thrustPower:O,thrusters:ee,handoff:{position:e.position.toArray(),quaternion:e.quaternion.toArray(),camera:{position:[...le],target:[...Fe],fov:Be},joints:Object.fromEntries([...o].map(([ie,ce])=>[ie,{rotation:ce.node.rotation.toArray().slice(0,3),scale:ce.node.scale.toArray()}]))},audit:{presentationOnly:!0,duration:Zi,timers:0,ownsRenderer:!1,loadsAssets:!1,sourceHostModified:!1,muted:!0}},p}function y(){x||(x=!0,c.destroy(),l.removeFromParent())}return{duration:Zi,pose:T,setMood:S,thrusters:c,diagnostics:()=>p,destroy:y}}var su=32,cv=new Set(["working","running","building","testing","researching","editing","reviewing","traveling"]),hv=new Set(["failed","passed","cancelled","interrupted","timed_out","stopping","termination_unknown"]),$l=s=>typeof s=="number"&&Number.isFinite(s);function Lf({template:s,scale:e=.65}={}){if(!s?.isObject3D)throw new TypeError("Robot crew requires the original host template");if(!$l(e)||e<=0)throw new RangeError("Robot crew scale must be positive and finite");if(s.updateWorldMatrix(!0,!0),Math.abs(s.matrixWorld.determinant())<1e-12)throw new RangeError("Robot template transform must be invertible");let t=new Ze;t.name="OriginalHostRobotCrew";let n=s.matrixWorld.clone().invert(),i=[],r=[];if(s.traverse(T=>{if(!T.isMesh)return;if(T.isSkinnedMesh||T.isInstancedMesh)throw new TypeError("Robot template must contain ordinary rigid host meshes");let y=!0;for(let A=T;A&&A!==s;A=A.parent)y&&=A.visible;if(!y)return;if((Array.isArray(T.material)?T.material:[T.material]).some(A=>A?.isShaderMaterial&&!/\binstanceMatrix\b/.test(A.vertexShader||""))){r.push(T.name||"Non-instanced transient shader");return}let M=new dn(T.geometry,T.material,su);M.name=`Crew:${T.name||T.uuid}`,M.count=0,M.castShadow=T.castShadow,M.receiveShadow=T.receiveShadow,M.renderOrder=T.renderOrder,M.layers.mask=T.layers.mask,M.frustumCulled=!1,M.instanceMatrix.setUsage(Ro),t.add(M),i.push({mesh:M,local:n.clone().multiply(T.matrixWorld)})}),!i.length)throw new TypeError("Robot template has no renderable rigid meshes");t.userData.crew={limit:su,scale:e,meshBatches:i.length,omittedTransientMeshes:r,records:[]};let o=[],a=!1,l=0,c=!1,h=new Oe,d=new Oe,u=new C,f=new zt,g=new C(0,1,0),x=new C(e,e,e);function p(T=0,y=!1){if(a)return;l=$l(T)?T:0,c=!!y;let E=0,M=[];for(let A=0;A<o.length;A++){let _=o[A],w=_?.position,I=w?.x??w?.[0],L=w?.y??w?.[1],U=w?.z??w?.[2];if(![I,L,U].every($l))continue;let O=_.scenery===!0,N=_.motionAllowed!==!1&&!_.stale&&!_.terminal&&!hv.has(_.state)&&(O||cv.has(_.state)),B=N&&!c?Math.sin(l*1.8+A*1.7)*.035:0;u.set(I,L+B,U),f.setFromAxisAngle(g,$l(_.heading)?_.heading:0),d.compose(u,f,x);for(let q of i)h.multiplyMatrices(d,q.local),q.mesh.setMatrixAt(E,h);M.push({id:_.id??_.workerId??null,scenery:O,state:_.state||"idle",motionAllowed:N}),E++}for(let A of i)A.mesh.count=E,A.mesh.instanceMatrix.needsUpdate=!0;t.userData.crew.records=M}function m(T=[]){if(!a){if(!Array.isArray(T))throw new TypeError("Robot crew records must be an array");o=T.slice(0,su),p(l,c)}}function S(){if(!a){a=!0,o=[],t.removeFromParent();for(let T of i)T.mesh.count=0,T.mesh.removeFromParent(),T.mesh.dispose();i.length=0,t.userData.crew.records=[]}}return{root:t,set:m,update:p,dispose:S}}var Dt=Object.freeze({maxDPR:1.5,pixelBudget:55e5,maxFPS:60,managementFPS:30,managementDPR:1,managementPixelBudget:3e6,workers:32,assetBytes:24*1024*1024,worldTriangles:12e5,hostTriangles:15e4,worldMeshes:1e3,hostMeshes:250,sceneTextures:16,textures:32,drawCalls:1200,frameTriangles:4e6}),ru=new Set,uv=new Set(["idle","unknown","queued","starting","working","running","building","testing","passed","failed","stopping","cancelled","termination_unknown","interrupted","timed_out"]),jl=new Set(["working","running","building","testing"]),Of=new Set(["failed","stopping","termination_unknown","interrupted","timed_out"]),Ai={hook:{position:[12,7,26],target:[-5,3.6,8],fov:43},crew:{position:[17,10,26],target:[-1,3.8,5],fov:43},make:{position:[32,21,29],target:[0,3.8,-5],fov:44},turn:{position:[19,10,28],target:[-2,3.6,7],fov:43}},Fn=Object.freeze({position:[60,62,58],target:[0,2,-2],verticalSpan:52,near:.2,far:260}),Ql={research:{anchor:[-11,0,-17],entrance:[-11,0,-9.9],pin:[-11,10.7,-17],min:[-16.5,0,-22],max:[-5.5,10.5773,-10.005]},build:{anchor:[9,0,-15],entrance:[9,0,-7.9],pin:[9,14.7,-15],min:[3.5,0,-19.9],max:[14.5,14.5063,-7.985]},test:{anchor:[-18,0,-1],entrance:[-18,0,5.75],pin:[-15.6,9.55,-.5],min:[-23.9,0,-5.6],max:[-12.1,9.25,5.695]},review:{anchor:[-10,0,12],entrance:[-10,0,17.3],pin:[-10,5.75,11.2],min:[-13.9,0,8.6],max:[-6.1,5.3903,17.3]},preview:{anchor:[18,0,3],entrance:[18,0,10.4],pin:[18,9.3,2.45],min:[12.1,0,-1.9],max:[23.9,8.965,10.265]}},li=(s,e,t)=>new C(s,e,t),Nf=at.clamp;function Df(s){let e=s.getExtension("WEBGL_debug_renderer_info"),t=e?String(s.getParameter(e.UNMASKED_VENDOR_WEBGL)||""):"",n=e?String(s.getParameter(e.UNMASKED_RENDERER_WEBGL)||""):"",i={vendor:t,renderer:n,webglVersion:String(s.getParameter(s.VERSION)||"")},r=!e||!n||/swiftshader|llvmpipe|softpipe|software|\bwarp\b|basic render|lavapipe|microsoft.*render/i.test(n)||!/nvidia|geforce|quadro|radeon|\bamd\b|\bintel\b|apple|adreno|mali|powervr/i.test(`${t} ${n}`);return{identity:i,supported:!r}}function dv(s){if(!(s instanceof ArrayBuffer)||s.byteLength<20||s.byteLength>Dt.assetBytes)throw new Error("Local 3D asset size is invalid");let e=new DataView(s);if(e.getUint32(0,!0)!==1179937895||e.getUint32(4,!0)!==2||e.getUint32(8,!0)!==s.byteLength)throw new Error("Local 3D asset is not a complete GLB 2 file");let t=null;for(let n=12;n<s.byteLength;){if(n+8>s.byteLength)throw new Error("Truncated GLB chunk");let i=e.getUint32(n,!0),r=e.getUint32(n+4,!0);if(i%4||n+8+i>s.byteLength)throw new Error("Invalid GLB chunk bounds");if(r===1313821514){if(t)throw new Error("Duplicate GLB JSON");t=JSON.parse(new TextDecoder().decode(new Uint8Array(s,n+8,i)).replace(/[\u0000\s]+$/,""))}n+=8+i}if(!t||t.asset?.version!=="2.0")throw new Error("Missing GLB scene description");if([...t.buffers||[],...t.images||[]].some(n=>Object.prototype.hasOwnProperty.call(n,"uri")))throw new Error("External GLB resources are not permitted");if((t.extensionsRequired||[]).some(n=>/draco|basisu|meshopt/i.test(n)))throw new Error("External geometry decoders are not permitted");return t}function yr(s){if(!s)return;let e=new Set,t=new Set,n=new Set;s.traverse(i=>{i.geometry&&e.add(i.geometry);for(let r of Array.isArray(i.material)?i.material:[i.material])if(r){t.add(r);for(let o of Object.values(r))o?.isTexture&&n.add(o)}i.dispose?.()}),n.forEach(i=>i.dispose()),t.forEach(i=>i.dispose()),e.forEach(i=>i.dispose())}function _t(s,e=0,t=0){return new At({color:s,metalness:.62,roughness:.43,emissive:e,emissiveIntensity:t})}function On(s,e,t,n,i){let r=new nt(e,t);return n&&r.position.set(...n),i&&(r.name=i),r.castShadow=!0,r.receiveShadow=!0,s.add(r),r}function Rt(s,e,t,n,i){return On(s,new Jt(...e),t,n,i)}function Ji(s,e,t,n,i,r,o=32){return On(s,new mn(e,t,n,o),i,r)}function ci(s,e,t,n,i,r=!0){let o=On(s,new vi(e,t,8,64),n,i);return r&&(o.rotation.x=Math.PI/2),o}function ou(s,e,t,n,i=!1){let r=new Hi(e.map(a=>li(...a)),i,"centripetal"),o=On(s,new ds(r,80,t,6,i),n);return o.castShadow=!1,r}function fv(){let s=new Ze;s.name="ProceduralDistrict";let e=_t(1320246),t=_t(3163227),n=_t(9658945),i=_t(2592157,4450290,2),r=_t(7426447,12286975,1.3),o=_t(11370819,16760162,1.6);Rt(s,[64,1.3,54],e,[0,-1.1,-1]),Rt(s,[53,.4,45],t,[0,-.35,-2]),Ji(s,5.1,5.7,.6,e,[0,.2,0],64),ci(s,4.7,.09,i,[0,.57,0]),[[-11,-17,6.5,r],[9,-15,8,o],[-18,-1,5.3,i],[18,3,5.4,r]].forEach(([d,u,f,g],x)=>{let p=new Ze;p.position.set(d,0,u),s.add(p),Rt(p,[8,.7,7],t,[0,0,0]),Rt(p,[6.2,f,5.1],e,[0,f/2,0]),Rt(p,[6.7,.45,5.6],n,[0,f*.65,0]),Rt(p,[5.6,1.1,4.7],t,[0,f+.4,0]);for(let m=-1;m<=1;m+=2){Rt(p,[.22,f+.7,.25],g,[m*2.8,f/2,2.7]);for(let S=0;S<3;S++)Rt(p,[4.8,.17,.15],g,[0,1.4+S*1.5,2.64])}if(x===0&&(On(p,new $t(2.5,24,12,0,Math.PI*2,0,Math.PI/2),t,[0,f+1,0]),ci(p,2.6,.1,r,[0,f+1,0])),x===1)for(let m=0;m<3;m++)Ji(p,.4,.5,3.5+m,n,[-2+m*1.8,f+1,-1.4]),ci(p,.46,.07,o,[-2+m*1.8,f+2,-1.4]);if(x===2){let m=ci(p,2.1,.27,i,[0,f+2,0],!1);m.rotation.y=.3}x===3&&(Rt(p,[.8,6.8,1.2],t,[-2.5,3.7,3.8]),Rt(p,[.8,6.8,1.2],t,[2.5,3.7,3.8]),Rt(p,[5.5,.8,1.2],r,[0,7,3.8]))});let l=[];for(let d=0;d<18;d++){let u=-27+d*3.15,f=-25-d%3*1.3,g=8+d*7%14;Rt(s,[2.5,g,2.9],d%3?e:t,[u,g/2,f]),Rt(s,[2.8,.22,3.2],n,[u,g*.7,f]),Ji(s,.07,.09,2,i,[u,g+1,f],8);for(let x=1;x<g-1;x+=1.7)for(let p=-1;p<=1;p++)l.push([u+p*.7,x,f+1.49])}let c=new dn(new Jt(.26,.6,.06),i,l.length),h=new Oe;l.forEach((d,u)=>{h.makeTranslation(...d),c.setMatrixAt(u,h)}),s.add(c);for(let d=-1;d<=1;d+=2){Rt(s,[15,.45,2],t,[d*11,4,-9]),Rt(s,[15,.09,.1],i,[d*11,4.35,-7.98]);for(let u=0;u<4;u++)Rt(s,[.4,4,.6],n,[d*(5+u*4),2,-9])}return s}function pv(){let s=new Ze;s.name="AmbientInfrastructure";let e=_t(1585220),t=_t(4024684),n=_t(1534068,3724774,1.8),i=_t(9464382,16758868,1.8),r=ou(s,[[0,.8,7],[-12,.8,9],[-22,.8,0],[-14,.8,-12],[8,.8,-18],[23,.8,-4],[22,.8,12],[9,.8,18]],.07,n,!0);ou(s,[[-26,.3,16],[-9,.3,20],[13,.3,20],[27,.3,9]],.13,e);for(let l=0;l<16;l++){let c=l/16*Math.PI*2,h=Math.cos(c)*25,d=Math.sin(c)*20;Ji(s,.09,.18,2.7,t,[h,1.35,d],8),Rt(s,[.6,.14,.6],i,[h,2.75,d])}ci(s,5.65,.06,n,[0,.75,0]);let o=new dn(new $t(.1,6,4),n,28);s.add(o);let a=new Oe;return{root:s,update(l){for(let c=0;c<28;c++){let h=r.getPointAt((c/28+l*.014)%1);a.makeTranslation(h.x,h.y,h.z),o.setMatrixAt(c,a)}o.instanceMatrix.needsUpdate=!0}}}function mv(){let s=new Ze;s.name="DistantCityAtmosphere";let e=new yt({side:Wt,depthWrite:!1,uniforms:{uTime:{value:0}},vertexShader:`varying vec3 vDirection;
      void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDirection; uniform float uTime;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      void main(){vec3 d=normalize(vDirection);float h=clamp(d.y*.8+.23,0.,1.);
      vec3 c=mix(vec3(.035,.10,.145),vec3(.005,.013,.044),smoothstep(.0,.72,h));
      float horizon=exp(-abs(d.y-.035)*11.);c+=vec3(.035,.075,.09)*horizon;
      float aurora=sin(d.x*5.+d.z*3.+uTime*.018)*.5+.5;
      c+=vec3(.029,.012,.062)*pow(aurora,5.)*exp(-abs(d.y-.24)*6.);
      float stars=step(.9985,hash(floor(d*950.)))*smoothstep(.08,.45,d.y);
      c+=vec3(.48,.66,.8)*stars*.36;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});On(s,new $t(130,32,20),e,[0,0,0]).castShadow=!1;let t=_t(1056304),n=_t(1320765),i=_t(2505554),r=_t(2717569,5621723,1.25),o=_t(7363139,15314800,.85),a=Ji(s,104,108,2.5,t,[0,-4,0],96);a.castShadow=!1;let l=[],c=[];for(let p=0;p<58;p++){let m=-.26+p/57*Math.PI*1.58,S=55+p%4*8,T=Math.cos(m)*S,y=-Math.sin(m)*S-7;if(y>24&&Math.abs(T)<45)continue;let E=10+p*17%33,M=3+p%4;l.push([T,E,y,M]);for(let A=2;A<E;A+=3)for(let _=-1;_<=1;_++)c.push([T+_*M*.24,A-2,y+2.3]);Rt(s,[M+.6,.3,4.6],i,[T,E-2,y]),p%4===0&&Ji(s,.06,.1,4,o,[T,E,y],6)}let h=new dn(new Jt(1,1,1),n,l.length),d=new Oe,u=new C,f=new C,g=new zt;l.forEach(([p,m,S,T],y)=>{f.set(p,m/2-2,S),u.set(T,m,4.5),d.compose(f,g,u),h.setMatrixAt(y,d)}),s.add(h);let x=new dn(new Jt(.24,.65,.06),r,c.length);c.forEach((p,m)=>{d.makeTranslation(...p),x.setMatrixAt(m,d)}),s.add(x);for(let[p,m]of[[-24,-29],[16,-30],[31,-15]]){let S=new nt(new Zr(5.8,36,24,1,!0),new yt({transparent:!0,depthWrite:!1,side:Ht,blending:si,vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec2 vUv;void main(){float a=pow(sin(vUv.x*3.14159265),2.)*pow(1.-vUv.y,2.)*.035;gl_FragColor=vec4(.12,.48,.66,a);}"}));S.position.set(p,18,m),S.rotation.z=.11,s.add(S)}return{root:s,update(p){e.uniforms.uTime.value=p}}}function gv(){let s=new Ze;s.name="IllustrativeIdeaSculpture";let e=_t(6726573,7794158,2.1),t=_t(11828802,16760433,1.6),n=_t(1719123),i=new Ze;s.add(i),On(i,new eo(.46,1),t),ci(i,.76,.035,e,[0,0,0],!1).rotation.y=.7,ci(i,.66,.025,t,[0,0,0]).rotation.z=.5;let r=[];for(let a=0;a<12;a++){let l=new Ze;s.add(l),Rt(l,[.88,.6,.14],n,[0,0,0]),Rt(l,[.79,.045,.04],a%4?e:t,[0,.22,.09]),Rt(l,[.52,.035,.04],e,[-.11,-.06,.09]),r.push(l)}let o=ci(s,3,.055,e,[0,1,0]);return{root:s,update(a,l,c,h){if(s.visible=!h,h)return;let d=c==="crew"?Nf(l/2.7,0,1):c==="hook"?0:1,u=d*d*(3-2*d);i.position.set(at.lerp(6.9,0,u),at.lerp(4,3.5,u)+Math.sin(d*Math.PI)*4+Math.sin(a*1.2)*.12,at.lerp(12.1,0,u)),i.rotation.set(a*.22,a*.7,.3);let f=c==="make"||c==="turn",g=c==="turn"?1:Nf(l/2.1,0,1),x=g*g*(3-2*g);r.forEach((p,m)=>{p.visible=f;let S=m/12*Math.PI*2,T=(m%4-1.5)*1.03,y=2.5+Math.floor(m/4)*.76;p.position.set(at.lerp(Math.cos(S)*6,T,x),at.lerp(1.2+m%3,y,x),at.lerp(Math.sin(S)*6,1.8,x)),p.rotation.set((1-x)*Math.sin(S),(1-x)*S,(1-x)*.3)}),o.visible=f,o.scale.setScalar(1+Math.sin(a*1.6)*.025),o.rotation.z=a*.04}}}function _v(s){let e=new Map;for(let i of Array.isArray(s)?s.slice(0,Dt.workers):[]){if(!i||typeof i.id!="string"||!i.id.trim())continue;let r=String(i.activityKey||i.renderId||i.id).slice(0,96),o=String(i.state||"idle").slice(0,40);e.set(r,{id:r,workerId:String(i.workerId||i.id).slice(0,96),motionAllowed:i.motionAllowed!==!1,quietReason:String(i.quietReason||"").slice(0,120),facility:Object.hasOwn(Ql,i.facility)?i.facility:null,phase:String(i.phase||"").slice(0,40),basis:["observed","reported","inferred"].includes(i.basis)?i.basis:null,state:o,stale:i.stale===!0,terminal:i.terminal===!0||["passed","failed","cancelled","interrupted","timed_out","termination_unknown"].includes(o)})}let t=[...e.values()].sort((i,r)=>i.id<r.id?-1:i.id>r.id?1:0),n=new Map;for(let i of t){let r=i.facility||"hub";n.has(r)||n.set(r,[]),n.get(r).push(i)}for(let[i,r]of n)r.forEach((o,a)=>{if(i==="hub"){let l=a/Math.max(r.length,4)*Math.PI*2;o.position=[Math.cos(l)*3.3,.68,Math.sin(l)*3.3]}else{let l=Ql[i].entrance,c=Math.min(r.length,4);o.position=[l[0]+(a%4-(c-1)/2)*.95,.12,l[2]+1+Math.floor(a/4)*.9]}});return t}function xv(){let s=new Ze;s.name="ProjectedRealCrew";let e=_t(9550021),t=_t(1058874),n=_t(9333319),i=_t(7133154,4904166,.65),r=[[new $t(.37,12,8),e,[0,.78,0],[1,1.18,.8]],[new $t(.43,12,8),e,[0,1.43,0],[1.12,.65,.78]],[new Jt(.67,.25,.13),t,[0,1.44,.3],[1,1,1]],[new $t(.075,8,6),i,[-.17,1.46,.4],[1,1,1]],[new $t(.075,8,6),i,[.17,1.46,.4],[1,1,1]],[new Jt(.16,.58,.19),n,[-.48,.88,0],[1,1,1]],[new Jt(.16,.58,.19),n,[.48,.88,0],[1,1,1]],[new vi(.3,.035,6,20),i,[0,.27,0],[1,1,1]]].map(([g,x,p,m],S)=>{let T=new dn(g,x,Dt.workers);return T.count=0,T.castShadow=S<3,T.receiveShadow=!0,T.instanceMatrix.setUsage(Ro),s.add(T),{mesh:T,offset:li(...p).applyAxisAngle(li(0,1,0),Math.PI/4),scale:li(...m),ring:S===7,arm:S===5||S===6}}),o=[],a=!1,l=new Oe,c=new zt,h=new In,d=new C,u=[8248550,16761209,12493288,10343865];function f(g,x=!1){if(!(!a&&!x)){o.forEach((p,m)=>{let S=p.motionAllowed&&!p.stale&&!p.terminal&&jl.has(p.state),T=[...p.id].reduce((E,M)=>E*31+M.charCodeAt(0)>>>0,0),y=S?Math.sin(g*2+T%13)*.065:0;for(let E of r)d.set(...p.position).add(E.offset),d.y+=y,h.set(E.ring?Math.PI/2:0,Math.PI/4,E.arm&&S?Math.sin(g*1.1+m)*.1:0),c.setFromEuler(h),l.compose(d,c,E.scale),E.mesh.setMatrixAt(m,l),x&&E.mesh.setColorAt(m,new Ce(p.stale||p.terminal?8950941:Of.has(p.state)?16761209:u[T%u.length]))});for(let p of r)p.mesh.instanceMatrix.needsUpdate=!0,x&&p.mesh.instanceColor&&(p.mesh.instanceColor.needsUpdate=!0),p.mesh.computeBoundingSphere()}}return{root:s,update:f,set(g){o=g,a=o.some(x=>x.motionAllowed&&!x.stale&&!x.terminal&&jl.has(x.state));for(let x of r)x.mesh.count=o.length;f(0,!0)}}}function vv(){let s=new Ze;s.name="ProceduralHost";let e=_t(4350065),t=_t(1056301),n=_t(10711875),i=_t(8970217,5169133,1.8),r=new Ze;r.name="Head",r.position.y=2.25,s.add(r),On(r,new $t(.78,24,16),e,[0,0,0]).scale.set(1.25,.74,.67),Rt(r,[1.35,.52,.18],t,[0,0,.49]);for(let a=-1;a<=1;a+=2)On(r,new $t(.16,16,12),i,[a*.34,.03,.61]);ou(r,[[-.22,-.17,.62],[0,-.23,.65],[.22,-.17,.62]],.025,i),On(s,new $r(.75,1),e,[0,1.25,0]).scale.set(1,1.06,.65);let o=On(s,new $t(.25,16,12),i,[0,1.3,.47],"Core");for(let a=-1;a<=1;a+=2){let l=new Ze;l.name=a<0?"ArmL":"ArmR",l.position.set(a*.82,1.65,0),s.add(l),Rt(l,[.24,.85,.29],n,[a*.12,-.37,0]),On(l,new $t(.2,12,8),e,[a*.15,-.83,.1])}return Ji(s,.54,.34,.24,n,[0,.5,0]),ci(s,.65,.055,i,[0,.24,0]),{root:s,head:r,core:o,armL:s.getObjectByName("ArmL"),armR:s.getObjectByName("ArmR")}}function yv(s,e){let t=0,n=0,i=new Set;if(s.traverse(r=>{if(r.isMesh){n++,t+=(r.geometry.index?.count||r.geometry.attributes.position?.count||0)/3*(r.isInstancedMesh?r.count:1);for(let o of Array.isArray(r.material)?r.material:[r.material])for(let a of Object.values(o||{}))a?.isTexture&&i.add(a);r.castShadow=!0,r.receiveShadow=!0}}),t>Dt[e==="world"?"worldTriangles":"hostTriangles"]||n>Dt[e==="world"?"worldMeshes":"hostMeshes"]||i.size>Dt.sceneTextures)throw new Error("Local 3D asset exceeds the scene budget");return{triangles:t,meshes:n,textures:i.size}}async function Mv(s){if(!["district-world.glb","district-host.glb"].includes(s))throw new Error("Unknown district asset");if(typeof window.bus?.districtReadAsset!="function")throw new Error("Local asset bridge unavailable; procedural 3D retained");let e=await window.bus.districtReadAsset(s);if(typeof e?.base64!="string"||e.base64.length>Math.ceil(Dt.assetBytes/3)*4+4)throw new Error("Invalid local asset response");let t=atob(e.base64),n=new Uint8Array(t.length);for(let i=0;i<t.length;i++)n[i]=t.charCodeAt(i);return dv(n.buffer),n.buffer}function Sv({container:s,view:e="cinematic",showcase:t=!1}={}){if(!s?.appendChild)throw new TypeError("District world requires a container");let n=document.createElement("div");n.className="daw-world",n.setAttribute("aria-hidden","true");let i=document.createElement("canvas");i.setAttribute("aria-hidden","true"),n.appendChild(i),s.prepend(n);let r={ready:!1,phase:"initializing",renderer:"webgl2",frames:0,renderedFrames:0,fps:0,cpuFrameMs:0,cpuFrameEMA:0,width:0,height:0,dpr:0,maxDPR:Dt.maxDPR,maxFPS:Dt.maxFPS,pixelBudget:Dt.pixelBudget,drawCalls:0,triangles:0,memory:{geometries:0,textures:0},gpu:{vendor:"",renderer:"",webglVersion:""},paused:!1,contextLost:!1,disposed:!1,worldAsset:"procedural",hostAsset:"procedural",assetErrors:{},assetStats:{},beat:"hook",view:e==="management"?"management":"cinematic",engaged:!1,activity:{state:"idle",label:""},workerCount:0,gpuWorkersReady:!1,bloom:!1,limits:Dt,error:null},o,a,l,c,h,d,u,f,g,x,p,m=0,S=!1,T=!1,y=!1,E=!document.hidden&&document.visibilityState!=="hidden",M=!0,A,_=!0,w=window.matchMedia?.("(prefers-reduced-motion: reduce)"),I=!1,L=0,U=0,O=0,N=0,B=0,q=0,G=1,j,X,$,ne,Te,le,Fe=[],Be="",Qe,K,ee,ye=!1,Ue=100,ie="idle",ce=new Ze,Mt=new Ze,Ve=li(...Ai.hook.target),Je=li(...Ai.hook.position),ut=li(...Ai.hook.position),Ke=li(...Ai.hook.target),tt=new Map,wt=Uf.default.createTestPerformance(),Qt=!1,lt=null,Tt=t===!0,D=null,dt=0,We=null,R=0,v=!1,z=0,W=0,Y=null,oe=!1,ue=!1;function Z(){le&&(ue&&(le.set(Fe),r.ambientTraffic={count:0,representsAgentWork:!1},r.robotFamily={source:"district-host.glb",scale:.65,sharedAntennaAndRockets:!0}),le.update(L,!!w?.matches))}let Q="",de=null,Ae=!1,me="",re=null,Re=0,Ne=!1,ze={},F=()=>({position:ce.position.clone(),quaternion:ce.quaternion.clone(),cameraPosition:u.position.clone(),cameraQuaternion:u.quaternion.clone(),fov:u.fov,joints:new Map([...tt].map(([te,ge])=>[te,ge.node.quaternion.clone()])),sensor:We?.sensorPose||null,welcome:We?.lighting?.welcome??1,power:We?.thrustPower??.1}),fe=()=>JSON.parse(JSON.stringify(r)),J=()=>i.dispatchEvent(new CustomEvent("district-world-state",{detail:fe()})),pe=()=>{m&&cancelAnimationFrame(m),m=0,O=0,N=0},_e=()=>{if(a){for(let te of a.passes)te.dispose?.();a.dispose(),a=null,l=null,r.bloom=!1}},se=()=>!!o&&!!u&&!r.error&&!S&&!T&&!y&&E&&M&&_,Le=()=>se()&&!w?.matches&&r.ready,Me=()=>{I=!0,se()&&!m&&(m=requestAnimationFrame($i))},ct=te=>{pe(),r.ready=!1,r.gpuWorkersReady=!1,r.paused=!0,r.phase="error",r.error=String(te?.message||te).slice(0,240),n.classList.remove("is-ready"),n.dataset.state="error",J()},st=()=>{Tt&&(r.worldAsset!=="loaded"||r.hostAsset!=="loaded")||(r.gpuWorkersReady=!!le,r.ready||(r.ready=!0,r.phase=r.paused?"paused":"ready",n.classList.add("is-ready"),n.dataset.state="ready",J()))},Ut=()=>{r.nativeVisible=M,r.paused=y||!E||!M||!_||!!w?.matches,r.ready&&(r.phase=r.paused?"paused":"ready"),Le()||se()&&I?m||(m=requestAnimationFrame($i)):pe()};function yn(){let te=new ql,ge=new fr(o);try{h?.dispose(),h=ge.fromScene(te,.04),d.environment=h.texture,d.environmentIntensity=.42,r.ibl=!0}catch{d.environment=null,r.ibl=!1}finally{te.dispose(),ge.dispose()}}function ec(){if(!(a||r.view!=="cinematic"))try{a=new Gl(o),l=new Wl(d,u),a.addPass(l),c=new xr(new ae(1,1),.27,.6,1.2),a.addPass(c),a.addPass(new Xl),r.bloom=!0}catch{_e()}}function Uo(){tt.clear();for(let te of["Head","ArmL","ArmR","Core"]){let ge=j?.root?.getObjectByName(te);ge&&tt.set(te,{node:ge,rotation:ge.rotation.clone(),scale:ge.scale.clone()})}}function Fo(te,ge){let Se=te/ge;f.aspect=Se,f.updateProjectionMatrix();let rt=Fn.verticalSpan/2;g.left=-rt*Se,g.right=rt*Se,g.top=rt,g.bottom=-rt,g.updateProjectionMatrix()}function Ms(){let te=r.view==="management";n.dataset.view=r.view,r.maxFPS=te?Dt.managementFPS:Dt.maxFPS,r.maxDPR=te?Dt.managementDPR:Dt.maxDPR,r.pixelBudget=te?Dt.managementPixelBudget:Dt.pixelBudget,r.camera=te?{type:"orthographic",position:[...Fn.position],target:[...Fn.target],verticalSpan:Fn.verticalSpan}:{type:"perspective"},!(!f||!g)&&(u=te?g:f,u.updateMatrixWorld(!0),te?_e():ec(),l&&(l.camera=u),ce.visible=!0,Mt.visible=!te,Te&&(Te.root.visible=!te&&!r.engaged),Bn(),Me(),J())}function Oo(te){let ge=Tt&&Ne&&Ae&&D?F():null;L+=te,U+=te,Ue+=te,G=Math.min(1,G+te/2.6);let Se=G*G*(3-2*G);r.view==="cinematic"&&!oe&&(Je.lerpVectors(Qe||Je,ut,Se),Ve.lerpVectors(K||Ve,Ke,Se),u.position.copy(Je),u.position.x+=Math.sin(L*.13)*.6,u.position.y+=Math.sin(L*.17)*.25,u.fov=at.lerp(ee||u.fov,Ai[r.beat].fov+(r.engaged?2:0),Se),u.updateProjectionMatrix(),u.lookAt(Ve));let rt=Of.has(ie),on=jl.has(ie),zn=rt?.025:.11;ce.position.y=.95+Math.sin(L*1.7)*zn,ce.rotation.y=Math.atan2(u.position.x-ce.position.x,u.position.z-ce.position.z)+Math.sin(L*.45)*.035;let fn=tt.get("Head");fn&&(fn.node.rotation.copy(fn.rotation),fn.node.rotation.y+=Math.sin(L*.55)*.1,fn.node.rotation.z+=Math.sin(L*.7)*.035);for(let P of["ArmL","ArmR"]){let V=tt.get(P);if(!V)continue;V.node.rotation.copy(V.rotation);let k=P==="ArmL"?1:-1;V.node.rotation.z+=k*(.05+Math.sin(L*1.15+k)*(rt?.015:.055)),!r.engaged&&r.beat==="hook"&&!rt&&!on&&P==="ArmL"&&(V.node.rotation.z+=Math.max(0,Math.sin(L*.65))*.42,V.node.rotation.x-=Math.max(0,Math.sin(L*.65))*.3),on&&(V.node.rotation.x-=.16+Math.sin(L*.8)*.035),Ue<1.8&&ie==="passed"&&(V.node.rotation.z+=k*Math.sin(Ue/1.8*Math.PI)*.18)}let hi=tt.get("Core");hi&&(hi.node.rotation.copy(hi.rotation),hi.node.rotation.y+=L*.25),$.update(L),ne.update(L),Z(),Te.update(L,U,r.beat,r.engaged||r.view==="management");let b=d.getObjectByName("ActualWorkAccent");if(b.intensity=ie==="building"||ie==="testing"?9:rt?3:0,b.color.set(rt?16757850:ie==="building"?16758623:6612205),b.position.set(ie==="building"?9:ie==="testing"?-18:5,4,ie==="building"?-15:ie==="testing"?-1:12),Qt&&r.view==="cinematic"){let P=wt.sample(te,!!w?.matches);r.testScene=tu({sample:P,time:L,hostGroup:ce,joints:tt,actor:lt,camera:u,reduced:!!w?.matches}),Te.root.visible=!1,Mt.visible=!1,b.position.set(-18,4,5),b.intensity=P.active?9:P.state==="failed"?3:0,b.color.set(P.state==="failed"?16757850:6612205),d.getObjectByName("HostPracticalLight")?.position.set(ce.position.x+2,6,ce.position.z+3)}if(Tt&&r.view==="cinematic"){if(Te.root.visible=!1,Mt.visible=!1,ce.visible=!!D,D)if(!Ne)dt=Math.min(D.duration,dt+te),We=D.pose(dt,{reducedMotion:!!w?.matches}),o.toneMappingExposure=We.lighting.exposure,r.showcase={elapsed:dt,phase:Ae?"unknown":dt<D.duration?"opening":"ready",shotId:dt>=D.duration?"W01":We.shotId,projectId:Q,runId:de?.id||null,candidateHash:de?.artifact?.candidateHash||de?.source?.hash||"",handoff:!1,camera:{position:u.position.toArray(),target:u.getWorldDirection(new C).multiplyScalar(6).add(u.position).toArray(),fov:u.fov},hostPosition:ce.position.toArray(),muted:!0,faceVisible:We.faceVisible,lighting:We.lighting};else{re||(We||(We=D.pose(dt,{reducedMotion:!!w?.matches})),re=F(),Re=0);let P=wt.sample(Ae?0:te,!!w?.matches);if(Ae){if(ge){ce.position.copy(ge.position),ce.quaternion.copy(ge.quaternion),u.position.copy(ge.cameraPosition),u.quaternion.copy(ge.cameraQuaternion),u.fov=ge.fov,u.updateProjectionMatrix();for(let[H,he]of ge.joints)tt.get(H)?.node.quaternion.copy(he)}r.testScene={...P},D.thrusters.pose(L,.1,{reducedMotion:!!w?.matches})}else{re.sensor&&(P.extension=Math.max(P.extension,re.sensor.extension),P.open=Math.max(P.open,re.sensor.open));let H=tu({sample:P,time:L,hostGroup:ce,joints:tt,actor:lt,camera:f,reduced:!!w?.matches}),he=w?.matches?1:at.smoothstep(Re,0,1.8);ce.position.lerpVectors(re.position,ce.position.clone(),he),ce.quaternion.slerpQuaternions(re.quaternion,ce.quaternion.clone(),he),u.position.lerpVectors(re.cameraPosition,u.position.clone(),he),u.quaternion.slerpQuaternions(re.cameraQuaternion,u.quaternion.clone(),he),u.fov=at.lerp(re.fov,u.fov,he),u.updateProjectionMatrix();for(let[xe,we]of tt){let Ie=re.joints.get(xe);Ie&&we.node.quaternion.slerpQuaternions(Ie,we.node.quaternion.clone(),he)}let be=D.setMood(at.lerp(re.welcome,1,he));o.toneMappingExposure=be.exposure,D.thrusters.pose(L,at.lerp(re.power,.1,he),{reducedMotion:!!w?.matches}),r.testScene=H,Re+=te}b.position.set(P.target?.[0]??-18,4,(P.target?.[2]??7)-4),b.intensity=P.active?5:0;let V=u.getWorldDirection(new C).multiplyScalar(6).add(u.position).toArray(),k={notice:"T01A",uncertain:"T01A",deploy:"T01B",search:"T01B",lock:"T01B",turn:"T01C",travel:"T01C",watch:"T01D",result:"T01E",stopped:"T01E",inspect:"R01",ready:"W01"}[P.phase]||"W01";r.showcase={elapsed:dt,phase:P.phase,shotId:k,projectId:Q,runId:P.runId,candidateHash:P.candidateHash,handoff:!0,handoffAge:Re,camera:{position:u.position.toArray(),target:V,fov:u.fov},hostPosition:ce.position.toArray(),state:P.state,passed:P.passed,total:P.total,checkKind:P.checkKind,facility:P.facility,basis:P.basis,muted:!0}}if(D&&(dt>=D.duration||Ne)){Y||(Y={position:u.position.clone(),target:u.getWorldDirection(new C).multiplyScalar(3).add(u.position),fov:u.fov||43}),W+=te;let P=w?.matches?1:at.smoothstep(W,0,5.5),V=new C(...Fn.position),k=new C(...Fn.target);if(P<1){u=f,u.position.lerpVectors(Y.position,V,P),u.lookAt(Y.target.clone().lerp(k,P));let H=at.radToDeg(2*Math.atan(Fn.verticalSpan/2/V.distanceTo(k)));u.fov=at.lerp(Y.fov,H,P),u.updateProjectionMatrix()}else oe=!0,u=g,u.position.copy(V),u.lookAt(k),u.updateProjectionMatrix();l&&(l.camera=u),r.camera={type:oe?"orthographic":"perspective",position:u.position.toArray(),target:k.toArray(),verticalSpan:oe?Fn.verticalSpan:null},r.showcase={...r.showcase,overview:!0,pullback:P,shotId:Ne?r.showcase?.shotId:"W02",workerScale:.65}}u.isPerspectiveCamera&&(z=0,u.filmOffset=z,u.updateProjectionMatrix(),r.showcase&&(r.showcase.outputFraming={open:v,filmOffset:z}))}}function Mr(){if(S||T||!o)return!1;let te=performance.now();try{if(o.info.reset(),a)try{a.render()}catch{_e(),o.setRenderTarget(null),o.info.reset(),o.render(d,u)}else o.render(d,u);let ge=o.info;if(r.frames++,r.renderedFrames=r.frames,r.drawCalls=ge.render.calls,r.triangles=ge.render.triangles,r.memory={geometries:ge.memory.geometries,textures:ge.memory.textures},r.cpuFrameMs=performance.now()-te,r.cpuFrameEMA=r.cpuFrameEMA?r.cpuFrameEMA*.94+r.cpuFrameMs*.06:r.cpuFrameMs,ge.render.calls>Dt.drawCalls||ge.render.triangles>Dt.frameTriangles||ge.memory.textures>Dt.textures)throw new Error("GPU scene exceeded its measured resource budget");return st(),!0}catch(ge){return ct(ge),!1}}function $i(te){if(m=0,!se()||!Le()&&!I)return;if(te+.2<N){m=requestAnimationFrame($i);return}let ge=O?Math.min(.05,(te-O)/1e3):1/60;O=te,I=!1,N=Math.max(N+1e3/r.maxFPS,te+1e3/r.maxFPS-1),Oo(Le()?ge:0),Mr()&&(q++,B||(B=te),te-B>=1e3&&(r.fps=q*1e3/(te-B),q=0,B=te),(Le()||I)&&(m=requestAnimationFrame($i)))}function Bn(){if(!o||S||T)return;let te=s.getBoundingClientRect(),ge=Math.max(1,Math.round(s.clientWidth||te.width)),Se=Math.max(1,Math.round(s.clientHeight||te.height)),rt=Math.min(window.devicePixelRatio||1,r.maxDPR,Math.sqrt(r.pixelBudget/(ge*Se)));o.setPixelRatio(rt),o.setSize(ge,Se,!1),a?.setPixelRatio(rt),a?.setSize(ge,Se),Fo(ge,Se),Object.assign(r,{width:ge,height:Se,dpr:rt,backbufferWidth:i.width,backbufferHeight:i.height}),u.updateMatrixWorld(!0),Me(),J()}async function Ss(te,ge){r[`${te}Asset`]="loading",J();let Se;try{let rt=await Mv(ge);if(S)return;let on=new tr;if(on.setURLModifier(()=>{throw new Error("External asset resource denied")}),Se=(await new Bl(on).parseAsync(rt,"")).scene,S){yr(Se);return}let zn=yv(Se,te),fn=te==="world"?"host":"world";if(zn.textures+(r.assetStats[fn]?.textures||0)>Dt.sceneTextures)throw new Error("Combined scene texture budget exceeded");te==="world"?(d.remove(X),yr(X),X=Se,d.add(Se)):(D?.destroy(),lt?.dispose(),ce.remove(j.root),yr(j.root),j={root:Se},ce.add(Se),Uo(),lt=Cf(Se),D=Pf({scene:d,hostGroup:ce,joints:tt,actor:lt,camera:f,lights:ze}),le&&(d.remove(le.root),ue?le.dispose():yr(le.root)),lt.sensor.pose({extension:1,open:1,scanYaw:0,scanPitch:-.12,locked:!1}),le=Lf({template:ce,scale:.65}),ue=!0,d.add(le.root),Z()),r[`${te}Asset`]="loaded",r.assetStats[te]=zn,Me(),J()}catch(rt){if(Se&&!Se.parent&&yr(Se),S)return;r[`${te}Asset`]="error",r.assetErrors[te]=String(rt?.message||rt).slice(0,180),J()}}function Sr(){E=!document.hidden&&document.visibilityState!=="hidden",Ut()}function br(te){te.preventDefault(),T=!0,r.contextLost=!0,ct(new Error("Graphics context lost; illustrated view retained"))}function ji(){if(S)return;let te=Df(o.getContext());if(r.gpu=te.identity,!te.supported){ct(new Error("Restored graphics backend is not verified hardware"));return}T=!1,r.contextLost=!1,r.error=null,yn(),Bn(),Me(),Ut()}let Ri=Object.freeze({setShowcaseContext(te={}){if(S)return;Tt=!0;let ge=typeof te.projectId=="string"?te.projectId.slice(0,160):"",Se=te.run&&te.run.projectId===ge?te.run:null,rt=te.unavailable===!0||!!(te.run&&!Se),on=JSON.stringify([ge,Se?.id||"",Se?.created||0]),zn=!!Se&&(jl.has(Se.state)||["queued","starting","assigned","starting_agent","agent_working","agent_review"].includes(Se.state)||te.follow===!0);on!==me&&(D?re=F():re=null,Re=0,Ne=zn||Ne&&!!Se,!Ne&&dt>0&&(dt=Math.min(12,dt)),me=on),Q=ge,de=Se,Ae=rt,v=te.outputVisible===!0;let fn=te.activity&&te.activity.projectId===ge&&(!Se||te.activity.runId===Se.id)?te.activity:null;wt.setRun(Se?{...Se,presentationFacility:Ff.default.facilityFor(Se,fn),presentationBasis:fn?.basis||"observed"}:null,{follow:te.follow===!0,unavailable:rt,startPosition:re?.position?.toArray()}),Me()},setTestRun(te,ge){S||(Qt=!0,wt.setRun(te,ge),Me())},setBeat(te){S||!Ai[te]||r.beat===te||(r.beat=te,U=0,f&&(Qe=Je.clone(),K=Ve.clone(),ee=f.fov,ut.set(...Ai[te].position),Ke.set(...Ai[te].target),G=w?.matches?1:0,Me()))},setView(te){S||!["management","cinematic"].includes(te)||te===r.view||(r.view=te,N=0,Ms())},setWorkers(te){if(S)return;let ge=_v((Array.isArray(te)?te:[]).filter(rt=>rt&&(rt.runId||rt.sessionId))),Se=JSON.stringify(ge);Se!==Be&&(Be=Se,Fe=ge,le?.set(Fe),r.workerCount=Fe.length,r.gpuWorkersReady=!!le&&r.ready,Me(),J())},getLayout(){let te=Object.fromEntries(Object.entries(Ql).map(([ge,Se])=>[ge,{entrance:Se.entrance,pin:Se.pin,bounds:{min:Se.min,max:Se.max},footprint:[[Se.min[0],0,Se.min[2]],[Se.max[0],0,Se.min[2]],[Se.max[0],0,Se.max[2]],[Se.min[0],0,Se.max[2]]]}]));return JSON.parse(JSON.stringify({hub:[0,0,0],hubDetails:{anchor:[0,.55,0],entrance:[0,.55,5.4],pin:[0,.7,0]},facilities:Object.fromEntries(Object.entries(Ql).map(([ge,Se])=>[ge,Se.anchor])),facilityDetails:te,featuredHost:{position:ce.position.toArray(),scale:ce.scale.x},workers:Object.fromEntries(Fe.map(ge=>[ge.id,ge.position]))}))},projectPoint(te){if(S||!u||!Array.isArray(te)||te.length!==3||!te.every(Number.isFinite))return{x:0,y:0,visible:!1};u.updateMatrixWorld(!0);let ge=li(...te).project(u);return{x:(ge.x+1)*r.width/2,y:(1-ge.y)*r.height/2,visible:Number.isFinite(ge.x+ge.y+ge.z)&&ge.x>=-1&&ge.x<=1&&ge.y>=-1&&ge.y<=1&&ge.z>=-1&&ge.z<=1}},setEngaged(te){S||(r.engaged=!!te,Me())},setActivity(te={}){if(S)return;let ge=uv.has(te.state)?te.state:"unknown",Se=ie!==ge;ie=ge,r.activity={state:ge,label:String(te.label||"").replace(/[\u0000-\u001f]/g," ").slice(0,180)},Se&&(Ue=ye?0:100),ye=!0,Me()},setPaused(te){S||(y=!!te,Ut())},getDiagnostics:fe,destroy(){S||(S=!0,pe(),x?.disconnect(),p?.disconnect(),document.removeEventListener("visibilitychange",Sr),w?.removeEventListener?.("change",Ut),A?.(),i.removeEventListener("webglcontextlost",br),i.removeEventListener("webglcontextrestored",ji),D?.destroy(),lt?.dispose(),yr(d),_e(),h?.dispose(),o?.renderLists.dispose(),o?.dispose(),o?.forceContextLoss(),r.ready=!1,r.gpuWorkersReady=!1,r.disposed=!0,r.paused=!0,r.phase="destroyed",r.memory={geometries:0,textures:0},ru.delete(Ri),window.__districtWorld===Ri&&(window.__districtWorld=null),n.remove(),J())}});Object.defineProperty(i,"__districtWorldDiagnostics",{value:fe,configurable:!1}),ru.add(Ri),window.__districtWorld=Ri;try{let te=i.getContext("webgl2",{alpha:!0,antialias:!0,powerPreference:"high-performance",failIfMajorPerformanceCaveat:!0,preserveDrawingBuffer:!1});if(!te)throw new Error("Hardware WebGL2 is unavailable");let ge=Df(te);if(r.gpu=ge.identity,!ge.supported)throw new Error("A verified hardware GPU is required; illustrated view retained");o=new Ul({canvas:i,context:te,alpha:!0,antialias:!0,powerPreference:"high-performance"}),o.outputColorSpace=It,o.toneMapping=ms,o.toneMappingExposure=.98,o.shadowMap.enabled=!0,o.shadowMap.type=Va,o.info.autoReset=!1,d=new as,d.background=new Ce(397342),d.fog=new kr(1320254,.0105),yn(),f=new Bt(Ai.hook.fov,1,.2,220),f.position.copy(Je),f.lookAt(Ve),g=new Ln(-51,51,34,-34,Fn.near,Fn.far),g.position.set(...Fn.position),g.lookAt(li(...Fn.target)),u=r.view==="management"?g:f,ze.ambient=new oo(10410490,1253427,2.15),d.add(ze.ambient);let Se=new Gi(10537215,3);Se.position.set(-22,38,12),Se.castShadow=!0,Se.shadow.mapSize.set(1024,1024),Object.assign(Se.shadow.camera,{left:-38,right:38,top:36,bottom:-32,near:1,far:95}),Se.shadow.bias=-6e-4,Se.shadow.normalBias=.08,d.add(Se),ze.key=Se;let rt=new Gi(16758124,2.1);rt.position.set(23,16,-15),d.add(rt),ze.rim=rt;let on=new xn(9627391,26,15,2);on.name="HostPracticalLight",on.position.set(7,6,15),d.add(on),ze.practical=on;let zn=new xn(6612205,0,14,2);zn.name="ActualWorkAccent",d.add(zn),X=fv(),d.add(X),$=pv(),d.add($.root),ne=mv(),d.add(ne.root),le=xv(),d.add(le.root),le.set(Fe),Te=gv(),d.add(Te.root),j=vv(),ce.name="AnimatedHost",ce.position.set(5,.95,12),ce.scale.setScalar(.65),ce.add(j.root),d.add(ce),Uo();let fn=_t(2442840),hi=_t(1926516,4773865,1.5);Ji(Mt,2.5,2.8,.18,fn,[5,.65,12],48),ci(Mt,2.35,.045,hi,[5,.77,12]),d.add(Mt),i.addEventListener("webglcontextlost",br),i.addEventListener("webglcontextrestored",ji),document.addEventListener("visibilitychange",Sr),w?.addEventListener?.("change",Ut),typeof window.bus?.onDistrictWindowVisibility=="function"&&(A=window.bus.onDistrictWindowVisibility(b=>{M=typeof b=="boolean"?b:b?.visible===!0,Ut()})),x=new ResizeObserver(Bn),x.observe(s),typeof IntersectionObserver<"u"&&(p=new IntersectionObserver(b=>{_=b[0]?.isIntersecting!==!1,Ut()}),p.observe(n)),Ms(),Oo(0),I=!1,Mr(),Ut(),Ss("world","district-world.glb"),Ss("host","district-host.glb")}catch(te){ct(te)}return Ri}typeof window<"u"&&(window.DistrictAttractWorld=Object.freeze({mount:Sv,instances:()=>[...ru].map(s=>s.getDiagnostics())}));})();
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
