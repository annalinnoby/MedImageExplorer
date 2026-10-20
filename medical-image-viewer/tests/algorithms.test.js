import {describe,it,expect} from 'vitest';
import {threshold,gaussian,median,canny,histogram} from '../src/services/imageProcessor.js';
import {thresholdSegment,maskStats} from '../src/services/segmentationEngine.js';
const sq=(w=16,h=16)=>{const d=new Float32Array(w*h);for(let y=4;y<12;y++)for(let x=4;x<12;x++)d[y*w+x]=200;return d};
describe('processing',()=>{
  it('threshold is binary',()=>{expect([...threshold(Float32Array.of(1,5,9),5)]).toEqual([0,255,255])});
  it('gaussian keeps constant images constant',()=>{const o=gaussian(new Float32Array(100).fill(7),10,10,2);o.forEach(v=>expect(v).toBeCloseTo(7,3))});
  it('median removes an impulse',()=>{const d=new Float32Array(25);d[12]=999;expect(median(d,5,5,3)[12]).toBe(0)});
  it('canny finds edges of a square',()=>{const o=canny(sq(),16,16,10,30);expect(o.some(v=>v===255)).toBe(true);expect(o[8*16+8]).toBe(0)});
  it('histogram counts all pixels',()=>{expect(histogram(sq()).counts.reduce((a,b)=>a+b)).toBe(256)});
});
describe('segmentation',()=>{
  it('masks and stats',()=>{const m=thresholdSegment(sq(),100,255),s=maskStats(m);expect(s.pixels).toBe(64);expect(s.percent).toBeCloseTo(25)});
});
