import * as js from './imageProcessor.js';
import cvMod from '@techstark/opencv-js';
let cvp;const getCv=()=>cvp||(cvp=(async()=>{const m=await cvMod;if(m&&m.Mat)return m;return new Promise(r=>{cvMod.onRuntimeInitialized=()=>r(cvMod)})})());
const norm=d=>{let mn=Infinity,mx=-Infinity;for(const v of d){if(v<mn)mn=v;if(v>mx)mx=v}const s=255/((mx-mn)||1),o=new Uint8Array(d.length);for(let i=0;i<o.length;i++)o[i]=(d[i]-mn)*s+.5;return{o,mn,mx}};
const cvOps={
  Gaussian:(cv,d,w,h,p)=>{const k=2*Math.ceil(3*p.s)+1,a=new cv.Mat(h,w,cv.CV_32FC1),b=new cv.Mat();a.data32F.set(d);
    cv.GaussianBlur(a,b,new cv.Size(k,k),p.s,p.s,cv.BORDER_REPLICATE);const r=new Float32Array(b.data32F);a.delete();b.delete();return r},
  Median:(cv,d,w,h,p)=>{const{o,mn,mx}=norm(d),a=new cv.Mat(h,w,cv.CV_8UC1),b=new cv.Mat();a.data.set(o);cv.medianBlur(a,b,p.n);
    const r=new Float32Array(d.length),u=b.data;for(let i=0;i<r.length;i++)r[i]=u[i]/255*(mx-mn)+mn;a.delete();b.delete();return r},
  Canny:(cv,d,w,h,p)=>{const{o}=norm(d),a=new cv.Mat(h,w,cv.CV_8UC1),b=new cv.Mat(),e=new cv.Mat();a.data.set(o);
    cv.GaussianBlur(a,b,new cv.Size(5,5),1.4,1.4,cv.BORDER_REPLICATE);cv.Canny(b,e,p.lo*4,p.hi*4,3,true);const r=Float32Array.from(e.data);a.delete();b.delete();e.delete();return r}};
const jsOps={Threshold:(d,w,h,p)=>js.threshold(d,p.t),Gaussian:(d,w,h,p)=>js.gaussian(d,w,h,p.s),Median:(d,w,h,p)=>js.median(d,w,h,p.n),Canny:(d,w,h,p)=>js.canny(d,w,h,p.lo,p.hi)};
onmessage=async({data:{id,op,d,w,h,p,engine}})=>{let out=null,used='JavaScript';
  try{if(engine==='opencv'&&cvOps[op]){out=cvOps[op](await getCv(),d,w,h,p);used='OpenCV.js'}}catch(e){out=null}
  if(!out)out=jsOps[op](d,w,h,p);postMessage({id,out,used},[out.buffer])};
