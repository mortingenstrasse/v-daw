// Transient slice quantization: never stretches or pitch-shifts source media.
export function detectOnsets(channels,rate,from,to){
 const hop=Math.max(1,Math.round(rate*.004)),first=Math.floor(from*rate),last=Math.min(channels[0].length,Math.floor(to*rate));
 const energy=[];let peak=0;
 for(let i=first;i<last;i+=hop){let sum=0,n=0;for(let j=i;j<Math.min(i+hop,last);j++)for(const c of channels){sum+=c[j]*c[j];n++;}const rms=Math.sqrt(sum/Math.max(1,n));energy.push(rms);peak=Math.max(peak,rms);}
 if(peak<.001)return [];
 let floor=0,lastHit=-Infinity;const hits=[];
 for(let i=0;i<energy.length;i++){
  const e=energy[i],time=(first+i*hop)/rate;
  if(e>Math.max(.001,peak*.08,floor*2.2)&&time-lastHit>=.075){hits.push(time);lastHit=time;}
  floor=floor*.8+e*.2;
 }
 return hits;
}
export function quantizeClip(clip,onsets,bpm,division,strength,newId){
 if(!Number.isFinite(bpm)||bpm<=0||![4,8,16].includes(division)||!Number.isFinite(strength)||strength<0||strength>1)throw Error('Invalid quantize settings.');
 if(!strength)return [{...clip}];
 const end=clip.start+clip.out-clip.in,step=60/bpm*4/division;
 const hits=[...new Set(onsets)].filter(t=>t>=clip.in&&t<clip.out-.01).sort((a,b)=>a-b);
 if(!hits.length)return [{...clip}];
 const slices=[];
 // Preserve audio before the first detected attack.
 if(hits[0]>clip.in+.001)slices.push({...clip,out:hits[0]});
 for(let i=0;i<hits.length;i++){
  const source=hits[i],original=clip.start+source-clip.in,target=Math.round(original/step)*step;
  // Do not move a hit outside the selected region or overwrite its neighbours.
  const start=target<clip.start||target>=end?original:original+(target-original)*strength;
  if(slices.length&&start<=slices.at(-1).start+.005)continue; // keep an unsnappable hit in its preceding slice
  slices.push({...clip,id:newId(),start,in:source,out:clip.out,quantized:true});
 }
 for(let i=0;i<slices.length;i++){
  const c=slices[i],next=slices[i+1];
  c.out=Math.min(c.out,next?.in??clip.out,c.in+(next?.start??end)-c.start);
 }
 return slices.filter(c=>c.out-c.in>.001);
}
// Half-open elapsed window, independent of animation frames and timer cadence.
export function beatEvents(from,loop,bpm,lo,hi){
 const beat=60/bpm,events=[];
 if(hi<=lo||beat<=0)return events;
 const first=loop?loop.end-from:Infinity,len=loop?loop.end-loop.start:Infinity;
 let cycle=loop&&lo>=first?1+Math.floor((lo-first)/len):0;
 for(;;cycle++){
  const at=cycle===0?0:first+(cycle-1)*len,start=cycle===0?from:loop.start,end=loop?loop.end:Infinity;
  if(at>=hi)break;
  const a=Math.max(start,start+lo-at),b=Math.min(end,start+hi-at);
  for(let k=Math.ceil((a-1e-9)/beat);k*beat<b-1e-9;k++)events.push({at:at+k*beat-start,strong:k%4===0});
  if(!loop)break;
 }
 return events;
}

// Store edits in the region's source-coordinate space. Trim/split can keep the
// same immutable map while changing only the visible source window.
export function quantizeRegion(clip,onsets,bpm,division,strength){
 const {audioSlices,quantizeSettings,...original}=clip;
 if(!strength)return original;
 const parts=quantizeClip(original,onsets,bpm,division,strength,()=>original.id);
 return {...original,audioSlices:parts.map(p=>({start:original.in+p.start-original.start,in:p.in,out:p.out})),quantizeSettings:{bpm,division,strength}};
}
export function audioParts(clip){
 if(!clip.audioSlices)return [clip];
 return clip.audioSlices.flatMap(p=>{
  const start=Math.max(clip.in,p.start),end=Math.min(clip.out,p.start+p.out-p.in);
  return end>start?[{...clip,audioSlices:undefined,start:clip.start+start-clip.in,in:p.in+(start-p.start),out:p.in+(end-p.start),quantized:true}]:[];
 });
}
export function audioSourceTime(clip,time){
 if(!clip.audioSlices)return time;
 let lo=0,hi=clip.audioSlices.length;
 while(lo<hi){const mid=(lo+hi)>>1;if(clip.audioSlices[mid].start<=time)lo=mid+1;else hi=mid;}
 const p=clip.audioSlices[lo-1];return p&&time<p.start+p.out-p.in?p.in+(time-p.start):null;
}
