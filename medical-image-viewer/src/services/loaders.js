import dicomParser from 'dicom-parser';
import * as nifti from 'nifti-reader-js';
import {Decoder} from 'jpeg-lossless-decoder-js';
import {rle} from './rle.js';
export const MAX_MB=200;
const kind=f=>{const e=(f.name.split('.').pop()||'').toLowerCase();
  if(['png','jpg','jpeg'].includes(e))return'image';if(['nii','gz'].includes(e))return'nifti';if(['dcm','dicom'].includes(e)||!f.name.includes('.'))return'dicom';return null};
export function validateFiles(files){
  const ks=new Set(files.map(f=>{const k=kind(f);if(!k)throw new Error(`"${f.name}" is not supported. Use PNG, JPEG, NIfTI (.nii, .nii.gz) or DICOM (.dcm).`);
    if(f.size>MAX_MB*1048576)throw new Error(`"${f.name}" exceeds ${MAX_MB} MB.`);if(!f.size)throw new Error(`"${f.name}" is empty.`);return k}));
  if(ks.size>1)throw new Error('Open either image files or DICOM files, not both.');return[...ks][0]}
export async function loadImageFile(f){
  const bmp=await createImageBitmap(f).catch(()=>{throw new Error(`"${f.name}" could not be decoded as an image.`)});
  const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const x=c.getContext('2d');x.drawImage(bmp,0,0);
  const p=x.getImageData(0,0,bmp.width,bmp.height).data,g=new Float32Array(bmp.width*bmp.height);
  for(let i=0;i<g.length;i++)g[i]=.299*p[4*i]+.587*p[4*i+1]+.114*p[4*i+2];
  return{name:f.name,w:bmp.width,h:bmp.height,type:'PNG/JPEG (plain 2D image: no medical metadata, no real intensity units)',modality:null,spacing:null,slices:[g],min:0,max:255,wc:127.5,ww:255}}
export async function loadDicomFiles(files){
  const out=[];
  for(const [idx,f] of files.entries()){
    const buf=await f.arrayBuffer();let ds;
    try{ds=dicomParser.parseDicom(new Uint8Array(buf))}catch{throw new Error(`"${f.name}" is not a valid DICOM file.`)}
    const ts=ds.string('x00020010')||'';
    const el=ds.elements.x7fe00010;if(!el)throw new Error(`"${f.name}" has no pixel data.`);
    if((ds.uint16('x00280002')||1)>1)throw new Error('Colour DICOM is not supported.');
    const rows=ds.uint16('x00280010'),cols=ds.uint16('x00280011'),bits=ds.uint16('x00280100'),sgn=ds.uint16('x00280103')===1,n=rows*cols;
    const raw=await getPixels(ds,el,buf,ts,n,bits,f.name);
    const px=bits===8?new Uint8Array(raw):sgn?new Int16Array(raw):new Uint16Array(raw);
    const sl=parseFloat(ds.string('x00281053'))||1,ic=parseFloat(ds.string('x00281052'))||0,d=new Float32Array(n);
    for(let i=0;i<n;i++)d[i]=px[i]*sl+ic;
    out.push({d,rows,cols,inst:parseInt(ds.string('x00200013'))||idx,wc:parseFloat(ds.string('x00281050')),ww:parseFloat(ds.string('x00281051')),
      mod:ds.string('x00080060'),sp:ds.string('x00280030')})}
  out.sort((a,b)=>a.inst-b.inst);const a=out[0];
  if(out.some(s=>s.rows!==a.rows||s.cols!==a.cols))throw new Error('Slices have different dimensions.');
  let mn=Infinity,mx=-Infinity;for(const s of out)for(const v of s.d){if(v<mn)mn=v;if(v>mx)mx=v}
  return{name:files.length>1?`${files.length} DICOM files`:files[0].name,w:a.cols,h:a.rows,type:out.length>1?'DICOM series':'DICOM',modality:a.mod||null,
    spacing:a.sp?a.sp.replace('\\',' x ')+' mm':null,slices:out.map(s=>s.d),min:mn,max:mx,wc:a.wc||(mn+mx)/2,ww:a.ww||(mx-mn)||1}}
