// Modular: add regionGrow(...) etc. next to thresholdSegment; all return Uint8Array masks (1 = inside).
export function thresholdSegment(d,lo,hi){const m=new Uint8Array(d.length);for(let i=0;i<d.length;i++)m[i]=d[i]>=lo&&d[i]<=hi?1:0;return m}
export function maskStats(m){let c=0;for(const v of m)c+=v;return{pixels:c,percent:m.length?100*c/m.length:0}}
export function maskToRGBA(m,[r,g,b],alpha){const o=new Uint8ClampedArray(m.length*4),a=Math.round(alpha*255);
  for(let i=0;i<m.length;i++)if(m[i]){o[4*i]=r;o[4*i+1]=g;o[4*i+2]=b;o[4*i+3]=a}return o}
export function regionGrow(d,w,h,sx,sy,lo,hi){const m=new Uint8Array(d.length),st=[sy*w+sx];
  if(d[st[0]]<lo||d[st[0]]>hi)return m;m[st[0]]=1;
  while(st.length){const i=st.pop(),x=i%w,y=(i/w)|0;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy;if(a<0||b<0||a>=w||b>=h)continue;const q=b*w+a;if(!m[q]&&d[q]>=lo&&d[q]<=hi){m[q]=1;st.push(q)}}}
  return m}
export function paint(m,w,h,cx,cy,r,val){for(let y=Math.max(0,cy-r);y<=Math.min(h-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(w-1,cx+r);x++)if((x-cx)**2+(y-cy)**2<=r*r)m[y*w+x]=val}
export function regionGrow3D(vol,w,h,sx,sy,sz,lo,hi){const n=w*h,m=vol.map(()=>new Uint8Array(n)),ok=(k,i)=>vol[k][i]>=lo&&vol[k][i]<=hi,s0=sy*w+sx;
  if(!ok(sz,s0))return m;m[sz][s0]=1;const st=[sz*n+s0];
  while(st.length){const t=st.pop(),k=(t/n)|0,i=t%n,x=i%w,y=(i/w)|0;
    for(const[dx,dy,dz]of[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const a=x+dx,b=y+dy,c=k+dz;
      if(a<0||b<0||c<0||a>=w||b>=h||c>=vol.length)continue;const q=b*w+a;if(!m[c][q]&&ok(c,q)){m[c][q]=1;st.push(c*n+q)}}}
  return m}
