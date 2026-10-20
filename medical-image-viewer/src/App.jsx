import {useState,useMemo,useRef,useEffect,useCallback} from 'react';
import {loadNifti,loadImageFile,loadDicomFiles,makeSample,validateFiles} from './services/loaders.js';
import {threshold,gaussian,median,canny,histogram,clamp} from './services/imageProcessor.js';
import {regionGrow3D,regionGrow,paint,thresholdSegment,maskStats,maskToRGBA} from './services/segmentationEngine.js';
import './styles.css';

const dl=(u,n)=>{const a=document.createElement('a');a.href=u;a.download=n;a.click()};
const Sl=({l,v,min,max,step=1,on})=><label className="sl"><span>{l}<b>{Math.round(v*100)/100}</b></span>
  <input type="range" min={min} max={max} step={step} value={v} onChange={e=>on(+e.target.value)}/></label>;
function Hist({h}){const r=useRef();useEffect(()=>{const c=r.current,x=c.getContext('2d'),m=Math.log1p(Math.max(...h.counts));
  x.clearRect(0,0,c.width,c.height);x.fillStyle='#6fd1c5';const bw=c.width/h.counts.length;
  h.counts.forEach((n,i)=>{const v=Math.log1p(n)/m*c.height;x.fillRect(i*bw,c.height-v,Math.max(1,bw-.5),v)})},[h]);
  return <><canvas ref={r} width="260" height="70" className="hist" aria-label="Intensity histogram"/><small>{Math.round(h.min)} to {Math.round(h.max)} (log scale)</small></>}

