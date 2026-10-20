import {it,expect} from 'vitest';import {rle} from '../src/services/rle.js';
it('decodes 16-bit RLE',()=>{const h=new Uint8Array(64);const dv=new DataView(h.buffer);dv.setUint32(0,2,true);dv.setUint32(4,64,true);dv.setUint32(8,67,true);
  const d=Uint8Array.from([...h,1,1,3,1,2,4]);expect([...rle(d,2,2)]).toEqual([2,1,4,3])});