// Synthetic CT-like phantom (values in HU) so the app works without any medical data.
export function makeSample(){
  const w=192,h=192,N=16,sl=[];let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647-.5;
  for(let z=0;z<N;z++){const d=new Float32Array(w*h),lr=14+10*Math.sin(Math.PI*(z+1)/(N+1))*1.5;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const X=x-96,Y=y-96,e=(a,b,cx,cy)=>((X-cx)/a)**2+((Y-cy)/b)**2<1;let v=-1000;
      if(e(80,66,0,0))v=60;if(e(84,70,0,0)&&!e(80,66,0,0))v=600;
      if(e(30,38,-38,-4)||e(30,38,38,-4))v=-800;if(e(9,9,0,40))v=750;if(Math.hypot(X-22,Y+4)<lr)v=160;
      d[y*w+x]=v+(v>-900?rnd()*50:0)}sl.push(d)}
  return{name:'sample-phantom (synthetic)',w,h,type:'Synthetic DICOM-like volume (HU)',modality:'CT (simulated)',spacing:'0.9 x 0.9 mm',slices:sl,min:-1050,max:850,wc:40,ww:400}}
const TA={2:Uint8Array,4:Int16Array,8:Int32Array,16:Float32Array,64:Float64Array,256:Int8Array,512:Uint16Array,768:Uint32Array};
export async function loadNifti(f){
  let b=await f.arrayBuffer();
  try{if(nifti.isCompressed(b))b=nifti.decompress(b)}catch{throw new Error(`"${f.name}" could not be decompressed.`)}
  if(!nifti.isNIFTI(b))throw new Error(`"${f.name}" is not a valid NIfTI file.`);
  const h=nifti.readHeader(b),T=TA[h.datatypeCode];if(!T)throw new Error(`NIfTI datatype ${h.datatypeCode} is not supported.`);
  const raw=new T(nifti.readImage(h,b)),w=h.dims[1],hh=h.dims[2],n=h.dims[3]||1,sl=h.scl_slope||1,ic=h.scl_inter||0,out=[];
  let mn=Infinity,mx=-Infinity;
  for(let k=0;k<n;k++){const d=new Float32Array(w*hh);
    for(let y=0;y<hh;y++)for(let x=0;x<w;x++){const v=raw[k*w*hh+y*w+x]*sl+ic;d[(hh-1-y)*w+x]=v;if(v<mn)mn=v;if(v>mx)mx=v}out.push(d)}
  return{name:f.name,w,h:hh,type:'NIfTI (flipped vertically for display; orientation matrix ignored)',modality:null,
    spacing:`${h.pixDims[2].toFixed(2)} x ${h.pixDims[1].toFixed(2)} mm`,slices:out,min:mn,max:mx,wc:(mn+mx)/2,ww:(mx-mn)||1}}
async function getPixels(ds,el,buf,ts,n,bits,name){
  if(!el.encapsulatedPixelData)return buf.slice(el.dataOffset,el.dataOffset+n*bits/8);
  if((parseInt(ds.string('x00280008'))||1)>1)throw new Error(`"${name}": multi-frame compressed DICOM is not supported.`);
  const fr=dicomParser.readEncapsulatedPixelDataFromFragments(ds,el,0,el.fragments.length),B=bits/8;
  if(ts==='1.2.840.10008.1.2.5')return rle(fr,n,B).buffer;
  if(ts==='1.2.840.10008.1.2.4.50'){const bm=await createImageBitmap(new Blob([fr],{type:'image/jpeg'})).catch(()=>{throw new Error(`"${name}": browser could not decode this JPEG.`)});
    const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const x=c.getContext('2d');x.drawImage(bm,0,0);
    const p=x.getImageData(0,0,bm.width,bm.height).data,o=new Uint8Array(n);for(let i=0;i<n;i++)o[i]=p[4*i];return o.buffer}
  if(ts==='1.2.840.10008.1.2.4.57'||ts==='1.2.840.10008.1.2.4.70'){const r=new Decoder().decode(fr.buffer,fr.byteOffset,fr.byteLength,B);
    return r instanceof ArrayBuffer?r:r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength)}
  throw new Error(`"${name}": transfer syntax ${ts} (JPEG 2000, JPEG-LS or 12-bit JPEG) is not supported. Use uncompressed, RLE, baseline JPEG or JPEG Lossless.`)}