export default function App(){
  const [img,setImg]=useState(null),[z,setZ]=useState(0),[wl,setWl]=useState({c:0,w:1}),[bc,setBc]=useState({b:0,c:1}),
    [view,setView]=useState({zoom:1,x:0,y:0,rot:0}),[proc,setProc]=useState(null),[cmp,setCmp]=useState(false),
    [f,setF]=useState({engine:'opencv',type:'Gaussian',t:0,s:1.5,n:3,lo:20,hi:60}),
    [seg,setSeg]=useState({on:false,lo:0,hi:1,color:'#ff3b30',op:.5,show:true}),
    [status,setStatus]=useState('Ready'),[err,setErr]=useState(''),[tab,setTab]=useState('view'),[help,setHelp]=useState(false),
    [probe,setProbe]=useState(null),[size,setSize]=useState({w:0,h:0}),[drop,setDrop]=useState(false),[tool,setTool]=useState('pan'),[man,setMan]=useState({}),[ver,setVer]=useState(0),[meas,setMeas]=useState([]),[draft,setDraft]=useState(null),[tol,setTol]=useState(100),[br,setBr]=useState(6),[td,setTd]=useState(false);
  const cref=useRef(),wrap=useRef(),inv=useRef(),drag=useRef(),fin=useRef(),undo=useRef([]),redo=useRef([]),work=useRef(),ap=useRef([]),wk=useRef(),jobs=useRef({});
  const src=img?img.slices[z]:null,nS=img?img.slices.length:0;

  const open=async get=>{setErr('');setStatus('Loading…');
    try{const i=await get();setImg(i);setZ(0);setWl({c:i.wc,w:i.ww});setBc({b:0,c:1});setProc(null);setF(p=>({...p,t:i.wc}));setMan({});setMeas([]);undo.current=[];redo.current=[];setTol(Math.round((i.max-i.min)/20)||1);setSeg(s=>({...s,on:false,lo:i.wc,hi:i.max}))}
    catch(e){setErr(e.message)}setStatus('Ready')};
  const onFiles=fl=>{const fs=[...fl];if(!fs.length)return;try{const k=validateFiles(fs);open(()=>k==='dicom'?loadDicomFiles(fs):k==='nifti'?loadNifti(fs[0]):loadImageFile(fs[0]))}catch(e){setErr(e.message)}};
  const clear=()=>{setImg(null);setProc(null);setMan({});setMeas([]);setSeg(s=>({...s,on:false}));setErr('')};

  useEffect(()=>{if(!wrap.current)return;const ro=new ResizeObserver(([e])=>setSize({w:Math.floor(e.contentRect.width),h:Math.floor(e.contentRect.height)}));
    ro.observe(wrap.current);return()=>ro.disconnect()},[!!img]);
  const fit=useCallback((rot=view.rot)=>{if(!img||!size.w)return;const o=rot%2,sw=o?img.h:img.w,sh=o?img.w:img.h;
    setView({zoom:Math.min(size.w/sw,size.h/sh)*.95,x:0,y:0,rot})},[img,size,view.rot]);
  useEffect(()=>{fit(0)},[img,size.w>0]);

  const shown=useMemo(()=>cmp||!proc?{data:src}:proc,[cmp,proc,src]);
  const base=useMemo(()=>{if(!img)return null;const c=document.createElement('canvas');c.width=img.w;c.height=img.h;
    const id=new ImageData(img.w,img.h),d=shown.data,lo=shown.binary?0:wl.c-wl.w/2,hi=shown.binary?255:wl.c+wl.w/2,s=255/(hi-lo||1);
    for(let i=0;i<d.length;i++){const v=clamp(((d[i]-lo)*s-128)*bc.c+128+bc.b,0,255);id.data[4*i]=id.data[4*i+1]=id.data[4*i+2]=v;id.data[4*i+3]=255}
    c.getContext('2d').putImageData(id,0,0);return c},[img,shown,wl,bc]);
  const mask=useMemo(()=>man[z]||(seg.on&&src?thresholdSegment(src,seg.lo,seg.hi):null),[man,z,ver,seg.on,seg.lo,seg.hi,src]);
  const stats=mask&&maskStats(mask);
  const gm=k=>man[k]||(seg.on?thresholdSegment(img.slices[k],seg.lo,seg.hi):new Uint8Array(img.w*img.h));
  const vox=useMemo(()=>img&&nS>1&&(seg.on||Object.keys(man).length)?img.slices.reduce((t,_,k)=>t+maskStats(gm(k)).pixels,0):null,[img,man,ver,seg.on,seg.lo,seg.hi]);
  const ov=useMemo(()=>{if(!mask)return null;const c=document.createElement('canvas');c.width=img.w;c.height=img.h;
    const rgb=[1,3,5].map(i=>parseInt(seg.color.slice(i,i+2),16));
    c.getContext('2d').putImageData(new ImageData(maskToRGBA(mask,rgb,seg.op),img.w,img.h),0,0);return c},[mask,ver,seg.color,seg.op]);
  const hist=useMemo(()=>src?histogram(src):null,[src]);

  useEffect(()=>{const cv=cref.current;if(!cv||!base)return;const x=cv.getContext('2d');
    x.setTransform(1,0,0,1,0,0);x.fillStyle='#05080c';x.fillRect(0,0,cv.width,cv.height);
    x.translate(cv.width/2+view.x,cv.height/2+view.y);x.rotate(view.rot*Math.PI/2);x.scale(view.zoom,view.zoom);
    x.imageSmoothingEnabled=view.zoom<1;x.drawImage(base,-img.w/2,-img.h/2);
    if(ov&&seg.show){x.imageSmoothingEnabled=false;x.drawImage(ov,-img.w/2,-img.h/2)}
    const M=x.getTransform();inv.current=M.inverse();x.translate(-img.w/2,-img.h/2);x.lineWidth=2/view.zoom;x.strokeStyle='#ffd24a';
    const items=[...meas.filter(m=>m.z===z),...(draft?[{...draft,label:measure(draft.type,draft.a,draft.b)}]:[]),...(ap.current.length?[{type:'angle',a:ap.current[0],b:ap.current[1]||ap.current[0],c:ap.current[1]||ap.current[0],label:''}]:[])],T=x.getTransform();
    for(const m of items){x.beginPath();if(m.type==='distance'){x.moveTo(m.a.x,m.a.y);x.lineTo(m.b.x,m.b.y)}else if(m.type==='angle'){x.moveTo(m.a.x,m.a.y);x.lineTo(m.b.x,m.b.y);x.lineTo(m.c.x,m.c.y)}else x.rect(m.a.x,m.a.y,m.b.x-m.a.x,m.b.y-m.a.y);x.stroke()}
    x.setTransform(1,0,0,1,0,0);x.fillStyle='#ffd24a';x.font='12px system-ui';
    for(const m of items){const q=T.transformPoint(new DOMPoint(m.b.x,m.b.y));x.fillText(m.label,q.x+6,q.y-6)}},[base,ov,seg.show,view,size,img,meas,draft,z,ver]);

  const pt=e=>{const r=cref.current.getBoundingClientRect(),p=inv.current.transformPoint(new DOMPoint(e.clientX-r.left,e.clientY-r.top));return{x:p.x+img.w/2,y:p.y+img.h/2}};
  const ang=(a,b,c)=>{const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y];return`${(Math.acos(clamp((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1),-1,1))*180/Math.PI).toFixed(1)}°`};
  const beginK=ks=>{const c={};ks.forEach(k=>{c[k]=gm(k).slice()});undo.current.push(ks.map(k=>({z:k,prev:man[k]})));redo.current=[];setMan(o=>({...o,...c}));setSeg(s=>({...s,on:true}));return c};
  const span=()=>td?[...Array(nS).keys()].filter(k=>Math.abs(k-z)<=br):[z];
  const stamp=(c,p,v)=>{for(const k of Object.keys(c)){const dz=k-z,r=Math.floor(Math.sqrt(Math.max(0,br*br-dz*dz)));paint(c[k],img.w,img.h,Math.floor(p.x),Math.floor(p.y),r,v)}setVer(n=>n+1)};
  const down=e=>{const p=pt(e);drag.current=1;
    if(tool==='distance'||tool==='roi')setDraft({type:tool,a:p,b:p});
    else if(tool==='angle'){ap.current.push(p);if(ap.current.length===3){const[a,b,c]=ap.current;setMeas(m=>[...m,{type:'angle',a,b,c,z,label:ang(a,b,c)}]);ap.current=[]}setVer(n=>n+1)}
    else if(tool==='brush'||tool==='erase'){work.current=beginK(span());stamp(work.current,p,tool==='brush'?1:0)}
    else if(tool==='grow'){const ix=Math.floor(p.x),iy=Math.floor(p.y);if(ix<0||iy<0||ix>=img.w||iy>=img.h)return;const v=src[iy*img.w+ix];
      if(td){const g=regionGrow3D(img.slices,img.w,img.h,ix,iy,z,v-tol,v+tol),ks=g.map((m,k)=>m.some(q=>q)?k:-1).filter(k=>k>=0);if(!ks.length)return;
        const c=beginK(ks);for(const k of ks)for(let i=0;i<g[k].length;i++)c[k][i]|=g[k][i]}
      else{const g=regionGrow(src,img.w,img.h,ix,iy,v-tol,v+tol),c=beginK([z]);for(let i=0;i<g.length;i++)c[z][i]|=g[i]}setVer(n=>n+1)}};
  const move=e=>{const p=pt(e),ix=Math.floor(p.x),iy=Math.floor(p.y);
    if(drag.current){if(tool==='pan')setView(v=>({...v,x:v.x+e.movementX,y:v.y+e.movementY}));else if(draft)setDraft(d=>({...d,b:p}));else if(work.current)stamp(work.current,p,tool==='brush'?1:0)}
    setProbe(ix>=0&&iy>=0&&ix<img.w&&iy<img.h?{x:ix,y:iy,v:src[iy*img.w+ix]}:null)};
  const up=()=>{if(draft&&Math.hypot(draft.b.x-draft.a.x,draft.b.y-draft.a.y)>2)setMeas(m=>[...m,{...draft,z,label:measure(draft.type,draft.a,draft.b)}]);setDraft(null);work.current=null;drag.current=0};
  const restore=(from,to)=>{const t=from.current.pop();if(!t)return;to.current.push(t.map(e=>({z:e.z,prev:man[e.z]})));
    setMan(o=>{const n={...o};t.forEach(e=>{if(e.prev)n[e.z]=e.prev;else delete n[e.z]});return n});go(t[0].z);setVer(v=>v+1)};
  const zoom=k=>setView(v=>({...v,zoom:clamp(v.zoom*k,.05,40)}));
  const go=n=>{setZ(clamp(n,0,nS-1));setProc(null)};
  useEffect(()=>{const k=e=>{if(!img||/INPUT|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowUp'||e.key==='ArrowRight')go(z+1);if(e.key==='ArrowDown'||e.key==='ArrowLeft')go(z-1)};
    addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[img,z]);
  const sp=img&&img.spacing&&img.spacing.match(/([\d.]+) x ([\d.]+)/),sy=sp?+sp[1]:1,sx=sp?+sp[2]:1,u=sp?'mm':'px';
  const measure=(t,a,b)=>{if(t==='distance')return`${Math.hypot((b.x-a.x)*sx,(b.y-a.y)*sy).toFixed(1)} ${u}`;
    const x0=clamp(Math.floor(Math.min(a.x,b.x)),0,img.w),x1=clamp(Math.ceil(Math.max(a.x,b.x)),0,img.w),y0=clamp(Math.floor(Math.min(a.y,b.y)),0,img.h),y1=clamp(Math.ceil(Math.max(a.y,b.y)),0,img.h);
    let n=0,s=0,s2=0,mn=Infinity,mx=-Infinity;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const v=src[y*img.w+x];n++;s+=v;s2+=v*v;if(v<mn)mn=v;if(v>mx)mx=v}
    if(!n)return'';const m=s/n;return`mean ${m.toFixed(1)}, sd ${Math.sqrt(Math.max(0,s2/n-m*m)).toFixed(1)}, min ${mn.toFixed(0)}, max ${mx.toFixed(0)}, area ${(n*sx*sy).toFixed(0)} ${u}²`};

  const run=(op,d,p)=>new Promise((res,rej)=>{
    if(!wk.current){wk.current=new Worker(new URL('./services/filter.worker.js',import.meta.url),{type:'module'});
      wk.current.onmessage=({data})=>{jobs.current[data.id](data);delete jobs.current[data.id]};wk.current.onerror=e=>rej(new Error('Worker error: '+e.message))}
    const id=Math.random(),c=d.slice();jobs.current[id]=res;wk.current.postMessage({id,op,d:c,w:img.w,h:img.h,p,engine:f.engine},[c.buffer])});
  const apply=async()=>{setStatus('Processing…');try{const d=proc&&!proc.binary?proc.data:src,r=await run(f.type,d,f);
    setProc({data:r.out,binary:f.type==='Threshold'||f.type==='Canny'?1:0});setStatus('Ready ('+r.used+')')}catch(e){setErr(e.message);setStatus('Ready')}};
  const exp={
    png:()=>dl(base.toDataURL(),'processed.png'),
    shot:()=>dl(cref.current.toDataURL(),'screenshot.png'),
    mask:()=>{if(!mask)return setErr('Generate a segmentation first.');const c=document.createElement('canvas');c.width=img.w;c.height=img.h;
      const id=new ImageData(img.w,img.h);mask.forEach((m,i)=>id.data.set([m*255,m*255,m*255,255],i*4));c.getContext('2d').putImageData(id,0,0);dl(c.toDataURL(),'mask.png')},
    vol:()=>{if(vox===null)return setErr('Generate or edit a segmentation on a multi-slice volume first.');dl(URL.createObjectURL(new Blob(img.slices.map((_,k)=>gm(k).map(v=>v?255:0)))),`mask-volume_${img.w}x${img.h}x${nS}.u8`)},
    json:()=>dl(URL.createObjectURL(new Blob([JSON.stringify({file:img.name,slice:z+1,slices:nS,window:wl,brightnessContrast:bc,
      filter:proc?f:null,measurements:meas.map(({z,type,label})=>({slice:z+1,type,label})),editedSlices:Object.keys(man).map(k=>+k+1),segmentation:{min:seg.lo,max:seg.hi,color:seg.color,opacity:seg.op,stats},note:'Educational use only.'},null,2)],{type:'application/json'})),'segmentation.json')};

  const Expo=()=><div className="row">{[['png','Processed PNG'],['mask','Mask PNG'],['shot','Screenshot'],['json','Settings JSON'],['vol','Mask volume (raw)']].map(([k,t])=><button key={k} onClick={exp[k]}>{t}</button>)}</div>;
  const rng=img?[img.min,img.max,(img.max-img.min)/500||1]:[0,1,1];

  return <div className="app">
    <header className="top"><b className="logo">MedImage Explorer</b>
      <input ref={fin} type="file" hidden multiple accept=".png,.jpg,.jpeg,.nii,.gz,.dcm,.dicom,application/dicom,image/*" onChange={e=>{onFiles(e.target.files);e.target.value=''}}/>
      <button onClick={()=>fin.current.click()}>Open image</button>
      {img&&<details className="menu"><summary>Export</summary><div className="pop"><Expo/></div></details>}
      {img&&<button onClick={clear}>Remove image</button>}
      <button onClick={()=>setHelp(h=>!h)}>Help / About</button></header>
    {help&&<div className="note" role="dialog"><b>About.</b> Educational tool, not a diagnostic device. Files are processed only in your browser and never uploaded or stored.
      Supports PNG/JPEG, NIfTI (.nii/.nii.gz) and uncompressed DICOM (select several files for a series). Plain PNG/JPEG files carry no medical metadata or true intensity units. Exports are 2D PNGs and do not keep DICOM metadata or the 3D volume.
      Scroll to zoom, drag to pan. <button onClick={()=>setHelp(false)}>Close</button></div>}
    {err&&<div className="note err" role="alert">{err} <button onClick={()=>setErr('')}>Dismiss</button></div>}

    {!img?<main className={'home'+(drop?' drop':'')} onDragOver={e=>{e.preventDefault();setDrop(true)}} onDragLeave={()=>setDrop(false)} onDrop={e=>{e.preventDefault();setDrop(false);onFiles(e.dataTransfer.files)}}>
      <h1>Medical Image Viewer and Basic Segmentation Tool</h1>
      <p>Open a CT or MRI slice, adjust window and contrast, filter noise, and outline regions by intensity, all inside your browser.</p>
      <div className="zone"><p>Drop files here</p><button className="pri" onClick={()=>fin.current.click()}>Upload medical image</button>
        <button onClick={()=>open(async()=>makeSample())}>Load sample image</button>
        <small>PNG, JPEG, NIfTI, DICOM (.dcm, uncompressed). Max {200} MB per file. For a DICOM series, select all slices together.</small></div>
      <ol className="flow">{['Upload','View','Process','Segment','Export'].map(s=><li key={s}>{s}</li>)}</ol>
      <small>Educational application, not a diagnostic medical device. Images never leave your device. {status==='Loading…'&&'Loading…'}</small></main>
    :<>
    <nav className="tabs">{[['left','Image'],['view','Viewer'],['right','Tools']].map(([k,t])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{t}</button>)}</nav>
    <div className="work">
      <aside className={'side'+(tab==='left'?' on':'')}>
        <h3>File</h3><dl><dt>Name</dt><dd>{img.name}</dd><dt>Type</dt><dd>{img.type}</dd><dt>Size</dt><dd>{img.w} x {img.h}</dd>
          <dt>Pixel spacing</dt><dd>{img.spacing||'not available'}</dd>{img.modality&&<><dt>Modality</dt><dd>{img.modality}</dd></>}</dl>
        {nS>1&&<><h3>Slices</h3><div className="row"><button onClick={()=>go(z-1)} aria-label="Previous slice">◀</button>
          <input type="range" min="0" max={nS-1} value={z} onChange={e=>go(+e.target.value)} aria-label="Slice"/><button onClick={()=>go(z+1)} aria-label="Next slice">▶</button></div><small>Slice {z+1} / {nS}</small></>}
        <h3>Tools</h3><div className="row">{[['pan','Pan'],['distance','Distance'],['roi','ROI'],['angle','Angle'],['grow','Region grow'],['brush','Brush'],['erase','Eraser']].map(([k,t])=><button key={k} className={tool===k?'on':''} onClick={()=>{setTool(k);ap.current=[]}}>{t}</button>)}</div>
        {tool==='grow'&&<Sl l="Tolerance (±)" v={tol} min={1} max={Math.max(2,Math.round((img.max-img.min)/2))} on={setTol}/>}
        {(tool==='brush'||tool==='erase')&&<Sl l="Brush radius (px)" v={br} min={1} max={40} on={setBr}/>}
        {['grow','brush','erase'].includes(tool)&&<label className="chk"><input type="checkbox" checked={td} onChange={e=>setTd(e.target.checked)}/> 3D: apply across slices (radius = sphere)</label>}
        <div className="row"><button onClick={()=>restore(undo,redo)}>Undo</button><button onClick={()=>restore(redo,undo)}>Redo</button></div><small>Arrow keys change slice.</small>
        <h3>View</h3><div className="row"><button onClick={()=>zoom(1.25)}>Zoom +</button><button onClick={()=>zoom(.8)}>Zoom −</button><button onClick={()=>fit()}>Fit</button>
          <button onClick={()=>fit((view.rot+1)%4)}>Rotate</button><button onClick={()=>fit(0)}>Reset</button></div>
        <h3>Window / level</h3><Sl l="Level" v={wl.c} min={rng[0]} max={rng[1]} step={rng[2]} on={c=>setWl(w=>({...w,c}))}/>
        <Sl l="Width" v={wl.w} min={1} max={(img.max-img.min)*1.2||1} step={rng[2]} on={w=>setWl(o=>({...o,w}))}/>
        <Sl l="Brightness" v={bc.b} min={-100} max={100} on={b=>setBc(o=>({...o,b}))}/><Sl l="Contrast" v={bc.c} min={.2} max={3} step={.05} on={c=>setBc(o=>({...o,c}))}/>
        <button onClick={()=>{setWl({c:img.wc,w:img.ww});setBc({b:0,c:1})}}>Reset display</button></aside>
      <main className={'stage'+(tab==='view'?' on':'')} ref={wrap}>
        <canvas ref={cref} width={size.w} height={size.h} onWheel={e=>zoom(e.deltaY<0?1.1:1/1.1)} className={tool==='pan'?'':'cross'} onMouseDown={down} onMouseUp={up}
          onMouseLeave={()=>{up();setProbe(null)}} onMouseMove={move} aria-label="Image viewer"/>
        {cmp&&<span className="badge">Original</span>}</main>
      <aside className={'side'+(tab==='right'?' on':'')}>
        <h3>Processing</h3><label className="sl"><span>Engine</span><select value={f.engine} onChange={e=>setF({...f,engine:e.target.value})}><option value="opencv">OpenCV.js (Web Worker)</option><option value="js">Plain JavaScript (Web Worker)</option></select></label><select value={f.type} onChange={e=>setF({...f,type:e.target.value})} aria-label="Filter">{['Threshold','Gaussian','Median','Canny'].map(t=><option key={t}>{t}</option>)}</select>
        {f.type==='Threshold'&&<Sl l="Threshold" v={f.t} min={rng[0]} max={rng[1]} step={rng[2]} on={t=>setF({...f,t})}/>}
        {f.type==='Gaussian'&&<Sl l="Sigma" v={f.s} min={.5} max={5} step={.1} on={s=>setF({...f,s})}/>}
        {f.type==='Median'&&<label className="sl"><span>Kernel</span><select value={f.n} onChange={e=>setF({...f,n:+e.target.value})}>{[3,5,7].map(n=><option key={n} value={n}>{n} x {n}</option>)}</select></label>}
        {f.type==='Canny'&&<><Sl l="Low" v={f.lo} min={1} max={200} on={lo=>setF({...f,lo})}/><Sl l="High" v={f.hi} min={1} max={255} on={hi=>setF({...f,hi})}/></>}
        <div className="row"><button className="pri" onClick={apply}>Apply</button><button onClick={()=>setProc(null)}>Reset</button>
          <button onPointerDown={()=>setCmp(true)} onPointerUp={()=>setCmp(false)} onPointerLeave={()=>setCmp(false)}>Hold to compare</button></div>
        <small>Filters stack on the current slice until Reset. Original data is never modified.</small>
        <h3>Histogram</h3>{hist&&<Hist h={hist}/>}
        <h3>Segmentation</h3>
        <Sl l="Min intensity" v={seg.lo} min={rng[0]} max={rng[1]} step={rng[2]} on={lo=>setSeg(s=>({...s,lo,on:true}))}/>
        <Sl l="Max intensity" v={seg.hi} min={rng[0]} max={rng[1]} step={rng[2]} on={hi=>setSeg(s=>({...s,hi,on:true}))}/>
        <label className="sl"><span>Overlay colour</span><input type="color" value={seg.color} onChange={e=>setSeg(s=>({...s,color:e.target.value}))}/></label>
        <Sl l="Opacity" v={seg.op} min={0} max={1} step={.05} on={op=>setSeg(s=>({...s,op}))}/>
        <label className="chk"><input type="checkbox" checked={seg.show} onChange={e=>setSeg(s=>({...s,show:e.target.checked}))}/> Show overlay</label>
        <div className="row"><button className="pri" onClick={()=>setSeg(s=>({...s,on:true}))}>Generate mask</button><button onClick={()=>{setSeg(s=>({...s,on:false}));setMan({});undo.current=[];redo.current=[]}}>Clear</button></div>
        {stats&&<p className="stat"><b>{stats.pixels.toLocaleString()}</b> px selected, <b>{stats.percent.toFixed(2)}%</b> of the slice</p>}
        {vox!==null&&<p className="stat">Volume: <b>{vox.toLocaleString()}</b> voxels across {nS} slices</p>}
        <h3>Measurements</h3>{meas.filter(m=>m.z===z).map((m,i)=><p key={i} className="stat">{m.type==='roi'?'ROI':m.type==='angle'?'Angle':'Distance'}: {m.label}</p>)}
        {!meas.some(m=>m.z===z)&&<small>Choose Distance or ROI and drag, or Angle and click three points (vertex second),  on the image.</small>}<div className="row"><button onClick={()=>setMeas(m=>m.filter(q=>q.z!==z))}>Clear measurements</button></div>
        <h3>Export</h3><Expo/></aside></div>
    <footer className="status"><span>{nS>1?`Slice ${z+1}/${nS}`:'Single image'}</span><span>{img.w} x {img.h}</span><span>Zoom {Math.round(view.zoom*100)}%</span>
      <span>{probe?`(${probe.x}, ${probe.y}) = ${Math.round(probe.v*10)/10}`:'Cursor: n/a'}</span><span>{status}</span></footer></>}
  </div>}
