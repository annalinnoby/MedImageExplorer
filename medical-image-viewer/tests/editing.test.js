import {describe,it,expect} from 'vitest';
import {regionGrow,paint,maskStats} from '../src/services/segmentationEngine.js';
describe('editing',()=>{
  const d=new Float32Array(100);for(const i of[11,12,21,22,88])d[i]=100;
  it('region grow stays connected',()=>{const m=regionGrow(d,10,10,1,1,50,150);expect(maskStats(m).pixels).toBe(4);expect(m[88]).toBe(0)});
  it('seed outside range gives empty mask',()=>{expect(maskStats(regionGrow(d,10,10,5,5,50,150)).pixels).toBe(0)});
  it('paint and erase',()=>{const m=new Uint8Array(100);paint(m,10,10,5,5,2,1);expect(maskStats(m).pixels).toBeGreaterThan(8);paint(m,10,10,5,5,3,0);expect(maskStats(m).pixels).toBe(0)});
});
import {regionGrow3D} from '../src/services/segmentationEngine.js';
it('3D grow crosses slices',()=>{const v=[0,1,2].map(()=>new Float32Array(9));v[0][4]=v[1][4]=100;v[2][0]=100;
  const m=regionGrow3D(v,3,3,1,1,0,50,150);expect(m[1][4]).toBe(1);expect(m[2][0]).toBe(0)});
