export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export function threshold(d,t){const o=new Float32Array(d.length);for(let i=0;i<d.length;i++)o[i]=d[i]>=t?255:0;return o}
export function gaussian(d,w,h,s){
  const r=Math.max(1,Math.ceil(3*s)),k=[];let sum=0;
  for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*s*s));k.push(v);sum+=v}
  for(let i=0;i<k.length;i++)k[i]/=sum;
  const t=new Float32Array(d.length),o=new Float32Array(d.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0;for(let i=-r;i<=r;i++)a+=k[i+r]*d[y*w+clamp(x+i,0,w-1)];t[y*w+x]=a}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0;for(let i=-r;i<=r;i++)a+=k[i+r]*t[clamp(y+i,0,h-1)*w+x];o[y*w+x]=a}
  return o}
export function median(d,w,h,n=3){
  const r=n>>1,o=new Float32Array(d.length),b=new Float32Array(n*n);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let c=0;
    for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)b[c++]=d[clamp(y+j,0,h-1)*w+clamp(x+i,0,w-1)];
    b.sort();o[y*w+x]=b[c>>1]}
  return o}
const DIRS=[[1,0],[1,1],[0,1],[-1,1]];
export function canny(d,w,h,lo,hi){
  let mn=Infinity,mx=-Infinity;for(const v of d){if(v<mn)mn=v;if(v>mx)mx=v}
  const sc=255/((mx-mn)||1),n=gaussian(d.map(v=>(v-mn)*sc),w,h,1.4);
  const P=(x,y)=>n[clamp(y,0,h-1)*w+clamp(x,0,w-1)],g=new Float32Array(d.length),dir=new Uint8Array(d.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const gx=-P(x-1,y-1)-2*P(x-1,y)-P(x-1,y+1)+P(x+1,y-1)+2*P(x+1,y)+P(x+1,y+1);
    const gy=-P(x-1,y-1)-2*P(x,y-1)-P(x+1,y-1)+P(x-1,y+1)+2*P(x,y+1)+P(x+1,y+1);
    const i=y*w+x;g[i]=Math.hypot(gx,gy)/4;let a=Math.atan2(gy,gx)*180/Math.PI;if(a<0)a+=180;
    dir[i]=a<22.5||a>=157.5?0:a<67.5?1:a<112.5?2:3}
  const G=(x,y)=>x<0||y<0||x>=w||y>=h?0:g[y*w+x],o=new Float32Array(d.length),st=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,[dx,dy]=DIRS[dir[i]];
    if(g[i]>=lo&&g[i]>=G(x+dx,y+dy)&&g[i]>=G(x-dx,y-dy)){if(g[i]>=hi){o[i]=255;st.push(i)}else o[i]=100}}
  while(st.length){const i=st.pop(),x=i%w,y=(i/w)|0;
    for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const a=x+k,b=y+j;if(a<0||b<0||a>=w||b>=h)continue;const q=b*w+a;if(o[q]===100){o[q]=255;st.push(q)}}}
  for(let i=0;i<o.length;i++)if(o[i]!==255)o[i]=0;
  return o}
export function histogram(d,bins=128){
  let mn=Infinity,mx=-Infinity;for(const v of d){if(v<mn)mn=v;if(v>mx)mx=v}
  const c=new Array(bins).fill(0),s=(mx-mn)||1;for(const v of d)c[Math.min(bins-1,((v-mn)/s*bins)|0)]++;
  return{counts:c,min:mn,max:mx}}
