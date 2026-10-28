export const endOf = c => c.start + c.out - c.in;
export const durationOf = tracks => Math.max(0, ...tracks.flatMap(t => t.clips.map(endOf)));
export function splitClip(clip, time, id) {
  if (time <= clip.start + .02 || time >= endOf(clip) - .02) throw Error('Place the playhead inside the selected clip.');
  const cut = clip.in + time - clip.start;
  return [{...clip, out: cut}, {...clip, id, start: time, in: cut}];
}
export function trimClip(clip, start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < clip.in || end > clip.out || end - start < .05) throw Error('Trim must stay inside the current source range and keep at least 0.05 seconds.');
  return {...clip, start: clip.start + start - clip.in, in: start, out: end};
}
export function recordingPlacement(position, offsetMs) {
  const shifted = position - offsetMs / 1000;
  return {start: Math.max(0, shifted), in: Math.max(0, -shifted)};
}
export function makeChirp(rate, duration = .035) {
  const a = new Float32Array(Math.round(rate * duration));
  for (let i=0;i<a.length;i++) { const t=i/rate; a[i]=.18*Math.sin(2*Math.PI*(700*t+((4600-700)/(2*duration))*t*t))*Math.sin(Math.PI*i/a.length)**2; }
  return a;
}
// Normalized matched filter. Coarse scan then single-sample refinement.
export function detectChirp(samples, template, from, to) {
  let best={score:0,index:0};
  function scoreAt(i, stride) {
    let dot=0,a=0,b=0;
    for(let j=0;j<template.length;j+=stride) { const x=samples[i+j]||0,y=template[j]; dot+=x*y;a+=x*x;b+=y*y; }
    return Math.abs(dot)/Math.sqrt(a*b||1);
  }
  from=Math.max(0,Math.ceil(from)); to=Math.min(samples.length-template.length,Math.floor(to));
  for(let i=from;i<=to;i+=4) {const score=scoreAt(i,4);if(score>best.score)best={score,index:i};}
  const center=best.index; best={score:0,index:center};
  for(let i=Math.max(from,center-5);i<=Math.min(to,center+5);i++) {const score=scoreAt(i,1);if(score>best.score)best={score,index:i};}
  return best;
}
export function summarizeLatency(results, rate) {
  if(results.length!==3 || results.some(r=>r.score<.55)) throw Error('No reliable loopback signal. Check the cable, input gain, output route, and disable hardware direct monitoring.');
  const times=results.map(r=>r.delay*1000/rate).sort((a,b)=>a-b);
  const jitter=times[2]-times[0];
  if(jitter>12) throw Error('Unstable loopback timing (spread over 12 ms). Check routing and retry.');
  return {ms:times[1],jitter,confidence:Math.min(...results.map(r=>r.score))};
}

export function loopPosition(elapsed, from, loop) {
  if (!loop) return from + Math.max(0, elapsed);
  const first = loop.end - from;
  return elapsed < first ? from + Math.max(0, elapsed) : loop.start + ((elapsed - first) % (loop.end - loop.start));
}
export function playbackWindow(from, loop, cycle = 0) {
  if (!loop) return {start:from,end:Infinity,at:0};
  if (!cycle) return {start:from,end:loop.end,at:0};
  return {start:loop.start,end:loop.end,at:loop.end-from+(cycle-1)*(loop.end-loop.start)};
}
export const MAX_TRACKS = 4;
export function createTrack(index) {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_TRACKS) throw Error('A session supports up to four tracks.');
  return {name:['Track one','Track two','Track three','Track four'][index],clips:[],volume:.25,muted:false};
}
export function videoRects(count, width, height) {
  if (count < 1) return [];
  if (count === 1) return [{x:0,y:0,width,height}];
  if (count === 2) return height > width
    ? [{x:0,y:0,width,height:height/2},{x:0,y:height/2,width,height:height/2}]
    : [{x:0,y:0,width:width/2,height},{x:width/2,y:0,width:width/2,height}];
  // Three: a centered second row. Four: a balanced 2×2 grid.
  const w=width/2,h=height/2;
  if (count === 3) return [{x:0,y:0,width:w,height:h},{x:w,y:0,width:w,height:h},{x:w/2,y:h,width:w,height:h}];
  return [{x:0,y:0,width:w,height:h},{x:w,y:0,width:w,height:h},{x:0,y:h,width:w,height:h},{x:w,y:h,width:w,height:h}];
}
export const mp4Types = ['video/mp4;codecs=avc1.420028,mp4a.40.2','video/mp4;codecs=avc1.42E028,mp4a.40.2','video/mp4;codecs=avc1.4d0028,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2'];
export function mp4Type(supports) {
  return mp4Types.find(supports)||'';
}

// Continuous capture is mapped to cycle passes without restarting the encoder.
export function recordingSegments(length, from, loop, offsetMs=0) {
  if (!Number.isFinite(length) || length <= 0) return [];
  if (!loop) {const place=recordingPlacement(from,offsetMs);return length-place.in>=.05?[{...place,out:length}]:[];}
  if (loop.end-loop.start<.1 || from<loop.start || from>=loop.end) throw Error('Invalid recording cycle.');
  const result=[];let input=Math.max(0,offsetMs/1000),start=from;
  while(input<length-.000001){const out=Math.min(length,input+loop.end-start);if(out-input>=.05)result.push({start,in:input,out});input=out;start=loop.start;}
  return result;
}
// Keep unaffected portions; only the newly performed interval is replaced.
export function replaceRange(clips, incoming, newId) {
  const end=endOf(incoming),result=[];
  for(const c of clips){
    if(endOf(c)<=incoming.start || c.start>=end){result.push(c);continue;}
    if(c.start<incoming.start)result.push({...c,out:c.in+incoming.start-c.start});
    if(endOf(c)>end)result.push({...c,id:newId(),start:end,in:c.in+end-c.start});
  }
  return [...result,incoming].sort((a,b)=>a.start-b.start);
}
export const countInSeconds = bpm => 8*60/bpm;
