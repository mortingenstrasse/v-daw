import test from 'node:test';
import assert from 'node:assert/strict';
import {detectOnsets,quantizeClip,beatEvents} from '../quantize.js';
const clip={id:'a',source:'av',start:0,in:0,out:2};let n=0;const id=()=>`q${n++}`;
test('silence produces no invented attacks; stereo attacks are detected',()=>{
 const rate=10000,a=new Float32Array(rate*2),b=a.slice();assert.deepEqual(detectOnsets([a,b],rate,0,2),[]);
 for(const at of [.12,.62,1.12])for(let i=0;i<200;i++)b[Math.round(at*rate)+i]=Math.sin(i*.4)*Math.exp(-i/50);
 const hits=detectOnsets([a,b],rate,0,2);assert.equal(hits.length,3);hits.forEach((h,i)=>assert.ok(Math.abs(h-[.12,.62,1.12][i])<.008));
});
test('strength zero is unchanged, halfway interpolates, full snaps attacks',()=>{
 assert.deepEqual(quantizeClip(clip,[.12,.62],120,4,0,id),[clip]);
 for(const amount of [.5,1]){
 const parts=quantizeClip(clip,[.12,.62],120,4,amount,id);
 const hit=parts.find(c=>c.in===.62);assert.ok(Math.abs(hit.start-(.62-.12*amount))<1e-8);
 assert.ok(parts.every(c=>c.source==='av')); // audio and video retain one source and one placement
 for(let i=1;i<parts.length;i++)assert.ok(parts[i-1].start+parts[i-1].out-parts[i-1].in<=parts[i].start+1e-8);
 }
});
test('trimmed region uses timeline grid, stays inside bounds and leaves original intact',()=>{
 const c={...clip,start:2.1,in:10,out:11},before={...c};
 const parts=quantizeClip(c,[10.05,10.43,10.92],120,8,1,id);
 assert.deepEqual(c,before);assert.ok(parts.every(p=>p.in>=10&&p.out<=11&&p.start>=2.1&&p.start+p.out-p.in<=3.1+1e-8));
 assert.equal(parts.find(p=>p.in===10.43).start,2.5);
});
test('colliding grid targets never create overlapping or zero length slices',()=>{
 const parts=quantizeClip(clip,[.1,.19,.3,.4],120,4,1,id);
 assert.ok(parts.every(c=>c.out>c.in));for(let i=1;i<parts.length;i++)assert.ok(parts[i-1].start+parts[i-1].out-parts[i-1].in<=parts[i].start+1e-8);
});
test('beat scheduling gives identical phase across different timer windows',()=>{
 const all=beatEvents(0,null,120,0,4),chunks=[];
 for(let t=0;t<4;t+=.125)chunks.push(...beatEvents(0,null,120,t,t+.125));assert.deepEqual(chunks,all);assert.deepEqual(all.map(b=>b.at),[0,.5,1,1.5,2,2.5,3,3.5]);
});
test('non-bar cycle wraps reset grid and do not duplicate boundary clicks',()=>{
 const loop={start:.2,end:1.1};const events=beatEvents(.2,loop,120,0,3);
 assert.equal(new Set(events.map(e=>e.at.toFixed(8))).size,events.length);
 assert.ok(Math.abs(events[0].at-.3)<1e-8);assert.ok(Math.abs(events[2].at-1.2)<1e-8);
});
