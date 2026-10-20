// DICOM RLE decoder (PS3.5 Annex G). Returns little-endian interleaved bytes for n pixels.
export function rle(d,n,bytes){
  const dv=new DataView(d.buffer,d.byteOffset,d.byteLength),ns=dv.getUint32(0,true),out=new Uint8Array(n*bytes);
  for(let s=0;s<ns;s++){let p=dv.getUint32(4+4*s,true),o=0;const end=s+1<ns?dv.getUint32(8+4*s,true):d.length;
    while(p<end&&o<n){const c=dv.getInt8(p++);
      if(c>=0){for(let k=0;k<=c&&o<n;k++)out[(o++)*bytes+(bytes-1-s)]=d[p++]}
      else if(c!==-128){const v=d[p++];for(let k=0;k<1-c&&o<n;k++)out[(o++)*bytes+(bytes-1-s)]=v}}}
  return out}
